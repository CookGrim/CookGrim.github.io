// Applique les migrations en attente en appelant directement l'API
// programmatique de drizzle-orm (celle que `drizzle-kit migrate` utilise en
// interne), en contournant le wrapper CLI de drizzle-kit qui plante sur
// cette machine Windows (assertion libuv native pendant son propre
// nettoyage, après ou pendant l'exécution des requêtes — voir la
// discussion dans la session ayant introduit ce script).
import "dotenv/config";
import { migrate } from "drizzle-orm/libsql/migrator";
import { db } from "../src/db/client.js";

await migrate(db, { migrationsFolder: "./drizzle" });
console.log("Migrations appliquées.");
process.exit(0);
