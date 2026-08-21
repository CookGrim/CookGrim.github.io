import { Link, useParams } from "react-router-dom";
import { useShoppingList, useToggleShoppingListItem } from "../lib/queries/shopping-lists";
import type { ShoppingListItem } from "../types/shopping-list";

function formatQuantity(item: ShoppingListItem) {
  if (item.quantity === null) return null;
  const quantity = Number.isInteger(item.quantity) ? item.quantity : item.quantity.toFixed(1);
  return [quantity, item.unit].filter(Boolean).join(" ");
}

export function ShoppingListDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: list, isLoading, isError } = useShoppingList(id);
  const toggleItem = useToggleShoppingListItem(id ?? "");

  if (isLoading) return <p className="text-(--color-text-muted)">Chargement…</p>;
  if (isError || !list) return <p className="text-sm text-red-600">Liste introuvable.</p>;

  const remaining = list.items.filter((item) => !item.checked).length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link to="/courses" className="text-sm text-(--color-plum) underline underline-offset-4">
          ← Toutes les listes
        </Link>
        <h1 className="mt-1 font-display text-2xl font-semibold text-(--color-text)">
          {list.name}
        </h1>
        <p className="text-sm text-(--color-text-muted)">
          {remaining === 0 ? "Tout est dans le panier 🎉" : `${remaining} article${remaining > 1 ? "s" : ""} restant${remaining > 1 ? "s" : ""}`}
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {list.items.map((item) => (
          <li
            key={item.id}
            className="flex items-center gap-3 rounded-xl border border-(--color-surface-line) bg-(--color-surface) px-4 py-3"
          >
            <input
              type="checkbox"
              checked={item.checked}
              onChange={(e) => toggleItem.mutate({ itemId: item.id, checked: e.target.checked })}
              className="size-5 accent-(--color-plum)"
            />
            <span
              className={`flex-1 ${item.checked ? "text-(--color-text-muted) line-through" : "text-(--color-text)"}`}
            >
              {item.name}
            </span>
            {formatQuantity(item) && (
              <span className="text-sm font-medium tabular-nums text-(--color-text-muted)">
                {formatQuantity(item)}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
