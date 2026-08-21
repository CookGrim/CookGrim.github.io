import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, isRetryableError } from "../api";
import { enqueue } from "../offline-queue";
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

// Coche/décoche un article — le geste le plus courant hors-ligne (au
// magasin, connexion capricieuse). En cas d'échec réseau (pas une vraie
// erreur serveur), la requête part dans la file d'attente et sera rejouée
// à la reconnexion (voir offline-sync.ts) ; l'écran reste à jour dans
// l'intervalle grâce à la mise à jour optimiste ci-dessous.
export function useToggleShoppingListItem(listId: string) {
  const queryClient = useQueryClient();
  const queryKey = ["shopping-lists", listId];

  return useMutation({
    mutationFn: async ({ itemId, checked }: { itemId: string; checked: boolean }) => {
      const path = `/api/shopping-lists/${listId}/items/${itemId}`;
      try {
        await api.patch<void>(path, { checked });
      } catch (err) {
        if (!isRetryableError(err)) throw err; // vraie erreur serveur (4xx), pas un souci réseau
        await enqueue({ method: "PATCH", path, body: { checked } });
      }
    },
    onMutate: async ({ itemId, checked }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ShoppingList>(queryKey);
      if (previous) {
        queryClient.setQueryData<ShoppingList>(queryKey, {
          ...previous,
          items: previous.items.map((item) =>
            item.id === itemId ? { ...item, checked } : item,
          ),
        });
      }
      return { previous };
    },
    onError: (err, _vars, context) => {
      // On ne défait l'optimisme qu'en cas de vraie erreur serveur — un
      // échec réseau/5xx reste affiché tel quel, il est en file d'attente.
      if (!isRetryableError(err) && context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
  });
}
