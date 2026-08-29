// Modèle de données CookGrim — reflète les réponses JSON de apps/api
// (voir apps/api/src/db/schema.ts et apps/api/src/routes/recipes.ts).

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

// GET /api/recipes — liste, sans ingrédients/étapes
export type RecipeSummary = {
  id: string;
  userId: string;
  title: string;
  servings: number | null;
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
  cookTempCelsius: number | null;
  photoUrl: string | null;
  notes: string | null;
  shareToken: string | null;
  createdAt: string;
  updatedAt: string;
};

// GET /api/recipes/:id — détail complet
export type Recipe = RecipeSummary & {
  ingredients: Ingredient[];
  steps: Step[];
};

// GET /api/recipes/shared/:token — vue publique, sans notes ni userId
export type SharedRecipe = Omit<Recipe, "notes" | "userId">;

// Réponse de POST /api/recipes/extract — brouillon à relire, jamais
// sauvegardé automatiquement.
export type ExtractedRecipe = {
  title: string;
  servings: number | null;
  ingredients: { name: string; quantity: number | null; unit: string | null }[];
  steps: string[];
};

// Champs envoyés par le formulaire de création/édition.
export type RecipeInput = {
  title: string;
  servings: number | null;
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
  cookTempCelsius: number | null;
  photoUrl: string | null;
  notes: string | null;
  ingredients: { name: string; quantity: number | null; unit: string | null }[];
  steps: { text: string }[];
};
