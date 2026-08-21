import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useSession } from "../lib/auth-client";
import { useCreateRecipe, useSharedRecipe } from "../lib/queries/recipes";

export function SharedRecipePage() {
  const { token } = useParams<{ token: string }>();
  const { data: recipe, isLoading, isError } = useSharedRecipe(token);
  const { data: session } = useSession();
  const createRecipe = useCreateRecipe();
  const [imported, setImported] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const onImport = async () => {
    if (!recipe) return;
    await createRecipe.mutateAsync({
      title: recipe.title,
      servings: recipe.servings,
      prepTimeMinutes: recipe.prepTimeMinutes,
      cookTimeMinutes: recipe.cookTimeMinutes,
      photoUrl: recipe.photoUrl,
      notes: null,
      ingredients: recipe.ingredients.map(({ name, quantity, unit }) => ({
        name,
        quantity,
        unit,
      })),
      steps: recipe.steps.map(({ text }) => ({ text })),
    });
    setImported(true);
  };

  const onExportPdf = async () => {
    if (!recipe) return;
    setIsExporting(true);
    try {
      const { downloadRecipePdf } = await import("../lib/recipe-pdf");
      await downloadRecipePdf(recipe);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-svh max-w-2xl flex-col gap-8 px-6 py-8">
      <Link to="/" className="flex items-center gap-2.5">
        <img src="/mark.svg" alt="" width={32} height={32} className="rounded-[22%]" />
        <span className="font-display text-xl font-semibold text-(--color-text)">CookGrim</span>
      </Link>

      {isLoading && <p className="text-(--color-text-muted)">Chargement…</p>}
      {isError && (
        <p className="text-sm text-red-600">Ce lien est invalide ou a été révoqué par son auteur.</p>
      )}

      {recipe && (
        <>
          <div>
            <h1 className="font-display text-2xl font-semibold text-(--color-text)">
              {recipe.title}
            </h1>
            <p className="text-sm text-(--color-text-muted)">
              {[
                recipe.servings ? `${recipe.servings} portions` : null,
                recipe.prepTimeMinutes ? `${recipe.prepTimeMinutes} min de préparation` : null,
                recipe.cookTimeMinutes ? `${recipe.cookTimeMinutes} min de cuisson` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
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

            {session ? (
              <button
                type="button"
                onClick={onImport}
                disabled={createRecipe.isPending || imported}
                className="rounded-full bg-(--color-saffron) px-4 py-2 text-sm font-semibold text-(--color-plum) transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {imported ? "Importée dans mes recettes ✓" : "Importer dans mes recettes"}
              </button>
            ) : (
              <Link
                to="/login"
                className="rounded-full bg-(--color-saffron) px-4 py-2 text-sm font-semibold text-(--color-plum) transition-opacity hover:opacity-90"
              >
                Se connecter pour importer
              </Link>
            )}
          </div>

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
            <h2 className="mb-3 font-display text-lg font-semibold text-(--color-text)">
              Étapes
            </h2>
            <ol className="flex flex-col gap-3">
              {recipe.steps.map((step, i) => (
                <li key={step.id} className="flex gap-3 text-(--color-text)">
                  <span className="w-6 shrink-0 font-medium text-(--color-text-muted)">
                    {i + 1}.
                  </span>
                  <span>{step.text}</span>
                </li>
              ))}
            </ol>
          </section>
        </>
      )}
    </div>
  );
}
