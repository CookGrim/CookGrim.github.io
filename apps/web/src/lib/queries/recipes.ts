import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { Recipe, RecipeInput, RecipeSummary } from "../../types/recipe";

export function useRecipes() {
  return useQuery({
    queryKey: ["recipes"],
    queryFn: () => api.get<RecipeSummary[]>("/api/recipes"),
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
