// Modèle du groupe (foyer partagé) — reflète apps/api/src/routes/groups.ts
// (GET /api/groups/me) et apps/api/src/db/schema.ts (groups/groupMembers/
// groupInvites).

export type GroupRole = "owner" | "member";

export type GroupMember = {
  userId: string;
  role: GroupRole;
  joinedAt: string;
  pseudo: string;
};

export type SentInvite = {
  id: string;
  createdAt: string;
  inviteePseudo: string;
};

export type ReceivedInvite = {
  id: string;
  createdAt: string;
  groupName: string;
  inviterPseudo: string;
};

export type GroupOverview = {
  group: { id: string; name: string };
  role: GroupRole;
  members: GroupMember[];
  sentInvites: SentInvite[];
  receivedInvites: ReceivedInvite[];
};
