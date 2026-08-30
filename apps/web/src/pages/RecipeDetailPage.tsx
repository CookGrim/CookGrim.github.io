import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiError } from "../lib/api";
import { RECIPE_SYNCED_EVENT, type RecipeSyncedDetail } from "../lib/offline-sync";
import {
  useConsumeRecipe,
  useDeleteRecipe,
  useRecipe,
  useShareRecipe,
  useShareRecipeWithUser,
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
  const shareRecipeWithUser = useShareRecipeWithUser(id ?? "");
  const consumeRecipe = useConsumeRecipe(id ?? "");
  const deleteRecipe = useDeleteRecipe();
  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showConsume, setShowConsume] = useState(false);
  const [consumeMultiplier, setConsumeMultiplier] = useState(1);
  const [consumeSummary, setConsumeSummary] = useState<string | null>(null);
  const [showShareWithUser, setShowShareWithUser] = useState(false);
  const [sharePseudo, setSharePseudo] = useState("");
  const [shareWithUserMessage, setShareWithUserMessage] = useState<string | null>(null);
  const ingredientChecklist = useChecklist();
  const stepChecklist = useChecklist();

  // Recette créée hors-ligne (voir queries/recipes.ts, createRecipeOffline) :
  // dès que la file la synchronise pour de bon (offline-sync.ts), on quitte
  // l'URL provisoire pour la vraie, sans quoi les actions ci-dessous
  // (partager, décompter…) continueraient de viser un id que le serveur ne
  // connaît pas.
  useEffect(() => {
    function onSynced(e: Event) {
      const { tempId, recipe } = (e as CustomEvent<RecipeSyncedDetail>).detail;
      if (tempId === id) navigate(`/recettes/${recipe.id}`, { replace: true });
    }
    window.addEventListener(RECIPE_SYNCED_EVENT, onSynced);
    return () => window.removeEventListener(RECIPE_SYNCED_EVENT, onSynced);
  }, [id, navigate]);

  if (isLoading) return <p className="text-(--color-text-muted)">Chargement…</p>;
  if (isError || !recipe) return <p className="text-sm text-red-600">Recette introuvable.</p>;

  // Pas encore (ou jamais) parvenue au serveur : les actions ci-dessous
  // (modifier, partager, décompter le stock…) ont toutes besoin d'un id que
  // l'API reconnaît — seuls l'export PDF (purement client) et la suppression
  // (gérée spécifiquement, voir useDeleteRecipe) restent disponibles.
  const isUnsynced = Boolean(recipe.syncStatus);

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

  const onConsume = async () => {
    const result = await consumeRecipe.mutateAsync(consumeMultiplier);
    const decrementedCount = result.summary.filter((s) => s.decremented).length;
    const skippedCount = result.summary.length - decrementedCount;
    setConsumeSummary(
      skippedCount > 0
        ? `${decrementedCount} ingrédient${decrementedCount > 1 ? "s" : ""} décompté${decrementedCount > 1 ? "s" : ""} du stock, ${skippedCount} ignoré${skippedCount > 1 ? "s" : ""} (absent du stock ou quantité non suivie).`
        : `${decrementedCount} ingrédient${decrementedCount > 1 ? "s" : ""} décompté${decrementedCount > 1 ? "s" : ""} du stock.`,
    );
    setShowConsume(false);
  };

  const onShareWithUser = async () => {
    try {
      const result = await shareRecipeWithUser.mutateAsync(sharePseudo);
      setShareWithUserMessage(`Copie envoyée à @${result.pseudo}.`);
      setSharePseudo("");
    } catch (err) {
      setShareWithUserMessage(
        err instanceof ApiError ? err.message : "Impossible d'envoyer la copie, réessayez.",
      );
    }
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
            {recipe.sharedFromPseudo && (
              <p className="text-sm text-(--color-text-muted)">
                Reçue de @{recipe.sharedFromPseudo}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {!isUnsynced && (
              <Link
                to={`/recettes/${recipe.id}/modifier`}
                className="text-sm text-(--color-plum) underline underline-offset-4"
              >
                Modifier
              </Link>
            )}
            <button
              type="button"
              onClick={onDelete}
              className="text-sm text-(--color-text-muted) hover:text-red-600"
            >
              Supprimer
            </button>
          </div>
        </div>
      </div>

      {recipe.syncStatus === "pending" && (
        <p className="rounded-xl bg-(--color-saffron)/15 px-4 py-3 text-sm text-(--color-text)">
          Créée hors-ligne — en attente de synchronisation. Les actions ci-dessous seront
          disponibles une fois la connexion revenue.
        </p>
      )}
      {recipe.syncStatus === "failed" && (
        <p className="rounded-xl bg-red-600/10 px-4 py-3 text-sm text-red-600">
          Échec de synchronisation : cette recette n'a pas pu être enregistrée côté serveur.
          Notez son contenu puis supprimez-la et recréez-la une fois en ligne.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onExportPdf}
          disabled={isExporting}
          className="rounded-full border border-(--color-surface-line) px-4 py-2 text-sm font-medium text-(--color-text) hover:border-(--color-plum) disabled:opacity-60"
        >
          {isExporting ? "Génération…" : "Télécharger en PDF"}
        </button>

        {!isUnsynced && !shareUrl && (
          <button
            type="button"
            onClick={() => shareRecipe.mutate()}
            disabled={shareRecipe.isPending}
            className="rounded-full border border-(--color-surface-line) px-4 py-2 text-sm font-medium text-(--color-text) hover:border-(--color-plum) disabled:opacity-60"
          >
            Partager
          </button>
        )}

        {!isUnsynced && !showConsume && (
          <button
            type="button"
            onClick={() => {
              setConsumeSummary(null);
              setShowConsume(true);
            }}
            className="rounded-full border border-(--color-surface-line) px-4 py-2 text-sm font-medium text-(--color-text) hover:border-(--color-plum)"
          >
            J'ai cuisiné cette recette
          </button>
        )}

        {!isUnsynced && !showShareWithUser && (
          <button
            type="button"
            onClick={() => {
              setShareWithUserMessage(null);
              setShowShareWithUser(true);
            }}
            className="rounded-full border border-(--color-surface-line) px-4 py-2 text-sm font-medium text-(--color-text) hover:border-(--color-plum)"
          >
            Copier à un pseudo
          </button>
        )}
      </div>

      {showShareWithUser && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-(--color-surface-line) bg-(--color-surface) px-4 py-3">
          <input
            type="text"
            value={sharePseudo}
            onChange={(e) => setSharePseudo(e.target.value)}
            placeholder="Pseudo du destinataire"
            className="min-w-0 flex-1 rounded-lg border border-(--color-surface-line) bg-(--color-bg) px-3 py-1.5 text-sm text-(--color-text)"
          />
          <button
            type="button"
            onClick={onShareWithUser}
            disabled={shareRecipeWithUser.isPending || sharePseudo.trim().length === 0}
            className="rounded-full bg-(--color-plum) px-4 py-1.5 text-sm font-medium text-(--color-tile-fg) disabled:opacity-60"
          >
            {shareRecipeWithUser.isPending ? "Envoi…" : "Envoyer une copie"}
          </button>
          <button
            type="button"
            onClick={() => setShowShareWithUser(false)}
            className="text-sm text-(--color-text-muted) hover:text-red-600"
          >
            Annuler
          </button>
        </div>
      )}

      {shareWithUserMessage && (
        <p className="text-sm text-(--color-text-muted)">{shareWithUserMessage}</p>
      )}

      {showConsume && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-(--color-surface-line) bg-(--color-surface) px-4 py-3">
          <label className="flex items-center gap-1.5 text-sm text-(--color-text-muted)">
            Portions réalisées ×
            <input
              type="number"
              min={0.5}
              step={0.5}
              value={consumeMultiplier}
              onChange={(e) => setConsumeMultiplier(Number(e.target.value))}
              className="w-16 rounded-lg border border-(--color-surface-line) bg-(--color-bg) px-2 py-1 text-(--color-text)"
            />
          </label>
          <button
            type="button"
            onClick={onConsume}
            disabled={consumeRecipe.isPending}
            className="rounded-full bg-(--color-plum) px-4 py-1.5 text-sm font-medium text-(--color-tile-fg) disabled:opacity-60"
          >
            {consumeRecipe.isPending ? "Décompte…" : "Décompter du stock"}
          </button>
          <button
            type="button"
            onClick={() => setShowConsume(false)}
            className="text-sm text-(--color-text-muted) hover:text-red-600"
          >
            Annuler
          </button>
        </div>
      )}

      {consumeSummary && <p className="text-sm text-(--color-text-muted)">{consumeSummary}</p>}

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
