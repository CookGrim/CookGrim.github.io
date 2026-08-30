import { describe, expect, it } from "vitest";
import { computeMissing, deductPantryFromAggregated, planPantryAdjustment } from "./pantry-match.js";
import type { PantryEntry } from "./pantry-match.js";
import type { AggregatedItem } from "./aggregate-ingredients.js";

describe("computeMissing", () => {
  it("compte comme manquant un ingrédient absent du stock", () => {
    const result = computeMissing([{ name: "Farine", quantity: 200, unit: "g" }], []);
    expect(result).toEqual({ missingCount: 1, totalCount: 1 });
  });

  it("un ingrédient sans quantité exploitable est couvert dès qu'il est présent, quelle que soit la quantité en stock", () => {
    const pantry: PantryEntry[] = [{ name: "Sel", quantity: 1, unit: "pincée" }];
    const result = computeMissing([{ name: "Sel", quantity: null, unit: null }], pantry);
    expect(result.missingCount).toBe(0);
  });

  it("une ligne de stock 'j'en ai' (quantité null) couvre l'ingrédient sans comparaison de quantité", () => {
    const pantry: PantryEntry[] = [{ name: "Poivre", quantity: null, unit: null }];
    const result = computeMissing([{ name: "Poivre", quantity: 50, unit: "g" }], pantry);
    expect(result.missingCount).toBe(0);
  });

  it("couvre si le stock (même unité) suffit, manque sinon", () => {
    const pantry: PantryEntry[] = [{ name: "Sucre", quantity: 100, unit: "g" }];
    expect(computeMissing([{ name: "Sucre", quantity: 100, unit: "g" }], pantry).missingCount).toBe(0);
    expect(computeMissing([{ name: "Sucre", quantity: 150, unit: "g" }], pantry).missingCount).toBe(1);
  });

  it("additionne des lignes de stock convertibles (g/kg) pour couvrir la demande", () => {
    const pantry: PantryEntry[] = [
      { name: "Farine", quantity: 1, unit: "kg" },
      { name: "Farine", quantity: 200, unit: "g" },
    ];
    const result = computeMissing([{ name: "Farine", quantity: 1200, unit: "g" }], pantry);
    expect(result.missingCount).toBe(0);
  });

  it("ignore une unité de stock non convertible avec la ligne demandée", () => {
    const pantry: PantryEntry[] = [{ name: "Chocolat", quantity: 3, unit: "carré" }];
    const result = computeMissing([{ name: "Chocolat", quantity: 100, unit: "g" }], pantry);
    expect(result.missingCount).toBe(1);
  });
});

describe("deductPantryFromAggregated", () => {
  it("retire entièrement une ligne couverte par le stock", () => {
    const items: AggregatedItem[] = [{ name: "Beurre", quantity: 100, unit: "g", sourceRecipeIds: ["r1"] }];
    const pantry: PantryEntry[] = [{ name: "Beurre", quantity: 250, unit: "g" }];
    expect(deductPantryFromAggregated(items, pantry)).toEqual([]);
  });

  it("ne garde que la quantité manquante pour une ligne partiellement couverte", () => {
    const items: AggregatedItem[] = [{ name: "Beurre", quantity: 300, unit: "g", sourceRecipeIds: ["r1"] }];
    const pantry: PantryEntry[] = [{ name: "Beurre", quantity: 100, unit: "g" }];
    const result = deductPantryFromAggregated(items, pantry);
    expect(result).toEqual([{ name: "Beurre", quantity: 200, unit: "g", sourceRecipeIds: ["r1"] }]);
  });

  it("convertit les unités de stock compatibles avant de déduire", () => {
    const items: AggregatedItem[] = [{ name: "Lait", quantity: 1, unit: "l", sourceRecipeIds: ["r1"] }];
    const pantry: PantryEntry[] = [{ name: "Lait", quantity: 400, unit: "ml" }];
    const result = deductPantryFromAggregated(items, pantry);
    expect(result).toEqual([{ name: "Lait", quantity: 0.6, unit: "l", sourceRecipeIds: ["r1"] }]);
  });

  it("garde la ligne intacte si rien de correspondant en stock", () => {
    const items: AggregatedItem[] = [{ name: "Levure", quantity: 1, unit: "sachet", sourceRecipeIds: ["r1"] }];
    expect(deductPantryFromAggregated(items, [])).toEqual(items);
  });

  it("retire une ligne libre (sans quantité) dès qu'un match existe en stock", () => {
    const items: AggregatedItem[] = [{ name: "Sel", quantity: null, unit: null, sourceRecipeIds: ["r1"] }];
    const pantry: PantryEntry[] = [{ name: "Sel", quantity: 1, unit: "pincée" }];
    expect(deductPantryFromAggregated(items, pantry)).toEqual([]);
  });

  it("une ligne de stock 'j'en ai' couvre entièrement, quelle que soit la quantité demandée", () => {
    const items: AggregatedItem[] = [{ name: "Farine", quantity: 500, unit: "g", sourceRecipeIds: ["r1"] }];
    const pantry: PantryEntry[] = [{ name: "Farine", quantity: null, unit: null }];
    expect(deductPantryFromAggregated(items, pantry)).toEqual([]);
  });
});

describe("planPantryAdjustment", () => {
  it("ne fait rien pour une ligne sans quantité exploitable", () => {
    expect(planPantryAdjustment({ name: "Sel", quantity: null, unit: null }, [], 1)).toEqual({
      kind: "none",
    });
  });

  it("ne touche pas une ligne 'j'en ai' existante (ne la transforme pas en quantité chiffrée)", () => {
    const pantry = [{ id: "p1", name: "Poivre", quantity: null, unit: null }];
    const result = planPantryAdjustment({ name: "Poivre", quantity: 20, unit: "g" }, pantry, 1);
    expect(result).toEqual({ kind: "none" });
  });

  it("met à jour une ligne de stock existante de même unité (achat = +)", () => {
    const pantry = [{ id: "p1", name: "Farine", quantity: 100, unit: "g" }];
    const result = planPantryAdjustment({ name: "Farine", quantity: 200, unit: "g" }, pantry, 1);
    expect(result).toEqual({ kind: "update", id: "p1", quantity: 300 });
  });

  it("annulation d'achat (direction -1) décrémente sans jamais descendre sous zéro", () => {
    const pantry = [{ id: "p1", name: "Farine", quantity: 100, unit: "g" }];
    const result = planPantryAdjustment({ name: "Farine", quantity: 200, unit: "g" }, pantry, -1);
    expect(result).toEqual({ kind: "update", id: "p1", quantity: 0 });
  });

  it("met à jour une ligne de stock d'unité convertible en convertissant la quantité", () => {
    const pantry = [{ id: "p1", name: "Lait", quantity: 500, unit: "ml" }];
    const result = planPantryAdjustment({ name: "Lait", quantity: 1, unit: "l" }, pantry, 1);
    expect(result).toEqual({ kind: "update", id: "p1", quantity: 1500 });
  });

  it("crée une nouvelle ligne de stock si aucune ligne compatible n'existe (achat)", () => {
    const result = planPantryAdjustment({ name: "Riz", quantity: 500, unit: "g" }, [], 1);
    expect(result).toEqual({ kind: "create", name: "Riz", quantity: 500, unit: "g" });
  });

  it("n'invente pas de ligne à l'annulation si aucune ligne compatible n'existe", () => {
    const result = planPantryAdjustment({ name: "Riz", quantity: 500, unit: "g" }, [], -1);
    expect(result).toEqual({ kind: "none" });
  });
});
