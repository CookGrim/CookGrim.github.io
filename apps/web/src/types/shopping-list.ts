export type ShoppingListItem = {
  id: string;
  shoppingListId: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  category: string | null;
  checked: boolean;
  position: number;
  sourceRecipeIds: string[];
};

// GET /api/shopping-lists — sans les lignes
export type ShoppingListSummary = {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
};

// GET/POST /api/shopping-lists/:id — avec les lignes
export type ShoppingList = ShoppingListSummary & {
  items: ShoppingListItem[];
};

export type CreateShoppingListInput = {
  name?: string;
  recipes: { recipeId: string; multiplier: number }[];
};
