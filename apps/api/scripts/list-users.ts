// Script en lecture seule : liste les comptes existants (pseudo + date de
// création) pour repérer lesquels datent d'avant le passage du code à 6
// chiffres (commit 5ccac1c, 2026-09-05 09:06) et ont donc encore un code à
// 4 chiffres. Le pseudo est stocké en clair dans user.email
// (<pseudo>@pseudo.cookgrim.local) — seul le mot de passe est haché.
//
// Usage (depuis apps/api) :
//   npx tsx scripts/list-users.ts

import "dotenv/config";
import { db } from "../src/db/client.js";
import { user } from "../src/db/auth-schema.js";

const PIN6_CUTOFF = new Date("2026-09-05T09:06:10+02:00");

async function main() {
  const rows = await db
    .select({ id: user.id, email: user.email, createdAt: user.createdAt })
    .from(user);

  rows.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  for (const row of rows) {
    const pseudo = row.email.endsWith("@pseudo.cookgrim.local")
      ? row.email.slice(0, -"@pseudo.cookgrim.local".length)
      : row.email;
    const status = row.createdAt < PIN6_CUTOFF ? "code 4 chiffres (à réinitialiser)" : "code 6 chiffres (déjà à jour)";
    console.log(`${row.createdAt.toISOString()}  ${pseudo.padEnd(20)}  ${status}`);
  }
  console.log(`\nTotal : ${rows.length} compte(s).`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
