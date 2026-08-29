import { useState } from "react";
import { Link } from "react-router-dom";
import {
  useDeleteShoppingList,
  useRenameShoppingList,
  useShoppingLists,
} from "../lib/queries/shopping-lists";

const NAME_MAX_LENGTH = 60;

export function ShoppingListsPage() {
  const { data: lists, isLoading, isError } = useShoppingLists();
  const renameList = useRenameShoppingList();
  const deleteList = useDeleteShoppingList();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");

  const startRename = (id: string, currentName: string) => {
    setEditingId(id);
    setDraftName(currentName);
  };

  const cancelRename = () => {
    setEditingId(null);
    setDraftName("");
  };

  const confirmRename = async (id: string) => {
    const name = draftName.trim();
    if (name) await renameList.mutateAsync({ id, name });
    cancelRename();
  };

  const onDelete = (id: string, name: string) => {
    if (window.confirm(`Supprimer la liste « ${name} » ?`)) {
      deleteList.mutate(id);
    }
  };

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
            <li
              key={list.id}
              className="flex items-center gap-2 rounded-xl border border-(--color-surface-line) bg-(--color-surface) px-4 py-3 hover:border-(--color-plum)"
            >
              {editingId === list.id ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    confirmRename(list.id);
                  }}
                  className="flex min-w-0 flex-1 items-center gap-2"
                >
                  <input
                    autoFocus
                    required
                    maxLength={NAME_MAX_LENGTH}
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    aria-label="Nom de la liste"
                    className="min-w-0 flex-1 rounded-lg border border-(--color-surface-line) bg-(--color-bg) px-3 py-1.5 text-(--color-text)"
                  />
                  <button
                    type="submit"
                    disabled={renameList.isPending}
                    className="shrink-0 text-sm font-medium text-(--color-plum) disabled:opacity-60"
                  >
                    Valider
                  </button>
                  <button
                    type="button"
                    onClick={cancelRename}
                    className="shrink-0 text-sm text-(--color-text-muted)"
                  >
                    Annuler
                  </button>
                </form>
              ) : (
                <>
                  <Link
                    to={`/courses/${list.id}`}
                    className="flex min-w-0 flex-1 items-center justify-between gap-3"
                  >
                    <span className="truncate font-medium text-(--color-text)">{list.name}</span>
                    <span className="shrink-0 text-sm text-(--color-text-muted)">
                      {new Date(list.createdAt).toLocaleDateString("fr-FR")}
                    </span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => startRename(list.id, list.name)}
                    className="shrink-0 rounded-full p-2 text-(--color-text-muted) hover:text-(--color-text)"
                    title="Renommer"
                    aria-label={`Renommer ${list.name}`}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="18"
                      height="18"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M17 3a2.83 2.83 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(list.id, list.name)}
                    className="shrink-0 rounded-full p-2 text-(--color-text-muted) hover:text-red-600"
                    title="Supprimer"
                    aria-label={`Supprimer ${list.name}`}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="18"
                      height="18"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M3 6h18" />
                      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
                      <path d="M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6" />
                    </svg>
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
