// Renders public/mark.svg into every PWA/app icon size we ship.
// Re-run this whenever the mark changes: `npm run icons`
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(root, "public/mark.svg");
const outDir = resolve(root, "public/icons");

const targets = [
  { file: "icon-192.png", size: 192 },
  { file: "icon-512.png", size: 512 },
  { file: "maskable-512.png", size: 512, padded: true },
  { file: "apple-touch-icon.png", size: 180 },
];

await mkdir(outDir, { recursive: true });

for (const { file, size, padded } of targets) {
  const image = sharp(source, { density: 384 }).resize(size, size);
  const buffer = padded
    ? await sharp(source, { density: 384 })
        .resize(Math.round(size * 0.7), Math.round(size * 0.7))
        .extend({
          top: Math.round(size * 0.15),
          bottom: Math.round(size * 0.15),
          left: Math.round(size * 0.15),
          right: Math.round(size * 0.15),
          background: "#3C2350",
        })
        .png()
        .toBuffer()
    : await image.png().toBuffer();

  await sharp(buffer).toFile(resolve(outDir, file));
  console.log(`✓ ${file}`);
}
