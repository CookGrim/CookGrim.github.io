import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["mark.svg"],
      manifest: {
        name: "CookGrim",
        short_name: "CookGrim",
        description: "Un livre de recettes qui préremplit le formulaire depuis une photo et compose la liste de courses.",
        lang: "fr",
        start_url: "/",
        display: "standalone",
        background_color: "#3C2350",
        theme_color: "#3C2350",
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
      },
      workbox: {
        // lecture hors-ligne : app shell + assets en cache, stale-while-revalidate
        // pour les appels réseau ; les écritures (formulaires) restent en ligne
        // uniquement pour l'instant — voir ARCHITECTURE.md, phase "offline-first".
        globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
      },
    }),
  ],
});
