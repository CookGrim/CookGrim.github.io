import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { db, schema } from "./db/client.js";

const isProduction = process.env.NODE_ENV === "production";

// Le pseudo (champ "name" côté better-auth) tient lieu d'identifiant :
// pas de nom/email demandés à l'utilisateur. On dérive un email interne
// unique du pseudo pour satisfaire le schéma better-auth (email requis
// et unique) sans jamais l'exposer côté client.
const PIN_PATTERN = /^\d{4}$/;

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:8787",
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [process.env.WEB_ORIGIN ?? "http://localhost:5173"],
  database: drizzleAdapter(db, { provider: "sqlite", schema }),
  emailAndPassword: {
    enabled: true,
    // Code numérique à 4 chiffres à la place d'un mot de passe classique.
    minPasswordLength: 4,
    maxPasswordLength: 4,
  },
  hooks: {
    // better-auth ne vérifie que la longueur du mot de passe ; on
    // impose ici le format "4 chiffres uniquement" (défense en
    // profondeur, en plus de la contrainte côté formulaire).
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/sign-up/email" || ctx.path === "/sign-in/email") {
        const password = (ctx.body as { password?: unknown } | undefined)?.password;
        if (typeof password !== "string" || !PIN_PATTERN.test(password)) {
          throw new APIError("BAD_REQUEST", {
            message: "Le code doit contenir exactement 4 chiffres.",
          });
        }
      }
    }),
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
