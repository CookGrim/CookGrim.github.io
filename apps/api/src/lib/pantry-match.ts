// Rapproche les ingrédients d'une recette du stock de l'utilisateur pour
// compter ce qui manque. Fonction pure, testable sans DB — même esprit que
// aggregate-ingredients.ts, dont elle réutilise la normalisation nom/unité.
import { normalizeName, normalizeUnit } from "./aggregate-ingredients.js";
import type { AggregatedItem } from "./aggregate-ingredients.js";

export type PantryEntry = {
  name: string;
  quantity: number | null;
  unit: string | null;
};

export type RecipeIngredientLike = {
  name: string;
  quantity: number | null;
  unit: string | null;
};

export type MissingCount = {
  missingCount: number;
  totalCount: number;
};

// Conversion limitée à deux familles simples (masse, volume) — les autres
// unités de la liste fermée (UNITS côté front : pincée, sachet, gousse...)
// n'ont pas de facteur de conversion fiable entre elles et exigent une
// correspondance exacte.
const MASS_TO_GRAMS: Record<string, number> = { g: 1, kg: 1000 };
const VOLUME_TO_ML: Record<string, number> = { ml: 1, cl: 10, l: 1000 };

function toBaseUnit(quantity: number, unit: string | null) {
  const key = normalizeUnit(unit);
  if (key in MASS_TO_GRAMS) return { family: "mass", value: quantity * MASS_TO_GRAMS[key] };
  if (key in VOLUME_TO_ML) return { family: "volume", value: quantity * VOLUME_TO_ML[key] };
  return null;
}

// Convertit `quantity` (dans `fromUnit`) vers `toUnit`, ou `null` si les deux
// unités ne sont pas de la même famille convertible (voir toBaseUnit).
function convert(quantity: number, fromUnit: string | null, toUnit: string | null): number | null {
  const from = toBaseUnit(quantity, fromUnit);
  const toUnitFactor = toBaseUnit(1, toUnit);
  if (!from || !toUnitFactor || from.family !== toUnitFactor.family) return null;
  return from.value / toUnitFactor.value;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// Quantité de `matches` disponible, exprimée dans l'unité de la ligne
// demandée (`quantity`/`unit`) : somme directe des lignes de stock dans la
// même unité, plus les lignes convertibles (g/kg, ml/cl/l) reconverties.
// Les lignes de stock dans une unité non comparable sont ignorées plutôt que
// de fausser le calcul.
function coveredQuantity(
  quantity: number,
  unit: string | null,
  matches: PantryEntry[],
): number {
  const unitKey = normalizeUnit(unit);
  let covered = matches
    .filter((m) => m.quantity !== null && normalizeUnit(m.unit) === unitKey)
    .reduce((sum, m) => sum + (m.quantity as number), 0);

  const base = toBaseUnit(quantity, unit);
  if (base) {
    const unitFactor = base.value / quantity; // 1 unité de `unit` = unitFactor en unité de base
    covered += matches
      .filter((m) => m.quantity !== null && normalizeUnit(m.unit) !== unitKey)
      .reduce((sum, m) => {
        const matchBase = toBaseUnit(m.quantity as number, m.unit);
        return matchBase && matchBase.family === base.family
          ? sum + matchBase.value / unitFactor
          : sum;
      }, 0);
  }

  return covered;
}

function isCovered(ingredient: RecipeIngredientLike, pantry: PantryEntry[]): boolean {
  const nameKey = normalizeName(ingredient.name);
  const matches = pantry.filter((p) => normalizeName(p.name) === nameKey);
  if (matches.length === 0) return false;

  // Ingrédient sans quantité exploitable (ex. "sel", "poivre") : la
  // présence dans le stock suffit, on ne peut de toute façon rien comparer.
  if (ingredient.quantity === null) return true;

  // Au moins une ligne de stock "j'en ai" sans quantité suivie : on suppose
  // que c'est assez plutôt que de la compter comme manquante.
  if (matches.some((m) => m.quantity === null)) return true;

  return coveredQuantity(ingredient.quantity, ingredient.unit, matches) >= ingredient.quantity;
}

export function computeMissing(
  ingredients: RecipeIngredientLike[],
  pantry: PantryEntry[],
): MissingCount {
  const totalCount = ingredients.length;
  const missingCount = ingredients.filter((ing) => !isCovered(ing, pantry)).length;
  return { missingCount, totalCount };
}

// Retranche le stock disponible des lignes agrégées d'une liste de courses :
// une ligne entièrement couverte disparaît, une ligne partiellement couverte
// ne garde que la quantité restant à acheter. Même règle de correspondance
// que computeMissing (nom normalisé, unité exacte ou convertible, "j'en ai"
// = couvert).
export function deductPantryFromAggregated(
  items: AggregatedItem[],
  pantry: PantryEntry[],
): AggregatedItem[] {
  const result: AggregatedItem[] = [];

  for (const item of items) {
    const nameKey = normalizeName(item.name);
    const matches = pantry.filter((p) => normalizeName(p.name) === nameKey);

    if (matches.length === 0) {
      result.push(item);
      continue;
    }

    if (item.quantity === null) continue; // présence en stock suffit (ex. "sel")
    if (matches.some((m) => m.quantity === null)) continue; // "j'en ai" = couvert

    const remaining = item.quantity - coveredQuantity(item.quantity, item.unit, matches);
    if (remaining > 1e-9) {
      result.push({ ...item, quantity: round2(remaining) });
    }
    // sinon : entièrement couvert par le stock, la ligne ne rejoint pas la liste.
  }

  return result;
}

export type PantryAdjustment =
  | { kind: "update"; id: string; quantity: number }
  | { kind: "create"; name: string; quantity: number; unit: string | null }
  | { kind: "none" };

// Coche/décoche un article de liste de courses = achat/annulation d'achat :
// détermine comment ajuster le stock en conséquence. `direction` +1 = achat
// (on ajoute au stock), -1 = annulation (on retire ce qui avait été ajouté).
// Même règle de correspondance que le reste (nom normalisé, unité exacte ou
// convertible g/kg·ml/cl/l).
export function planPantryAdjustment(
  item: RecipeIngredientLike,
  pantry: (PantryEntry & { id: string })[],
  direction: 1 | -1,
): PantryAdjustment {
  // Ligne libre (ex. "sel", sans quantité) : rien à ajuster.
  if (item.quantity === null) return { kind: "none" };

  const nameKey = normalizeName(item.name);
  const matches = pantry.filter((p) => normalizeName(p.name) === nameKey);

  // Une ligne "j'en ai" existe déjà pour ce nom : on ne la transforme pas en
  // quantité chiffrée, la présence suffisait déjà et suffira encore après.
  if (matches.some((m) => m.quantity === null)) return { kind: "none" };

  const itemUnitKey = normalizeUnit(item.unit);
  const sameUnit = matches.find((m) => normalizeUnit(m.unit) === itemUnitKey);
  if (sameUnit) {
    const next = (sameUnit.quantity ?? 0) + direction * item.quantity;
    return { kind: "update", id: sameUnit.id, quantity: Math.max(0, round2(next)) };
  }

  const convertibleMatch = matches.find(
    (m) => m.quantity !== null && convert(item.quantity as number, item.unit, m.unit) !== null,
  );
  if (convertibleMatch) {
    const delta = convert(item.quantity, item.unit, convertibleMatch.unit) as number;
    const next = (convertibleMatch.quantity as number) + direction * delta;
    return { kind: "update", id: convertibleMatch.id, quantity: Math.max(0, round2(next)) };
  }

  // Achat sans ligne de stock compatible (aucune ou unité incompatible) :
  // on en crée une nouvelle plutôt que de deviner où l'ajouter.
  if (direction > 0) {
    return { kind: "create", name: item.name, quantity: item.quantity, unit: item.unit };
  }

  // Annulation sans ligne compatible à ajuster : on ne touche à rien plutôt
  // que de deviner (ex. le stock a été modifié à la main entre-temps).
  return { kind: "none" };
}
