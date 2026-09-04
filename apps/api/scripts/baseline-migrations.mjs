// One-off : déclare les migrations 0000-0005 comme déjà appliquées (leurs
// tables existent déjà en base, provisionnées à l'origine via `drizzle-kit
// push` plutôt que `migrate` — voir la table __drizzle_migrations, vide
// alors que ces tables existent). Sans ça, `migrate()` essaie de rejouer
// tout l'historique depuis 0000 et échoue sur "table already exists". Ne
// touche à aucune donnée applicative, seulement à la table de suivi des
// migrations.
import "dotenv/config";
import { createClient } from "@libsql/client";
import crypto from "node:crypto";
import fs from "node:fs";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const journal = JSON.parse(fs.readFileSync("./drizzle/meta/_journal.json", "utf8"));
const toBaseline = journal.entries.filter((e) => e.tag !== "0006_smiling_meltdown");

const existing = await client.execute("SELECT hash FROM __drizzle_migrations");
const existingHashes = new Set(existing.rows.map((r) => r.hash));

for (const entry of toBaseline) {
  const sql = fs.readFileSync(`./drizzle/${entry.tag}.sql`, "utf8");
  const hash = crypto.createHash("sha256").update(sql).digest("hex");
  if (existingHashes.has(hash)) {
    console.log(`déjà enregistrée : ${entry.tag}`);
    continue;
  }
  await client.execute({
    sql: "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)",
    args: [hash, entry.when],
  });
  console.log(`enregistrée : ${entry.tag} (hash ${hash.slice(0, 8)}…, ${entry.when})`);
}

const rows = await client.execute("SELECT id, hash, created_at FROM __drizzle_migrations ORDER BY created_at");
console.log("__drizzle_migrations maintenant :", rows.rows);
process.exit(0);
