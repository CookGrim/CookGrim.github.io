import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { ApiError } from "../lib/api";
import { useCreateRecipe } from "../lib/queries/recipes";

const recipeSchema = z.object({
  title: z.string().min(1, "Le titre est obligatoire."),
  servings: z.coerce.number().int().positive().nullable(),
  prepTimeMinutes: z.coerce.number().int().nonnegative().nullable(),
  cookTimeMinutes: z.coerce.number().int().nonnegative().nullable(),
  notes: z.string().nullable(),
  ingredients: z
    .array(
      z.object({
        name: z.string().min(1, "Nom manquant."),
        quantity: z.coerce.number().nullable(),
        unit: z.string().nullable(),
      }),
    )
    .min(1, "Ajoutez au moins un ingrédient."),
  steps: z
    .array(z.object({ text: z.string().min(1, "Étape vide.") }))
    .min(1, "Ajoutez au moins une étape."),
});

type RecipeFormInput = z.input<typeof recipeSchema>;
type RecipeFormOutput = z.output<typeof recipeSchema>;

const defaultValues: RecipeFormInput = {
  title: "",
  servings: 4,
  prepTimeMinutes: null,
  cookTimeMinutes: null,
  notes: null,
  ingredients: [{ name: "", quantity: null, unit: null }],
  steps: [{ text: "" }],
};

export function RecipeFormPage() {
  const navigate = useNavigate();
  const createRecipe = useCreateRecipe();
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RecipeFormInput, unknown, RecipeFormOutput>({
    resolver: zodResolver(recipeSchema),
    defaultValues,
  });

  const ingredients = useFieldArray({ control, name: "ingredients" });
  const steps = useFieldArray({ control, name: "steps" });

  const onSubmit = handleSubmit(async (values: RecipeFormOutput) => {
    try {
      await createRecipe.mutateAsync({ ...values, photoUrl: null });
      navigate("/");
    } catch (err) {
      setError("root", {
        message:
          err instanceof ApiError
            ? err.message
            : "Impossible d'enregistrer la recette. Réessayez.",
      });
    }
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-(--color-text)">
          Nouvelle recette
        </h1>
        <button
          type="button"
          className="rounded-full border border-(--color-surface-line) px-4 py-2 text-sm font-medium text-(--color-text-muted)"
          disabled
          title="Prérempli une fois l'extraction IA branchée (voir ARCHITECTURE.md)"
        >
          Importer depuis une photo
        </button>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-(--color-text)">Titre</span>
        <input
          {...register("title")}
          className="rounded-lg border border-(--color-surface-line) bg-(--color-surface) px-3 py-2 text-(--color-text)"
          placeholder="Tarte aux pommes de grand-mère"
        />
        {errors.title && <span className="text-sm text-red-600">{errors.title.message}</span>}
      </label>

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
        <label className="flex max-w-32 flex-col gap-1.5">
          <span className="text-sm font-medium text-(--color-text)">Cuisson (min)</span>
          <input
            type="number"
            {...register("cookTimeMinutes")}
            className="rounded-lg border border-(--color-surface-line) bg-(--color-surface) px-3 py-2 text-(--color-text)"
          />
        </label>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-medium text-(--color-text)">Ingrédients</legend>
        {ingredients.fields.map((field, index) => (
          <div key={field.id} className="flex gap-2">
            <input
              {...register(`ingredients.${index}.quantity`)}
              placeholder="Qté"
              className="w-20 rounded-lg border border-(--color-surface-line) bg-(--color-surface) px-3 py-2 text-(--color-text)"
            />
            <input
              {...register(`ingredients.${index}.unit`)}
              placeholder="Unité"
              className="w-24 rounded-lg border border-(--color-surface-line) bg-(--color-surface) px-3 py-2 text-(--color-text)"
            />
            <input
              {...register(`ingredients.${index}.name`)}
              placeholder="Farine"
              className="flex-1 rounded-lg border border-(--color-surface-line) bg-(--color-surface) px-3 py-2 text-(--color-text)"
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
        Enregistrer la recette
      </button>
    </form>
  );
}
