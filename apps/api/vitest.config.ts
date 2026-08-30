import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Par défaut, Vitest matche aussi *.test.js — sans exclusion explicite,
    // un `dist/` généré par `npm run build` (tsc compile src/**/*.test.ts
    // en dist/**/*.test.js) fait tourner chaque test deux fois. `dist` est
    // gitignored donc invisible en CI fraîche, mais reproductible en local
    // dès qu'on a buildé avant de tester.
    exclude: ["**/node_modules/**", "**/dist/**"],
  },
});
