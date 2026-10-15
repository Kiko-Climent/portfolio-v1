/**
 * Relevo póster del Index → hoja de la galería (móvil).
 *
 * Al abrir un proyecto tocando el póster del Index (IndexSheetMobile), la
 * portada vuela en su propio lienzo (IndexPosterPaper) hasta el hueco que esa
 * misma imagen ocupará en el slider del proyecto (SliderThree4Mobile), que
 * arranca en esa imagen con su hoja reservada (sin cortina). Cuando las dos
 * partes están listas —el póster aterrizado y la textura de la hoja cargada—
 * la hoja del slider aparece y el póster desaparece en el mismo sitio.
 *
 *   Index:   arm({ projectId, imageId })  →  whenGallery(cb)  →  complete()
 *   Galería: armedImage(projectId)        →  galleryReady(projectId, { rect, reveal })
 *   Index (hoja): whenComplete(cb) para desmontar el póster.
 *
 * Mismo patrón que aboutHandoff (escritorio). Si una de las partes no llega,
 * cada una tiene su red de seguridad: la galería se destapa sola y el Index
 * se cierra igualmente.
 */

let current = null;

const call = (fns, payload) => fns.forEach((fn) => fn(payload));

export const indexHandoff = {
  arm({ projectId, imageId }) {
    current = { projectId, imageId, gallery: null, done: false, galleryFns: new Set(), completeFns: new Set() };
  },

  /** Id de la imagen reservada si hay un relevo armado para este proyecto. */
  armedImage(projectId) {
    return current && !current.done && current.projectId === projectId ? current.imageId : null;
  },

  /** La galería ya tiene la hoja colocada y con textura: rect en px de viewport. */
  galleryReady(projectId, gallery) {
    if (!current || current.done || current.projectId !== projectId) return false;
    current.gallery = gallery;
    call(current.galleryFns, gallery);
    return true;
  },

  whenGallery(fn) {
    if (!current) return () => {};
    if (current.gallery) {
      fn(current.gallery);
      return () => {};
    }
    const entry = current;
    entry.galleryFns.add(fn);
    return () => entry.galleryFns.delete(fn);
  },

  whenComplete(fn) {
    if (!current) return () => {};
    const entry = current;
    entry.completeFns.add(fn);
    return () => entry.completeFns.delete(fn);
  },

  /** Relevo hecho (o abortado): la galería se destapa y el Index puede desmontarse. */
  complete() {
    const entry = current;
    if (!entry || entry.done) return;
    entry.done = true;
    current = null;
    entry.gallery?.reveal?.();
    call(entry.completeFns);
  },

  isActive() {
    return !!current && !current.done;
  },
};
