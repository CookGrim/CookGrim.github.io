import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type {
  ExtractedRecipe,
  MissingCount,
  Recipe,
  RecipeInput,
  RecipeSummary,
  SharedRecipe,
} from "../../types/recipe";
import type { CompressedImage } from "../compress-image";

export function useRecipes() {
  return useQuery({
    queryKey: ["recipes"],
    queryFn: () => api.get<RecipeSummary[]>("/api/recipes"),
  });
}

// Nombre d'ingrédients manquants par recette, comparé au stock courant —
// alimente le badge sur RecipesPage. Recalculé à chaque changement de stock
// ou de recette (voir invalidations dans queries/pantry.ts).
export function useMissingCounts() {
  return useQuery({
    queryKey: ["recipes", "missing-counts"],
    queryFn: () => api.get<MissingCount[]>("/api/recipes/missing-counts"),
  });
}

export function useRecipe(id: string | undefined) {
  return useQuery({
    queryKey: ["recipes", id],
    queryFn: () => api.get<Recipe>(`/api/recipes/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateRecipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RecipeInput) => api.post<Recipe>("/api/recipes", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["recipes"] }),
  });
}

export function useDeleteRecipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del(`/api/recipes/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["recipes"] }),
  });
}

export function useShareRecipe(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ shareToken: string }>(`/api/recipes/${id}/share`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["recipes", id] }),
  });
}

export function useUnshareRecipe(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.del(`/api/recipes/${id}/share`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["recipes", id] }),
  });
}

export function useExtractRecipe() {
  return useMutation({
    mutationFn: (image: CompressedImage) =>
      api.post<ExtractedRecipe>("/api/recipes/extract", {
        imageBase64: image.base64,
        mediaType: image.mediaType,
      }),
  });
}

// Route publique : pas besoin d'être connecté pour consulter un lien partagé.
export function useSharedRecipe(token: string | undefined) {
  return useQuery({
    queryKey: ["shared-recipe", token],
    queryFn: () => api.get<SharedRecipe>(`/api/recipes/shared/${token}`),
    enabled: Boolean(token),
    retry: false,
  });
}
