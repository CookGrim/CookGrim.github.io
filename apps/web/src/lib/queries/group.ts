import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { GroupOverview } from "../../types/group";

export function useGroup() {
  return useQuery({
    queryKey: ["group"],
    queryFn: () => api.get<GroupOverview>("/api/groups/me"),
  });
}

// Rejoindre/quitter un groupe change tout ce que je vois (recettes, stock,
// listes) : ces mutations invalident aussi ces caches-là, en plus du groupe
// lui-même.
function invalidateGroupAndSharedData(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ["group"] });
  queryClient.invalidateQueries({ queryKey: ["recipes"] });
  queryClient.invalidateQueries({ queryKey: ["pantry"] });
  queryClient.invalidateQueries({ queryKey: ["shopping-lists"] });
}

export function useRenameGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.patch("/api/groups/me", { name }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["group"] }),
  });
}

export function useInviteToGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (pseudo: string) => api.post("/api/groups/invites", { pseudo }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["group"] }),
  });
}

export function useRevokeInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) => api.del(`/api/groups/invites/${inviteId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["group"] }),
  });
}

export function useAcceptInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) => api.post(`/api/groups/invites/${inviteId}/accept`, {}),
    onSuccess: () => invalidateGroupAndSharedData(queryClient),
  });
}

export function useDeclineInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) => api.post(`/api/groups/invites/${inviteId}/decline`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["group"] }),
  });
}

export function useLeaveGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/api/groups/leave", {}),
    onSuccess: () => invalidateGroupAndSharedData(queryClient),
  });
}

export function useRemoveGroupMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.del(`/api/groups/members/${userId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["group"] }),
  });
}

export function useTransferOwnership() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.post(`/api/groups/members/${userId}/owner`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["group"] }),
  });
}
