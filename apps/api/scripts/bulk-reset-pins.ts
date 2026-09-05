// Script ponctuel : réinitialise le code (PIN) de TOUS les comptes
// email/mot de passe ("credential") à une valeur fixe à 6 chiffres.
//
// Contexte : passage du code de 4 à 6 chiffres exactement (commit
// 5ccac1c, voir PIN_PATTERN dans src/auth.ts) — tous les comptes créés
// avant ce commit ont un hash correspondant à un code à 4 chiffres et ne
// peuvent plus se connecter (le hook `before` d'auth.ts rejette tout mot
// de passe qui n'a pas exactement 6 chiffres). Pas de flux "code oublié"
// ni d'écran "changer mon code" dans l'appli à ce jour — ce script sert
// de réinitialisation de secours, à distribuer ensuite aux utilisateurs.
//
// Ne touche que le hash stocké dans `account` (provider "credential"),
// via `better-auth/crypto` pour rester compatible avec la vérification
// faite au login.
//
// Usage (depuis apps/api) :
//   npx tsx scripts/bulk-reset-pins.ts <nouveau-pin-6-chiffres>
//
// Variables d'env : les mêmes que le serveur (TURSO_DATABASE_URL +
// TURSO_AUTH_TOKEN pour cibler la prod ; sans elles, fallback sur le
// fichier local ./local.db).

import "dotenv/config";
import { eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { db } from "../src/db/client.js";
import { user, account } from "../src/db/auth-schema.js";

const PIN_PATTERN = /^\d{6}$/;

async function main() {
  const [newPin] = process.argv.slice(2);

  if (!newPin || !PIN_PATTERN.test(newPin)) {
    console.error("Usage: npx tsx scripts/bulk-reset-pins.ts <nouveau-pin-6-chiffres>");
    process.exit(1);
  }

  const hash = await hashPassword(newPin);

  const credentials = await db
    .select({ accountId: account.id, userId: account.userId })
    .from(account)
    .where(eq(account.providerId, "credential"));

  if (credentials.length === 0) {
    console.log("Aucun compte email/mot de passe trouvé.");
    return;
  }

  const users = await db.select({ id: user.id, email: user.email }).from(user);
  const emailById = new Map(users.map((u) => [u.id, u.email]));

  for (const cred of credentials) {
    await db.update(account).set({ password: hash }).where(eq(account.id, cred.accountId));
    const email = emailById.get(cred.userId) ?? "(email introuvable)";
    const pseudo = email.endsWith("@pseudo.cookgrim.local")
      ? email.slice(0, -"@pseudo.cookgrim.local".length)
      : email;
    console.log(`OK — ${pseudo}`);
  }

  console.log(`\n${credentials.length} compte(s) réinitialisé(s) au code "${newPin}".`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
