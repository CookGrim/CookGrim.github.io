import { Link } from "react-router-dom";
import { useShoppingLists } from "../lib/queries/shopping-lists";

export function ShoppingListsPage() {
  const { data: lists, isLoading, isError } = useShoppingLists();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-semibold text-(--color-text)">
        Liste de courses
      </h1>

      {isLoading && <p className="text-(--color-text-muted)">Chargement…</p>}
      {isError && <p className="text-sm text-red-600">Impossible de charger les listes.</p>}

      {lists && lists.length === 0 && (
        <div className="rounded-2xl border border-dashed border-(--color-surface-line) px-6 py-16 text-center">
          <p className="text-(--color-text)">Aucune liste pour l'instant.</p>
          <p className="mt-1 text-sm text-(--color-text-muted)">
            <Link to="/" className="text-(--color-plum) underline underline-offset-4">
              Choisissez des recettes
            </Link>{" "}
            pour que CookGrim compose la liste à votre place.
          </p>
        </div>
      )}

      {lists && lists.length > 0 && (
        <ul className="flex flex-col gap-3">
          {lists.map((list) => (
            <li key={list.id}>
              <Link
                to={`/courses/${list.id}`}
                className="flex items-center justify-between rounded-xl border border-(--color-surface-line) bg-(--color-surface) px-4 py-3 hover:border-(--color-plum)"
              >
                <span className="font-medium text-(--color-text)">{list.name}</span>
                <span className="text-sm text-(--color-text-muted)">
                  {new Date(list.createdAt).toLocaleDateString("fr-FR")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
