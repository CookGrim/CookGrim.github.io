import { useSyncExternalStore } from "react";
import { getQueueCountSnapshot, subscribeQueueCount } from "../offline-queue";

export function useOfflineQueueCount() {
  return useSyncExternalStore(subscribeQueueCount, getQueueCountSnapshot);
}
