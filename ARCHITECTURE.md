# CookGrim — note technique (architecture & maintenance)

PWA de recettes : formulaire de saisie (préremplissable depuis une photo via
IA vision), génération de liste de courses à partir d'une sélection de
recettes, partage par lien public et export PDF.

Monorepo npm workspaces, deux services déployés séparément sur **Render**,
code sur **GitHub**, base de données **Turso**.

---

## 1. Stack technique

| Domaine | Techno |
|---|---|
| Monorepo | npm workspaces (`apps/web`, `apps/api`) |
| Frontend | React 19 + Vite + TypeScript + Tailwind CSS v4, PWA (`vite-plugin-pwa`) |
| Backend | Hono (serveur TypeScript), déployé comme Web Service Render |
| Base de données | Turso (SQLite/libSQL) via `@libsql/client` |
| ORM / migrations | Drizzle ORM + drizzle-kit |
| Auth | Better Auth (email + mot de passe), adaptateur Drizzle/SQLite |
| Vision IA (prefill photo) | Claude (`@anthropic-ai/sdk`), appelé depuis une route serveur (`POST /api/recipes/extract`) |
| État serveur / cache (front) | TanStack Query |
| Formulaires | React Hook Form + Zod |
| Hébergement | Render (Web Service pour l'API, Static Site pour le front) |
| CI/déploiement | GitHub → déploiement auto Render (voir `render.yaml`) |

### Pourquoi ce choix (vs. Supabase)

Le premier jet du scaffold utilisait Supabase (backend-as-a-service : auth +
DB + storage + edge functions inclus). Ce projet est revenu sur cette
stack pour rester cohérent avec le reste des projets de l'auteur
(GitHub/Render/Turso déjà utilisés ailleurs). Contrepartie : sans RLS ni
service tout-en-un, l'auth, l'API et le contrôle d'accès sont du code
applicatif à part entière — chaque requête doit explicitement filtrer par
`user_id`, il n'y a pas de filet de sécurité au niveau base de données.

**Photos de recette** : différées en v2. La photo ne sert qu'à l'extraction
IA (envoyée à Claude, jamais stockée) — pas de stockage objet à mettre en
place tout de suite. Quand ce sera nécessaire, Cloudflare R2 (compatible
S3) est le candidat naturel : Render n'a pas d'équivalent natif.

---

## 2. Lancer en local

```bash
npm install                     # installe les deux workspaces depuis la racine
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
npm run dev                     # lance apps/api (port 8787) + apps/web (port 5173) en parallèle
```

Sans `TURSO_DATABASE_URL` renseigné, `apps/api` retombe sur un fichier
SQLite local (`apps/api/local.db`) — pratique pour développer sans compte
Turso. Le frontend proxifie `/api` vers `localhost:8787` en dev (voir
`apps/web/vite.config.ts`), pas de CORS à gérer localement.

### Base de données

```bash
cd apps/api
npx drizzle-kit generate   # génère une migration après modif du schéma
npx drizzle-kit migrate    # applique les migrations en attente
npx drizzle-kit studio     # explorateur de données
```

Le schéma applicatif vit dans `apps/api/src/db/schema.ts`. Les tables d'auth
(`user`, `session`, `account`, `verification`) vivent dans
`apps/api/src/db/auth-schema.ts`, générées par Better Auth
(`npx @better-auth/cli generate --output src/db/auth-schema.ts -y`) — ne
pas les éditer à la main sauf pour corriger un décalage de version comme
celui documenté en commentaire dans ce fichier (champ `issuer` sur
`account`, absent de la génération avec `@better-auth/cli@1.4.21` alors que
`better-auth@1.7.x` l'exige — à revérifier si vous mettez à jour l'un des
deux paquets).

### Régénérer les icônes PWA

`apps/web/public/mark.svg` est la source de vérité de la marque. Après
modification :

```bash
npm run icons
```

---

## 3. Arborescence

```
apps/web/            PWA (React/Vite)
  src/pages/          RecipesPage, RecipeFormPage, ShoppingListPage
  src/lib/api.ts       client REST vers apps/api
  public/mark.svg      marque CookGrim, source des icônes
apps/api/             API (Hono)
  src/db/schema.ts      tables applicatives (Drizzle)
  src/db/auth-schema.ts tables Better Auth (générées)
  src/routes/           recipes.ts, shopping-lists.ts, extract.ts
  src/lib/aggregate-ingredients.ts   agrégation liste de courses (fonction pure)
  src/middleware/require-auth.ts
render.yaml           blueprint de déploiement (2 services)
```

---

## 4. Modèle de données

Cinq tables applicatives (voir `apps/api/src/db/schema.ts`) :

- **recipes** — titre, portions, temps, photo (v2), `notes` (zone libre
  privée), `shareToken` (non-null = lien public actif, régénérable pour
  révoquer).
- **ingredients** / **steps** — liés par `recipeId`.
- **shoppingLists** / **shoppingListItems** — `sourceRecipeIds` (JSON) trace
  la provenance de chaque ligne agrégée.

Pas de RLS (SQLite n'en a pas) : chaque route vérifie explicitement
`recipe.userId === user.id` avant de lire/écrire — voir
`apps/api/src/routes/recipes.ts`.

**Partage public** : `GET /api/recipes/shared/:token` est la seule route non
authentifiée. Elle retire systématiquement `notes` et `userId` de la
réponse, quel que soit l'appelant — le partage n'expose jamais les notes
privées.

---

## 5. Déploiement (Render)

Deux services (voir `render.yaml`, à valider/adapter au premier déploiement
réel — non testé dans cet environnement) :

1. **cookgrim-api** — Web Service Node, `rootDir` implicite via
   `--workspace=@cookgrim/api`. Variables : `TURSO_DATABASE_URL`,
   `TURSO_AUTH_TOKEN`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`,
   `WEB_ORIGIN`, `ANTHROPIC_API_KEY`.
2. **cookgrim-web** — Static Site, publie `apps/web/dist`. Variable :
   `VITE_API_URL` (pointe vers l'URL du service `cookgrim-api`).

GitHub reste la source de vérité : chaque push sur la branche par défaut
redéploie les deux services.

---

## 6. Roadmap

1. **Setup** ✅ — monorepo, schéma Drizzle/Turso, auth Better Auth, API Hono
   testée de bout en bout (sign-up, session, CRUD recettes, agrégation liste
   de courses, partage public).
2. **Brancher le frontend** ✅ — écrans de connexion/inscription
   (`better-auth/react`, cookie de session), `RecipesPage`/`RecipeFormPage`
   branchés sur l'API réelle (TanStack Query), sélection de recettes +
   multiplicateur → génération de liste de courses, écran de liste avec
   cases à cocher. Testé de bout en bout (sign-up, création de recette,
   génération de liste, coche d'article).
   - Cookie de session cross-site (web/api sur deux domaines Render
     différents) : `advanced.defaultCookieAttributes` force
     `SameSite=None; Secure` en production uniquement (voir `auth.ts`).
3. **Prefill photo → IA** ✅ — bouton "Importer depuis une photo" sur
   `RecipeFormPage` : compression client (`src/lib/compress-image.ts`,
   redimensionnée à 1600px avant envoi), appel à
   `POST /api/recipes/extract`, préremplissage du formulaire via
   `reset()` — rien n'est jamais sauvegardé sans relecture. Testé sans
   `ANTHROPIC_API_KEY` (erreur 501 propre, affichée à l'utilisateur) ;
   reste à tester avec une vraie clé une fois renseignée.
4. **Offline-first** — cache de lecture (Workbox, déjà configuré), file
   d'écriture hors-ligne à ajouter.
5. **Partage & export** ✅ — `RecipeDetailPage` (générer/révoquer un lien
   public, bouton PDF), `SharedRecipePage` publique (`/r/:token`, sans
   notes) avec import dans ses propres recettes si connecté. Export PDF
   100 % client (`@react-pdf/renderer`, chargé à la demande via `import()`
   dynamique pour ne pas alourdir le chargement initial — voir
   `src/lib/recipe-pdf.tsx`).
6. **Partage ciblé compte-à-compte (v2)** — table `recipeShares`.
7. **Stockage photo** — Cloudflare R2 si le besoin se confirme.

---

## 7. Points de vigilance

- Toujours laisser l'utilisateur relire/corriger l'extraction IA avant
  sauvegarde (jamais d'auto-save direct depuis la photo).
- `ANTHROPIC_API_KEY` est une variable serveur uniquement (Render), jamais
  `VITE_*` — elle finirait dans le bundle client.
- Chaque nouvelle route doit filtrer explicitement par `user_id` : pas de
  RLS pour rattraper un oubli.
- `share_token` doit rester imprévisible (UUID v4) et révocable — c'est déjà
  le cas (`POST/DELETE /api/recipes/:id/share`).
