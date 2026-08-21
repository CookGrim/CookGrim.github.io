import { QueryClient } from "@tanstack/react-query";

// Instance partagée : main.tsx (provider) et offline-sync.ts (invalidation
// après réconciliation de la file d'attente) doivent pointer sur le même
// client.
export const queryClient = new QueryClient();
