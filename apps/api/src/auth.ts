import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db, schema } from "./db/client.js";

const isProduction = process.env.NODE_ENV === "production";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:8787",
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [process.env.WEB_ORIGIN ?? "http://localhost:5173"],
  database: drizzleAdapter(db, { provider: "sqlite", schema }),
  emailAndPassword: {
    enabled: true,
  },
  // cookgrim-web et cookgrim-api sont deux domaines Render distincts en
  // prod (cookie cross-site) : sans ça, le cookie de session posé par
  // l'API ne serait jamais renvoyé par le navigateur depuis le front.
  // En local (même domaine "localhost"), on garde les valeurs par défaut —
  // "secure" empêcherait le cookie de passer en HTTP simple.
  advanced: isProduction
    ? { defaultCookieAttributes: { sameSite: "none", secure: true } }
    : undefined,
});
