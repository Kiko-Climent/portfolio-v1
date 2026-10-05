import { projects } from '@/components/data/projects';
import { mediaKey } from '@/lib/media';

export const GRID_COLUMNS = 6;

const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

// Imágenes de la grid de escritorio, en este orden:
// johnny 1-13, salon 1-11, alt 9-15, mmdiscos 1-9 y about.
// Vive aquí (y no dentro de la grid) para que la precarga de la intro sepa qué pedir.
export const gridImages = [
  ...range(1, 13).map((id) => ({ project: 'johnny', id })),
  ...range(1, 11).map((id) => ({ project: 'salon', id })),
  ...range(9, 15).map((id) => ({ project: 'alt', id })),
  ...range(1, 9).map((id) => ({ project: 'mmdiscos', id })),
  { project: 'about', id: 1 },
].map((image) => {
  const key = mediaKey(projects[image.project], image.id);
  return { ...image, key, src: `/${key}.png` };
});
