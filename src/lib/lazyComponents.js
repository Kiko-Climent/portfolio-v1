import { useEffect, useState } from 'react';

/**
 * Componentes con Three.js en chunks aparte: la intro arranca sin esperar a
 * Three.js y src/lib/preload.js los descarga mientras se reproduce.
 *
 * No se usa next/dynamic a propósito: pasa por Suspense, y React 19 retrasa
 * hasta 300 ms la primera aparición de un componente suspendido aunque su
 * chunk ya esté descargado (se notaba al abrir la primera galería). Aquí, si
 * el chunk ya está, el componente se monta en el mismo render.
 */
export const loadWaveImage = () => import('@/components/tools/WaveImage');
export const loadBackgroundMobile = () => import('@/components/backgroundMobile/index');
export const loadDesktopSlider = () => import('@/components/sliders/ProjectImageSliderThree');
export const loadMobileSlider = () => import('@/components/sliders/ProjectImageSliderMobile');

const modules = new Map();

/** Descarga (una sola vez) el componente de un loader de arriba. */
export function loadComponent(loader) {
  let entry = modules.get(loader);
  if (!entry) {
    entry = { component: null, promise: null };
    entry.promise = loader().then(
      (mod) => {
        entry.component = mod.default;
        return mod.default;
      },
      (error) => {
        modules.delete(loader); // permitir reintentar
        throw error;
      }
    );
    modules.set(loader, entry);
  }
  return entry.promise;
}

/** El componente si ya está descargado (o en cuanto lo esté); null mientras tanto. */
export function useLazyComponent(loader) {
  const [component, setComponent] = useState(() => modules.get(loader)?.component ?? null);

  useEffect(() => {
    if (component) return undefined;
    let alive = true;
    loadComponent(loader).then(
      (loaded) => {
        if (alive) setComponent(() => loaded);
      },
      () => {}
    );
    return () => {
      alive = false;
    };
  }, [loader, component]);

  return component;
}

/**
 * Pinta el componente de `loader` en cuanto su chunk está disponible (nada
 * mientras tanto). El resto de props se le pasan tal cual.
 */
export function LazyComponent({ loader, ...props }) {
  const Component = useLazyComponent(loader);
  if (!Component) return null;
  // La referencia sale de la caché de módulos de arriba: es estable, no se
  // crea un componente nuevo en cada render.
  // eslint-disable-next-line react-hooks/static-components
  return <Component {...props} />;
}
