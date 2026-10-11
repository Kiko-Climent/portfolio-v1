/**
 * Rejilla de la home de escritorio: 12 columnas, el mismo aire a los lados
 * y entre columnas. Las miniaturas ocupan las 6 primeras; la foto, la línea
 * de datos y la lista de proyectos cuelgan de la columna 7, la misma línea
 * que "Creative Frontend Developer".
 */
export const PAGE = {
  columns: 12,
  gap: 16,
  pad: 16,
  // Navbar → línea de la rejilla (y rejilla → footer). Dos módulos de 16:
  // margen, columnas y este hueco salen del mismo 16. Antes 46 (pensado
  // para la letra de ~21px; con la de ~15px dejaba demasiado aire).
  rowGap: 32,
  /** Proyectos que no están activos. Sobre blanco, no más claro que esto. */
  muted: '#767676',
  mutedDark: '#8f8f8f',
  /** Miniaturas inactivas: transparencia, sin desenfoque. */
  dim: 0.14,
};

const innerGaps = PAGE.columns - 1;

/** Borde izquierdo de una columna (1–12), respecto a una página al 100%. */
export function columnLeft(column) {
  const before = column - 1;
  return `calc(${PAGE.pad}px + ${before} * ((100% - ${PAGE.pad * 2}px - ${innerGaps * PAGE.gap}px) / ${PAGE.columns} + ${PAGE.gap}px))`;
}

/** Ancho de `span` columnas seguidas, con los huecos que hay entre ellas. */
export function columnsWidth(span) {
  return `calc(${span} * (100% - ${PAGE.pad * 2}px - ${innerGaps * PAGE.gap}px) / ${PAGE.columns} + ${(span - 1) * PAGE.gap}px)`;
}

/** El mismo ancho, en píxeles, para darle un tamaño al canvas de la foto. */
export function columnsWidthPx(span, viewportWidth) {
  const inner = viewportWidth - PAGE.pad * 2;
  const track = (inner - innerGaps * PAGE.gap) / PAGE.columns;
  return span * track + (span - 1) * PAGE.gap;
}
