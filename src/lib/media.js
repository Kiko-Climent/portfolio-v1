import manifest from './media-manifest.json';

/**
 * Acceso a las variantes optimizadas de /public/media (ver scripts/optimize-images.mjs)
 * y cachés compartidas entre componentes:
 *   - miniaturas <img> ya decodificadas (grid de escritorio)
 *   - ficheros ya descargados (Blob)
 *   - fuentes de textura decodificadas fuera del hilo principal (ImageBitmap) para
 *     que subir una textura a la GPU no congele un frame.
 * Todo vive a nivel de módulo: lo que se precarga durante la intro lo reutilizan
 * después la grid, el hover y los sliders 3D, aunque se monten/desmonten.
 */

/** Clave del manifest para una imagen de projects.js (misma convención de rutas que los PNG). */
export function mediaKey(project, imageId) {
  const folder = project.imagesPath.replace(/^\//, '');
  if (project.id === 'about' && imageId === 1) return `${folder}/about`;
  return `${folder}/${project.id}${imageId}`;
}

export function getMedia(key) {
  return manifest[key] || null;
}

/**
 * URL de una variante (thumb | sm | md | lg). Si la imagen todavía no pasó por
 * `npm run images` cae al PNG original, así que nada se rompe al añadir fotos.
 */
export function mediaSrc(key, size = 'md') {
  return manifest[key]?.variants[size]?.src ?? `/${key}.png`;
}

/**
 * URL de la variante más pequeña que cubre `width` px (o la mayor disponible).
 * null si la imagen no está en el manifest.
 */
export function mediaSrcForWidth(key, width) {
  const media = manifest[key];
  if (!media) return null;
  const variants = Object.values(media.variants).sort((a, b) => a.w - b.w);
  return (variants.find((variant) => variant.w >= width) ?? variants[variants.length - 1]).src;
}

/** Alto / ancho de la imagen original (1 si no está en el manifest). */
export function mediaAspect(key) {
  const media = manifest[key];
  return media ? media.h / media.w : 1;
}

/** Color dominante, útil como placeholder mientras llega la textura. */
export function mediaColor(key, fallback = '#ffffff') {
  return manifest[key]?.color ?? fallback;
}

export function saveDataEnabled() {
  return typeof navigator !== 'undefined' && navigator.connection?.saveData === true;
}

// ── Miniaturas <img> ─────────────────────────────────────────

const imagePromises = new Map();

/** Descarga y decodifica una imagen para <img>. Nunca rechaza: un error no debe colgar la intro. */
export function preloadImage(url) {
  let promise = imagePromises.get(url);
  if (!promise) {
    const image = new Image();
    image.decoding = 'async';
    image.fetchPriority = 'high';
    image.src = url;
    promise = image.decode().catch(() => {}).then(() => image);
    imagePromises.set(url, promise);
  }
  return promise;
}

// ── Ficheros descargados ─────────────────────────────────────

const blobPromises = new Map();

export function fetchBlob(url, priority = 'auto') {
  let promise = blobPromises.get(url);
  if (!promise) {
    promise = fetch(url, { priority }).then((response) => {
      if (!response.ok) throw new Error(`${response.status} ${url}`);
      return response.blob();
    });
    promise.catch(() => blobPromises.delete(url));
    blobPromises.set(url, promise);
  }
  return promise;
}

// ── Fuentes de textura decodificadas (WebGL) ─────────────────

let bitmapSupport = null;

// Misma comprobación que GLTFLoader de three.js: Safari < 17 y Firefox < 98
// ignoran las opciones de createImageBitmap (flipY), así que ahí usamos <img>.
function canUseImageBitmap() {
  if (bitmapSupport !== null) return bitmapSupport;
  if (typeof createImageBitmap === 'undefined') return (bitmapSupport = false);
  const ua = navigator.userAgent;
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  const safariVersion = isSafari ? parseInt(ua.match(/Version\/(\d+)/)?.[1] ?? '0', 10) : -1;
  const isFirefox = ua.includes('Firefox');
  const firefoxVersion = isFirefox ? parseInt(ua.match(/Firefox\/(\d+)/)?.[1] ?? '0', 10) : -1;
  bitmapSupport = !(isSafari && safariVersion < 17) && !(isFirefox && firefoxVersion < 98);
  return bitmapSupport;
}

async function decodeTextureSource(url) {
  if (canUseImageBitmap()) {
    const blob = await fetchBlob(url, 'high');
    const image = await createImageBitmap(blob, {
      imageOrientation: 'flipY',
      premultiplyAlpha: 'none',
      colorSpaceConversion: 'none',
    });
    return { image, flipY: false };
  }

  const image = new Image();
  image.decoding = 'async';
  image.src = url;
  await image.decode();
  return { image, flipY: true };
}

// LRU por bytes: las texturas ya subidas a la GPU no dependen de esta caché, solo
// evita volver a decodificar lo reciente sin acumular cientos de MB en memoria.
const decoded = new Map();
let decodedBytes = 0;
let decodedBudget = null;

function getDecodedBudget() {
  if (decodedBudget === null) {
    const lowMemory = (navigator.deviceMemory && navigator.deviceMemory <= 4) || window.innerWidth < 768;
    decodedBudget = (lowMemory ? 64 : 160) * 1024 * 1024;
  }
  return decodedBudget;
}

function evictDecoded() {
  const budget = getDecodedBudget();
  for (const [url, entry] of decoded) {
    if (decodedBytes <= budget) break;
    if (!entry.bytes) continue;
    decoded.delete(url);
    decodedBytes -= entry.bytes;
  }
}

/**
 * Devuelve { image, flipY } listo para `new THREE.Texture(image)`.
 * La decodificación ocurre fuera del hilo principal (ImageBitmap).
 */
export function loadTextureSource(url) {
  const cached = decoded.get(url);
  if (cached) {
    decoded.delete(url);
    decoded.set(url, cached);
    return cached.promise;
  }

  const entry = { bytes: 0, promise: null };
  entry.promise = decodeTextureSource(url).then((source) => {
    if (decoded.get(url) === entry) {
      entry.bytes = source.image.width * source.image.height * 4;
      decodedBytes += entry.bytes;
      evictDecoded();
    }
    return source;
  });
  entry.promise.catch(() => {
    if (decoded.get(url) === entry) decoded.delete(url);
  });
  decoded.set(url, entry);
  return entry.promise;
}

// ── Colas ────────────────────────────────────────────────────

async function runPool(items, worker, concurrency) {
  let index = 0;
  const next = async () => {
    while (index < items.length) {
      const item = items[index++];
      await worker(item).catch(() => {});
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, next));
}

const unique = (urls) => [...new Set(urls.filter(Boolean))];

export function preloadImages(urls, { concurrency = 8 } = {}) {
  return runPool(unique(urls), preloadImage, concurrency);
}

export function prefetchFiles(urls, { concurrency = 3, priority = 'low' } = {}) {
  return runPool(unique(urls), (url) => fetchBlob(url, priority), concurrency);
}

export function preloadTextureSources(urls, { concurrency = 4 } = {}) {
  return runPool(unique(urls), loadTextureSource, concurrency);
}
