import type { Context, Next } from "hono";
import type { AppEnv } from "../types.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Vérification d'Origin indépendante du CORS (voir index.ts) : le CORS
// n'empêche une page tierce que de LIRE la réponse, pas forcément de
// déclencher la requête — pour une méthode "simple" au sens fetch (POST) qui
// n'a pas besoin d'un corps JSON valide pour réussir (ex. POST /:id/share,
// qui ignore son corps), un <form> HTML tiers suffit à la déclencher sans
// préflight. Même principe que la vérification d'Origin que better-auth
// applique déjà à ses propres routes (/api/auth/*) — cette version couvre
// les routes propres à l'app, qui n'en bénéficient pas autrement.
export async function requireOrigin<P extends string>(c: Context<AppEnv, P>, next: Next) {
  if (!SAFE_METHODS.has(c.req.method)) {
    const origin = c.req.header("origin");
    const expected = process.env.WEB_ORIGIN || "http://localhost:5173";
    if (origin !== expected) {
      return c.json({ message: "Origine non autorisée." }, 403);
    }
  }
  await next();
}
