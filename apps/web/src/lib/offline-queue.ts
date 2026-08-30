import { openDB, type IDBPDatabase } from "idb";

// File d'écriture hors-ligne : les mutations qui échouent par manque de
// réseau (pas une vraie erreur serveur) atterrissent ici, persistées en
// IndexedDB, et sont rejouées dans l'ordre dès que la connexion revient
// (voir offline-sync.ts). Le compteur en mémoire sert de source
// synchrone pour useSyncExternalStore (l'indicateur "N en attente").

export type QueuedRequest = {
  id: string;
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  body: unknown;
  createdAt: number;
  // Présent uniquement pour une création hors-ligne (aujourd'hui : recettes,
  // voir queries/recipes.ts) : l'id local provisoire attribué avant que le
  // serveur ne connaisse la ressource, pour réconcilier une fois la vraie
  // réponse reçue (voir offline-sync.ts, drainOfflineQueue).
  tempId?: string;
};

// Préfixe reconnaissable qui distingue un id local provisoire (recette créée
// hors-ligne, pas encore synchronisée) d'un vrai id serveur (UUID) — utilisé
// pour éviter d'interroger le serveur avec un id qu'il ne connaît pas
// encore (voir queries/recipes.ts, useRecipe/useDeleteRecipe).
const TEMP_ID_PREFIX = "temp-";

export function createTempId(): string {
  return `${TEMP_ID_PREFIX}${crypto.randomUUID()}`;
}

export function isTempId(id: string): boolean {
  return id.startsWith(TEMP_ID_PREFIX);
}

const DB_NAME = "cookgrim-offline";
const STORE = "queue";

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb() {
  dbPromise ??= openDB(DB_NAME, 1, {
    upgrade(db) {
      db.createObjectStore(STORE, { keyPath: "id" });
    },
  });
  return dbPromise;
}

let count = 0;
const listeners = new Set<() => void>();

function setCount(next: number) {
  count = next;
  for (const listener of listeners) listener();
}

// Snapshot initial au chargement du module (best effort — si IndexedDB
// n'est pas disponible, le compteur reste à 0 et rien ne sera mis en file).
getDb()
  .then((db) => db.count(STORE))
  .then(setCount)
  .catch(() => {});

export function subscribeQueueCount(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getQueueCountSnapshot() {
  return count;
}

export async function enqueue(entry: Omit<QueuedRequest, "id" | "createdAt">) {
  const db = await getDb();
  await db.add(STORE, { ...entry, id: crypto.randomUUID(), createdAt: Date.now() });
  setCount(count + 1);
}

export async function getQueue(): Promise<QueuedRequest[]> {
  const db = await getDb();
  return db.getAll(STORE);
}

export async function removeFromQueue(id: string) {
  const db = await getDb();
  await db.delete(STORE, id);
  setCount(Math.max(0, count - 1));
}

// Annule une création encore en attente (ex. l'utilisateur supprime une
// recette créée hors-ligne avant qu'elle n'ait été synchronisée) — sans
// effet si elle a déjà été rejouée entre-temps (plus aucune entrée à ce
// tempId, voir queries/recipes.ts useDeleteRecipe).
export async function removeQueuedByTempId(tempId: string) {
  const queue = await getQueue();
  const match = queue.find((entry) => entry.tempId === tempId);
  if (match) await removeFromQueue(match.id);
}
