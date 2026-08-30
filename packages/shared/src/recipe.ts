// Schéma Zod canonique d'une recette envoyée à l'API (POST/PUT
// /api/recipes/:id, voir apps/api/src/routes/recipes.ts) — utilisé tel quel
// côté serveur pour valider la requête, et étendu côté web
// (apps/web/src/pages/RecipeFormPage.tsx) pour coercer les champs
// numériques (les <input> HTML ne produisent que des chaînes). Centralisé
// ici pour qu'une évolution du modèle (champ ajouté/renommé, contrainte
// changée) se propage aux deux sans les faire dériver l'une de l'autre.
import { z } from "zod";

export const ingredientInputSchema = z.object({
  name: z.string().min(1, "Nom manquant."),
  quantity: z.number().nullable(),
  unit: z.string().nullable(),
});

export const stepInputSchema = z.object({
  text: z.string().min(1, "Étape vide."),
});

export const recipeInputSchema = z.object({
  title: z.string().min(1, "Le titre est obligatoire."),
  servings: z.number().int().positive().nullable(),
  prepTimeMinutes: z.number().int().nonnegative().nullable(),
  cookTimeMinutes: z.number().int().nonnegative().nullable(),
  cookTempCelsius: z.number().int().nonnegative().nullable(),
  photoUrl: z.string().url().nullable(),
  notes: z.string().nullable(),
  ingredients: z.array(ingredientInputSchema).min(1, "Ajoutez au moins un ingrédient."),
  steps: z.array(stepInputSchema).min(1, "Ajoutez au moins une étape."),
});

export type IngredientInput = z.infer<typeof ingredientInputSchema>;
export type StepInput = z.infer<typeof stepInputSchema>;
export type RecipeInput = z.infer<typeof recipeInputSchema>;
