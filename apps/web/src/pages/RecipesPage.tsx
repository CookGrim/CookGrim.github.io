import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCreateShoppingList } from "../lib/queries/shopping-lists";
import { useDeleteRecipe, useRecipes } from "../lib/queries/recipes";

export function RecipesPage() {
  const navigate = useNavigate();
  const { data: recipes, isLoading, isError } = useRecipes();
  const deleteRecipe = useDeleteRecipe();
  const createShoppingList = useCreateShoppingList();

  const [multipliers, setMultipliers] = useState<Record<string, number>>({});

  const selectedIds = Object.keys(multipliers);

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
    navigate(`/courses/${list.id}`);
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
        <ul className="flex flex-col gap-3">
          {recipes.map((recipe) => {
            const isSelected = recipe.id in multipliers;
            return (
              <li
                key={recipe.id}
                className="flex items-center gap-4 rounded-xl border border-(--color-surface-line) bg-(--color-surface) px-4 py-3"
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleSelected(recipe.id)}
                  className="size-5 accent-(--color-plum)"
                  aria-label={`Sélectionner ${recipe.title} pour la liste de courses`}
                />
                <Link to={`/recettes/${recipe.id}`} className="flex-1">
                  <p className="font-medium text-(--color-text) hover:text-(--color-plum)">
                    {recipe.title}
                  </p>
                  <p className="text-sm text-(--color-text-muted)">
                    {recipe.servings ? `${recipe.servings} portions` : "Portions non précisées"}
                  </p>
                </Link>
                {isSelected && (
                  <label className="flex items-center gap-1.5 text-sm text-(--color-text-muted)">
                    ×
                    <input
                      type="number"
                      min={0.5}
                      step={0.5}
                      value={multipliers[recipe.id]}
                      onChange={(e) => setMultiplier(recipe.id, Number(e.target.value))}
                      className="w-16 rounded-lg border border-(--color-surface-line) bg-(--color-bg) px-2 py-1 text-(--color-text)"
                    />
                  </label>
                )}
                <button
                  type="button"
                  onClick={() => deleteRecipe.mutate(recipe.id)}
                  className="text-sm text-(--color-text-muted) hover:text-red-600"
                >
                  Supprimer
                </button>
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
