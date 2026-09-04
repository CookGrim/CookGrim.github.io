import type { Context, Next } from "hono";
import { auth } from "../auth.js";
import { getOrCreateGroupForUser } from "../lib/groups.js";
import type { AppEnv } from "../types.js";

// Attache `user`/`session`/`groupId` au contexte, ou coupe la requête en 401.
// Les routes protégées font `const user = c.get("user")` après ce middleware.
// Générique sur le path (P) pour ne pas casser l'inférence de c.req.param()
// dans le handler final quand ce middleware est chaîné avant lui.
export async function requireAuth<P extends string>(c: Context<AppEnv, P>, next: Next) {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session) {
    return c.json({ message: "Authentification requise." }, 401);
  }

  c.set("user", session.user);
  c.set("session", session.session);
  // Résolu à chaque requête plutôt que mis en cache côté session : filet de
  // sécurité si le hook d'inscription (auth.ts, databaseHooks) n'a pas
  // encore couru (voir lib/groups.ts, getOrCreateGroupForUser) — sinon,
  // simple lecture d'une ligne indexée par user_id.
  c.set("groupId", await getOrCreateGroupForUser(session.user.id, session.user.name));
  await next();
}
