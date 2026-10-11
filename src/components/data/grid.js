import { projects } from '@/components/data/projects';
import { mediaKey } from '@/lib/media';

export const GRID_COLUMNS = 6;

/** Proyecto encendido al entrar: el mismo con el que abre el prototipo. */
export const DEFAULT_PROJECT = 'salon';

export const PROJECT_NAME = {
  johnny: 'Johnny Carretes',
  salon: 'Salon Vilarnau',
  alt: 'Against Low Trends',
  mmdiscos: 'MM Discos',
  about: 'About',
};

const FILE_SLUG = {
  johnny: 'carretes',
  salon: 'vilarnau',
  alt: 'alt',
  mmdiscos: 'mmdiscos',
};

export const pad2 = (value) => String(value).padStart(2, '0');

/** Nombre de archivo de la interfaz, siempre con dos cifras: vilarnau_06.png. */
export function gridFileName(projectId, indexInProject) {
  if (projectId === 'about') return 'about.jpg';
  return `${FILE_SLUG[projectId]}_${pad2(indexInProject)}.png`;
}

const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

const rawImages = [
  ...range(1, 13).map((id) => ({ project: 'johnny', id })),
  ...range(1, 11).map((id) => ({ project: 'salon', id })),
  ...range(9, 15).map((id) => ({ project: 'alt', id })),
  ...range(1, 9).map((id) => ({ project: 'mmdiscos', id })),
  { project: 'about', id: 1 },
];

const totals = rawImages.reduce((acc, image) => {
  acc[image.project] = (acc[image.project] || 0) + 1;
  return acc;
}, {});

const seen = {};

// Imágenes de la grid de escritorio, en este orden:
// johnny 1-13, salon 1-11, alt 9-15, mmdiscos 1-9 y about.
// Vive aquí (y no dentro de la grid) para que la precarga de la intro sepa qué pedir.
// indexInProject numera cada proyecto desde 01, aunque el id de archivo no empiece en 1.
export const gridImages = rawImages.map((image) => {
  seen[image.project] = (seen[image.project] || 0) + 1;
  const indexInProject = seen[image.project];
  const key = mediaKey(projects[image.project], image.id);
  return {
    ...image,
    key,
    src: `/${key}.png`,
    indexInProject,
    totalInProject: totals[image.project],
    fileName: gridFileName(image.project, indexInProject),
  };
});
