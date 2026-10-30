// La máscara del rodillo, cada etapa y el salto del tween tienen que ser
// el mismo número de píxeles. Con un tamaño en vw (clamp de --kc-type) el
// `1em` cae en un decimal; Safari redondea el recorte de overflow y el
// translate por separado, y asoma la fila siguiente. Aquí se mide la caja
// de línea real y se sube al píxel de pantalla, para que los tres coincidan
// en cualquier ancho, zoom o densidad.

export function snapRollRow(px) {
  const dpr = window.devicePixelRatio || 1;
  return Math.ceil(px * dpr - 1e-4) / dpr;
}

export function applyRollRow(stacks, row) {
  const px = `${row}px`;
  for (const stack of stacks) {
    if (!stack) continue;
    const mask = stack.parentElement;
    if (mask) {
      mask.style.height = px;
      mask.style.lineHeight = px;
    }
    for (const stage of stack.children) {
      stage.style.flex = `0 0 ${px}`;
      stage.style.height = px;
      stage.style.minHeight = '0';
      stage.style.maxHeight = px;
      stage.style.lineHeight = px;
    }
  }
}

// Mide antes de animar. El alto natural es el de la etapa, no el de la
// máscara: en WebKit la caja de línea puede ser un pelo más alta que el em.
export function lockRollRow(stacks) {
  let natural = 0;
  for (const stack of stacks) {
    if (!stack) continue;
    for (const stage of stack.children) {
      const h = stage.getBoundingClientRect().height;
      if (h > natural) natural = h;
    }
  }
  if (!natural) return 0;
  const row = snapRollRow(natural);
  applyRollRow(stacks, row);
  return row;
}
