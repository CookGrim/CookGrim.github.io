import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db/client.js";
import { pantryItems } from "../db/schema.js";
import { requireAuth } from "../middleware/require-auth.js";
import type { AppEnv } from "../types.js";

export const pantryRoute = new Hono<AppEnv>();
pantryRoute.use("*", requireAuth);

// GET /api/pantry — le stock du groupe
pantryRoute.get("/", async (c) => {
  const groupId = c.get("groupId");
  const rows = await db
    .select()
    .from(pantryItems)
    .where(eq(pantryItems.groupId, groupId))
    .orderBy(pantryItems.name);
  return c.json(rows);
});

const pantryItemInput = z.object({
  name: z.string().min(1, "Le nom est obligatoire."),
  quantity: z.number().nullable(),
  unit: z.string().nullable(),
});

// POST /api/pantry — ajoute un item au stock du groupe
pantryRoute.post("/", async (c) => {
  const user = c.get("user");
  const groupId = c.get("groupId");
  const parsed = pantryItemInput.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ message: "Item invalide.", issues: parsed.error.issues }, 400);
  }
  const [item] = await db
    .insert(pantryItems)
    .values({ userId: user.id, groupId, ...parsed.data })
    .returning();
  return c.json(item, 201);
});

const pantryItemPatchInput = pantryItemInput.partial();

// PATCH /api/pantry/:id — modifie un item (nom/quantité/unité)
pantryRoute.patch("/:id", async (c) => {
  const groupId = c.get("groupId");
  const id = c.req.param("id");
  const parsed = pantryItemPatchInput.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ message: "Item invalide.", issues: parsed.error.issues }, 400);
  }

  const [existing] = await db
    .select({ id: pantryItems.id })
    .from(pantryItems)
    .where(and(eq(pantryItems.id, id), eq(pantryItems.groupId, groupId)));
  if (!existing) return c.json({ message: "Item introuvable." }, 404);

  const [updated] = await db
    .update(pantryItems)
    .set({ ...parsed.data, updatedAt: new Date().toISOString() })
    .where(eq(pantryItems.id, id))
    .returning();
  return c.json(updated);
});

// DELETE /api/pantry/:id
pantryRoute.delete("/:id", async (c) => {
  const groupId = c.get("groupId");
  const id = c.req.param("id");
  const [existing] = await db
    .select({ id: pantryItems.id })
    .from(pantryItems)
    .where(and(eq(pantryItems.id, id), eq(pantryItems.groupId, groupId)));
  if (!existing) return c.json({ message: "Item introuvable." }, 404);

  await db.delete(pantryItems).where(eq(pantryItems.id, id));
  return c.body(null, 204);
});
