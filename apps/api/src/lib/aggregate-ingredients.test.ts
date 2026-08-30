import { describe, expect, it } from "vitest";
import { aggregateIngredients, normalizeName, normalizeUnit } from "./aggregate-ingredients.js";
import type { SourceIngredient } from "./aggregate-ingredients.js";

describe("normalizeName", () => {
  it("trim, minuscule, espaces multiples réduits à un seul", () => {
    expect(normalizeName("  Farine   T55  ")).toBe("farine t55");
  });
});

describe("normalizeUnit", () => {
  it("null devient chaîne vide", () => {
    expect(normalizeUnit(null)).toBe("");
  });

  it("trim et minuscule", () => {
    expect(normalizeUnit("  KG ")).toBe("kg");
  });
});

describe("aggregateIngredients", () => {
  it("fusionne le même ingrédient (nom + unité) venant de deux recettes, en appliquant le multiplicateur", () => {
    const ingredients: SourceIngredient[] = [
      { recipeId: "r1", name: "Farine", quantity: 200, unit: "g" },
      { recipeId: "r2", name: "farine", quantity: 100, unit: "g" },
    ];
    const result = aggregateIngredients(ingredients, { r1: 2, r2: 1 });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ name: "Farine", quantity: 500, unit: "g" });
    expect(result[0].sourceRecipeIds).toEqual(["r1", "r2"]);
  });

  it("n'accumule pas deux fois la même recette dans sourceRecipeIds si elle contribue à la ligne plusieurs fois", () => {
    const ingredients: SourceIngredient[] = [
      { recipeId: "r1", name: "Sucre", quantity: 50, unit: "g" },
      { recipeId: "r1", name: "sucre", quantity: 30, unit: "g" },
    ];
    const result = aggregateIngredients(ingredients, {});

    expect(result).toHaveLength(1);
    expect(result[0].quantity).toBe(80);
    expect(result[0].sourceRecipeIds).toEqual(["r1"]);
  });

  it("ne fusionne pas des unités différentes pour le même nom", () => {
    const ingredients: SourceIngredient[] = [
      { recipeId: "r1", name: "Lait", quantity: 1, unit: "l" },
      { recipeId: "r2", name: "Lait", quantity: 200, unit: "ml" },
    ];
    const result = aggregateIngredients(ingredients, {});

    expect(result).toHaveLength(2);
  });

  it("laisse les lignes sans quantité exploitable (null) distinctes, sans les fusionner", () => {
    const ingredients: SourceIngredient[] = [
      { recipeId: "r1", name: "Sel", quantity: null, unit: null },
      { recipeId: "r2", name: "Sel", quantity: null, unit: null },
    ];
    const result = aggregateIngredients(ingredients, {});

    expect(result).toHaveLength(2);
    expect(result.every((r) => r.quantity === null)).toBe(true);
  });

  it("traite une quantité sans unité comme une ligne libre (pas de fusion)", () => {
    const ingredients: SourceIngredient[] = [
      { recipeId: "r1", name: "Œufs", quantity: 2, unit: null },
      { recipeId: "r2", name: "Œufs", quantity: 3, unit: null },
    ];
    const result = aggregateIngredients(ingredients, {});

    expect(result).toHaveLength(2);
  });

  it("applique un multiplicateur par défaut de 1 si la recette n'apparaît pas dans multipliers", () => {
    const ingredients: SourceIngredient[] = [{ recipeId: "r1", name: "Beurre", quantity: 100, unit: "g" }];
    const result = aggregateIngredients(ingredients, {});

    expect(result[0].quantity).toBe(100);
  });

  it("trie le résultat par nom (alphabet français, insensible aux accents dans l'ordre naturel)", () => {
    const ingredients: SourceIngredient[] = [
      { recipeId: "r1", name: "Yaourt", quantity: 1, unit: "pièce" },
      { recipeId: "r1", name: "Crème fraîche", quantity: 200, unit: "g" },
      { recipeId: "r1", name: "Ananas", quantity: 1, unit: "pièce" },
    ];
    const result = aggregateIngredients(ingredients, {});

    expect(result.map((r) => r.name)).toEqual(["Ananas", "Crème fraîche", "Yaourt"]);
  });
});
