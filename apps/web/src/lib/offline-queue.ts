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
};

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
