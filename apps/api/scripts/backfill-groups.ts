// One-off : à exécuter une fois après la migration ajoutant groups/
// group_members/group_invites et les colonnes group_id (voir
// drizzle/0006_smiling_meltdown.sql). Pour chaque utilisateur existant sans
// groupe, crée un groupe personnel (lui seul, owner) — voir lib/groups.ts,
// defaultGroupName — puis renseigne group_id sur ses recettes/stock/listes
// existants (jusque-là NULL, seul userId les rattachait). Idempotent : peut
// être relancé sans risque, il ne retouche que ce qui n'a pas encore de
// groupe.
import "dotenv/config";
import { eq, isNull } from "drizzle-orm";
import { user } from "../src/db/auth-schema.js";
import { db } from "../src/db/client.js";
import { groupMembers, groups, pantryItems, recipes, shoppingLists } from "../src/db/schema.js";
import { defaultGroupName } from "../src/lib/groups.js";

const allUsers = await db.select({ id: user.id, name: user.name }).from(user);

const groupIdByUser = new Map<string, string>();
for (const row of await db.select().from(groupMembers)) {
  groupIdByUser.set(row.userId, row.groupId);
}

let createdCount = 0;
for (const u of allUsers) {
  if (groupIdByUser.has(u.id)) continue;
  const groupId = crypto.randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(groups).values({ id: groupId, name: defaultGroupName(u.name) });
    await tx.insert(groupMembers).values({ groupId, userId: u.id, role: "owner" });
  });
  groupIdByUser.set(u.id, groupId);
  createdCount++;
}
console.log(`Groupes créés : ${createdCount} (sur ${allUsers.length} utilisateurs au total).`);

async function backfillGroupId(
  label: string,
  table: typeof recipes | typeof pantryItems | typeof shoppingLists,
) {
  const rows = await db
    .select({ id: table.id, userId: table.userId })
    .from(table)
    .where(isNull(table.groupId));

  let updated = 0;
  for (const row of rows) {
    const groupId = groupIdByUser.get(row.userId);
    if (!groupId) {
      console.warn(`  ⚠ pas de groupe trouvé pour user_id=${row.userId} (${label} ${row.id})`);
      continue;
    }
    await db.update(table).set({ groupId }).where(eq(table.id, row.id));
    updated++;
  }
  console.log(`${label} : ${updated}/${rows.length} ligne(s) mise(s) à jour.`);
}

await backfillGroupId("recipes", recipes);
await backfillGroupId("pantry_items", pantryItems);
await backfillGroupId("shopping_lists", shoppingLists);

process.exit(0);
