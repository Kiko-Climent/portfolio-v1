/**
 * Pipeline de imágenes: genera variantes WebP de las capturas de /public y un
 * manifest con dimensiones y color dominante (src/lib/media-manifest.json).
 *
 *   npm run images      → genera / actualiza (también corre en "prebuild")
 *
 * - Idempotente: el nombre de cada fichero lleva un hash del original + ajustes
 *   de codificación, así que solo se re-codifica lo que ha cambiado y se puede
 *   servir con caché inmutable (ver headers en next.config.mjs).
 * - Las variantes que acabarían con el mismo ancho (capturas pequeñas) comparten
 *   fichero.
 * - Los perfiles de color del Mac ("Color LCD") se convierten a sRGB: así <img>
 *   y las texturas WebGL ven exactamente los mismos colores.
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const OUT_DIR = path.join(PUBLIC_DIR, 'media');
const MANIFEST_PATH = path.join(ROOT, 'src', 'lib', 'media-manifest.json');

// Carpetas de /public con las capturas que usa el portfolio.
const SOURCE_DIRS = ['about', 'alt', 'johnny', 'mmdiscos', 'salon'];

// thumb: miniaturas de la grid de escritorio (manda el ancho de la celda).
// sm / md / lg: texturas, encajadas en una caja cuadrada (manda el lado mayor):
//   sm → móvil (canvas con pixelRatio ≤ 1.5)
//   md → escritorio: detalle del hover, flicker del footer y slider 3D
//   lg → escritorio retina: imagen en foco del slider 3D
const VARIANTS = {
  thumb: { width: 384 },
  sm: { box: 640 },
  md: { box: 1280 },
  lg: { box: 1920 },
};

const WEBP = { quality: 80, effort: 6, smartSubsample: true };
const SETTINGS_KEY = JSON.stringify({ VARIANTS, WEBP, v: 1 });

const targetWidth = (width, height, variant) => {
  if (variant.width) return Math.min(width, variant.width);
  const scale = Math.min(1, variant.box / Math.max(width, height));
  return Math.max(1, Math.round(width * scale));
};

const toHex = ({ r, g, b }) =>
  `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;

async function listSources() {
  const sources = [];
  for (const dir of SOURCE_DIRS) {
    const files = await readdir(path.join(PUBLIC_DIR, dir));
    for (const file of files.sort()) {
      if (!file.endsWith('.png')) continue;
      sources.push({ dir, name: file.replace(/\.png$/, ''), file: path.join(PUBLIC_DIR, dir, file) });
    }
  }
  return sources;
}

const hashOf = (buffer) =>
  createHash('sha1').update(buffer).update(SETTINGS_KEY).digest('hex').slice(0, 8);

async function readManifest() {
  try {
    return JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
  } catch {
    return null;
  }
}

// Sin sharp (p. ej. una máquina de build sin binarios) solo comprobamos que lo
// ya generado y commiteado sigue al día; si no, hay que correr el script en local.
async function verifyOnly(error) {
  const manifest = await readManifest();
  const sources = await listSources();
  const stale = [];
  for (const source of sources) {
    const entry = manifest?.[`${source.dir}/${source.name}`];
    const hash = hashOf(await readFile(source.file));
    const files = entry ? Object.values(entry.variants).map((v) => path.join(PUBLIC_DIR, v.src)) : [];
    if (!entry || entry.hash !== hash || !files.every((f) => existsSync(f))) stale.push(source.name);
  }
  if (stale.length) {
    console.error(`[images] sharp no disponible (${error.message}) y hay imágenes sin optimizar: ${stale.join(', ')}`);
    console.error('[images] Ejecuta "npm run images" en local y commitea public/media + src/lib/media-manifest.json');
    process.exit(1);
  }
  console.warn(`[images] sharp no disponible (${error.message}); las variantes commiteadas están al día.`);
}

async function main() {
  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch (error) {
    await verifyOnly(error);
    return;
  }

  const started = Date.now();
  const sources = await listSources();
  const previousManifest = (await readManifest()) || {};
  const manifest = {};
  const keep = new Set();
  let encoded = 0;
  let totalBytes = 0;

  for (const source of sources) {
    const key = `${source.dir}/${source.name}`;
    const buffer = await readFile(source.file);
    const hash = hashOf(buffer);

    // Original sin cambios y variantes en disco: no hace falta ni decodificarlo.
    const previous = previousManifest[key];
    const previousFiles = previous ? Object.values(previous.variants).map((v) => path.join(PUBLIC_DIR, v.src)) : [];
    if (previous?.hash === hash && previousFiles.every((f) => existsSync(f))) {
      manifest[key] = previous;
      previousFiles.forEach((f) => keep.add(f));
      continue;
    }

    const image = sharp(buffer);
    const { width, height } = await image.metadata();
    const stats = await image.stats();

    const entry = { w: width, h: height, color: toHex(stats.dominant), hash, variants: {} };
    const outDir = path.join(OUT_DIR, source.dir);
    await mkdir(outDir, { recursive: true });

    for (const [variantName, variant] of Object.entries(VARIANTS)) {
      const w = targetWidth(width, height, variant);
      const h = Math.max(1, Math.round((height * w) / width));
      const fileName = `${source.name}.${w}w.${hash}.webp`;
      const outFile = path.join(outDir, fileName);
      keep.add(outFile);

      if (!existsSync(outFile)) {
        let pipeline = sharp(buffer).resize({ width: w });
        // Todas las capturas actuales son opacas: sin canal alfa pesan menos.
        if (stats.isOpaque) pipeline = pipeline.removeAlpha();
        const output = await pipeline.webp(WEBP).toBuffer();
        await writeFile(outFile, output);
        encoded++;
      }

      entry.variants[variantName] = { src: `/media/${source.dir}/${fileName}`, w, h };
    }

    manifest[key] = entry;
  }

  // Borra variantes huérfanas (originales eliminados o ajustes cambiados).
  let removed = 0;
  for (const dir of await readdir(OUT_DIR)) {
    const dirPath = path.join(OUT_DIR, dir);
    for (const file of await readdir(dirPath)) {
      const filePath = path.join(dirPath, file);
      if (!keep.has(filePath)) {
        await rm(filePath);
        removed++;
      }
    }
  }

  for (const filePath of keep) totalBytes += (await readFile(filePath)).length;

  const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
  const json = `${JSON.stringify(sorted, null, 2)}\n`;
  const previous = existsSync(MANIFEST_PATH) ? await readFile(MANIFEST_PATH, 'utf8') : null;
  if (json !== previous) await writeFile(MANIFEST_PATH, json);

  console.log(
    `[images] ${sources.length} originales → ${keep.size} ficheros WebP ` +
      `(${(totalBytes / 1048576).toFixed(2)} MB). Codificados: ${encoded}, borrados: ${removed}, ` +
      `${((Date.now() - started) / 1000).toFixed(1)}s`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
