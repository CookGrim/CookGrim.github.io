import { api, isRetryableError } from "./api";
import { getQueue, removeFromQueue, type QueuedRequest } from "./offline-queue";
import { queryClient } from "./query-client";

let isDraining = false;

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
        await replay(entry);
        await removeFromQueue(entry.id);
        hadSuccess = true;
      } catch (err) {
        if (!isRetryableError(err)) {
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
      await queryClient.invalidateQueries({ queryKey: ["shopping-lists"] });
      await queryClient.invalidateQueries({ queryKey: ["recipes"] });
    }
  } finally {
    isDraining = false;
  }
}

export function initOfflineSync() {
  window.addEventListener("online", () => void drainOfflineQueue());
  if (navigator.onLine) void drainOfflineQueue();
}
