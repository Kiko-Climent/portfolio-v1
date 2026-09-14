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
 * Sirve una rendition vía el image optimizer de Next (AVIF/WebP, ancho acotado).
 * Three.TextureLoader puede usarla igual que un PNG estático.
 */
export function getOptimizedImageUrl(src, { width = 828, quality = 75 } = {}) {
    if (!src || src.startsWith('data:') || src.includes('/_next/image')) return src;

    const path = src.startsWith('/') ? src : `/${src}`;
    const w = pickWidth(width);
    const q = quality <= 50 ? 50 : 75;

    return `/_next/image?url=${encodeURIComponent(path)}&w=${w}&q=${q}`;
}
