import Anthropic from "@anthropic-ai/sdk";
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
Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, au format :
{"title": string, "servings": number|null, "ingredients": [{"name": string, "quantity": number|null, "unit": string|null}], "steps": [string]}
Si une information est illisible ou absente, mets null (ou un tableau vide). N'invente rien.`;

// POST /api/recipes/extract — envoie la photo à Claude, renvoie un brouillon
// structuré pour préremplir le formulaire. L'utilisateur relit et corrige
// avant toute sauvegarde : rien n'est écrit en base ici.
extractRoute.post("/", requireAuth, async (c) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return c.json(
      { message: "ANTHROPIC_API_KEY non configurée côté serveur." },
      501,
    );
  }

  const parsed = extractInput.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ message: "Requête invalide.", issues: parsed.error.issues }, 400);
  }
  const { imageBase64, mediaType } = parsed.data;

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
          { type: "text", text: "Extrait cette recette." },
        ],
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return c.json({ message: "Réponse IA inexploitable." }, 502);
  }

  let raw: unknown;
  try {
    raw = JSON.parse(textBlock.text);
  } catch {
    return c.json({ message: "Réponse IA non-JSON." }, 502);
  }

  const draft = extractedRecipe.safeParse(raw);
  if (!draft.success) {
    return c.json({ message: "Réponse IA au mauvais format.", issues: draft.error.issues }, 502);
  }

  return c.json(draft.data);
});
