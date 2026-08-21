import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type {
  CreateShoppingListInput,
  ShoppingList,
  ShoppingListSummary,
} from "../../types/shopping-list";

export function useShoppingLists() {
  return useQuery({
    queryKey: ["shopping-lists"],
    queryFn: () => api.get<ShoppingListSummary[]>("/api/shopping-lists"),
  });
}

export function useShoppingList(id: string | undefined) {
  return useQuery({
    queryKey: ["shopping-lists", id],
    queryFn: () => api.get<ShoppingList>(`/api/shopping-lists/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateShoppingList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateShoppingListInput) =>
      api.post<ShoppingList>("/api/shopping-lists", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["shopping-lists"] }),
  });
}

export function useToggleShoppingListItem(listId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, checked }: { itemId: string; checked: boolean }) =>
      api.patch<void>(`/api/shopping-lists/${listId}/items/${itemId}`, { checked }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["shopping-lists", listId] }),
  });
}
