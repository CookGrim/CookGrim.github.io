import { and, desc, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db/client.js";
import { ingredients, pantryItems, recipes, shoppingListItems, shoppingLists } from "../db/schema.js";
import { aggregateIngredients } from "../lib/aggregate-ingredients.js";
import { deductPantryFromAggregated, planPantryAdjustment } from "../lib/pantry-match.js";
import { requireAuth } from "../middleware/require-auth.js";
import type { AppEnv } from "../types.js";

export const shoppingListsRoute = new Hono<AppEnv>();
shoppingListsRoute.use("*", requireAuth);

// GET /api/shopping-lists — les listes du groupe (sans le détail des lignes)
shoppingListsRoute.get("/", async (c) => {
  const groupId = c.get("groupId");
  const rows = await db
    .select()
    .from(shoppingLists)
    .where(eq(shoppingLists.groupId, groupId))
    .orderBy(desc(shoppingLists.createdAt));
  return c.json(rows);
});

// GET /api/shopping-lists/:id — détail avec les lignes
shoppingListsRoute.get("/:id", async (c) => {
  const groupId = c.get("groupId");
  const id = c.req.param("id");
  const [list] = await db
    .select()
    .from(shoppingLists)
    .where(and(eq(shoppingLists.id, id), eq(shoppingLists.groupId, groupId)));
  if (!list) return c.json({ message: "Liste introuvable." }, 404);

  const items = await db
    .select()
    .from(shoppingListItems)
    .where(eq(shoppingListItems.shoppingListId, id));
  return c.json({ ...list, items: items.sort((a, b) => a.position - b.position) });
});

const createInput = z.object({
  name: z.string().min(1).optional(),
  recipes: z
    .array(z.object({ recipeId: z.string().min(1), multiplier: z.number().positive().default(1) }))
    .min(1, "Sélectionnez au moins une recette."),
});

// POST /api/shopping-lists — compose une liste à partir de recettes choisies
// (avec multiplicateur de portions), agrège les ingrédients communs.
shoppingListsRoute.post("/", async (c) => {
  const user = c.get("user");
  const groupId = c.get("groupId");
  const parsed = createInput.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ message: "Requête invalide.", issues: parsed.error.issues }, 400);
  }
  const { name, recipes: selection } = parsed.data;
  const recipeIds = selection.map((s) => s.recipeId);

  // On ne peut composer qu'à partir des recettes de SON groupe.
  const owned = await db
    .select({ id: recipes.id })
    .from(recipes)
    .where(and(inArray(recipes.id, recipeIds), eq(recipes.groupId, groupId)));
  if (owned.length !== recipeIds.length) {
    return c.json({ message: "Une ou plusieurs recettes sont introuvables." }, 404);
  }

  const [allIngredients, pantry] = await Promise.all([
    db.select().from(ingredients).where(inArray(ingredients.recipeId, recipeIds)),
    db.select().from(pantryItems).where(eq(pantryItems.groupId, groupId)),
  ]);

  const multipliers = Object.fromEntries(selection.map((s) => [s.recipeId, s.multiplier]));
  const aggregated = aggregateIngredients(
    allIngredients.map((i) => ({
      recipeId: i.recipeId,
      name: i.name,
      quantity: i.quantity,
      unit: i.unit,
    })),
    multipliers,
  );

  // Ce qu'il reste réellement à acheter une fois le stock déduit — une ligne
  // entièrement couverte disparaît, une ligne partielle ne garde que le
  // manquant (voir lib/pantry-match.ts).
  const toBuy = deductPantryFromAggregated(aggregated, pantry);
  const pantryDeductedCount = aggregated.length - toBuy.length;

  const created = await db.transaction(async (tx) => {
    const [list] = await tx
      .insert(shoppingLists)
      .values({ userId: user.id, groupId, name: name ?? "Liste de courses" })
      .returning();

    if (toBuy.length > 0) {
      await tx.insert(shoppingListItems).values(
        toBuy.map((item, position) => ({
          shoppingListId: list.id,
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          sourceRecipeIds: item.sourceRecipeIds,
          position,
        })),
      );
    }
    return list;
  });

  const items = await db
    .select()
    .from(shoppingListItems)
    .where(eq(shoppingListItems.shoppingListId, created.id));
  // pantryDeductedCount n'est pas persisté : c'est une info ponctuelle pour
  // le front au moment de la génération ("N articles déjà dans votre stock").
  return c.json({ ...created, items, pantryDeductedCount }, 201);
});

const patchItemInput = z.object({ checked: z.boolean() });

// PATCH /api/shopping-lists/:id/items/:itemId — coche/décoche une ligne.
// Cocher = acheté : on ajoute la quantité au stock. Décocher = annulation :
// on la retire (voir lib/pantry-match.ts, planPantryAdjustment).
shoppingListsRoute.patch("/:id/items/:itemId", async (c) => {
  const user = c.get("user");
  const groupId = c.get("groupId");
  const { id, itemId } = c.req.param();
  const parsed = patchItemInput.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ message: "Requête invalide." }, 400);

  const [list] = await db
    .select({ id: shoppingLists.id })
    .from(shoppingLists)
    .where(and(eq(shoppingLists.id, id), eq(shoppingLists.groupId, groupId)));
  if (!list) return c.json({ message: "Liste introuvable." }, 404);

  const [item] = await db
    .select()
    .from(shoppingListItems)
    .where(and(eq(shoppingListItems.id, itemId), eq(shoppingListItems.shoppingListId, id)));
  if (!item) return c.json({ message: "Article introuvable." }, 404);

  await db
    .update(shoppingListItems)
    .set({ checked: parsed.data.checked })
    .where(and(eq(shoppingListItems.id, itemId), eq(shoppingListItems.shoppingListId, id)));

  if (parsed.data.checked !== item.checked) {
    const pantry = await db.select().from(pantryItems).where(eq(pantryItems.groupId, groupId));
    const adjustment = planPantryAdjustment(
      { name: item.name, quantity: item.quantity, unit: item.unit },
      pantry,
      parsed.data.checked ? 1 : -1,
    );

    if (adjustment.kind === "update") {
      await db
        .update(pantryItems)
        .set({ quantity: adjustment.quantity, updatedAt: new Date().toISOString() })
        .where(eq(pantryItems.id, adjustment.id));
    } else if (adjustment.kind === "create") {
      await db.insert(pantryItems).values({
        userId: user.id,
        groupId,
        name: adjustment.name,
        quantity: adjustment.quantity,
        unit: adjustment.unit,
      });
    }
  }

  return c.body(null, 204);
});

const renameInput = z.object({
  name: z.string().trim().min(1, "Le nom est requis.").max(60, "60 caractères maximum."),
});

// PATCH /api/shopping-lists/:id — renomme une liste
shoppingListsRoute.patch("/:id", async (c) => {
  const groupId = c.get("groupId");
  const id = c.req.param("id");
  const parsed = renameInput.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ message: "Requête invalide.", issues: parsed.error.issues }, 400);
  }

  const [list] = await db
    .select({ id: shoppingLists.id })
    .from(shoppingLists)
    .where(and(eq(shoppingLists.id, id), eq(shoppingLists.groupId, groupId)));
  if (!list) return c.json({ message: "Liste introuvable." }, 404);

  await db.update(shoppingLists).set({ name: parsed.data.name }).where(eq(shoppingLists.id, id));
  return c.body(null, 204);
});

// DELETE /api/shopping-lists/:id
shoppingListsRoute.delete("/:id", async (c) => {
  const groupId = c.get("groupId");
  const id = c.req.param("id");
  const [list] = await db
    .select({ id: shoppingLists.id })
    .from(shoppingLists)
    .where(and(eq(shoppingLists.id, id), eq(shoppingLists.groupId, groupId)));
  if (!list) return c.json({ message: "Liste introuvable." }, 404);

  await db.delete(shoppingLists).where(eq(shoppingLists.id, id));
  return c.body(null, 204);
});
