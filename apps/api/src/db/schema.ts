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
