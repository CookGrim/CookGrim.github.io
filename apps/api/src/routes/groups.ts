import { pseudoToEmail } from "@cookgrim/shared";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db/client.js";
import { user } from "../db/auth-schema.js";
import { groupInvites, groupMembers, groups } from "../db/schema.js";
import { moveUserIntoGroup, moveUserToFreshSoloGroup, SoleMemberError } from "../lib/groups.js";
import { isRateLimited } from "../lib/rate-limit.js";
import { requireAuth } from "../middleware/require-auth.js";
import type { AppEnv } from "../types.js";

export const groupsRoute = new Hono<AppEnv>();
groupsRoute.use("*", requireAuth);

// GET /api/groups/me — mon groupe, ses membres, les invitations en cours
// (envoyées depuis ce groupe, et reçues par moi peu importe leur origine).
groupsRoute.get("/me", async (c) => {
  const caller = c.get("user");
  const groupId = c.get("groupId");

  const [group] = await db.select().from(groups).where(eq(groups.id, groupId));
  if (!group) return c.json({ message: "Groupe introuvable." }, 404);

  const [membership] = await db
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, caller.id)));

  const members = await db
    .select({
      userId: groupMembers.userId,
      role: groupMembers.role,
      joinedAt: groupMembers.joinedAt,
      pseudo: user.name,
    })
    .from(groupMembers)
    .innerJoin(user, eq(user.id, groupMembers.userId))
    .where(eq(groupMembers.groupId, groupId))
    .orderBy(groupMembers.joinedAt);

  const sentInvites = await db
    .select({
      id: groupInvites.id,
      createdAt: groupInvites.createdAt,
      inviteePseudo: user.name,
    })
    .from(groupInvites)
    .innerJoin(user, eq(user.id, groupInvites.inviteeUserId))
    .where(eq(groupInvites.groupId, groupId));

  const receivedInvites = await db
    .select({
      id: groupInvites.id,
      createdAt: groupInvites.createdAt,
      groupName: groups.name,
      inviterPseudo: user.name,
    })
    .from(groupInvites)
    .innerJoin(groups, eq(groups.id, groupInvites.groupId))
    .innerJoin(user, eq(user.id, groupInvites.inviterUserId))
    .where(eq(groupInvites.inviteeUserId, caller.id));

  return c.json({
    group: { id: group.id, name: group.name },
    role: membership?.role ?? "member",
    members,
    sentInvites,
    receivedInvites,
  });
});

const renameInput = z.object({
  name: z.string().trim().min(1, "Le nom est requis.").max(60, "60 caractères maximum."),
});

// PATCH /api/groups/me — renomme mon groupe. Réservé au propriétaire (même
// contrôle que DELETE /members/:userId ci-dessous).
groupsRoute.patch("/me", async (c) => {
  const caller = c.get("user");
  const groupId = c.get("groupId");

  const [callerMembership] = await db
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, caller.id)));
  if (callerMembership?.role !== "owner") {
    return c.json({ message: "Seul le propriétaire du groupe peut le renommer." }, 403);
  }

  const parsed = renameInput.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ message: "Requête invalide.", issues: parsed.error.issues }, 400);
  }
  await db.update(groups).set({ name: parsed.data.name }).where(eq(groups.id, groupId));
  return c.body(null, 204);
});

const inviteInput = z.object({
  pseudo: z.string().trim().min(1, "Le pseudo est obligatoire."),
});

// 20/heure/expéditeur — même ordre de grandeur et même raison que le
// partage de recette par pseudo (voir routes/recipes.ts, SHARE_RATE_LIMIT) :
// cette route révèle elle aussi si un pseudo existe ou non.
const INVITE_RATE_LIMIT = { max: 20, windowMs: 60 * 60 * 1000 };

// POST /api/groups/invites — invite un pseudo à rejoindre mon groupe.
groupsRoute.post("/invites", async (c) => {
  const sender = c.get("user");
  const groupId = c.get("groupId");
  if (isRateLimited(`group-invite:${sender.id}`, INVITE_RATE_LIMIT.max, INVITE_RATE_LIMIT.windowMs)) {
    return c.json({ message: "Trop d'invitations, réessayez plus tard." }, 429);
  }

  const parsed = inviteInput.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ message: "Requête invalide.", issues: parsed.error.issues }, 400);
  }

  const [recipient] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, pseudoToEmail(parsed.data.pseudo)));
  if (!recipient) return c.json({ message: "Pseudo introuvable." }, 404);
  if (recipient.id === sender.id) {
    return c.json({ message: "Vous ne pouvez pas vous inviter vous-même." }, 400);
  }

  const [alreadyMember] = await db
    .select({ id: groupMembers.id })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, recipient.id)));
  if (alreadyMember) {
    return c.json({ message: "Cette personne fait déjà partie du groupe." }, 400);
  }

  const [existingInvite] = await db
    .select({ id: groupInvites.id })
    .from(groupInvites)
    .where(and(eq(groupInvites.groupId, groupId), eq(groupInvites.inviteeUserId, recipient.id)));
  if (existingInvite) {
    return c.json({ message: "Une invitation est déjà en attente pour cette personne." }, 409);
  }

  const [invite] = await db
    .insert(groupInvites)
    .values({ groupId, inviterUserId: sender.id, inviteeUserId: recipient.id })
    .returning();

  return c.json({ id: invite.id, pseudo: parsed.data.pseudo, createdAt: invite.createdAt }, 201);
});

// POST /api/groups/invites/:id/accept — j'accepte une invitation reçue :
// je rejoins ce groupe (voir lib/groups.ts, moveUserIntoGroup pour ce que
// deviennent mes données actuelles), et toute autre invitation qui
// m'attendait devient sans objet (je ne peux être que dans un seul groupe).
groupsRoute.post("/invites/:id/accept", async (c) => {
  const caller = c.get("user");
  const id = c.req.param("id");

  const [invite] = await db.select().from(groupInvites).where(eq(groupInvites.id, id));
  if (!invite || invite.inviteeUserId !== caller.id) {
    return c.json({ message: "Invitation introuvable." }, 404);
  }

  await db.transaction(async (tx) => {
    await moveUserIntoGroup(tx, caller.id, invite.groupId);
    await tx.delete(groupInvites).where(eq(groupInvites.inviteeUserId, caller.id));
  });

  return c.body(null, 204);
});

// POST /api/groups/invites/:id/decline — je refuse une invitation reçue.
groupsRoute.post("/invites/:id/decline", async (c) => {
  const caller = c.get("user");
  const id = c.req.param("id");

  const [invite] = await db.select().from(groupInvites).where(eq(groupInvites.id, id));
  if (!invite || invite.inviteeUserId !== caller.id) {
    return c.json({ message: "Invitation introuvable." }, 404);
  }

  await db.delete(groupInvites).where(eq(groupInvites.id, id));
  return c.body(null, 204);
});

// DELETE /api/groups/invites/:id — révoque une invitation que j'ai envoyée,
// ou n'importe quelle invitation en attente de mon groupe si je suis owner.
groupsRoute.delete("/invites/:id", async (c) => {
  const caller = c.get("user");
  const groupId = c.get("groupId");
  const id = c.req.param("id");

  const [invite] = await db.select().from(groupInvites).where(eq(groupInvites.id, id));
  if (!invite) return c.json({ message: "Invitation introuvable." }, 404);

  const isSender = invite.inviterUserId === caller.id;
  const [membership] = await db
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, caller.id)));
  const isGroupOwner = invite.groupId === groupId && membership?.role === "owner";
  if (!isSender && !isGroupOwner) {
    return c.json({ message: "Invitation introuvable." }, 404);
  }

  await db.delete(groupInvites).where(eq(groupInvites.id, id));
  return c.body(null, 204);
});

// POST /api/groups/leave — je quitte mon groupe pour un groupe personnel
// tout neuf (voir lib/groups.ts pour ce que deviennent mes données).
groupsRoute.post("/leave", async (c) => {
  const caller = c.get("user");
  try {
    await moveUserToFreshSoloGroup(caller.id, caller.name);
    return c.body(null, 204);
  } catch (err) {
    if (err instanceof SoleMemberError) {
      return c.json({ message: "Vous êtes seul dans ce groupe, il n'y a rien à quitter." }, 409);
    }
    throw err;
  }
});

// DELETE /api/groups/members/:userId — le owner retire un membre (vers un
// groupe personnel neuf, voir lib/groups.ts). Pour se retirer soi-même,
// utiliser POST /leave.
groupsRoute.delete("/members/:userId", async (c) => {
  const caller = c.get("user");
  const groupId = c.get("groupId");
  const targetUserId = c.req.param("userId");

  if (targetUserId === caller.id) {
    return c.json({ message: "Utilisez plutôt « Quitter le groupe »." }, 400);
  }

  const [callerMembership] = await db
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, caller.id)));
  if (callerMembership?.role !== "owner") {
    return c.json({ message: "Seul le propriétaire du groupe peut retirer un membre." }, 403);
  }

  const [target] = await db
    .select({ id: user.id, name: user.name })
    .from(user)
    .innerJoin(groupMembers, and(eq(groupMembers.userId, user.id), eq(groupMembers.groupId, groupId)))
    .where(eq(user.id, targetUserId));
  if (!target) return c.json({ message: "Membre introuvable." }, 404);

  await moveUserToFreshSoloGroup(target.id, target.name);
  return c.body(null, 204);
});
