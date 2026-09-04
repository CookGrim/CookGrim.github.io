import "./env.js";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { auth } from "./auth.js";
import { requireOrigin } from "./middleware/require-origin.js";
import { extractRoute } from "./routes/extract.js";
import { groupsRoute } from "./routes/groups.js";
import { pantryRoute } from "./routes/pantry.js";
import { recipesRoute } from "./routes/recipes.js";
import { shoppingListsRoute } from "./routes/shopping-lists.js";
import type { AppEnv } from "./types.js";

const app = new Hono<AppEnv>();

app.use(
  "*",
  cors({
    origin: process.env.WEB_ORIGIN || "http://localhost:5173",
    credentials: true,
  }),
);

// En-têtes de durcissement par défaut (nosniff, no-referrer, etc.) — API
// JSON pure, donc sans risque. crossOriginResourcePolicy est explicitement
// desserré : cookgrim-web et cookgrim-api sont deux origines Render
// distinctes en prod, la valeur par défaut ("same-origin") bloquerait le
// fetch cross-origin du front, CORS ou pas.
app.use("*", secureHeaders({ crossOriginResourcePolicy: "cross-origin" }));

app.get("/health", (c) => c.json({ ok: true }));

// Better Auth gère lui-même /api/auth/sign-in, /sign-up, /session, etc.,
// avec sa propre vérification d'Origin — requireOrigin ci-dessous ne le
// couvre pas et n'a donc pas besoin de s'y appliquer.
app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

// Les routes propres à l'app n'ont que le CORS pour se défendre du CSRF, ce
// qui ne suffit pas pour un endpoint qui n'a pas besoin d'un corps JSON
// valide pour réussir (voir middleware/require-origin.ts).
app.use("/api/recipes/*", requireOrigin);
app.use("/api/shopping-lists/*", requireOrigin);
app.use("/api/pantry/*", requireOrigin);
app.use("/api/groups/*", requireOrigin);

app.route("/api/recipes/extract", extractRoute);
app.route("/api/recipes", recipesRoute);
app.route("/api/shopping-lists", shoppingListsRoute);
app.route("/api/pantry", pantryRoute);
app.route("/api/groups", groupsRoute);

const port = Number(process.env.PORT) || 8787;
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[CookGrim API] http://localhost:${info.port}`);
});
