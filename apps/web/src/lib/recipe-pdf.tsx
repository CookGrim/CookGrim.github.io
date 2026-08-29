import { Document, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";
import type { Ingredient, Step } from "../types/recipe";

// Génération 100 % côté client — aucune donnée envoyée à un serveur pour
// produire le PDF. Police standard (Helvetica) : les accents français
// passent nativement, pas besoin d'embarquer une police custom.
const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: "Helvetica", color: "#1a1a1a" },
  title: { fontSize: 22, marginBottom: 4, fontFamily: "Helvetica-Bold" },
  meta: { fontSize: 10, color: "#666666", marginBottom: 18 },
  sectionTitle: {
    fontSize: 13,
    marginTop: 18,
    marginBottom: 8,
    fontFamily: "Helvetica-Bold",
    borderBottom: "1 solid #dddddd",
    paddingBottom: 4,
  },
  ingredientRow: { flexDirection: "row", marginBottom: 5 },
  ingredientQty: { width: 100, fontFamily: "Helvetica-Bold" },
  stepRow: { flexDirection: "row", marginBottom: 9 },
  stepNumber: { width: 22, fontFamily: "Helvetica-Bold" },
  stepText: { flex: 1, lineHeight: 1.4 },
  notes: {
    marginTop: 18,
    padding: 12,
    backgroundColor: "#F0EDF4",
    borderRadius: 4,
    fontSize: 10,
    lineHeight: 1.4,
  },
});

export type PdfRecipe = {
  title: string;
  servings: number | null;
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
  cookTempCelsius: number | null;
  ingredients: Ingredient[];
  steps: Step[];
  notes?: string | null;
};

function RecipeDocument({ recipe }: { recipe: PdfRecipe }) {
  const meta = [
    recipe.servings ? `${recipe.servings} portions` : null,
    recipe.prepTimeMinutes ? `${recipe.prepTimeMinutes} min de préparation` : null,
    recipe.cookTimeMinutes ? `${recipe.cookTimeMinutes} min de cuisson` : null,
    recipe.cookTempCelsius ? `${recipe.cookTempCelsius} °C` : null,
  ]
    .filter(Boolean)
    .join("  ·  ");

  return (
    <Document title={recipe.title}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{recipe.title}</Text>
        {meta && <Text style={styles.meta}>{meta}</Text>}

        <Text style={styles.sectionTitle}>Ingrédients</Text>
        {recipe.ingredients.map((ing) => (
          <View key={ing.id} style={styles.ingredientRow}>
            <Text style={styles.ingredientQty}>
              {[ing.quantity, ing.unit].filter(Boolean).join(" ")}
            </Text>
            <Text>{ing.name}</Text>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Étapes</Text>
        {recipe.steps.map((step, i) => (
          <View key={step.id} style={styles.stepRow}>
            <Text style={styles.stepNumber}>{i + 1}.</Text>
            <Text style={styles.stepText}>{step.text}</Text>
          </View>
        ))}

        {recipe.notes && (
          <View style={styles.notes}>
            <Text>{recipe.notes}</Text>
          </View>
        )}
      </Page>
    </Document>
  );
}

function slugify(title: string) {
  return (
    title
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "recette"
  );
}

export async function downloadRecipePdf(recipe: PdfRecipe) {
  const blob = await pdf(<RecipeDocument recipe={recipe} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slugify(recipe.title)}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
