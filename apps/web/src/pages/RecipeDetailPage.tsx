import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  useDeleteRecipe,
  useRecipe,
  useShareRecipe,
  useUnshareRecipe,
} from "../lib/queries/recipes";

// Progression (ingrédients/étapes cochés) purement volatile : elle vit tant
// que l'affichage de la recette reste monté, et repart de zéro dès qu'on le
// quitte (le composant appelant remonte ce hook via `key={recipe.id}`).
function useChecklist() {
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const toggle = (itemId: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  return { checked, toggle };
}

export function RecipeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: recipe, isLoading, isError } = useRecipe(id);
  const shareRecipe = useShareRecipe(id ?? "");
  const unshareRecipe = useUnshareRecipe(id ?? "");
  const deleteRecipe = useDeleteRecipe();
  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const ingredientChecklist = useChecklist();
  const stepChecklist = useChecklist();

  if (isLoading) return <p className="text-(--color-text-muted)">Chargement…</p>;
  if (isError || !recipe) return <p className="text-sm text-red-600">Recette introuvable.</p>;

  const shareUrl = recipe.shareToken
    ? `${window.location.origin}/r/${recipe.shareToken}`
    : null;

  const meta = [
    recipe.servings ? `${recipe.servings} portions` : null,
    recipe.prepTimeMinutes ? `${recipe.prepTimeMinutes} min de préparation` : null,
    recipe.cookTimeMinutes ? `${recipe.cookTimeMinutes} min de cuisson` : null,
    recipe.cookTempCelsius ? `${recipe.cookTempCelsius} °C` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const onCopyLink = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const onExportPdf = async () => {
    setIsExporting(true);
    try {
      // Chargé à la demande : @react-pdf/renderer est lourd, inutile de
      // l'inclure dans le bundle initial pour les visiteurs qui n'exportent
      // jamais de PDF.
      const { downloadRecipePdf } = await import("../lib/recipe-pdf");
      await downloadRecipePdf(recipe);
    } finally {
      setIsExporting(false);
    }
  };

  const onDelete = async () => {
    await deleteRecipe.mutateAsync(recipe.id);
    navigate("/");
  };

  return (
    <div key={recipe.id} className="flex flex-col gap-8">
      <div>
        <Link to="/" className="text-sm text-(--color-plum) underline underline-offset-4">
          ← Mes recettes
        </Link>
        <div className="mt-1 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold text-(--color-text)">
              {recipe.title}
            </h1>
            {meta && <p className="text-sm text-(--color-text-muted)">{meta}</p>}
          </div>
          <button
            type="button"
            onClick={onDelete}
            className="shrink-0 text-sm text-(--color-text-muted) hover:text-red-600"
          >
            Supprimer
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onExportPdf}
          disabled={isExporting}
          className="rounded-full border border-(--color-surface-line) px-4 py-2 text-sm font-medium text-(--color-text) hover:border-(--color-plum) disabled:opacity-60"
        >
          {isExporting ? "Génération…" : "Télécharger en PDF"}
        </button>

        {!shareUrl && (
          <button
            type="button"
            onClick={() => shareRecipe.mutate()}
            disabled={shareRecipe.isPending}
            className="rounded-full border border-(--color-surface-line) px-4 py-2 text-sm font-medium text-(--color-text) hover:border-(--color-plum) disabled:opacity-60"
          >
            Partager
          </button>
        )}
      </div>

      {shareUrl && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-(--color-surface-line) bg-(--color-surface) px-4 py-3">
          <input
            readOnly
            value={shareUrl}
            className="min-w-0 flex-1 bg-transparent text-sm text-(--color-text)"
            onFocus={(e) => e.currentTarget.select()}
          />
          <button
            type="button"
            onClick={onCopyLink}
            className="rounded-full bg-(--color-plum) px-4 py-1.5 text-sm font-medium text-(--color-tile-fg)"
          >
            {copied ? "Copié !" : "Copier le lien"}
          </button>
          <button
            type="button"
            onClick={() => unshareRecipe.mutate()}
            disabled={unshareRecipe.isPending}
            className="text-sm text-(--color-text-muted) hover:text-red-600"
          >
            Arrêter le partage
          </button>
        </div>
      )}
      {shareUrl && (
        <p className="-mt-6 text-xs text-(--color-text-muted)">
          Les notes privées ne sont jamais incluses dans le lien partagé.
        </p>
      )}

      <section>
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h2 className="font-display text-lg font-semibold text-(--color-text)">Ingrédients</h2>
          <p className="text-xs text-(--color-text-muted)">
            {ingredientChecklist.checked.size < recipe.ingredients.length
              ? `${recipe.ingredients.length - ingredientChecklist.checked.size} manquant${recipe.ingredients.length - ingredientChecklist.checked.size > 1 ? "s" : ""}`
              : "Tout est là ✓"}
          </p>
        </div>
        <ul className="flex flex-col gap-1.5">
          {recipe.ingredients.map((ing) => {
            const isChecked = ingredientChecklist.checked.has(ing.id);
            return (
              <li key={ing.id}>
                <label className="flex cursor-pointer items-center gap-3 text-(--color-text)">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => ingredientChecklist.toggle(ing.id)}
                    className="size-4 shrink-0 accent-(--color-plum)"
                  />
                  <span
                    className={`w-24 shrink-0 font-medium tabular-nums ${isChecked ? "text-(--color-text-muted) line-through" : "text-(--color-text-muted)"}`}
                  >
                    {[ing.quantity, ing.unit].filter(Boolean).join(" ")}
                  </span>
                  <span className={isChecked ? "text-(--color-text-muted) line-through" : ""}>
                    {ing.name}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h2 className="font-display text-lg font-semibold text-(--color-text)">Étapes</h2>
          <p className="text-xs text-(--color-text-muted)">
            {stepChecklist.checked.size < recipe.steps.length
              ? `${recipe.steps.length - stepChecklist.checked.size} restante${recipe.steps.length - stepChecklist.checked.size > 1 ? "s" : ""}`
              : "Terminé ✓"}
          </p>
        </div>
        <ol className="flex flex-col gap-3">
          {recipe.steps.map((step, i) => {
            const isChecked = stepChecklist.checked.has(step.id);
            return (
              <li key={step.id}>
                <label className="flex cursor-pointer items-start gap-3 text-(--color-text)">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => stepChecklist.toggle(step.id)}
                    className="mt-0.5 size-4 shrink-0 accent-(--color-plum)"
                  />
                  <span className="w-6 shrink-0 font-medium text-(--color-text-muted)">
                    {i + 1}.
                  </span>
                  <span className={isChecked ? "text-(--color-text-muted) line-through" : ""}>
                    {step.text}
                  </span>
                </label>
              </li>
            );
          })}
        </ol>
      </section>

      {recipe.notes && (
        <section className="rounded-xl bg-(--color-surface) px-4 py-3">
          <h2 className="mb-1.5 font-display text-sm font-semibold text-(--color-text)">
            Notes (privées)
          </h2>
          <p className="whitespace-pre-wrap text-sm text-(--color-text-muted)">{recipe.notes}</p>
        </section>
      )}
    </div>
  );
}
