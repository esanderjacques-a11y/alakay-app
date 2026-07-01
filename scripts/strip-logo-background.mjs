import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const SOURCE = path.join(ROOT, "public", "app-icon.png");

function isBackgroundPixel(r, g, b) {
  const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
  if (maxDiff > 14) return false;
  const avg = (r + g + b) / 3;
  return avg >= 232;
}

function isLogoNeighbor(r, g, b) {
  const avg = (r + g + b) / 3;
  const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
  return avg < 150 || maxDiff > 36;
}

async function stripCheckerboardBackground(inputPath) {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const channels = 4;
  const original = Uint8Array.from(data);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * channels;
      const r = original[offset];
      const g = original[offset + 1];
      const b = original[offset + 2];

      if (isBackgroundPixel(r, g, b)) {
        data[offset + 3] = 0;
      }
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * channels;
      if (data[offset + 3] !== 0) continue;

      const r = original[offset];
      const g = original[offset + 1];
      const b = original[offset + 2];
      if (Math.min(r, g, b) < 248) continue;

      let restore = false;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const neighbor = (ny * width + nx) * channels;
        const nr = original[neighbor];
        const ng = original[neighbor + 1];
        const nb = original[neighbor + 2];
        if (isLogoNeighbor(nr, ng, nb)) {
          restore = true;
          break;
        }
      }

      if (restore) {
        data[offset + 3] = 255;
      }
    }
  }

  return sharp(data, { raw: { width, height, channels } }).png({ compressionLevel: 9 });
}

async function writeIconVariants(sourcePath) {
  const sizes = [
    ["icon-32x32.png", 32],
    ["icon-192x192.png", 192],
    ["icon-512x512.png", 512],
    ["apple-touch-icon.png", 180],
  ];

  const stripped = await stripCheckerboardBackground(sourcePath);
  const strippedBuffer = await stripped.toBuffer();

  await sharp(strippedBuffer).toFile(sourcePath);

  for (const [name, size] of sizes) {
    await sharp(strippedBuffer)
      .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toFile(path.join(ROOT, "public", name));
  }

  const meta = await sharp(strippedBuffer).metadata();
  const stats = await sharp(strippedBuffer).stats();
  const { data, info } = await sharp(strippedBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let bgOpaque = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const offset = (y * info.width + x) * 4;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      const a = data[offset + 3];
      if (a > 0 && isBackgroundPixel(r, g, b)) bgOpaque++;
    }
  }

  return {
    width: meta.width,
    height: meta.height,
    hasAlpha: meta.hasAlpha,
    isOpaque: stats.isOpaque,
    remainingBackgroundPixels: bgOpaque,
  };
}

if (!fs.existsSync(SOURCE)) {
  console.error(`Missing source icon: ${SOURCE}`);
  process.exit(1);
}

const result = await writeIconVariants(SOURCE);
console.log("Updated transparent app icon and PWA variants:", result);
