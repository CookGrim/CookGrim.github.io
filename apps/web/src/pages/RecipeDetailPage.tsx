import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  useDeleteRecipe,
  useRecipe,
  useShareRecipe,
  useUnshareRecipe,
} from "../lib/queries/recipes";

export function RecipeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: recipe, isLoading, isError } = useRecipe(id);
  const shareRecipe = useShareRecipe(id ?? "");
  const unshareRecipe = useUnshareRecipe(id ?? "");
  const deleteRecipe = useDeleteRecipe();
  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  if (isLoading) return <p className="text-(--color-text-muted)">Chargement…</p>;
  if (isError || !recipe) return <p className="text-sm text-red-600">Recette introuvable.</p>;

  const shareUrl = recipe.shareToken
    ? `${window.location.origin}/r/${recipe.shareToken}`
    : null;

  const meta = [
    recipe.servings ? `${recipe.servings} portions` : null,
    recipe.prepTimeMinutes ? `${recipe.prepTimeMinutes} min de préparation` : null,
    recipe.cookTimeMinutes ? `${recipe.cookTimeMinutes} min de cuisson` : null,
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
    <div className="flex flex-col gap-8">
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
        <h2 className="mb-3 font-display text-lg font-semibold text-(--color-text)">
          Ingrédients
        </h2>
        <ul className="flex flex-col gap-1.5">
          {recipe.ingredients.map((ing) => (
            <li key={ing.id} className="flex gap-3 text-(--color-text)">
              <span className="w-24 shrink-0 font-medium tabular-nums text-(--color-text-muted)">
                {[ing.quantity, ing.unit].filter(Boolean).join(" ")}
              </span>
              <span>{ing.name}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-semibold text-(--color-text)">Étapes</h2>
        <ol className="flex flex-col gap-3">
          {recipe.steps.map((step, i) => (
            <li key={step.id} className="flex gap-3 text-(--color-text)">
              <span className="w-6 shrink-0 font-medium text-(--color-text-muted)">{i + 1}.</span>
              <span>{step.text}</span>
            </li>
          ))}
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
