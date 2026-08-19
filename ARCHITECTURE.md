# CookGrim — note technique (architecture & maintenance)

PWA de recettes : formulaire de saisie (préremplissable depuis une photo via
IA vision), génération de liste de courses à partir d'une sélection de
recettes, partage par lien public et export PDF. Ce document sert de
référence pour la maintenance, dans le même esprit que celui de MindFlow.

---

## 1. Stack technique

| Domaine | Techno |
|---|---|
| Langage | TypeScript |
| UI | React 19 + Tailwind CSS v4 (config CSS-first, voir `src/index.css`) |
| Build | Vite |
| Routing | React Router |
| État serveur / cache | TanStack Query |
| Formulaires | React Hook Form + Zod |
| Backend | Supabase (Postgres + Auth + Storage + Edge Functions) |
| Vision IA (prefill photo) | Claude (API Anthropic), appelée depuis une Edge Function |
| PWA | `vite-plugin-pwa` (Workbox) |
| Export PDF | `@react-pdf/renderer` (à ajouter en phase 5, génération 100% client) |

Le projet n'est pas encore un dépôt Git à la création du scaffold — voir la
fin de ce document pour l'initialiser.

### Lancer en local

```bash
npm install
cp .env.example .env   # puis renseigner VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm run dev
```

Sans projet Supabase connecté, l'app démarre quand même (le client Supabase
retombe sur des valeurs factices) mais aucune requête ne fonctionnera —
suffisant pour travailler sur l'UI seule.

### Régénérer les icônes

La marque (`public/mark.svg`) est la source de vérité. Après toute
modification :

```bash
npm run icons
```

Ça régénère `public/icons/*.png` (icône d'app, maskable, apple-touch-icon)
via `scripts/generate-icons.mjs` (sharp).

---

## 2. Arborescence

```
src/
  components/     Layout (nav + wordmark), composants partagés
  pages/          RecipesPage, RecipeFormPage, ShoppingListPage, ...
  lib/            supabase.ts (client), à compléter (queryClient, pdf, etc.)
  types/          recipe.ts — modèle de données côté front
supabase/
  schema.sql      Schéma Postgres + RLS + fonction de partage public
scripts/
  generate-icons.mjs
public/
  mark.svg        Marque CookGrim (marmite), source des icônes PWA
```

---

## 3. Modèle de données

Voir `supabase/schema.sql` pour le détail (colonnes, RLS, fonction
`get_recipe_by_share_token`). Résumé :

- **recipes** — titre, portions, temps, photo, `notes` (zone libre privée),
  `share_token` (non-null = lien public actif, régénérable pour révoquer).
- **ingredients** / **steps** — liés à une recette par `recipe_id`.
- **shopping_lists** / **shopping_list_items** — une liste = une sélection de
  recettes agrégée ; `source_recipe_ids` trace la provenance de chaque ligne.
- RLS : chacun ne lit/écrit que ses propres lignes (`auth.uid() = user_id`,
  ou jointure sur `recipe_id`/`shopping_list_id`).
- Partage public : **pas** de policy RLS ouverte sur `share_token` (ça
  exposerait la liste de toutes les recettes publiques). La lecture passe par
  la fonction `get_recipe_by_share_token(token)`, `security definer`, qui
  n'accepte qu'une recherche par token exact connu du visiteur via l'URL.

---

## 4. Roadmap

1. **Setup** ✅ — scaffold Vite/React/TS, Tailwind, PWA, schéma Supabase.
2. **CRUD recettes manuel** — brancher `RecipeFormPage`/`RecipesPage` sur
   Supabase (`useQuery`/`useMutation`), auth (email magic link).
3. **Prefill photo → IA** — Edge Function Supabase qui appelle Claude
   (vision) avec un prompt à schéma JSON strict (titre/portions/
   ingrédients/étapes), préremplit le formulaire pour relecture.
4. **Liste de courses** — sélection multi-recettes + multiplicateur de
   portions, agrégation des ingrédients (nom normalisé, somme si unité
   compatible), catégorisation, cases à cocher.
5. **Partage & export** — lien public (`/r/<share_token>`) + import chez le
   visiteur, export PDF (`@react-pdf/renderer`, génération client).
6. **Offline-first** — cache de lecture (déjà en place via Workbox), file
   d'écriture hors-ligne à ajouter.
7. **Partage ciblé compte-à-compte (v2)** — table `recipe_shares`, onglet
   "Partagées avec moi".
8. **Polish** — recherche/tags, Lighthouse PWA.

---

## 5. Points de vigilance

- Toujours laisser l'utilisateur relire/corriger l'extraction IA avant
  sauvegarde (jamais d'auto-save direct depuis la photo).
- Notes personnelles exclues par défaut de tout partage (lien public, PDF) —
  case à cocher explicite pour les inclure.
- Compresser/redimensionner la photo avant envoi à l'Edge Function (coût +
  temps de réponse).
- `ANTHROPIC_API_KEY` est un secret Supabase (`supabase secrets set`),
  jamais une variable `VITE_*` (elle finirait dans le bundle client).

---

## 6. Initialiser Git

```bash
git init
git add -A
git commit -m "Scaffold initial CookGrim"
```
