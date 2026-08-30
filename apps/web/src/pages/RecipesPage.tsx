import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { RecipeIllustration } from "../components/RecipeIllustration";
import { normalizeText } from "../lib/normalize-text";
import { useCreateShoppingList } from "../lib/queries/shopping-lists";
import { useDeleteRecipe, useMissingCounts, useRecipes } from "../lib/queries/recipes";

type SortOrder = "recent" | "alpha";

export function RecipesPage() {
  const navigate = useNavigate();
  const { data: recipes, isLoading, isError } = useRecipes();
  const { data: missingCounts } = useMissingCounts();
  const deleteRecipe = useDeleteRecipe();
  const createShoppingList = useCreateShoppingList();

  const missingByRecipe = useMemo(() => {
    const map = new Map<string, { missingCount: number; totalCount: number }>();
    for (const entry of missingCounts ?? []) map.set(entry.recipeId, entry);
    return map;
  }, [missingCounts]);

  const [multipliers, setMultipliers] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("recent");

  const selectedIds = Object.keys(multipliers);

  const visibleRecipes = useMemo(() => {
    if (!recipes) return [];
    const query = normalizeText(search);
    const filtered = query
      ? recipes.filter((recipe) => normalizeText(recipe.title).includes(query))
      : recipes;
    if (sortOrder === "alpha") {
      return [...filtered].sort((a, b) => a.title.localeCompare(b.title, "fr"));
    }
    return filtered; // déjà trié par date de mise à jour (voir l'API)
  }, [recipes, search, sortOrder]);

  const toggleSelected = (id: string) => {
    setMultipliers((prev) => {
      const next = { ...prev };
      if (id in next) delete next[id];
      else next[id] = 1;
      return next;
    });
  };

  const setMultiplier = (id: string, value: number) => {
    setMultipliers((prev) => ({ ...prev, [id]: value }));
  };

  const onComposeList = async () => {
    const list = await createShoppingList.mutateAsync({
      recipes: selectedIds.map((recipeId) => ({ recipeId, multiplier: multipliers[recipeId] })),
    });
    // Info ponctuelle (pas persistée) : passée via l'état de navigation pour
    // s'afficher une fois sur l'écran de la liste, voir ShoppingListDetailPage.
    navigate(`/courses/${list.id}`, { state: { pantryDeductedCount: list.pantryDeductedCount } });
  };

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

      {isLoading && <p className="text-(--color-text-muted)">Chargement…</p>}
      {isError && <p className="text-sm text-red-600">Impossible de charger les recettes.</p>}

      {recipes && recipes.length === 0 && (
        <div className="rounded-2xl border border-dashed border-(--color-surface-line) px-6 py-16 text-center">
          <p className="text-(--color-text)">Aucune recette pour l'instant.</p>
          <p className="mt-1 text-sm text-(--color-text-muted)">
            Ajoutez-en une à la main, ou depuis une photo une fois l'extraction IA branchée.
          </p>
        </div>
      )}

      {recipes && recipes.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une recette…"
            aria-label="Rechercher une recette par titre"
            className="min-w-0 flex-1 rounded-lg border border-(--color-surface-line) bg-(--color-surface) px-3 py-2 text-(--color-text)"
          />
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as SortOrder)}
            aria-label="Trier les recettes"
            className="w-full min-w-0 shrink-0 rounded-lg border border-(--color-surface-line) bg-(--color-surface) px-3 py-2 text-sm text-(--color-text) sm:w-auto"
          >
            <option value="recent">Plus récentes</option>
            <option value="alpha">Alphabétique</option>
          </select>
        </div>
      )}

      {recipes && recipes.length > 0 && visibleRecipes.length === 0 && (
        <p className="text-sm text-(--color-text-muted)">
          Aucune recette ne correspond à « {search} ».
        </p>
      )}

      {visibleRecipes.length > 0 && (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visibleRecipes.map((recipe) => {
            const isSelected = recipe.id in multipliers;
            const missing = missingByRecipe.get(recipe.id);
            const totalMinutes = (recipe.prepTimeMinutes ?? 0) + (recipe.cookTimeMinutes ?? 0);
            const servingsLabel = recipe.servings
              ? `${recipe.servings} portion${recipe.servings > 1 ? "s" : ""}`
              : "Portions non précisées";
            const metaLabel = totalMinutes > 0 ? `${totalMinutes} min · ${servingsLabel}` : servingsLabel;
            return (
              <li
                key={recipe.id}
                className={`flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-(--color-surface) transition-colors ${
                  isSelected
                    ? "border-(--color-plum) ring-2 ring-(--color-plum)/25"
                    : "border-(--color-surface-line)"
                }`}
              >
                <div className="relative h-40 shrink-0">
                  <RecipeIllustration
                    recipeId={recipe.id}
                    title={recipe.title}
                    photoUrl={recipe.photoUrl}
                    className="h-40 w-full"
                  />
                  {!recipe.syncStatus && (
                    <button
                      type="button"
                      onClick={() => toggleSelected(recipe.id)}
                      aria-pressed={isSelected}
                      aria-label={`Sélectionner ${recipe.title} pour la liste de courses`}
                      className={`absolute left-2 top-2 flex size-7 items-center justify-center rounded-full border backdrop-blur-sm transition-colors ${
                        isSelected
                          ? "border-(--color-plum) bg-(--color-plum) text-(--color-tile-fg)"
                          : "border-(--color-plum)/30 bg-(--color-surface)/85 text-transparent"
                      }`}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={3}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="size-4"
                      >
                        <path d="M4 12l5 5L20 6" />
                      </svg>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => deleteRecipe.mutate(recipe.id)}
                    aria-label={`Supprimer ${recipe.title}`}
                    className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-(--color-surface)/85 text-(--color-text-muted) backdrop-blur-sm hover:text-red-600"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="size-3.5"
                    >
                      <path d="M5 7h14" />
                      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                      <path d="M7 7l1 13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-13" />
                    </svg>
                  </button>
                </div>

                <Link to={`/recettes/${recipe.id}`} className="flex flex-1 flex-col gap-1 px-4 py-3">
                  <p className="line-clamp-2 font-display font-semibold text-(--color-text) hover:text-(--color-plum)">
                    {recipe.title}
                  </p>
                  <p className="text-sm text-(--color-text-muted)">{metaLabel}</p>
                  {recipe.syncStatus === "pending" && (
                    <p className="text-sm text-(--color-saffron)">
                      Créée hors-ligne — en attente de synchronisation
                    </p>
                  )}
                  {recipe.syncStatus === "failed" && (
                    <p className="text-sm text-red-600">
                      Échec de synchronisation — à recréer une fois en ligne
                    </p>
                  )}
                  {!recipe.syncStatus && missing && (
                    <p
                      className={`text-sm ${
                        missing.missingCount === 0
                          ? "text-(--color-mint)"
                          : "text-(--color-text-muted)"
                      }`}
                    >
                      {missing.missingCount === 0
                        ? "Tout y est dans le stock"
                        : `${missing.missingCount} ingrédient${missing.missingCount > 1 ? "s" : ""} manquant${missing.missingCount > 1 ? "s" : ""} sur ${missing.totalCount}`}
                    </p>
                  )}
                </Link>

                {isSelected && (
                  <div className="flex items-center justify-between border-t border-dashed border-(--color-surface-line) px-4 py-2.5">
                    <span className="text-xs text-(--color-text-muted)">Quantité</span>
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => setMultiplier(recipe.id, Math.max(0.5, multipliers[recipe.id] - 0.5))}
                        aria-label="Diminuer la quantité"
                        className="flex size-7 items-center justify-center rounded-full border border-(--color-surface-line) text-(--color-text) hover:border-(--color-plum)"
                      >
                        −
                      </button>
                      <span className="min-w-8 text-center text-sm font-medium text-(--color-text)">
                        × {multipliers[recipe.id]}
                      </span>
                      <button
                        type="button"
                        onClick={() => setMultiplier(recipe.id, multipliers[recipe.id] + 0.5)}
                        aria-label="Augmenter la quantité"
                        className="flex size-7 items-center justify-center rounded-full border border-(--color-surface-line) text-(--color-text) hover:border-(--color-plum)"
                      >
                        +
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {selectedIds.length > 0 && (
        <div className="sticky bottom-4 flex justify-end">
          <button
            type="button"
            onClick={onComposeList}
            disabled={createShoppingList.isPending}
            className="rounded-full bg-(--color-plum) px-6 py-2.5 font-semibold text-(--color-tile-fg) shadow-lg transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            Composer la liste de courses ({selectedIds.length})
          </button>
        </div>
      )}
    </div>
  );
}
