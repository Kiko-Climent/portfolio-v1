/**
 * Canal mínimo entre el slider WebGL móvil y la interfaz (navbar, footer).
 * El slider emite en cada frame; quien escucha escribe directamente en el DOM
 * (transform / color), sin pasar por el estado de React, así el contador
 * rodante y la lista no provocan re-renders a 60 fps.
 *
 *   'progress' → { value, count }  value: índice continuo (2.37 = entre la 3 y la 4)
 *   'active'   → { projectId }     proyecto de la hoja que está en el ancla (Home)
 */
const listeners = new Map();
const last = new Map();

export const sliderBus = {
  on(type, fn) {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type).add(fn);
    if (last.has(type)) fn(last.get(type));
    return () => listeners.get(type)?.delete(fn);
  },
  emit(type, payload) {
    last.set(type, payload);
    listeners.get(type)?.forEach((fn) => fn(payload));
  },
  /** Olvida el último valor (al desmontar un slider, para que el siguiente no herede su estado). */
  reset(type) {
    last.delete(type);
  },
};
