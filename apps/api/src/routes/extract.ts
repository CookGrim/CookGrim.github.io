import { GoogleGenAI, Type } from "@google/genai";
import { Hono } from "hono";
import { z } from "zod";
import { requireAuth } from "../middleware/require-auth.js";
import type { AppEnv } from "../types.js";

export const extractRoute = new Hono<AppEnv>();

const extractInput = z.object({
  imageBase64: z.string().min(1),
  mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]),
});

const extractedRecipe = z.object({
  title: z.string(),
  servings: z.number().int().positive().nullable(),
  ingredients: z.array(
    z.object({
      name: z.string(),
      quantity: z.number().nullable(),
      unit: z.string().nullable(),
    }),
  ),
  steps: z.array(z.string()),
});

const SYSTEM_PROMPT = `Tu extrais le contenu d'une photo de recette de cuisine.
Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, au format demandé.
Si une information est illisible ou absente, mets null (ou un tableau vide). N'invente rien.`;

// Schéma Gemini (responseSchema) — même forme que extractedRecipe côté Zod,
// mais exprimée dans le format attendu par l'API Gemini.
const GEMINI_RECIPE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    servings: { type: Type.INTEGER, nullable: true },
    ingredients: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          quantity: { type: Type.NUMBER, nullable: true },
          unit: { type: Type.STRING, nullable: true },
        },
        required: ["name", "quantity", "unit"],
      },
    },
    steps: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ["title", "servings", "ingredients", "steps"],
};

// Modèle Gemini gratuit (quota journalier généreux sur la clé API AI Studio).
// "-latest" suit la dernière version stable du flash-lite ; épingler une
// version précise (ex. "gemini-3.5-flash-lite") si un jour la stabilité prime.
const GEMINI_MODEL = "gemini-flash-lite-latest";

// POST /api/recipes/extract — envoie la photo à Gemini, renvoie un brouillon
// structuré pour préremplir le formulaire. L'utilisateur relit et corrige
// avant toute sauvegarde : rien n'est écrit en base ici.
extractRoute.post("/", requireAuth, async (c) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return c.json(
      { message: "GEMINI_API_KEY non configurée côté serveur." },
      501,
    );
  }

  const parsed = extractInput.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ message: "Requête invalide.", issues: parsed.error.issues }, 400);
  }
  const { imageBase64, mediaType } = parsed.data;

  const ai = new GoogleGenAI({ apiKey });

  let text: string | undefined;
  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType: mediaType, data: imageBase64 } },
            { text: "Extrait cette recette." },
          ],
        },
      ],
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseSchema: GEMINI_RECIPE_SCHEMA,
      },
    });
    text = response.text;
  } catch (error) {
    console.error("Gemini extract error:", error);
    return c.json({ message: "Échec de l'appel au service d'extraction IA." }, 502);
  }

  if (!text) {
    return c.json({ message: "Réponse IA inexploitable." }, 502);
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return c.json({ message: "Réponse IA non-JSON." }, 502);
  }

  const draft = extractedRecipe.safeParse(raw);
  if (!draft.success) {
    return c.json({ message: "Réponse IA au mauvais format.", issues: draft.error.issues }, 502);
  }

  return c.json(draft.data);
});
