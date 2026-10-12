/**
 * About v2 (contact sheet): genera los 12 fotogramas a partir de public/about/about.png.
 *
 *   node scripts/about-sheet.mjs
 *
 * Los recortes están en src/components/data/aboutSheet.json, en fracciones de
 * la foto [x, y, ancho, alto] (3:4). Por cada uno salen dos WebP en
 * public/about/sheet/:
 *   frame-NN.sm.webp → tira (240×320)
 *   frame-NN.lg.webp → ampliada (720×960; la ampliada ronda los 480 px de ancho)
 *
 * La foto original es pequeña (526 px de ancho), así que los recortes cerrados
 * se amplían mucho: se reescalan con lanczos, se enfocan y se les añade grano
 * de película (determinista: misma semilla → mismos ficheros). Si un día hay
 * una foto con más resolución y el mismo encuadre, basta con sustituir
 * about.png y volver a correr el script (y bajar GRAIN si ya no hace falta).
 */
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(ROOT, 'public', 'about', 'about.png');
const OUT_DIR = path.join(ROOT, 'public', 'about', 'sheet');
const FRAMES = path.join(ROOT, 'src', 'components', 'data', 'aboutSheet.json');

// grain: desviación típica del ruido (0–255). cell: tamaño del grano en px.
const SIZES = {
  sm: { width: 240, grain: 8, cell: 1 },
  lg: { width: 720, grain: 14, cell: 1.5 },
};
const WEBP = { quality: 72, effort: 6 };

// PRNG con semilla (mulberry32) + Box–Muller: ruido gaussiano reproducible.
function gaussian(seed) {
  let a = seed >>> 0;
  const rand = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return () => Math.sqrt(-2 * Math.log(rand() || 1e-9)) * Math.cos(2 * Math.PI * rand());
}

async function frame(rect, index, size, meta) {
  const { width, grain, cell } = SIZES[size];
  const height = Math.round((width * 4) / 3);
  const [x, y, w, h] = rect;
  const left = Math.round(x * meta.width);
  const top = Math.round(y * meta.height);
  const extract = {
    left,
    top,
    width: Math.min(meta.width - left, Math.round(w * meta.width)),
    height: Math.min(meta.height - top, Math.round(h * meta.height)),
  };

  const { data, info } = await sharp(SOURCE)
    .extract(extract)
    .greyscale()
    .resize(width, height, { kernel: 'lanczos3', fit: 'cover' })
    .sharpen({ sigma: 1.1, m1: 0.6, m2: 2.4 })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const noise = gaussian(1000 + index * 10 + (size === 'lg' ? 1 : 0));
  const cols = Math.ceil(info.width / cell);
  const cells = new Float32Array(cols * Math.ceil(info.height / cell)).map(() => noise() * grain);
  const ch = info.channels;
  for (let py = 0; py < info.height; py += 1) {
    for (let px = 0; px < info.width; px += 1) {
      const n = cells[Math.floor(py / cell) * cols + Math.floor(px / cell)];
      const i = (py * info.width + px) * ch;
      for (let c = 0; c < ch; c += 1) data[i + c] = Math.max(0, Math.min(255, data[i + c] + n));
    }
  }

  const file = path.join(OUT_DIR, `frame-${String(index + 1).padStart(2, '0')}.${size}.webp`);
  await sharp(data, { raw: { width: info.width, height: info.height, channels: ch } })
    .webp(WEBP)
    .toFile(file);
  return file;
}

// Igual que optimize-images2: sharp no es dependencia directa del proyecto.
let sharp;
try {
  sharp = (await import('sharp')).default;
} catch (error) {
  console.error(`[about-sheet] sharp no disponible (${error.message}). Instálalo con: npm i -D sharp`);
  process.exit(1);
}

const { frames } = JSON.parse(await readFile(FRAMES, 'utf8'));
const meta = await sharp(SOURCE).metadata();
await mkdir(OUT_DIR, { recursive: true });
for (const [index, { rect }] of frames.entries()) {
  for (const size of Object.keys(SIZES)) await frame(rect, index, size, meta);
}
console.log(`about-sheet: ${frames.length * Object.keys(SIZES).length} fotogramas en public/about/sheet`);
