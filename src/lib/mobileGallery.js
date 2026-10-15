/**
 * Dónde queda una imagen en el slider móvil del detalle (SliderThree4Mobile)
 * cuando el slider arranca en ella: misma regla de colocación que su
 * computeLayout (apaisadas a 4 columnas; verticales a 2, alternando 3–4 / 1–2
 * según cuántas verticales van antes) y asentada en el ancla bajo el navbar.
 * Lo usa el póster del Index para volar al sitio exacto antes de que el
 * slider exista.
 */
import { colLeftPx, colsWidthPx, mobileAnchorPx } from '@/lib/mobileGrid';
import { mediaAspect, mediaKey } from '@/lib/media';

export function predictSlideRect(project, imageId, viewportWidth = typeof window === 'undefined' ? 390 : window.innerWidth) {
  const images = project?.slider?.images ?? [];
  const index = Math.max(0, images.findIndex((img) => img.id === imageId));
  let portraitCount = 0;
  for (let i = 0; i < index; i++) {
    const aspect = 1 / mediaAspect(mediaKey(project, images[i].id));
    if (aspect < 1) portraitCount += 1;
  }
  const aspect = 1 / mediaAspect(mediaKey(project, images[index]?.id ?? imageId));
  const portrait = aspect < 1;
  const span = portrait ? 2 : 4;
  const startCol = portrait ? (portraitCount % 2 === 0 ? 3 : 1) : 1;
  const width = colsWidthPx(span, viewportWidth);
  return { left: colLeftPx(startCol, viewportWidth), top: mobileAnchorPx(), width, height: width / aspect };
}
