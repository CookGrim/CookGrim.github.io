import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.warn(
    "[CookGrim] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY manquantes — " +
      "copiez .env.example vers .env et renseignez les clés de votre projet Supabase.",
  );
}

// En dev sans projet Supabase connecté, on retombe sur un client factice pour
// que l'app démarre quand même : toute requête échouera proprement, mais
// rien ne casse au chargement.
export const supabase = createClient(
  url ?? "https://placeholder.supabase.co",
  anonKey ?? "placeholder-anon-key",
);
