import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "public", "icons", "app-icon-source.png");
const outDir = join(root, "public", "icons");

mkdirSync(outDir, { recursive: true });

const targets = [
  { name: "icon-32.png", size: 32 },
  { name: "icon-180.png", size: 180 },
  { name: "apple-touch-icon.png", size: 180 },
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
];

for (const target of targets) {
  await sharp(source)
    .resize(target.size, target.size, { fit: "cover" })
    .png({ compressionLevel: 9 })
    .toFile(join(outDir, target.name));
  console.log(`created ${target.name}`);
}
