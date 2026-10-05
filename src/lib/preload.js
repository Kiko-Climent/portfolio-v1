import { projects } from '@/components/data/projects';
import { getInitialMashKeys, getMobileMash } from '@/components/data/mobileMash';
import { getGridSources } from '@/components/grids/index5';
import { getSlideSources } from '@/lib/optimizedImage';
import {
  loadBackgroundMobile,
  loadComponent,
  loadDesktopSlider,
  loadMobileSlider,
  loadWaveImage,
} from '@/lib/lazyComponents';
import {
  mediaKey,
  mediaSrc,
  prefetchFiles,
  preloadImages,
  preloadTextureSources,
  saveDataEnabled,
} from '@/lib/media';

const whenIdle = (callback) => {
  if (typeof requestIdleCallback === 'function') requestIdleCallback(callback, { timeout: 2000 });
  else setTimeout(callback, 200);
};

const galleryProjects = () =>
  Object.values(projects).filter((project) => project.id !== 'about' && project.slider?.images?.length);

// Texturas de la columna del slider de escritorio: exactamente las que pide
// SliderThree4 al montarse (getSlideSources → low).
const sliderColumnUrls = (project) =>
  getSlideSources(project, project.slider.images).map(({ low }) => low);

/**
 * Lo que tiene que estar listo para que la home aparezca completa al acabar la
 * intro (los cuadrados no viajan a la esquina hasta entonces):
 *   - escritorio: las 41 miniaturas de la grid (las mismas URLs que pide
 *     grids/index5) + los chunks de Three.js del hover y del slider
 *   - móvil: las texturas que el fondo 3D pinta nada más montarse + su chunk
 * Cuando termina, el resto se descarga en segundo plano sin competir con lo crítico.
 * Nunca rechaza: un fallo de red no puede dejar a nadie atrapado en el loader.
 */
export function preloadForIntro(isMobile) {
  const critical = isMobile
    ? Promise.all([
        preloadTextureSources(getInitialMashKeys().map((key) => mediaSrc(key, 'sm')), { concurrency: 7 }),
        loadComponent(loadBackgroundMobile),
      ])
    : Promise.all([
        preloadImages(getGridSources()),
        loadComponent(loadWaveImage),
        // La galería se monta en el mismo click: su código ya tiene que estar.
        loadComponent(loadDesktopSlider),
      ]);

  const done = critical.then(
    () => {},
    () => {}
  );
  done.then(() => whenIdle(() => (isMobile ? preloadMobileRest() : preloadDesktopRest())));
  return done;
}

function preloadMobileRest() {
  loadComponent(loadMobileSlider).catch(() => {});
  if (saveDataEnabled()) return;
  // Resto del fondo 3D (~0,9 MB): al deslizar no aparece ninguna placa vacía.
  preloadTextureSources(getMobileMash().map((item) => mediaSrc(item.key, 'sm')), { concurrency: 2 });
}

function preloadDesktopRest() {
  if (saveDataEnabled()) return;
  // Columna del slider de cada galería (~2 MB): al abrir una solo queda
  // decodificar y subir a la GPU, y la cortina entra sin esperar a la red.
  prefetchFiles(galleryProjects().flatMap(sliderColumnUrls), { concurrency: 3 });
}

/**
 * Precarga por intención: al pasar por encima de un proyecto (escritorio) o al
 * tocarlo (móvil).
 *   size: 'slider' → texturas de la columna del slider de escritorio
 *         'sm' | 'md' → variante fija (móvil / flicker del footer)
 *   as: 'image'   → <img> decodificadas (flicker del footer, About)
 *       'texture' → ImageBitmap listos para subir a la GPU (sliders 3D)
 */
export function prefetchProject(projectId, { size = 'md', as = 'texture' } = {}) {
  const project = projects[projectId];
  if (!project?.slider?.images?.length) return;
  const urls =
    size === 'slider'
      ? sliderColumnUrls(project)
      : project.slider.images.map((image) => mediaSrc(mediaKey(project, image.id), size));
  if (as === 'image') preloadImages(urls, { concurrency: 4 });
  else preloadTextureSources(urls, { concurrency: 4 });
}
