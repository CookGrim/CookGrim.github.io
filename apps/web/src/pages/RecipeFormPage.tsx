import { ingredientInputSchema, recipeInputSchema } from "@cookgrim/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { ApiError } from "../lib/api";
import { compressImage } from "../lib/compress-image";
import { useCreateRecipe, useExtractRecipe, useRecipe, useUpdateRecipe } from "../lib/queries/recipes";
import { UNITS } from "../lib/units";

// Étend le schéma partagé avec l'API (packages/shared/src/recipe.ts) : les
// <input> HTML ne produisent que des chaînes, d'où le `coerce` sur les
// champs numériques. `photoUrl` n'est pas un champ du formulaire (photo
// gérée séparément, voir onPhotoSelected/onSubmit) — on l'exclut plutôt que
// de le rendre optionnel, pour ne pas laisser croire qu'il est éditable ici.
const recipeSchema = recipeInputSchema.omit({ photoUrl: true }).extend({
  servings: z.coerce.number().int().positive().nullable(),
  prepTimeMinutes: z.coerce.number().int().nonnegative().nullable(),
  cookTimeMinutes: z.coerce.number().int().nonnegative().nullable(),
  cookTempCelsius: z.coerce.number().int().nonnegative().nullable(),
  ingredients: z
    .array(ingredientInputSchema.extend({ quantity: z.coerce.number().nullable() }))
    .min(1, "Ajoutez au moins un ingrédient."),
});

type RecipeFormInput = z.input<typeof recipeSchema>;
type RecipeFormOutput = z.output<typeof recipeSchema>;

const defaultValues: RecipeFormInput = {
  title: "",
  servings: 4,
  prepTimeMinutes: null,
  cookTimeMinutes: null,
  cookTempCelsius: null,
  notes: null,
  ingredients: [{ name: "", quantity: null, unit: null }],
  steps: [{ text: "" }],
};

export function RecipeFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);
  // En édition, on charge la recette existante pour préremplir le
  // formulaire (voir l'effet ci-dessous) ; en création, cette query reste
  // simplement désactivée (id undefined, voir useRecipe).
  const { data: existingRecipe, isLoading: isLoadingRecipe } = useRecipe(id);
  const createRecipe = useCreateRecipe();
  const updateRecipe = useUpdateRecipe(id ?? "");
  const extractRecipe = useExtractRecipe();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [extractError, setExtractError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RecipeFormInput, unknown, RecipeFormOutput>({
    resolver: zodResolver(recipeSchema),
    defaultValues,
  });

  const ingredients = useFieldArray({ control, name: "ingredients" });
  const steps = useFieldArray({ control, name: "steps" });

  // Préremplissage depuis la recette existante, une fois chargée. Ne dépend
  // que de son id : un changement de titre/ingrédients pendant l'édition ne
  // doit pas écraser ce que l'utilisateur est en train de taper.
  useEffect(() => {
    if (!existingRecipe) return;
    reset({
      title: existingRecipe.title,
      servings: existingRecipe.servings,
      prepTimeMinutes: existingRecipe.prepTimeMinutes,
      cookTimeMinutes: existingRecipe.cookTimeMinutes,
      cookTempCelsius: existingRecipe.cookTempCelsius,
      notes: existingRecipe.notes,
      ingredients: existingRecipe.ingredients.map((ing) => ({
        name: ing.name,
        quantity: ing.quantity,
        unit: ing.unit,
      })),
      steps: existingRecipe.steps.map((step) => ({ text: step.text })),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingRecipe?.id]);

  const onSubmit = handleSubmit(async (values: RecipeFormOutput) => {
    try {
      if (isEditing) {
        // La photo n'est pas éditable depuis ce formulaire (import v2) : on
        // conserve celle déjà associée à la recette plutôt que de l'effacer.
        await updateRecipe.mutateAsync({ ...values, photoUrl: existingRecipe?.photoUrl ?? null });
        navigate(`/recettes/${id}`);
      } else {
        await createRecipe.mutateAsync({ ...values, photoUrl: null });
        navigate("/");
      }
    } catch (err) {
      setError("root", {
        message:
          err instanceof ApiError
            ? err.message
            : "Impossible d'enregistrer la recette. Réessayez.",
      });
    }
  });

  const onPickPhoto = () => fileInputRef.current?.click();

  const onPhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permet de reprendre la même photo si besoin
    if (!file) return;

    setExtractError(null);
    try {
      const image = await compressImage(file);
      const draft = await extractRecipe.mutateAsync(image);
      reset({
        title: draft.title || "",
        servings: draft.servings,
        prepTimeMinutes: null,
        cookTimeMinutes: null,
        cookTempCelsius: null,
        notes: null,
        ingredients:
          draft.ingredients.length > 0
            ? draft.ingredients
            : [{ name: "", quantity: null, unit: null }],
        steps: draft.steps.length > 0 ? draft.steps.map((text) => ({ text })) : [{ text: "" }],
      });
    } catch (err) {
      setExtractError(
        err instanceof ApiError
          ? err.message
          : "Impossible d'analyser cette photo. Réessayez, ou remplissez le formulaire à la main.",
      );
    }
  };

  if (isEditing && isLoadingRecipe) {
    return <p className="text-(--color-text-muted)">Chargement…</p>;
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-semibold text-(--color-text)">
          {isEditing ? "Modifier la recette" : "Nouvelle recette"}
        </h1>
        <div className="flex flex-col items-end gap-1">
          <button
            type="button"
            onClick={onPickPhoto}
            disabled={extractRecipe.isPending}
            className="rounded-full border border-(--color-surface-line) px-4 py-2 text-sm font-medium text-(--color-text) hover:border-(--color-plum) disabled:opacity-60"
          >
            {extractRecipe.isPending ? "Analyse en cours…" : "Importer depuis une photo"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onPhotoSelected}
            className="hidden"
          />
          {extractError && <span className="text-xs text-red-600">{extractError}</span>}
        </div>
      </div>
      <p className="-mt-6 text-xs text-(--color-text-muted)">
        L'IA prérempli le formulaire depuis la photo — relisez et corrigez avant d'enregistrer,
        rien n'est sauvegardé automatiquement.
      </p>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-(--color-text)">Titre</span>
        <input
          {...register("title")}
          className="rounded-lg border border-(--color-surface-line) bg-(--color-surface) px-3 py-2 text-(--color-text)"
          placeholder="Tarte aux pommes de grand-mère"
        />
        {errors.title && <span className="text-sm text-red-600">{errors.title.message}</span>}
      </label>

      <div className="flex flex-col gap-4">
        <div className="flex gap-4">
          <label className="flex max-w-32 flex-col gap-1.5">
            <span className="text-sm font-medium text-(--color-text)">Portions</span>
            <input
              type="number"
              {...register("servings")}
              className="rounded-lg border border-(--color-surface-line) bg-(--color-surface) px-3 py-2 text-(--color-text)"
            />
          </label>
          <label className="flex max-w-32 flex-col gap-1.5">
            <span className="text-sm font-medium text-(--color-text)">Préparation (min)</span>
            <input
              type="number"
              {...register("prepTimeMinutes")}
              className="rounded-lg border border-(--color-surface-line) bg-(--color-surface) px-3 py-2 text-(--color-text)"
            />
          </label>
        </div>
        <div className="flex gap-4">
          <label className="flex max-w-32 flex-col gap-1.5">
            <span className="text-sm font-medium text-(--color-text)">Cuisson (min)</span>
            <input
              type="number"
              {...register("cookTimeMinutes")}
              className="rounded-lg border border-(--color-surface-line) bg-(--color-surface) px-3 py-2 text-(--color-text)"
            />
          </label>
          <label className="flex max-w-32 flex-col gap-1.5">
            <span className="text-sm font-medium text-(--color-text)">Température (°C)</span>
            <input
              type="number"
              {...register("cookTempCelsius")}
              className="rounded-lg border border-(--color-surface-line) bg-(--color-surface) px-3 py-2 text-(--color-text)"
            />
          </label>
        </div>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-medium text-(--color-text)">Ingrédients</legend>
        {ingredients.fields.map((field, index) => (
          <div key={field.id} className="flex flex-col gap-2">
            <div className="flex gap-2">
              <input
                {...register(`ingredients.${index}.quantity`)}
                placeholder="Qté"
                className="w-20 rounded-lg border border-(--color-surface-line) bg-(--color-surface) px-3 py-2 text-(--color-text)"
              />
              <Controller
                control={control}
                name={`ingredients.${index}.unit`}
                render={({ field }) => (
                  <select
                    name={field.name}
                    ref={field.ref}
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value || null)}
                    onBlur={field.onBlur}
                    className="w-28 rounded-lg border border-(--color-surface-line) bg-(--color-surface) px-3 py-2 text-(--color-text)"
                  >
                    <option value="">Unité</option>
                    {UNITS.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                )}
              />
              <button
                type="button"
                onClick={() => ingredients.remove(index)}
                className="px-2 text-(--color-text-muted) hover:text-(--color-text)"
                aria-label="Retirer l'ingrédient"
              >
                ✕
              </button>
            </div>
            <input
              {...register(`ingredients.${index}.name`)}
              placeholder="Farine"
              className="w-full rounded-lg border border-(--color-surface-line) bg-(--color-surface) px-3 py-2 text-(--color-text)"
            />
          </div>
        ))}
        {errors.ingredients?.root && (
          <span className="text-sm text-red-600">{errors.ingredients.root.message}</span>
        )}
        <button
          type="button"
          onClick={() => ingredients.append({ name: "", quantity: null, unit: null })}
          className="self-start text-sm font-medium text-(--color-plum) underline decoration-(--color-saffron) decoration-2 underline-offset-4"
        >
          + Ajouter un ingrédient
        </button>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-medium text-(--color-text)">Étapes</legend>
        {steps.fields.map((field, index) => (
          <div key={field.id} className="flex gap-2">
            <span className="pt-2 text-sm text-(--color-text-muted)">{index + 1}.</span>
            <textarea
              {...register(`steps.${index}.text`)}
              rows={2}
              className="flex-1 rounded-lg border border-(--color-surface-line) bg-(--color-surface) px-3 py-2 text-(--color-text)"
            />
            <button
              type="button"
              onClick={() => steps.remove(index)}
              className="px-2 text-(--color-text-muted) hover:text-(--color-text)"
              aria-label="Retirer l'étape"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => steps.append({ text: "" })}
          className="self-start text-sm font-medium text-(--color-plum) underline decoration-(--color-saffron) decoration-2 underline-offset-4"
        >
          + Ajouter une étape
        </button>
      </fieldset>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-(--color-text)">Notes (privées)</span>
        <textarea
          {...register("notes")}
          rows={3}
          placeholder="Mieux avec moins de sucre, cuire 5 min de plus si moule en verre…"
          className="rounded-lg border border-(--color-surface-line) bg-(--color-surface) px-3 py-2 text-(--color-text)"
        />
      </label>

      {errors.root && <p className="text-sm text-red-600">{errors.root.message}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="self-start rounded-full bg-(--color-plum) px-6 py-2.5 font-semibold text-(--color-tile-fg) transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {isEditing ? "Enregistrer les modifications" : "Enregistrer la recette"}
      </button>
    </form>
  );
}
