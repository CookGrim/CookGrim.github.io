import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db/client.js";
import { ingredients, recipes, steps } from "../db/schema.js";
import { requireAuth } from "../middleware/require-auth.js";
import type { AppEnv } from "../types.js";

export const recipesRoute = new Hono<AppEnv>();

const ingredientInput = z.object({
  name: z.string().min(1),
  quantity: z.number().nullable(),
  unit: z.string().nullable(),
});

const stepInput = z.object({ text: z.string().min(1) });

const recipeInput = z.object({
  title: z.string().min(1, "Le titre est obligatoire."),
  servings: z.number().int().positive().nullable(),
  prepTimeMinutes: z.number().int().nonnegative().nullable(),
  cookTimeMinutes: z.number().int().nonnegative().nullable(),
  photoUrl: z.string().url().nullable(),
  notes: z.string().nullable(),
  ingredients: z.array(ingredientInput).min(1, "Ajoutez au moins un ingrédient."),
  steps: z.array(stepInput).min(1, "Ajoutez au moins une étape."),
});

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
  const parsed = recipeInput.safeParse(await c.req.json());
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
  const parsed = recipeInput.safeParse(await c.req.json());
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
