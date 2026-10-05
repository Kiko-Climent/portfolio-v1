import * as THREE from 'three';

/**
 * Crea una textura a partir de lo que devuelve loadTextureSource (src/lib/media.js).
 * Con ImageBitmap la imagen ya viene volteada y decodificada, así que la subida a
 * la GPU no bloquea el hilo principal decodificando.
 */
export function createTexture({ image, flipY }) {
  const texture = new THREE.Texture(image);
  texture.flipY = flipY;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

/** Libera el renderer y su contexto WebGL en el acto (dispose() solo lo deja para el GC). */
export function destroyRenderer(renderer) {
  renderer.dispose();
  renderer.forceContextLoss();
}
