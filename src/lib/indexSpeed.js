/**
 * Colocación de las imágenes del Index móvil con las pautas del speed-slider
 * de escritorio (components/sliders/SpeedSlider.js → placeRaw / place):
 *   - x siempre en una línea de columna (aquí las 4 de la rejilla móvil)
 *   - ancho = columnas enteras (apaisadas 2–4, verticales 1–2, mismos pesos)
 *   - y libre, ajustada a pasos de 8 px
 *   - semilla fija por imagen → la misma imagen cae siempre en el mismo sitio
 *   - si cae en la misma columna y casi a la misma altura que la anterior, salta 2 columnas
 * Misma secuencia que el speed-slider: las imágenes del proyecto en el orden de la grid.
 */
import { gridImages, PROJECT_NAME } from '@/components/data/grid';
import { MOBILE_GRID } from '@/lib/mobileGrid';
import { mediaAspect } from '@/lib/media';

export const SPEED = { depth: 3, baseline: 8, antiRepeat: 64 };
const SPANS = { landscape: [2, 3, 3, 4], portrait: [1, 1, 2] };
const COLS = MOBILE_GRID.columns;
const PROJECT_ORDER = Object.keys(PROJECT_NAME);

function rnd(n) {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export const speedImagesOf = (projectId) => gridImages.filter((image) => image.project === projectId);
export const ratioOf = (image) => 1 / (mediaAspect(image.key) || 1);

function placeRaw(projectId, imageIndex, ratio, stage) {
  const projectIndex = Math.max(0, PROJECT_ORDER.indexOf(projectId));
  const colW = (stage.width - (COLS - 1) * MOBILE_GRID.gap) / COLS;
  const seed = projectIndex * 97 + imageIndex * 13 + 1;
  const spans = ratio >= 1 ? SPANS.landscape : SPANS.portrait;
  const span = Math.min(COLS, spans[Math.floor(rnd(seed) * spans.length)]);
  let w = colW * span + MOBILE_GRID.gap * (span - 1);
  let h = w / ratio;
  if (h > stage.height) {
    h = stage.height;
    w = h * ratio;
  }
  const col = Math.floor(rnd(seed + 7) * (COLS - span + 1));
  const y = Math.floor((rnd(seed + 19) * Math.max(0, stage.height - h)) / SPEED.baseline) * SPEED.baseline;
  return { x: col * (colW + MOBILE_GRID.gap), y, w, h, col, span };
}

/**
 * Rect (px, relativo al escenario) de la imagen imageIndex del proyecto.
 * prev: { imageIndex, ratio } de la imagen anterior, para no caer encima.
 */
export function speedPlace(projectId, imageIndex, ratio, stage, prev = null) {
  const p = placeRaw(projectId, imageIndex, ratio, stage);
  if (!prev) return p;
  const q = placeRaw(projectId, prev.imageIndex, prev.ratio, stage);
  if (p.col !== q.col || Math.abs(p.y - q.y) >= SPEED.antiRepeat) return p;
  const colW = (stage.width - (COLS - 1) * MOBILE_GRID.gap) / COLS;
  const maxCol = COLS - p.span;
  const col = maxCol === 0 ? 0 : (p.col + 2) % (maxCol + 1);
  return { ...p, col, x: col * (colW + MOBILE_GRID.gap) };
}
