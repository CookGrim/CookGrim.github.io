// Modèle du stock d'ingrédients — reflète apps/api/src/db/schema.ts (pantryItems)
// et apps/api/src/routes/pantry.ts.

export type PantryItem = {
  id: string;
  userId: string;
  name: string;
  quantity: number | null; // null = "j'en ai", quantité non suivie
  unit: string | null;
  updatedAt: string;
};

export type PantryItemInput = {
  name: string;
  quantity: number | null;
  unit: string | null;
};
