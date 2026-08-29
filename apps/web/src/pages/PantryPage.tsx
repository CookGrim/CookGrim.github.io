import { useState } from "react";
import { UNITS } from "../lib/units";
import {
  useCreatePantryItem,
  useDeletePantryItem,
  usePantry,
  useUpdatePantryItem,
} from "../lib/queries/pantry";

export function PantryPage() {
  const { data: items, isLoading, isError } = usePantry();
  const createItem = useCreatePantryItem();
  const updateItem = useUpdatePantryItem();
  const deleteItem = useDeletePantryItem();

  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    await createItem.mutateAsync({
      name: trimmed,
      quantity: quantity === "" ? null : Number(quantity),
      unit: unit === "" ? null : unit,
    });
    setName("");
    setQuantity("");
    setUnit("");
  };

  const onQuantityChange = (id: string, value: string) => {
    updateItem.mutate({ id, quantity: value === "" ? null : Number(value) });
  };

  const onUnitChange = (id: string, value: string) => {
    updateItem.mutate({ id, unit: value === "" ? null : value });
  };

  const onDelete = (id: string, itemName: string) => {
    if (window.confirm(`Retirer « ${itemName} » du stock ?`)) {
      deleteItem.mutate(id);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-semibold text-(--color-text)">Mon stock</h1>
      <p className="text-sm text-(--color-text-muted)">
        Les ingrédients déjà chez vous — utilisés pour repérer ce qu'il manque dans une recette et
        pour ne pas racheter ce que vous avez déjà.
      </p>

      <form
        onSubmit={onAdd}
        className="flex flex-wrap items-end gap-2 rounded-xl border border-(--color-surface-line) bg-(--color-surface) p-4"
      >
        <label className="flex flex-1 min-w-40 flex-col gap-1 text-sm text-(--color-text-muted)">
          Ingrédient
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex. farine"
            required
            className="rounded-lg border border-(--color-surface-line) bg-(--color-bg) px-3 py-2 text-(--color-text)"
          />
        </label>
        <label className="flex w-24 flex-col gap-1 text-sm text-(--color-text-muted)">
          Quantité
          <input
            type="number"
            min={0}
            step="any"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="rounded-lg border border-(--color-surface-line) bg-(--color-bg) px-3 py-2 text-(--color-text)"
          />
        </label>
        <label className="flex w-36 flex-col gap-1 text-sm text-(--color-text-muted)">
          Unité
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="rounded-lg border border-(--color-surface-line) bg-(--color-bg) px-3 py-2 text-(--color-text)"
          >
            <option value="">—</option>
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={createItem.isPending}
          className="rounded-full bg-(--color-saffron) px-4 py-2 text-sm font-semibold text-(--color-plum) transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          Ajouter
        </button>
      </form>

      {isLoading && <p className="text-(--color-text-muted)">Chargement…</p>}
      {isError && <p className="text-sm text-red-600">Impossible de charger le stock.</p>}

      {items && items.length === 0 && (
        <div className="rounded-2xl border border-dashed border-(--color-surface-line) px-6 py-16 text-center">
          <p className="text-(--color-text)">Stock vide pour l'instant.</p>
          <p className="mt-1 text-sm text-(--color-text-muted)">
            Ajoutez ce que vous avez déjà chez vous avec le formulaire ci-dessus.
          </p>
        </div>
      )}

      {items && items.length > 0 && (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-(--color-surface-line) bg-(--color-surface) px-4 py-3"
            >
              <span className="flex-1 min-w-32 font-medium text-(--color-text)">{item.name}</span>
              <input
                type="number"
                min={0}
                step="any"
                defaultValue={item.quantity ?? ""}
                onBlur={(e) => onQuantityChange(item.id, e.target.value)}
                placeholder="—"
                aria-label={`Quantité en stock pour ${item.name}`}
                className="w-20 rounded-lg border border-(--color-surface-line) bg-(--color-bg) px-2 py-1 text-(--color-text)"
              />
              <select
                defaultValue={item.unit ?? ""}
                onChange={(e) => onUnitChange(item.id, e.target.value)}
                aria-label={`Unité pour ${item.name}`}
                className="w-32 rounded-lg border border-(--color-surface-line) bg-(--color-bg) px-2 py-1 text-(--color-text)"
              >
                <option value="">—</option>
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => onDelete(item.id, item.name)}
                className="shrink-0 text-sm text-(--color-text-muted) hover:text-red-600"
              >
                Retirer
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
