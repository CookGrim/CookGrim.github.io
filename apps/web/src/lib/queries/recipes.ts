import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { api, isRetryableError } from "../api";
import { createTempId, enqueue, isTempId, removeQueuedByTempId } from "../offline-queue";
import type {
  ConsumeRecipeResult,
  ExtractedRecipe,
  MissingCount,
  Recipe,
  RecipeInput,
  RecipeSummary,
  ShareRecipeWithUserResult,
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
    // Un id "temp-…" (recette créée hors-ligne, pas encore synchronisée —
    // voir createRecipeOffline ci-dessous) n'existe pas côté serveur : ne
    // jamais l'interroger, la donnée déjà posée dans le cache par
    // createRecipeOffline (ou par la réconciliation dans offline-sync.ts)
    // suffit à l'afficher.
    queryFn: () => api.get<Recipe>(`/api/recipes/${id}`),
    enabled: Boolean(id) && !isTempId(id ?? ""),
  });
}

// Fabrique une recette locale à partir du formulaire, le temps que la vraie
// création soit rejouée (voir offline-sync.ts) — reprend exactement les
// champs saisis, avec des id provisoires pour les lignes filles (jamais
// exposés au serveur, la file rejoue `input` tel quel).
function buildOptimisticRecipe(id: string, input: RecipeInput): Recipe {
  const now = new Date().toISOString();
  return {
    id,
    userId: "", // inconnu tant que non synchronisée ; jamais lu avant (voir RecipeDetailPage)
    title: input.title,
    servings: input.servings,
    prepTimeMinutes: input.prepTimeMinutes,
    cookTimeMinutes: input.cookTimeMinutes,
    cookTempCelsius: input.cookTempCelsius,
    photoUrl: input.photoUrl,
    notes: input.notes,
    shareToken: null,
    sharedFromPseudo: null,
    createdAt: now,
    updatedAt: now,
    syncStatus: "pending",
    ingredients: input.ingredients.map((ing, position) => ({
      id: `${id}-ingredient-${position}`,
      name: ing.name,
      quantity: ing.quantity,
      unit: ing.unit,
      position,
    })),
    steps: input.steps.map((step, position) => ({
      id: `${id}-step-${position}`,
      position,
      text: step.text,
    })),
  };
}

// Échec réseau (pas une vraie erreur serveur) à la création : plutôt que de
// faire échouer tout le formulaire, on met la requête en file (rejouée à la
// reconnexion, voir offline-sync.ts) et on affiche tout de suite une
// recette provisoire — l'utilisateur retrouve sa saisie sans avoir à la
// refaire, marquée "en attente" le temps de la synchronisation.
async function createRecipeOffline(queryClient: QueryClient, input: RecipeInput): Promise<Recipe> {
  const tempId = createTempId();
  const optimistic = buildOptimisticRecipe(tempId, input);
  await enqueue({ method: "POST", path: "/api/recipes", body: input, tempId });
  queryClient.setQueryData<RecipeSummary[]>(["recipes"], (prev) => [optimistic, ...(prev ?? [])]);
  queryClient.setQueryData<Recipe>(["recipes", tempId], optimistic);
  return optimistic;
}

export function useCreateRecipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: RecipeInput): Promise<Recipe> => {
      try {
        return await api.post<Recipe>("/api/recipes", input);
      } catch (err) {
        if (!isRetryableError(err)) throw err; // vraie erreur (validation, auth…) : à afficher telle quelle
        return createRecipeOffline(queryClient, input);
      }
    },
    onSuccess: (recipe) => {
      // Le brouillon hors-ligne (id "temp-…") est déjà dans le cache
      // (createRecipeOffline ci-dessus) : pas de revalidation possible tant
      // qu'on est hors-ligne, et sans objet une fois reconnecté puisque
      // offline-sync.ts s'en charge à la réconciliation.
      if (!isTempId(recipe.id)) {
        queryClient.invalidateQueries({ queryKey: ["recipes"] });
      }
    },
  });
}

// PUT /api/recipes/:id — édition d'une recette existante (remplace champs +
// réécrit ingrédients/étapes, voir apps/api/src/routes/recipes.ts). Invalide
// aussi bien la liste (titre/méta affichés sur RecipesPage) que le détail
// (id précis, revu juste après la sauvegarde).
export function useUpdateRecipe(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RecipeInput) => api.put<Recipe>(`/api/recipes/${id}`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      queryClient.invalidateQueries({ queryKey: ["recipes", id] });
    },
  });
}

export function useDeleteRecipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (isTempId(id)) {
        // Recette créée hors-ligne, jamais parvenue au serveur (en attente
        // ou définitivement en échec, voir offline-sync.ts) : rien à
        // annuler côté API, juste retirer la requête encore en file.
        await removeQueuedByTempId(id);
        return;
      }
      await api.del(`/api/recipes/${id}`);
    },
    onSuccess: (_data, id) => {
      // Retrait immédiat du cache local : nécessaire pour un id "temp-…"
      // (le serveur ne l'a jamais connu, une invalidation ne le ferait pas
      // disparaître), et évite l'aller-retour réseau pour l'autre cas.
      queryClient.setQueryData<RecipeSummary[]>(["recipes"], (prev) =>
        prev?.filter((r) => r.id !== id),
      );
      if (!isTempId(id)) {
        queryClient.invalidateQueries({ queryKey: ["recipes"] });
      }
    },
  });
}

// Décompte le stock après avoir cuisiné la recette (voir
// apps/api/src/routes/recipes.ts, POST /:id/consume). Le stock et le badge
// "manquants" des autres recettes en dépendent, comme pour toute mutation de
// pantry (voir queries/pantry.ts).
export function useConsumeRecipe(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (multiplier: number) =>
      api.post<ConsumeRecipeResult>(`/api/recipes/${id}/consume`, { multiplier }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pantry"] });
      queryClient.invalidateQueries({ queryKey: ["recipes", "missing-counts"] });
    },
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

// Copie immédiate de la recette dans le compte du pseudo visé (voir
// apps/api/src/routes/recipes.ts, POST /:id/shares) — n'affecte pas la
// recette de l'expéditeur, rien à invalider ici.
export function useShareRecipeWithUser(id: string) {
  return useMutation({
    mutationFn: (pseudo: string) =>
      api.post<ShareRecipeWithUserResult>(`/api/recipes/${id}/shares`, { pseudo }),
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
