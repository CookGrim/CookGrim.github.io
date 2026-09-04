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
| Auth | Better Auth (pseudo + code à 4 chiffres, email interne dérivé du pseudo), adaptateur Drizzle/SQLite |
| Vision IA (prefill photo) | Gemini (`@google/genai`, palier gratuit), appelé depuis une route serveur (`POST /api/recipes/extract`) |
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

**`drizzle-kit migrate` plante sur Windows** (assertion libuv native,
`src/win/async.c`, apparemment un mauvais interfaçage entre le spinner de la
CLI et le client `@libsql/client` — reproduit à coup sûr sur cette machine).
Si ça plante, utiliser `npx tsx scripts/run-migrate.ts` à la place : appelle
directement l'API programmatique de `drizzle-orm` (celle que la CLI utilise
en interne), sans son wrapper qui plante. Attention en revanche si votre base
a été provisionnée à l'origine via `drizzle-kit push` plutôt que `migrate`
(sa table `__drizzle_migrations` reste alors vide alors que les tables
existent déjà) : `migrate()` essaierait de rejouer tout l'historique depuis
la migration 0000 et échouerait sur "table already exists" — il faut d'abord
baseliner les migrations déjà en place (insérer leur hash/date dans
`__drizzle_migrations` sans rejouer leur SQL) avant de laisser passer les
nouvelles.

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
packages/shared/      types + schémas Zod partagés (recette, pseudo→email),
                       construit en JS avant apps/api et apps/web (npm run build)
apps/web/            PWA (React/Vite)
  src/pages/          RecipesPage, RecipeFormPage, ShoppingListPage, GroupPage
  src/lib/api.ts       client REST vers apps/api
  src/components/SplashScreen.tsx   écran de chargement d'ouverture (logo qui bat)
  public/mark.svg      marque CookGrim, source des icônes
apps/api/             API (Hono)
  src/db/schema.ts      tables applicatives (Drizzle)
  src/db/auth-schema.ts tables Better Auth (générées)
  src/routes/           recipes.ts, shopping-lists.ts, pantry.ts, groups.ts, extract.ts
  src/lib/aggregate-ingredients.ts   agrégation liste de courses (fonction pure)
  src/lib/groups.ts     logique de groupe (fusion/départ/promotion de owner)
  src/lib/*.test.ts     tests unitaires (Vitest) des fonctions pures ci-dessus
  src/middleware/require-auth.ts   résout aussi le groupId courant (voir §4)
  scripts/run-migrate.ts       applique les migrations en attente (voir §2, note Windows)
  scripts/backfill-groups.ts   one-off : groupe solo + group_id pour les comptes pré-groupes
.github/workflows/ci.yml   type-check + lint + tests, à chaque push/PR
render.yaml           blueprint de déploiement (2 services)
```

### Tests

```bash
cd apps/api
npm test          # une fois (CI)
npm run test:watch
```

Seules les fonctions pures de `src/lib/` (`aggregate-ingredients.ts`,
`pantry-match.ts`) sont couvertes pour l'instant — pas de DB à mocker, ce
sont les points les plus critiques (agrégation liste de courses, conversions
d'unités, décompte de stock) et les plus faciles à casser silencieusement en
les modifiant. Les routes elles-mêmes n'ont pas de tests d'intégration.

---

## 4. Modèle de données

Tables applicatives (voir `apps/api/src/db/schema.ts`) :

- **recipes** — titre, portions, temps, photo (v2), `notes` (zone libre
  privée), `shareToken` (non-null = lien public actif, régénérable pour
  révoquer).
- **ingredients** / **steps** — liés par `recipeId`.
- **shoppingLists** / **shoppingListItems** — `sourceRecipeIds` (JSON) trace
  la provenance de chaque ligne agrégée.
- **groups** / **groupMembers** / **groupInvites** — foyers partagés (voir
  ci-dessous).

Pas de RLS (SQLite n'en a pas) : chaque route vérifie explicitement
`recipe.groupId === groupId` avant de lire/écrire — voir
`apps/api/src/routes/recipes.ts`.

### Groupes (foyers partagés)

Chaque utilisateur appartient à exactement un groupe à la fois
(`groupMembers.userId` unique) — un utilisateur seul a simplement un groupe
dont il est l'unique membre, créé automatiquement à l'inscription
(`auth.ts`, `databaseHooks.user.create.after`) ou à la volée si besoin
(`middleware/require-auth.ts`, filet de sécurité). `recipes`, `pantryItems`
et `shoppingLists` portent chacun un `groupId` : c'est lui, et non plus
`userId`, qui détermine l'accès (voir `lib/groups.ts` et les routes
`recipes`/`pantry`/`shopping-lists`) — `userId` ne sert plus que
d'attribution ("qui a créé cette ligne").

Invitation par pseudo (`POST /api/groups/invites`), acceptée ou refusée par
le destinataire (`groupInvites` : une ligne = une invitation en attente,
supprimée dès qu'elle est traitée). En acceptant, l'utilisateur rejoint le
groupe de l'inviteur ; ce que deviennent ses données actuelles dépend de son
groupe de départ (voir `lib/groups.ts`, `moveUserIntoGroup`) :
- s'il était seul, tout son contenu (recettes/stock/listes) part avec lui —
  fusion normale entre deux personnes jusque-là seules ;
- sinon, il part les mains vides (le contenu appartient au groupe qu'il
  quitte, pas à lui) et un nouveau owner est promu si besoin (membre restant
  le plus ancien). Même mécanique pour un départ volontaire
  (`POST /api/groups/leave`) ou une exclusion par le owner
  (`DELETE /api/groups/members/:userId`).

**`group_id` reste nullable au niveau SQLite** sur `recipes`/`pantryItems`/
`shoppingLists`, alors qu'il est conceptuellement obligatoire : SQLite ne
permet pas d'ajouter une colonne `NOT NULL` sans défaut sur une table
existante, et resserrer la contrainte après coup demanderait une
reconstruction de table. L'application garantit elle-même qu'il est toujours
renseigné à l'écriture — même logique que l'absence de RLS ci-dessus, pas de
filet de sécurité au niveau du schéma. Les comptes créés avant cette
fonctionnalité ont été rattachés à un groupe solo par
`scripts/backfill-groups.ts` (one-off, idempotent).

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
   `WEB_ORIGIN`, `GEMINI_API_KEY`.
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
   cases à cocher. `RecipeFormPage` sert aussi à l'édition
   (`/recettes/:id/modifier`, préremplie via `useRecipe` + `useUpdateRecipe`,
   `PUT /api/recipes/:id`) — la photo n'y est pas éditable (import v2),
   sa valeur existante est conservée telle quelle. Testé de bout en bout (sign-up, création de recette,
   génération de liste, coche d'article).
   - Cookie de session cross-site (web/api sur deux domaines Render
     différents) : `advanced.defaultCookieAttributes` force
     `SameSite=None; Secure` en production uniquement (voir `auth.ts`).
3. **Prefill photo → IA** ✅ — bouton "Importer depuis une photo" sur
   `RecipeFormPage` : compression client (`src/lib/compress-image.ts`,
   redimensionnée à 1600px avant envoi), appel à
   `POST /api/recipes/extract`, préremplissage du formulaire via
   `reset()` — rien n'est jamais sauvegardé sans relecture. Testé sans
   `GEMINI_API_KEY` (erreur 501 propre, affichée à l'utilisateur) ;
   reste à tester avec une vraie clé une fois renseignée.
4. **Offline-first** ✅ (partiel) — cache de lecture (Workbox). File
   d'écriture hors-ligne pour la coche des articles de liste de courses
   (le geste le plus courant hors connexion — au magasin) :
   `src/lib/offline-queue.ts` (file persistée en IndexedDB, via `idb`),
   `src/lib/offline-sync.ts` (rejeu à la reconnexion, `window`'s `online`),
   mise à jour optimiste + bannière "N modification(s) en attente" dans
   `Layout`. `isRetryableError` (`src/lib/api.ts`) décide ce qui part en
   file (échec réseau ou 5xx transitoire) vs. ce qui remonte tel quel
   (4xx — vraie erreur de validation/droits). Testé en réel : API coupée →
   coche conservée à l'écran et mise en file → API relancée → rejouée et
   persistée côté serveur.
   - **Création de recette hors-ligne** ✅ — `useCreateRecipe`
     (`src/lib/queries/recipes.ts`) pose un id local `temp-…`
     (`offline-queue.ts`, `createTempId`/`isTempId`), affiche tout de suite
     une recette optimiste marquée `syncStatus: "pending"` (liste + détail),
     et met la vraie création en file. À la reconnexion,
     `drainOfflineQueue` (`offline-sync.ts`) remplace le brouillon par la
     recette réelle (id serveur) dans le cache, et prévient
     `RecipeDetailPage` via l'évènement `cookgrim:recipe-synced` s'il est
     resté ouvert sur l'URL provisoire, pour rediriger vers la vraie. Tant
     qu'une recette n'est pas synchronisée : sélection pour une liste de
     courses, partage, "copier à un pseudo", "j'ai cuisiné" et modification
     sont masqués (id que le serveur ne connaît pas encore) — seuls export
     PDF et suppression restent disponibles. Si la création échoue pour de
     bon une fois en ligne (ex. session expirée entre-temps — vraie erreur
     4xx, pas un souci réseau), la recette reste affichée marquée
     `syncStatus: "failed"` plutôt que d'être perdue en silence, à charge
     pour l'utilisateur de la recréer.
     - **Limite connue** : ce brouillon optimiste ne vit qu'en mémoire
       (cache TanStack Query). Recharger la page pendant qu'on est encore
       hors-ligne le fait disparaître de l'écran — la requête, elle, reste
       intacte dans la file IndexedDB et se rejoue normalement à la
       reconnexion suivante ; aucune donnée n'est perdue, seul l'affichage
       est temporairement à jour du serveur plutôt que du brouillon. Même
       limite déjà présente pour la coche d'article optimiste ci-dessus.
   - **Scope restant** : éditer/supprimer une recette existante, générer une
     liste, partager restent des actions qui nécessitent d'être en ligne —
     pas besoin de réconciliation d'id là où l'id est déjà réel (édition/
     suppression), mais pas encore fait faute de besoin confirmé.
5. **Partage & export** ✅ — `RecipeDetailPage` (générer/révoquer un lien
   public, bouton PDF), `SharedRecipePage` publique (`/r/:token`, sans
   notes) avec import dans ses propres recettes si connecté. Export PDF
   100 % client (`@react-pdf/renderer`, chargé à la demande via `import()`
   dynamique pour ne pas alourdir le chargement initial — voir
   `src/lib/recipe-pdf.tsx`).
6. **Partage ciblé compte-à-compte (v2)** — table `recipeShares`.
7. **Stockage photo** — Cloudflare R2 si le besoin se confirme.
8. **Polish** ✅ (partiel) — recherche (titre, insensible aux accents) +
   tri (récent/alphabétique) sur `RecipesPage`. Manifest PWA complété
   (`id`, `scope`, `categories`, un raccourci "Nouvelle recette") et
   `navigateFallback` ajouté à Workbox pour que recharger une route
   profonde (ex. `/recettes/xyz`) hors-ligne serve l'app shell au lieu
   d'une erreur navigateur. Vérifié : manifeste valide et servi
   correctement, `sw.js` généré avec la bonne liste de précache
   (`node --check` + inspection du bundle). **Vérifié sur l'URL Render
   déployée** (Chrome DevTools → Application/Lighthouse) : l'enregistrement
   du service worker fonctionne réellement en conditions de production —
   l'échec observé plus tôt était bien une limite du navigateur sandboxé de
   l'outil, pas un bug de l'app. Recherche/tags par ingrédient restent hors
   scope (les ingrédients ne sont pas chargés dans la liste).
   - Écran de chargement d'ouverture ✅ — `SplashScreen` (logo `mark.svg` en
     grand, animation CSS "battement de cœur", respecte
     `prefers-reduced-motion`), affiché par `RequireAuth` pendant la
     vérification de session (`useSession().isPending`).
9. **Groupes partagés (foyers)** ✅ — voir §4 (Groupes) pour le modèle de
   données et la logique de fusion/départ (`lib/groups.ts`), et
   `routes/groups.ts` pour les routes (`GET/PATCH /me`, invitations, `leave`,
   exclusion de membre). `GroupPage` côté web (renommer le groupe, inviter
   par pseudo, accepter/refuser/révoquer une invitation, quitter le groupe).
   Testé de bout en bout (deux comptes, invitation, acceptation, recette et
   article de stock du premier compte visibles depuis le second après
   fusion). Migration + backfill des comptes existants appliqués en
   production (voir `scripts/run-migrate.ts` et `scripts/backfill-groups.ts`,
   §2 pour la note Windows sur `drizzle-kit migrate`).

---

## 7. Points de vigilance

- Toujours laisser l'utilisateur relire/corriger l'extraction IA avant
  sauvegarde (jamais d'auto-save direct depuis la photo).
- **La photo envoyée pour extraction IA n'est jamais sauvegardée**, ni en
  base ni sur disque côté serveur (`POST /api/recipes/extract`,
  `apps/api/src/routes/extract.ts`) : elle ne sert que le temps de l'appel
  Gemini, jamais écrite nulle part. Côté formulaire (`RecipeFormPage`), rien
  ne permet d'associer cette photo à `photoUrl` — la création force
  `photoUrl: null`, l'édition conserve la valeur déjà en base sans jamais la
  faire pointer vers la photo importée. Stockage photo prévu en v2
  (Cloudflare R2, voir §1) : à ce moment-là, bien garder ces deux flux
  distincts (upload explicite d'une photo de recette ≠ photo fournie pour
  extraction IA, qui doit rester jetable).
- `GEMINI_API_KEY` est une variable serveur uniquement (Render), jamais
  `VITE_*` — elle finirait dans le bundle client.
- Chaque nouvelle route doit filtrer explicitement par `group_id` (pas
  `user_id`, voir §4) : pas de RLS pour rattraper un oubli.
- `POST /api/groups/invites` révèle elle aussi si un pseudo existe ou non
  (comme `POST /api/recipes/:id/shares`) — même rate-limit et même
  raisonnement, voir `INVITE_RATE_LIMIT` dans `routes/groups.ts`.
- `share_token` doit rester imprévisible (UUID v4) et révocable — c'est déjà
  le cas (`POST/DELETE /api/recipes/:id/share`).
- **Rate-limit en mémoire, mono-process.** `isRateLimited` (`src/lib/rate-limit.ts`,
  utilisé pour `POST /:id/shares` et `POST /api/groups/invites`) et le
  rate-limit natif de better-auth sur `/sign-in/email` et `/sign-up/email`
  (`rateLimit.customRules` dans `auth.ts`) stockent tous les deux leurs
  compteurs en mémoire du process — scellé au seul Web Service Render
  actuel. Si l'app passe un jour à plusieurs instances, ces compteurs ne
  seraient plus partagés (chaque instance aurait sa propre limite effective,
  multipliée par le nombre d'instances) : il faudrait alors un stockage
  partagé (`storage: "database"` ou `"secondary-storage"` côté better-auth ;
  réécrire `isRateLimited` sur la même base pour `/shares` et `/invites`).
