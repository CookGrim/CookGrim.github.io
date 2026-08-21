import { createAuthClient } from "better-auth/react";

// Même origine que src/lib/api.ts : proxifiée par Vite en dev,
// VITE_API_URL en prod.
const API_URL = import.meta.env.VITE_API_URL ?? "";

export const authClient = createAuthClient({
  baseURL: API_URL,
  fetchOptions: { credentials: "include" },
});

export const { signIn, signUp, signOut, useSession } = authClient;
