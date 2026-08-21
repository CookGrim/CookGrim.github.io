// Redimensionne + recompresse une photo côté client avant envoi à l'IA —
// moins de coût, moins de latence, et jamais l'image originale (potentiellement
// lourde) qui transite sur le réseau.
export type CompressedImage = { base64: string; mediaType: "image/jpeg" };

export async function compressImage(
  file: File,
  maxDimension = 1600,
  quality = 0.82,
): Promise<CompressedImage> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Le navigateur ne supporte pas le traitement d'image.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Échec de compression de l'image."))),
      "image/jpeg",
      quality,
    );
  });

  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Impossible de lire l'image."));
    reader.readAsDataURL(blob);
  });

  return { base64, mediaType: "image/jpeg" };
}
