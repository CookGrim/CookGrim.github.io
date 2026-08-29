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

// mark.svg dessine ses propres coins arrondis (rx) sur un carré : le reste
// du canevas — les quatre coins hors du rect arrondi — est transparent.
// Toutes nos icônes doivent être des carrés pleins, sans aucune transparence
// résiduelle : pour les icônes "any", c'est l'OS qui applique son propre
// masque/arrondi (sans flatten, Android affiche son fond gris par défaut
// derrière cette transparence — d'où des coins gris autour du logo dans le
// multitâche) ; pour la maskable, ce sont ces mêmes coins qui, une fois
// repositionnés à l'intérieur de la safe zone, laisseraient passer de la
// transparence. Dans les deux cas on aplatit sur la couleur de fond du mark.
const flatten = (image) => image.flatten({ background: "#3C2350" });

for (const { file, size, padded } of targets) {
  const buffer = padded
    ? await flatten(
        sharp(source, { density: 384 }).resize(Math.round(size * 0.7), Math.round(size * 0.7)),
      )
        .extend({
          top: Math.round(size * 0.15),
          bottom: Math.round(size * 0.15),
          left: Math.round(size * 0.15),
          right: Math.round(size * 0.15),
          background: "#3C2350",
        })
        .png()
        .toBuffer()
    : await flatten(sharp(source, { density: 384 }).resize(size, size))
        .png()
        .toBuffer();

  await sharp(buffer).toFile(resolve(outDir, file));
  console.log(`✓ ${file}`);
}
