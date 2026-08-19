import { Link } from "react-router-dom";

// TODO(supabase): remplacer par useQuery(['recipes']) une fois le projet
// Supabase connecté (voir src/lib/supabase.ts et supabase/schema.sql).
export function RecipesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-(--color-text)">
          Mes recettes
        </h1>
        <Link
          to="/recettes/nouvelle"
          className="rounded-full bg-(--color-saffron) px-4 py-2 text-sm font-semibold text-(--color-plum) transition-opacity hover:opacity-90"
        >
          Nouvelle recette
        </Link>
      </div>

      <div className="rounded-2xl border border-dashed border-(--color-surface-line) px-6 py-16 text-center">
        <p className="text-(--color-text)">Aucune recette pour l'instant.</p>
        <p className="mt-1 text-sm text-(--color-text-muted)">
          Ajoutez-en une à la main, ou depuis une photo une fois l'extraction IA branchée.
        </p>
      </div>
    </div>
  );
}
