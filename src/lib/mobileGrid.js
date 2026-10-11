/**
 * Rejilla móvil: 4 columnas, el equivalente de las 12 de escritorio
 * (pageGrid.js): cada columna móvil son 3 de escritorio.
 *   pad 16 · gap 12 · rowGap 24 (el doble del gap, como 32 = 2 × 16 en desktop)
 * Las hojas del slider móvil (SliderThree4Mobile) se colocan sobre ella:
 *   apaisadas → 4 columnas · verticales → 2 columnas, alternando 3–4 / 1–2.
 */
export const MOBILE_GRID = {
  columns: 4,
  pad: 16,
  gap: 12,
  rowGap: 24,
  /** Caption con el nombre de archivo bajo cada hoja: 4 px de aire + línea de 11 px (texto de 10 px). */
  captionGap: 4,
  captionLine: 11,
  captionSize: 10,
  /** Ancla por defecto (y de la hoja activa) si todavía no hay navbar que medir. */
  fallbackAnchor: 92,
  /** Proyectos inactivos en la lista (mismo gris que escritorio). */
  muted: '#767676',
  mutedDark: '#8f8f8f',
};

const trackPx = (viewportWidth) => {
  const { columns, pad, gap } = MOBILE_GRID;
  return (viewportWidth - pad * 2 - (columns - 1) * gap) / columns;
};

/** Ancho en px de `span` columnas seguidas, con sus huecos. */
export function colsWidthPx(span, viewportWidth) {
  return span * trackPx(viewportWidth) + (span - 1) * MOBILE_GRID.gap;
}

/** Borde izquierdo en px de la columna `column` (1–4). */
export function colLeftPx(column, viewportWidth) {
  return MOBILE_GRID.pad + (column - 1) * (trackPx(viewportWidth) + MOBILE_GRID.gap);
}

/**
 * Línea donde se asienta la hoja activa: el borde inferior del navbar
 * ([data-navbar]) más un rowGap. Encima queda la hoja anterior, pasando por
 * debajo del navbar en difference.
 */
export function mobileAnchorPx() {
  if (typeof document === 'undefined') return MOBILE_GRID.fallbackAnchor;
  const navbar = document.querySelector('[data-navbar]');
  if (!navbar) return MOBILE_GRID.fallbackAnchor;
  const rect = navbar.getBoundingClientRect();
  if (!rect.height) return MOBILE_GRID.fallbackAnchor;
  return Math.round(rect.top + rect.height + MOBILE_GRID.rowGap);
}
