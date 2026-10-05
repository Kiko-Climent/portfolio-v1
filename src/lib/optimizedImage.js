import { mediaSrcForWidth } from '@/lib/media';

const ALLOWED_WIDTHS = [256, 384, 640, 750, 828, 1080, 1200, 1920];

const pickWidth = (width) => {
    let chosen = ALLOWED_WIDTHS[0];
    for (const candidate of ALLOWED_WIDTHS) {
        chosen = candidate;
        if (candidate >= width) break;
    }
    return chosen;
};

/**
 * Rendition optimizada de una imagen de /public con al menos `width` px de ancho.
 * Sirve las variantes WebP estáticas que genera scripts/optimize-images.mjs
 * (sin coste en el servidor y cacheables para siempre); solo si la imagen aún
 * no está en el manifest recurre al image optimizer de Next (AVIF/WebP).
 * Three.TextureLoader puede usarla igual que un PNG estático.
 */
export function getOptimizedImageUrl(src, { width = 828, quality = 75 } = {}) {
    if (!src || src.startsWith('data:') || src.includes('/_next/image')) return src;

    const path = src.startsWith('/') ? src : `/${src}`;
    const staticVariant = mediaSrcForWidth(path.slice(1).replace(/\.png$/i, ''), width);
    if (staticVariant) return staticVariant;

    const w = pickWidth(width);
    const q = quality <= 50 ? 50 : 75;

    return `/_next/image?url=${encodeURIComponent(path)}&w=${w}&q=${q}`;
}

/**
 * Dos resoluciones por imagen del slider 3D de escritorio. Subir un PNG
 * original (2940 px) a la GPU bloquea el hilo ~70 ms; una versión de 1200 px,
 * ~4 ms. La columna usa la ligera (a la medida de la hoja en pantalla), así el
 * slider puede cargar mientras se animan menú, grid y título. La imagen en
 * detalle cambia a alta resolución al terminar su vuelo, ya quieta.
 * Vive aquí (y no en el slider) para que la precarga pida exactamente las mismas.
 */
export const getSlideSources = (project, images) => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const columnWidth = window.innerHeight * 0.6 * dpr; // ancho de una hoja en la columna
    const detailWidth = window.innerWidth * 0.6 * dpr;  // ancho de la imagen en detalle
    return images.map((img) => {
        const original = `${project.imagesPath}/${project.id}${img.id}.png`;
        return {
            low: getOptimizedImageUrl(original, { width: columnWidth }),
            // Por encima de 1920 px (pantallas 5K) se usa el PNG original.
            high: detailWidth > 1920 ? original : getOptimizedImageUrl(original, { width: detailWidth }),
        };
    });
};
