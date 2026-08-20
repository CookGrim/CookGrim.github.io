import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { auth } from "./auth.js";
import { extractRoute } from "./routes/extract.js";
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

app.get("/health", (c) => c.json({ ok: true }));

// Better Auth gère lui-même /api/auth/sign-in, /sign-up, /session, etc.
app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

app.route("/api/recipes/extract", extractRoute);
app.route("/api/recipes", recipesRoute);
app.route("/api/shopping-lists", shoppingListsRoute);

const port = Number(process.env.PORT) || 8787;
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[CookGrim API] http://localhost:${info.port}`);
});
