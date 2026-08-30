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
  // Renseigné quand cette recette est une copie reçue via
  // POST /api/recipes/:id/shares — simple mention d'origine, jamais mis à
  // jour ensuite (voir apps/api/src/db/schema.ts).
  sharedFromPseudo: string | null;
  createdAt: string;
  updatedAt: string;
  // Marqueur purement client, jamais renvoyé par l'API : présent tant qu'une
  // recette créée hors-ligne (voir lib/offline-queue.ts, lib/offline-sync.ts)
  // n'a pas encore été synchronisée, ou si la synchronisation a
  // définitivement échoué (ex. session expirée entre-temps).
  syncStatus?: "pending" | "failed";
};

// GET /api/recipes/:id — détail complet
export type Recipe = RecipeSummary & {
  ingredients: Ingredient[];
  steps: Step[];
};

// GET /api/recipes/shared/:token — vue publique, sans notes ni userId
export type SharedRecipe = Omit<Recipe, "notes" | "userId">;

// GET /api/recipes/missing-counts — ingrédients manquants par recette,
// comparés au stock courant (voir apps/api/src/lib/pantry-match.ts).
export type MissingCount = {
  recipeId: string;
  missingCount: number;
  totalCount: number;
};

// Réponse de POST /api/recipes/:id/consume — quel ingrédient a réellement
// été décompté du stock (voir apps/api/src/lib/pantry-match.ts,
// planPantryAdjustment) vs. ignoré (absent du stock, ou quantité non suivie
// type "j'en ai").
export type ConsumeRecipeResult = {
  summary: { name: string; decremented: boolean }[];
};

// Réponse de POST /api/recipes/:id/shares — copie de la recette envoyée
// directement dans le compte du pseudo visé (voir routes/recipes.ts).
export type ShareRecipeWithUserResult = {
  pseudo: string;
  recipeId: string;
};

// Réponse de POST /api/recipes/extract — brouillon à relire, jamais
// sauvegardé automatiquement.
export type ExtractedRecipe = {
  title: string;
  servings: number | null;
  ingredients: { name: string; quantity: number | null; unit: string | null }[];
  steps: string[];
};

// Champs envoyés par le formulaire de création/édition — type dérivé du
// schéma Zod partagé avec l'API (voir packages/shared/src/recipe.ts), pour
// que les deux ne dérivent pas l'un de l'autre.
export type { RecipeInput } from "@cookgrim/shared";
