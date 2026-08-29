import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { PantryItem, PantryItemInput } from "../../types/pantry";

export function usePantry() {
  return useQuery({
    queryKey: ["pantry"],
    queryFn: () => api.get<PantryItem[]>("/api/pantry"),
  });
}

// Le stock change → le badge "manquants" de RecipesPage (useMissingCounts)
// doit se recalculer, donc on invalide les deux à chaque mutation.
function invalidatePantry(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["pantry"] });
  queryClient.invalidateQueries({ queryKey: ["recipes", "missing-counts"] });
}

export function useCreatePantryItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PantryItemInput) => api.post<PantryItem>("/api/pantry", input),
    onSuccess: () => invalidatePantry(queryClient),
  });
}

export function useUpdatePantryItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: Partial<PantryItemInput> & { id: string }) =>
      api.patch<PantryItem>(`/api/pantry/${id}`, input),
    onSuccess: () => invalidatePantry(queryClient),
  });
}

export function useDeletePantryItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del(`/api/pantry/${id}`),
    onSuccess: () => invalidatePantry(queryClient),
  });
}
