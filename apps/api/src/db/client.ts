import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as authSchema from "./auth-schema.js";
import * as appSchema from "./schema.js";

const client = createClient({
  // En dev sans compte Turso, on retombe sur un fichier SQLite local.
  url: process.env.TURSO_DATABASE_URL || "file:./local.db",
  authToken: process.env.TURSO_AUTH_TOKEN || undefined,
});

export const schema = { ...authSchema, ...appSchema };
export const db = drizzle(client, { schema });
