// Logique de groupe (foyer partagé) — voir ARCHITECTURE.md et
// db/schema.ts (groups/groupMembers/groupInvites) pour le modèle de données.
// Chaque utilisateur appartient à exactement un groupe à la fois
// (group_members.userId est unique) : "quitter" un groupe, c'est toujours
// en rejoindre un autre (neuf et vide, ou celui de quelqu'un qui invite).
import { and, eq, ne } from "drizzle-orm";
import { db } from "../db/client.js";
import { groupMembers, groups, pantryItems, recipes, shoppingLists } from "../db/schema.js";

// Type du paramètre `tx` reçu dans un callback `db.transaction(async (tx) => ...)`
// — permet d'écrire des fonctions qui participent à une transaction ouverte
// par l'appelant (route) sans dupliquer la logique de connexion.
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export function defaultGroupName(pseudo: string): string {
  return `Foyer de ${pseudo}`;
}

// Lève cette erreur quand une action de groupe demande explicitement à ce
// que l'appelant ne soit pas le seul membre restant (quitter un groupe,
// se faire retirer) — voir routes/groups.ts pour le mapping en 409.
export class SoleMemberError extends Error {
  constructor() {
    super("Vous êtes le seul membre de ce groupe.");
  }
}

// Élit le membre restant le plus ancien comme nouveau owner. Appelé juste
// avant de retirer un owner de son groupe (départ ou exclusion — jamais
// applicable à l'exclusion en fait, un owner ne peut pas être exclu, mais
// la fonction reste générique) pour qu'un groupe à plusieurs membres ne se
// retrouve jamais sans owner.
async function promoteNewOwner(tx: Tx, groupId: string, excludingUserId: string) {
  const [next] = await tx
    .select()
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), ne(groupMembers.userId, excludingUserId)))
    .orderBy(groupMembers.joinedAt)
    .limit(1);
  if (next) {
    await tx.update(groupMembers).set({ role: "owner" }).where(eq(groupMembers.id, next.id));
  }
}

// Trouve le groupe de l'utilisateur, ou lui en crée un (lui seul, owner) —
// filet de sécurité si le hook d'inscription (auth.ts) n'a pas encore
// couru, et point d'entrée pour tout code qui a juste besoin du groupe
// courant (voir middleware/require-auth.ts).
export async function getOrCreateGroupForUser(userId: string, pseudo: string): Promise<string> {
  const [existing] = await db
    .select({ groupId: groupMembers.groupId })
    .from(groupMembers)
    .where(eq(groupMembers.userId, userId));
  if (existing) return existing.groupId;

  const groupId = crypto.randomUUID();
  try {
    await db.transaction(async (tx) => {
      await tx.insert(groups).values({ id: groupId, name: defaultGroupName(pseudo) });
      await tx.insert(groupMembers).values({ groupId, userId, role: "owner" });
    });
    return groupId;
  } catch {
    // Course concurrente (ex. hook d'inscription + premier appel API dans
    // la foulée) : la contrainte unique sur group_members.userId a rejeté
    // le doublon, quelqu'un d'autre a déjà créé le groupe entre-temps — on
    // relit plutôt que de propager l'erreur. Le groupe créé ci-dessus dans
    // la transaction annulée reste orphelin (sans membre) : anodin, jamais
    // référencé par personne.
    const [created] = await db
      .select({ groupId: groupMembers.groupId })
      .from(groupMembers)
      .where(eq(groupMembers.userId, userId));
    if (created) return created.groupId;
    throw new Error("Impossible de créer ou récupérer le groupe de l'utilisateur.");
  }
}

// Déplace un utilisateur vers un groupe cible (déjà existant), en décidant
// ce que deviennent ses données actuelles :
// - s'il était seul dans son ancien groupe, tout son contenu (recettes,
//   stock, listes) part avec lui — c'est une simple fusion, le cas normal
//   quand deux personnes seules jusque-là forment un foyer commun ;
// - sinon (il partageait déjà un groupe avec d'autres), il part les mains
//   vides — ce contenu appartient au groupe qu'il quitte, pas à lui
//   individuellement — et un nouveau owner est promu si besoin.
// Doit être appelée à l'intérieur d'une transaction (le `tx` passé par
// l'appelant), pour que le déplacement de membership et de données soit
// atomique.
export async function moveUserIntoGroup(tx: Tx, userId: string, targetGroupId: string) {
  const [membership] = await tx.select().from(groupMembers).where(eq(groupMembers.userId, userId));
  const oldGroupId = membership?.groupId;
  if (oldGroupId === targetGroupId) return;

  if (oldGroupId) {
    const oldGroupMembers = await tx
      .select({ id: groupMembers.id })
      .from(groupMembers)
      .where(eq(groupMembers.groupId, oldGroupId));
    const wasAlone = oldGroupMembers.length === 1;

    if (wasAlone) {
      await tx.update(recipes).set({ groupId: targetGroupId }).where(eq(recipes.groupId, oldGroupId));
      await tx.update(pantryItems).set({ groupId: targetGroupId }).where(eq(pantryItems.groupId, oldGroupId));
      await tx.update(shoppingLists).set({ groupId: targetGroupId }).where(eq(shoppingLists.groupId, oldGroupId));
      await tx.delete(groupMembers).where(eq(groupMembers.groupId, oldGroupId));
      await tx.delete(groups).where(eq(groups.id, oldGroupId));
    } else {
      if (membership.role === "owner") {
        await promoteNewOwner(tx, oldGroupId, userId);
      }
      await tx.delete(groupMembers).where(eq(groupMembers.userId, userId));
    }
  }

  await tx.insert(groupMembers).values({ groupId: targetGroupId, userId, role: "member" });
}

// Fait quitter à un utilisateur son groupe actuel vers un groupe personnel
// tout neuf (vide) — utilisé pour un départ volontaire (POST /groups/leave)
// ou une exclusion par le owner (DELETE /groups/members/:userId). Refuse si
// l'utilisateur est déjà seul dans son groupe : il n'y a alors rien à
// quitter (et créer un groupe neuf identique ne changerait rien).
export async function moveUserToFreshSoloGroup(userId: string, pseudo: string): Promise<string> {
  return db.transaction(async (tx) => {
    const [membership] = await tx.select().from(groupMembers).where(eq(groupMembers.userId, userId));
    if (membership) {
      const currentMembers = await tx
        .select({ id: groupMembers.id })
        .from(groupMembers)
        .where(eq(groupMembers.groupId, membership.groupId));
      if (currentMembers.length <= 1) throw new SoleMemberError();
    }

    const newGroupId = crypto.randomUUID();
    await tx.insert(groups).values({ id: newGroupId, name: defaultGroupName(pseudo) });
    await moveUserIntoGroup(tx, userId, newGroupId);
    // moveUserIntoGroup pose toujours role "member" ; seul propriétaire de
    // ce groupe tout neuf, il doit en être le owner.
    await tx
      .update(groupMembers)
      .set({ role: "owner" })
      .where(and(eq(groupMembers.groupId, newGroupId), eq(groupMembers.userId, userId)));

    return newGroupId;
  });
}
