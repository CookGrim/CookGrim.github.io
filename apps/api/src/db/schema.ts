// Schéma applicatif CookGrim (Drizzle / SQLite, pensé pour Turso).
// Les tables d'auth (user, session, account, verification) vivent dans
// ./auth-schema.ts, générées par `npx @better-auth/cli generate`.
import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth-schema.js";

export const recipes = sqliteTable("recipes", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  servings: integer("servings"),
  prepTimeMinutes: integer("prep_time_minutes"),
  cookTimeMinutes: integer("cook_time_minutes"),
  cookTempCelsius: integer("cook_temp_celsius"),
  photoUrl: text("photo_url"),
  notes: text("notes"), // zone libre, privée par défaut au partage
  shareToken: text("share_token").unique(), // non-null = lien public actif
  // Pseudo de l'expéditeur si cette recette est une copie reçue via
  // POST /api/recipes/:id/shares (voir routes/recipes.ts) — simple mention
  // d'origine, pas une référence vivante : l'expéditeur peut être renommé ou
  // supprimé ensuite sans que ça n'affecte cette copie.
  sharedFromPseudo: text("shared_from_pseudo"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

export const ingredients = sqliteTable("ingredients", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  recipeId: text("recipe_id")
    .notNull()
    .references(() => recipes.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  quantity: real("quantity"),
  unit: text("unit"),
  position: integer("position").notNull().default(0),
});

export const steps = sqliteTable("steps", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  recipeId: text("recipe_id")
    .notNull()
    .references(() => recipes.id, { onDelete: "cascade" }),
  position: integer("position").notNull().default(0),
  text: text("text").notNull(),
});

// Verrouillage de compte après trop d'échecs de connexion (voir auth.ts,
// hooks before/after sur /sign-in/email) — une ligne par utilisateur, créée
// au premier échec, effacée dès une connexion réussie (compteur "réinitialisé").
export const loginLockouts = sqliteTable("login_lockouts", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  failedCount: integer("failed_count").notNull().default(0),
  // ISO ; null = pas verrouillé. Ne se remet PAS à zéro tout seul à
  // l'expiration : si l'échec reprend après coup, le compte reverrouille
  // immédiatement plutôt que d'accorder 10 nouveaux essais.
  lockedUntil: text("locked_until"),
});

export const pantryItems = sqliteTable("pantry_items", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  quantity: real("quantity"), // null = "j'en ai", quantité non suivie
  unit: text("unit"),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

export const shoppingLists = sqliteTable("shopping_lists", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull().default("Liste de courses"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

export const shoppingListItems = sqliteTable("shopping_list_items", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  shoppingListId: text("shopping_list_id")
    .notNull()
    .references(() => shoppingLists.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  quantity: real("quantity"),
  unit: text("unit"),
  category: text("category"),
  checked: integer("checked", { mode: "boolean" }).notNull().default(false),
  position: integer("position").notNull().default(0),
  // SQLite n'a pas de type array natif : on stocke un JSON stringifié.
  sourceRecipeIds: text("source_recipe_ids", { mode: "json" })
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'`),
});
