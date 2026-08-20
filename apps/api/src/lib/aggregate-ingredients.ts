// Cœur de la liste de courses : agrège les ingrédients de plusieurs recettes
// (avec multiplicateur de portions) en lignes uniques. Fonction pure, testable
// sans DB.

export type SourceIngredient = {
  recipeId: string;
  name: string;
  quantity: number | null;
  unit: string | null;
};

export type AggregatedItem = {
  name: string;
  quantity: number | null;
  unit: string | null;
  sourceRecipeIds: string[];
};

function normalizeName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeUnit(unit: string | null) {
  return (unit ?? "").trim().toLowerCase();
}

export function aggregateIngredients(
  ingredients: SourceIngredient[],
  multipliers: Record<string, number>,
): AggregatedItem[] {
  const byKey = new Map<string, AggregatedItem & { displayName: string }>();
  const freeform: AggregatedItem[] = [];

  for (const ing of ingredients) {
    const multiplier = multipliers[ing.recipeId] ?? 1;
    const quantity = ing.quantity === null ? null : ing.quantity * multiplier;
    const nameKey = normalizeName(ing.name);
    const unitKey = normalizeUnit(ing.unit);

    // Pas de quantité/unité exploitable : on ne fusionne pas, chaque ligne
    // reste distincte pour éviter de perdre de l'info (ex. "sel", "poivre").
    if (quantity === null || !unitKey) {
      freeform.push({
        name: ing.name.trim(),
        quantity,
        unit: ing.unit,
        sourceRecipeIds: [ing.recipeId],
      });
      continue;
    }

    const key = `${nameKey}::${unitKey}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.quantity = (existing.quantity ?? 0) + quantity;
      if (!existing.sourceRecipeIds.includes(ing.recipeId)) {
        existing.sourceRecipeIds.push(ing.recipeId);
      }
    } else {
      byKey.set(key, {
        displayName: ing.name.trim(),
        name: ing.name.trim(),
        quantity,
        unit: ing.unit,
        sourceRecipeIds: [ing.recipeId],
      });
    }
  }

  return [...byKey.values(), ...freeform].sort((a, b) => a.name.localeCompare(b.name, "fr"));
}
