import { pseudoToEmail, recipeInputSchema } from "@cookgrim/shared";
import { and, desc, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db/client.js";
import { user } from "../db/auth-schema.js";
import { ingredients, pantryItems, recipes, steps } from "../db/schema.js";
import { computeMissing, planPantryAdjustment } from "../lib/pantry-match.js";
import { isRateLimited } from "../lib/rate-limit.js";
import { requireAuth } from "../middleware/require-auth.js";
import type { AppEnv } from "../types.js";

export const recipesRoute = new Hono<AppEnv>();

async function loadFullRecipe(recipeId: string) {
  const [recipe] = await db.select().from(recipes).where(eq(recipes.id, recipeId));
  if (!recipe) return null;

  const [recipeIngredients, recipeSteps] = await Promise.all([
    db.select().from(ingredients).where(eq(ingredients.recipeId, recipeId)),
    db.select().from(steps).where(eq(steps.recipeId, recipeId)),
  ]);

  return {
    ...recipe,
    ingredients: recipeIngredients.sort((a, b) => a.position - b.position),
    steps: recipeSteps.sort((a, b) => a.position - b.position),
  };
}

// GET /api/recipes — liste des recettes de l'utilisateur (sans le détail)
recipesRoute.get("/", requireAuth, async (c) => {
  const user = c.get("user");
  const rows = await db
    .select()
    .from(recipes)
    .where(eq(recipes.userId, user.id))
    .orderBy(desc(recipes.updatedAt));
  return c.json(rows);
});

// POST /api/recipes — crée une recette + ses ingrédients + ses étapes
recipesRoute.post("/", requireAuth, async (c) => {
  const user = c.get("user");
  const parsed = recipeInputSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ message: "Recette invalide.", issues: parsed.error.issues }, 400);
  }
  const input = parsed.data;

  const created = await db.transaction(async (tx) => {
    const [recipe] = await tx
      .insert(recipes)
      .values({
        userId: user.id,
        title: input.title,
        servings: input.servings,
        prepTimeMinutes: input.prepTimeMinutes,
        cookTimeMinutes: input.cookTimeMinutes,
        cookTempCelsius: input.cookTempCelsius,
        photoUrl: input.photoUrl,
        notes: input.notes,
      })
      .returning();

    if (input.ingredients.length > 0) {
      await tx.insert(ingredients).values(
        input.ingredients.map((ing, position) => ({
          recipeId: recipe.id,
          name: ing.name,
          quantity: ing.quantity,
          unit: ing.unit,
          position,
        })),
      );
    }

    if (input.steps.length > 0) {
      await tx.insert(steps).values(
        input.steps.map((step, position) => ({
          recipeId: recipe.id,
          text: step.text,
          position,
        })),
      );
    }

    return recipe;
  });

  return c.json(await loadFullRecipe(created.id), 201);
});

// GET /api/recipes/missing-counts — nombre d'ingrédients manquants par
// recette, comparé au stock courant (voir lib/pantry-match.ts). Enregistrée
// avant /:id pour ne jamais être capturée par ce paramètre dynamique.
recipesRoute.get("/missing-counts", requireAuth, async (c) => {
  const user = c.get("user");
  const userRecipes = await db
    .select({ id: recipes.id })
    .from(recipes)
    .where(eq(recipes.userId, user.id));
  const recipeIds = userRecipes.map((r) => r.id);
  if (recipeIds.length === 0) return c.json([]);

  const [allIngredients, pantry] = await Promise.all([
    db.select().from(ingredients).where(inArray(ingredients.recipeId, recipeIds)),
    db.select().from(pantryItems).where(eq(pantryItems.userId, user.id)),
  ]);

  const ingredientsByRecipe = new Map<string, typeof allIngredients>();
  for (const ing of allIngredients) {
    const list = ingredientsByRecipe.get(ing.recipeId);
    if (list) list.push(ing);
    else ingredientsByRecipe.set(ing.recipeId, [ing]);
  }

  const result = recipeIds.map((recipeId) => ({
    recipeId,
    ...computeMissing(ingredientsByRecipe.get(recipeId) ?? [], pantry),
  }));

  return c.json(result);
});

// GET /api/recipes/:id — détail (propriétaire uniquement)
recipesRoute.get("/:id", requireAuth, async (c) => {
  const user = c.get("user");
  const recipe = await loadFullRecipe(c.req.param("id"));
  if (!recipe || recipe.userId !== user.id) {
    return c.json({ message: "Recette introuvable." }, 404);
  }
  return c.json(recipe);
});

// PUT /api/recipes/:id — remplace les champs + réécrit ingrédients/étapes
recipesRoute.put("/:id", requireAuth, async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const parsed = recipeInputSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ message: "Recette invalide.", issues: parsed.error.issues }, 400);
  }
  const input = parsed.data;

  const [existing] = await db.select().from(recipes).where(eq(recipes.id, id));
  if (!existing || existing.userId !== user.id) {
    return c.json({ message: "Recette introuvable." }, 404);
  }

  await db.transaction(async (tx) => {
    await tx
      .update(recipes)
      .set({
        title: input.title,
        servings: input.servings,
        prepTimeMinutes: input.prepTimeMinutes,
        cookTimeMinutes: input.cookTimeMinutes,
        cookTempCelsius: input.cookTempCelsius,
        photoUrl: input.photoUrl,
        notes: input.notes,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(recipes.id, id));

    await tx.delete(ingredients).where(eq(ingredients.recipeId, id));
    await tx.delete(steps).where(eq(steps.recipeId, id));

    if (input.ingredients.length > 0) {
      await tx.insert(ingredients).values(
        input.ingredients.map((ing, position) => ({
          recipeId: id,
          name: ing.name,
          quantity: ing.quantity,
          unit: ing.unit,
          position,
        })),
      );
    }
    if (input.steps.length > 0) {
      await tx.insert(steps).values(
        input.steps.map((step, position) => ({ recipeId: id, text: step.text, position })),
      );
    }
  });

  return c.json(await loadFullRecipe(id));
});

// DELETE /api/recipes/:id
recipesRoute.delete("/:id", requireAuth, async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const [existing] = await db.select().from(recipes).where(eq(recipes.id, id));
  if (!existing || existing.userId !== user.id) {
    return c.json({ message: "Recette introuvable." }, 404);
  }
  await db.delete(recipes).where(eq(recipes.id, id));
  return c.body(null, 204);
});

const consumeInput = z.object({
  multiplier: z.number().positive().default(1),
});

// POST /api/recipes/:id/consume — décompte le stock après avoir cuisiné la
// recette (voir lib/pantry-match.ts, planPantryAdjustment avec direction -1,
// même règle de correspondance que la liste de courses). Ne touche jamais aux
// lignes "j'en ai" (quantité non suivie) ni aux ingrédients absents du
// stock : seul ce qui est réellement en stock diminue, jamais sous zéro.
recipesRoute.post("/:id/consume", requireAuth, async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const parsed = consumeInput.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return c.json({ message: "Requête invalide.", issues: parsed.error.issues }, 400);
  }

  const [recipe] = await db
    .select({ id: recipes.id })
    .from(recipes)
    .where(and(eq(recipes.id, id), eq(recipes.userId, user.id)));
  if (!recipe) return c.json({ message: "Recette introuvable." }, 404);

  const recipeIngredients = await db.select().from(ingredients).where(eq(ingredients.recipeId, id));
  let pantry = await db.select().from(pantryItems).where(eq(pantryItems.userId, user.id));

  const updates = new Map<string, number>();
  const summary: { name: string; decremented: boolean }[] = [];

  for (const ing of recipeIngredients) {
    const quantity = ing.quantity === null ? null : ing.quantity * parsed.data.multiplier;
    const adjustment = planPantryAdjustment({ name: ing.name, quantity, unit: ing.unit }, pantry, -1);

    if (adjustment.kind === "update") {
      updates.set(adjustment.id, adjustment.quantity);
      // Répercuté tout de suite sur la copie locale : si une deuxième ligne
      // de la recette retombe sur le même article de stock, elle doit voir
      // la quantité déjà décomptée, pas l'originale.
      pantry = pantry.map((p) => (p.id === adjustment.id ? { ...p, quantity: adjustment.quantity } : p));
      summary.push({ name: ing.name, decremented: true });
    } else {
      // "none" : ingrédient absent du stock, quantité non suivie ("j'en ai"),
      // ou sans quantité exploitable — jamais de "create" en sens -1.
      summary.push({ name: ing.name, decremented: false });
    }
  }

  if (updates.size > 0) {
    await db.transaction(async (tx) => {
      for (const [pantryId, quantity] of updates) {
        await tx
          .update(pantryItems)
          .set({ quantity, updatedAt: new Date().toISOString() })
          .where(eq(pantryItems.id, pantryId));
      }
    });
  }

  return c.json({ summary });
});

const shareWithUserInput = z.object({
  pseudo: z.string().trim().min(1, "Le pseudo est obligatoire."),
});

// POST /api/recipes/:id/shares — copie immédiate de la recette dans le
// compte d'un autre utilisateur, désigné par son pseudo. Pas de lien vivant
// avec l'original ni de session requise côté destinataire : la copie
// atterrit directement chez lui, comme le fait déjà "Importer dans mes
// recettes" depuis un lien public (voir GET /shared/:token côté web), mais
// sans passer par un lien à faire suivre.
// 20/heure/expéditeur : c'est aussi la seule route de l'app qui répond
// différemment selon qu'un pseudo existe ou non ("Pseudo introuvable.") —
// cette limite empêche un compte authentifié de s'en servir pour sonder
// l'espace des pseudos en boucle.
const SHARE_RATE_LIMIT = { max: 20, windowMs: 60 * 60 * 1000 };

recipesRoute.post("/:id/shares", requireAuth, async (c) => {
  const sender = c.get("user");
  if (isRateLimited(`share:${sender.id}`, SHARE_RATE_LIMIT.max, SHARE_RATE_LIMIT.windowMs)) {
    return c.json({ message: "Trop d'envois, réessayez plus tard." }, 429);
  }

  const id = c.req.param("id");
  const parsed = shareWithUserInput.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ message: "Requête invalide.", issues: parsed.error.issues }, 400);
  }

  const source = await loadFullRecipe(id);
  if (!source || source.userId !== sender.id) {
    return c.json({ message: "Recette introuvable." }, 404);
  }

  const [recipient] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, pseudoToEmail(parsed.data.pseudo)));
  if (!recipient) return c.json({ message: "Pseudo introuvable." }, 404);
  if (recipient.id === sender.id) {
    return c.json({ message: "Vous ne pouvez pas vous partager une recette à vous-même." }, 400);
  }

  const copy = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(recipes)
      .values({
        userId: recipient.id,
        title: source.title,
        servings: source.servings,
        prepTimeMinutes: source.prepTimeMinutes,
        cookTimeMinutes: source.cookTimeMinutes,
        cookTempCelsius: source.cookTempCelsius,
        photoUrl: source.photoUrl,
        notes: null, // les notes privées ne sont jamais copiées
        sharedFromPseudo: sender.name,
      })
      .returning();

    if (source.ingredients.length > 0) {
      await tx.insert(ingredients).values(
        source.ingredients.map((ing, position) => ({
          recipeId: created.id,
          name: ing.name,
          quantity: ing.quantity,
          unit: ing.unit,
          position,
        })),
      );
    }
    if (source.steps.length > 0) {
      await tx.insert(steps).values(
        source.steps.map((step, position) => ({ recipeId: created.id, text: step.text, position })),
      );
    }
    return created;
  });

  return c.json({ pseudo: parsed.data.pseudo, recipeId: copy.id }, 201);
});

// POST /api/recipes/:id/share — (re)génère le lien public, révoque l'ancien
recipesRoute.post("/:id/share", requireAuth, async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const [existing] = await db
    .select()
    .from(recipes)
    .where(and(eq(recipes.id, id), eq(recipes.userId, user.id)));
  if (!existing) return c.json({ message: "Recette introuvable." }, 404);

  const shareToken = crypto.randomUUID();
  await db.update(recipes).set({ shareToken }).where(eq(recipes.id, id));
  return c.json({ shareToken });
});

// DELETE /api/recipes/:id/share — révoque le lien public
recipesRoute.delete("/:id/share", requireAuth, async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const [existing] = await db
    .select()
    .from(recipes)
    .where(and(eq(recipes.id, id), eq(recipes.userId, user.id)));
  if (!existing) return c.json({ message: "Recette introuvable." }, 404);

  await db.update(recipes).set({ shareToken: null }).where(eq(recipes.id, id));
  return c.body(null, 204);
});

// GET /api/recipes/shared/:token — lecture publique, pas d'auth requise.
// Les notes privées ne sont jamais renvoyées ici, quel que soit l'appelant.
recipesRoute.get("/shared/:token", async (c) => {
  const token = c.req.param("token");
  const [recipe] = await db.select().from(recipes).where(eq(recipes.shareToken, token));
  if (!recipe) return c.json({ message: "Lien invalide ou révoqué." }, 404);

  const full = await loadFullRecipe(recipe.id);
  if (!full) return c.json({ message: "Lien invalide ou révoqué." }, 404);
  const { notes: _notes, userId: _userId, ...publicRecipe } = full;
  return c.json(publicRecipe);
});
