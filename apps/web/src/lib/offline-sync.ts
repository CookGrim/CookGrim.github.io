import { api, isRetryableError } from "./api";
import { getQueue, removeFromQueue, type QueuedRequest } from "./offline-queue";
import { queryClient } from "./query-client";
import type { Recipe, RecipeSummary } from "../types/recipe";

let isDraining = false;

// Émis quand une recette créée hors-ligne obtient son id définitif —
// RecipeDetailPage l'écoute pour se rediriger de l'URL provisoire vers
// l'URL réelle si l'utilisateur est justement en train de la consulter
// (voir pages/RecipeDetailPage.tsx).
export const RECIPE_SYNCED_EVENT = "cookgrim:recipe-synced";
export type RecipeSyncedDetail = { tempId: string; recipe: Recipe };

function replay(entry: QueuedRequest) {
  switch (entry.method) {
    case "POST":
      return api.post(entry.path, entry.body);
    case "PUT":
      return api.put(entry.path, entry.body);
    case "PATCH":
      return api.patch(entry.path, entry.body);
    case "DELETE":
      return api.del(entry.path);
  }
}

// Remplace la recette provisoire (id "temp-…", voir queries/recipes.ts,
// createRecipeOffline) par la vraie une fois la création rejouée avec
// succès, dans la liste et dans son propre cache de détail, puis prévient un
// éventuel écran de détail resté ouvert sur l'ancienne URL. La query
// "temp-…" elle-même n'est pas retirée explicitement du cache ici : la
// supprimer pendant qu'un RecipeDetailPage l'observe encore ferait
// clignoter "introuvable" avant que la redirection ci-dessous n'ait eu le
// temps de s'appliquer — elle sera nettoyée par le garbage collector de
// TanStack Query une fois plus personne à l'écoute.
function reconcileRecipeCreation(tempId: string, recipe: Recipe) {
  queryClient.setQueryData<RecipeSummary[]>(["recipes"], (prev) =>
    prev?.map((r) => (r.id === tempId ? recipe : r)),
  );
  queryClient.setQueryData<Recipe>(["recipes", recipe.id], recipe);
  window.dispatchEvent(
    new CustomEvent<RecipeSyncedDetail>(RECIPE_SYNCED_EVENT, { detail: { tempId, recipe } }),
  );
}

// La création ne sera jamais rejouée avec succès (vraie erreur client — ex.
// session expirée entre-temps, désormais 401 au lieu d'un souci réseau) :
// plutôt que de perdre la recette en silence comme pour les autres entrées
// de la file (voir la boucle ci-dessous), on la garde affichée mais marquée
// en échec — l'utilisateur peut en recopier le contenu puis la recréer une
// fois reconnecté.
function markRecipeCreationFailed(tempId: string) {
  queryClient.setQueryData<RecipeSummary[]>(["recipes"], (prev) =>
    prev?.map((r) => (r.id === tempId ? { ...r, syncStatus: "failed" } : r)),
  );
  queryClient.setQueryData<Recipe>(["recipes", tempId], (prev) =>
    prev ? { ...prev, syncStatus: "failed" } : prev,
  );
}

// Rejoue la file dans l'ordre. S'arrête au premier échec réseau/5xx pour ne
// pas désynchroniser l'ordre (on réessaiera au prochain retour en ligne) ;
// une vraie erreur client (4xx — donnée invalide, entre-temps supprimée
// côté serveur, etc.) fait juste abandonner cette entrée-là, pour ne pas
// bloquer les suivantes indéfiniment sur une requête qui ne passera jamais.
export async function drainOfflineQueue() {
  if (isDraining) return;
  isDraining = true;
  try {
    const queue = (await getQueue()).sort((a, b) => a.createdAt - b.createdAt);
    let hadSuccess = false;
    for (const entry of queue) {
      try {
        const result = await replay(entry);
        // Présent uniquement pour une création (voir queries/recipes.ts,
        // createRecipeOffline) : `result` est alors la recette telle que
        // créée côté serveur, avec son id définitif.
        if (entry.tempId) reconcileRecipeCreation(entry.tempId, result as Recipe);
        await removeFromQueue(entry.id);
        hadSuccess = true;
      } catch (err) {
        if (!isRetryableError(err)) {
          if (entry.tempId) markRecipeCreationFailed(entry.tempId);
          await removeFromQueue(entry.id);
          continue;
        }
        // Réseau toujours indisponible (ou 5xx transitoire) : on s'arrête,
        // on réessaiera au prochain "online".
        break;
      }
    }
    if (hadSuccess) {
      // Les données côté serveur ont peut-être changé entre-temps :
      // on laisse React Query rafraîchir tout ce qui pourrait être affecté.
      // Une coche rejouée ici a pu ajuster le stock (planPantryAdjustment),
      // d'où l'invalidation de "pantry" en plus.
      await queryClient.invalidateQueries({ queryKey: ["shopping-lists"] });
      await queryClient.invalidateQueries({ queryKey: ["recipes"] });
      await queryClient.invalidateQueries({ queryKey: ["pantry"] });
    }
  } finally {
    isDraining = false;
  }
}

export function initOfflineSync() {
  window.addEventListener("online", () => void drainOfflineQueue());
  if (navigator.onLine) void drainOfflineQueue();
}
