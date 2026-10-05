import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { loadTextureSource } from '@/lib/media';
import { createTexture, destroyRenderer } from '@/lib/textures';

// Texturas que se quedan en la GPU entre hovers (las más recientes).
const MAX_GPU_TEXTURES = 8;

const vertexShader = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Ondulación sutil de la imagen: desplaza las UV unos píxeles en el tiempo.
// colorspace_fragment devuelve el color a sRGB: sin él la imagen salía bastante
// más oscura y saturada que la captura original.
const fragmentShader = `
  uniform sampler2D uTexture;
  uniform float uTime;
  varying vec2 vUv;

  void main() {
    vec2 distortion = vec2(
      sin(vUv.y * 8.0 + uTime) * 0.004,
      cos(vUv.x * 8.0 + uTime) * 0.003
    );

    gl_FragColor = texture2D(uTexture, vUv + distortion);
    #include <colorspace_fragment>
  }
`;

// Un único contexto WebGL para todos los hovers: crearlo es lo caro, así que se
// hace una vez y cada hover solo cambia la textura y el tamaño del canvas.
function createWaveRenderer(container) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.domElement.style.visibility = 'hidden';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 1;

  const geometry = new THREE.PlaneGeometry(2, 2);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTexture: { value: null },
      uTime: { value: 0 },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
  });
  scene.add(new THREE.Mesh(geometry, material));
  renderer.compile(scene, camera);

  const textures = new Map();
  const start = performance.now();
  let frame = null;
  let width = 0;
  let height = 0;

  const render = () => {
    material.uniforms.uTime.value = (performance.now() - start) * 0.001;
    renderer.render(scene, camera);
  };

  const loop = () => {
    render();
    frame = requestAnimationFrame(loop);
  };

  return {
    hide() {
      renderer.domElement.style.visibility = 'hidden';
      cancelAnimationFrame(frame);
      frame = null;
    },

    show(src, source, nextWidth, nextHeight) {
      let texture = textures.get(src);
      if (texture) {
        textures.delete(src);
      } else {
        texture = createTexture(source);
        texture.generateMipmaps = false;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
      }
      textures.set(src, texture);

      for (const [oldSrc, oldTexture] of textures) {
        if (textures.size <= MAX_GPU_TEXTURES) break;
        oldTexture.dispose();
        textures.delete(oldSrc);
      }

      if (width !== nextWidth || height !== nextHeight) {
        renderer.setSize(nextWidth, nextHeight);
        width = nextWidth;
        height = nextHeight;
      }

      material.uniforms.uTexture.value = texture;
      render();
      renderer.domElement.style.visibility = 'visible';
      if (!frame) frame = requestAnimationFrame(loop);
    },

    dispose() {
      cancelAnimationFrame(frame);
      textures.forEach((texture) => texture.dispose());
      geometry.dispose();
      material.dispose();
      renderer.domElement.remove();
      destroyRenderer(renderer);
    },
  };
}

/**
 * Detalle del hover de la grid. El bucle de render solo corre mientras hay una
 * imagen visible y las texturas llegan ya decodificadas de la caché compartida.
 * Con "reducir movimiento" (o sin WebGL) se muestra la imagen tal cual.
 */
export default function WaveImage({ src, width, height, style, className }) {
  const containerRef = useRef(null);
  const waveRef = useRef(null);
  const ensureWaveRef = useRef(null);
  const [useFallback, setUseFallback] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  // El renderer se crea en un momento ocioso tras montar (o en el primer hover,
  // lo que llegue antes) para no robarle frames a la animación de entrada.
  useEffect(() => {
    if (useFallback) return undefined;
    const container = containerRef.current;

    ensureWaveRef.current = () => {
      if (!waveRef.current) {
        try {
          waveRef.current = createWaveRenderer(container);
        } catch {
          setUseFallback(true);
        }
      }
      return waveRef.current;
    };

    const ensure = () => ensureWaveRef.current?.();
    const idleId =
      typeof requestIdleCallback === 'function'
        ? requestIdleCallback(ensure, { timeout: 2000 })
        : setTimeout(ensure, 500);

    return () => {
      if (typeof cancelIdleCallback === 'function') cancelIdleCallback(idleId);
      else clearTimeout(idleId);
      ensureWaveRef.current = null;
      waveRef.current?.dispose();
      waveRef.current = null;
    };
  }, [useFallback]);

  // Cambio de imagen: textura desde la caché compartida y render inmediato.
  useEffect(() => {
    if (useFallback) return undefined;

    const wave = src ? ensureWaveRef.current?.() : waveRef.current;
    if (!wave) return undefined;

    wave.hide();
    if (!src) return undefined;

    let cancelled = false;
    loadTextureSource(src)
      .then((source) => {
        if (!cancelled && waveRef.current === wave) wave.show(src, source, width, height);
      })
      .catch((error) => console.warn(`Couldn't load image ${src}`, error));

    return () => {
      cancelled = true;
    };
  }, [src, width, height, useFallback]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        ...style,
        width,
        height,
        position: 'absolute',
        pointerEvents: 'none',
      }}
    >
      {useFallback && src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" style={{ width: '100%', height: '100%', display: 'block' }} />
      ) : null}
    </div>
  );
}
