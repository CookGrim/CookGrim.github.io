// Modèle de données CookGrim — reflète le schéma Postgres (voir supabase/schema.sql).

export type Ingredient = {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  position: number;
};

export type Step = {
  id: string;
  position: number;
  text: string;
};

export type Recipe = {
  id: string;
  userId: string;
  title: string;
  servings: number | null;
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
  photoUrl: string | null;
  notes: string | null;
  shareToken: string | null;
  ingredients: Ingredient[];
  steps: Step[];
  createdAt: string;
  updatedAt: string;
};

export type ShoppingListItem = {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  category: string | null;
  checked: boolean;
  position: number;
  sourceRecipeIds: string[];
};

export type ShoppingList = {
  id: string;
  userId: string;
  name: string;
  items: ShoppingListItem[];
  createdAt: string;
};

// Champs éditables d'un formulaire recette, avant qu'un id/timestamps existent.
export type RecipeDraft = Omit<
  Recipe,
  "id" | "userId" | "shareToken" | "createdAt" | "updatedAt"
>;

export const emptyRecipeDraft: RecipeDraft = {
  title: "",
  servings: 4,
  prepTimeMinutes: null,
  cookTimeMinutes: null,
  photoUrl: null,
  notes: null,
  ingredients: [],
  steps: [],
};
