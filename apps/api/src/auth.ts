import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { eq } from "drizzle-orm";
import { db, schema } from "./db/client.js";
import { user } from "./db/auth-schema.js";
import { loginLockouts } from "./db/schema.js";
import { getOrCreateGroupForUser } from "./lib/groups.js";

const isProduction = process.env.NODE_ENV === "production";

// Le pseudo (champ "name" côté better-auth) tient lieu d'identifiant :
// pas de nom/email demandés à l'utilisateur. On dérive un email interne
// unique du pseudo pour satisfaire le schéma better-auth (email requis
// et unique) sans jamais l'exposer côté client.
const PIN_PATTERN = /^\d{6}$/;

// Verrouillage de compte (voir db/schema.ts, table login_lockouts) : au-delà
// de ce nombre d'échecs consécutifs, le compte est bloqué pour la durée
// ci-dessous. Pas de flux "code oublié" possible dans cette appli (pas de
// vrai email) — un verrouillage permanent bloquerait l'utilisateur pour de
// bon, donc déverrouillage automatique à l'expiration plutôt que manuel.
const MAX_FAILED_ATTEMPTS = 10;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

async function findUserByEmail(email: string) {
  const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
  return existing ?? null;
}

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:8787",
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [process.env.WEB_ORIGIN ?? "http://localhost:5173"],
  database: drizzleAdapter(db, { provider: "sqlite", schema }),
  emailAndPassword: {
    enabled: true,
    // Code numérique à 6 chiffres à la place d'un mot de passe classique.
    minPasswordLength: 6,
    maxPasswordLength: 6,
  },
  // Rate-limit par IP (mécanisme natif better-auth, activé par défaut
  // seulement en production — cohérent avec `isProduction` ci-dessous pour
  // ne pas gêner le développement local). Complète le verrouillage de compte
  // (voir hooks.after) : celui-ci ne protège qu'un compte déjà existant et
  // identifié — un pseudo inexistant, ou une création de compte en masse, ne
  // déclenchent aucun verrou. `isRateLimited` (lib/rate-limit.ts) n'est pas
  // réutilisé ici : il ne connaît pas l'IP de l'appelant, seulement des clés
  // arbitraires construites à la main (ex. id utilisateur déjà authentifié
  // pour /shares) — impossible à appliquer avant authentification.
  rateLimit: {
    customRules: {
      "/sign-in/email": { window: 5 * 60, max: 20 },
      "/sign-up/email": { window: 60 * 60, max: 10 },
    },
  },
  databaseHooks: {
    user: {
      create: {
        // Identifiant lisible plutôt que la chaîne aléatoire générée par
        // défaut (better-auth n'a accès au pseudo qu'ici, pas dans
        // `advanced.database.generateId` qui ne reçoit que le nom de
        // table — voir node_modules/@better-auth/core/dist/types/init-options.d.mts).
        // Réutilise exactement la partie locale de l'email interne déjà
        // dérivé du pseudo (`pseudoToEmail`, toujours en minuscules) plutôt
        // que de reformater le pseudo nous-mêmes : garantit par construction
        // le même identifiant, donc la même garantie d'unicité que la
        // contrainte email déjà en place — pas de vérification
        // supplémentaire nécessaire. `data.email` est toujours au format
        // `<pseudo en minuscules>@pseudo.cookgrim.local` (seul chemin
        // d'inscription de l'app, voir SignupPage.tsx). L'adaptateur
        // respecte cet id explicite (`forceAllowId: true`, voir
        // db/with-hooks.mjs) — ne s'applique qu'aux nouvelles inscriptions,
        // les comptes déjà créés gardent leur ancien id aléatoire (le
        // changer rétroactivement casserait toutes les clés étrangères qui
        // le référencent : recettes, stock, listes, groupes, sessions…).
        before: async (data: { email: string }) => {
          return { data: { id: data.email.split("@")[0] } };
        },
        // Crée automatiquement le groupe personnel (foyer solo) de tout
        // nouvel utilisateur — voir db/schema.ts (groups/groupMembers) et
        // lib/groups.ts. Mis en file après la transaction de création (voir
        // node_modules/better-auth/dist/db/with-hooks.mjs,
        // queueAfterTransactionHook) : ne bloque jamais la réponse
        // d'inscription. `getOrCreateGroupForUser` sert aussi de filet de
        // sécurité dans requireAuth si jamais ce hook n'avait pas encore
        // couru au moment du premier appel API du nouvel utilisateur.
        after: async (createdUser: { id: string; name: string }) => {
          await getOrCreateGroupForUser(createdUser.id, createdUser.name);
        },
      },
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/sign-up/email" || ctx.path === "/sign-in/email") {
        // better-auth ne vérifie que la longueur du mot de passe ; on
        // impose ici le format "6 chiffres uniquement" (défense en
        // profondeur, en plus de la contrainte côté formulaire).
        const password = (ctx.body as { password?: unknown } | undefined)?.password;
        if (typeof password !== "string" || !PIN_PATTERN.test(password)) {
          throw new APIError("BAD_REQUEST", {
            message: "Le code doit contenir exactement 6 chiffres.",
          });
        }
      }

      if (ctx.path === "/sign-in/email") {
        const email = (ctx.body as { email?: unknown } | undefined)?.email;
        if (typeof email === "string") {
          const target = await findUserByEmail(email);
          if (target) {
            const [lockout] = await db
              .select()
              .from(loginLockouts)
              .where(eq(loginLockouts.userId, target.id));
            if (lockout?.lockedUntil && new Date(lockout.lockedUntil) > new Date()) {
              throw new APIError("FORBIDDEN", {
                message: "Trop d'échecs : compte temporairement verrouillé. Réessayez plus tard.",
              });
            }
          }
        }
      }
    }),
    // Compte les échecs de connexion (mot de passe rejeté par le handler
    // ci-dessus une fois le format validé) pour verrouiller le compte au
    // bout de MAX_FAILED_ATTEMPTS, et remet le compteur à zéro dès qu'une
    // connexion réussit. Ne s'exécute jamais pour un pseudo inexistant (rien
    // à verrouiller), ni quand le hook `before` a déjà bloqué la requête
    // (format invalide ou déjà verrouillé) : ce hook `after` n'est atteint
    // que si le handler de connexion a réellement tourné.
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-in/email") return;
      const email = (ctx.body as { email?: unknown } | undefined)?.email;
      if (typeof email !== "string") return;

      const target = await findUserByEmail(email);
      if (!target) return;

      const failed = ctx.context.returned instanceof APIError;
      if (!failed) {
        await db.delete(loginLockouts).where(eq(loginLockouts.userId, target.id));
        return;
      }

      const [existing] = await db
        .select()
        .from(loginLockouts)
        .where(eq(loginLockouts.userId, target.id));
      const failedCount = (existing?.failedCount ?? 0) + 1;
      const lockedUntil =
        failedCount >= MAX_FAILED_ATTEMPTS
          ? new Date(Date.now() + LOCKOUT_DURATION_MS).toISOString()
          : null;

      await db
        .insert(loginLockouts)
        .values({ userId: target.id, failedCount, lockedUntil })
        .onConflictDoUpdate({
          target: loginLockouts.userId,
          set: { failedCount, lockedUntil },
        });
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
