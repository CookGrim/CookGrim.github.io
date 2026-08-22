import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  server: {
    proxy: {
      // apps/api tourne sur ce port en dev (voir apps/api/.env.example)
      "/api": { target: "http://localhost:8787", changeOrigin: true },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["mark.svg"],
      manifest: {
        id: "/",
        name: "CookGrim",
        short_name: "CookGrim",
        description: "Un livre de recettes qui préremplit le formulaire depuis une photo et compose la liste de courses.",
        lang: "fr",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#3C2350",
        theme_color: "#3C2350",
        categories: ["food", "lifestyle"],
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/icons/maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
        shortcuts: [
          {
            name: "Nouvelle recette",
            url: "/recettes/nouvelle",
            icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
          },
        ],
      },
      workbox: {
        // App shell + assets en cache pour la lecture hors-ligne. La coche
        // des articles de liste de courses fonctionne aussi hors-ligne (file
        // d'écriture applicative, voir src/lib/offline-queue.ts) ; les
        // autres écritures (créer/supprimer une recette, générer une liste)
        // nécessitent toujours une connexion — voir ARCHITECTURE.md.
        globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
        // Permet de recharger n'importe quelle route (ex. /recettes/xyz)
        // hors-ligne : Workbox sert l'app shell, React Router prend le relais.
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
});
