// TODO(supabase): sélection multi-recettes + agrégation des ingrédients
// (voir ARCHITECTURE.md, section "Liste de courses").
export function ShoppingListPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-semibold text-(--color-text)">
        Liste de courses
      </h1>
      <div className="rounded-2xl border border-dashed border-(--color-surface-line) px-6 py-16 text-center">
        <p className="text-(--color-text)">Aucune recette sélectionnée.</p>
        <p className="mt-1 text-sm text-(--color-text-muted)">
          Choisissez des recettes pour que CookGrim compose la liste à votre place.
        </p>
      </div>
    </div>
  );
}
