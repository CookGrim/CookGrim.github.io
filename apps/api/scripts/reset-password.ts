// Script ponctuel : réinitialise le code (PIN) d'un compte existant.
//
// Contexte : le PIN est passé de 4 à 6 chiffres exactement (voir
// PIN_PATTERN dans src/auth.ts). Les comptes créés avant ce changement ont
// un hash correspondant à un PIN à 4 chiffres — le hook `before` d'auth.ts
// rejette désormais toute tentative de connexion dont le mot de passe
// n'a pas exactement 6 chiffres, donc ces comptes sont bloqués et ne
// peuvent plus se reconnecter tout seuls (pas de flux "code oublié" dans
// l'appli, voir le commentaire dans auth.ts).
//
// Ce script met à jour directement le hash stocké dans la table `account`
// (provider "credential") avec `better-auth/crypto`, pour rester
// bit-à-bit compatible avec la vérification faite au login — donc pas de
// changement de comportement en dehors du compte visé.
//
// Usage (depuis apps/api) :
//   npx tsx scripts/reset-password.ts <pseudo> <nouveau-pin-6-chiffres>
//
// Variables d'env nécessaires : les mêmes que le serveur (TURSO_DATABASE_URL
// + TURSO_AUTH_TOKEN pour viser la base de prod sur Turso ; sans elles, le
// script agit sur le fichier local ./local.db comme le serveur en dev).

import "dotenv/config";
import { eq, and } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { pseudoToEmail } from "@cookgrim/shared";
import { db } from "../src/db/client.js";
import { user, account } from "../src/db/auth-schema.js";

const PIN_PATTERN = /^\d{6}$/;

async function main() {
  const [pseudo, newPin] = process.argv.slice(2);

  if (!pseudo || !newPin) {
    console.error("Usage: npx tsx scripts/reset-password.ts <pseudo> <nouveau-pin-6-chiffres>");
    process.exit(1);
  }
  if (!PIN_PATTERN.test(newPin)) {
    console.error("Le nouveau PIN doit contenir exactement 6 chiffres.");
    process.exit(1);
  }

  const email = pseudoToEmail(pseudo);
  const [target] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
  if (!target) {
    console.error(`Aucun compte trouvé pour le pseudo "${pseudo}".`);
    process.exit(1);
  }

  const [credential] = await db
    .select({ id: account.id })
    .from(account)
    .where(and(eq(account.userId, target.id), eq(account.providerId, "credential")));
  if (!credential) {
    console.error(`Le compte "${pseudo}" n'a pas d'identifiants email/mot de passe (providerId=credential).`);
    process.exit(1);
  }

  const hash = await hashPassword(newPin);
  await db.update(account).set({ password: hash }).where(eq(account.id, credential.id));

  console.log(`OK — nouveau PIN appliqué pour "${pseudo}". Communique-le à la personne concernée.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
