# CookGrim

Un livre de recettes qui préremplit le formulaire depuis une photo et
compose la liste de courses à partir d'une sélection de recettes.

Monorepo : `apps/web` (PWA React/Vite) + `apps/api` (serveur Hono, Turso,
Better Auth). Voir [ARCHITECTURE.md](./ARCHITECTURE.md) pour le détail.

## Démarrer

```bash
npm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
npm run dev
```

- `apps/web` → http://localhost:5173
- `apps/api` → http://localhost:8787
