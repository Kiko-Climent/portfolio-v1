import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export default function WaveImage({ src, style, className, isVisible = true }) {
  const containerRef = useRef(null);
  const rendererRef = useRef(null);
  const materialRef = useRef(null);
  const animationRef = useRef(null);

  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  

  // Obtener dimensiones reales de la imagen
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const targetWidth =
        typeof style?.width === 'number'
          ? style.width
          : window.innerWidth * 0.5;

      const aspect = img.height / img.width;

      setDimensions({
        width: targetWidth,
        height: targetWidth * aspect,
      });
    };
    img.src = src;
  }, [src, style?.width]);

  useEffect(() => {
    if (!containerRef.current || !dimensions.width) return;

    const scene = new THREE.Scene();

    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 1;

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
    });

    // 🔥 CLAVE: pixel ratio correcto (adiós blur)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(dimensions.width, dimensions.height);

    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Textura
    const texture = new THREE.TextureLoader().load(src, () => {
      renderer.render(scene, camera);
    });

    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.colorSpace = THREE.SRGBColorSpace;

    const geometry = new THREE.PlaneGeometry(2, 2, 64, 64);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTexture: { value: texture },
        uTime: { value: 0 },
        uOpacity: { value: isVisible ? 1 : 0 },
        uWaveIntensity: { value: isVisible ? 1 : 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        uniform float uTime;
        uniform float uWaveIntensity;

        void main() {
          vUv = uv;
          vec3 pos = position;

          pos.z += sin(pos.x * 3.0 + uTime * 1.5) * 0.04 * uWaveIntensity;
          pos.z += sin(pos.y * 4.0 + uTime * 2.0) * 0.03 * uWaveIntensity;

          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D uTexture;
        uniform float uOpacity;
        uniform float uTime;
        uniform float uWaveIntensity;
        varying vec2 vUv;

        void main() {
          vec2 distortion = vec2(
            sin(vUv.y * 8.0 + uTime) * 0.004,
            cos(vUv.x * 8.0 + uTime) * 0.003
          ) * uWaveIntensity;

          vec4 color = texture2D(uTexture, vUv + distortion);
          gl_FragColor = vec4(color.rgb, color.a * uOpacity);
        }
      `,
      transparent: true,
    });

    materialRef.current = material;

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const start = performance.now();

    const animate = () => {
      material.uniforms.uTime.value = (performance.now() - start) * 0.001;
      renderer.render(scene, camera);
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    // ✅ CLEANUP SEGURO
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }

      geometry.dispose();
      material.dispose();
      texture.dispose();

      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current = null;
      }

      if (containerRef.current?.firstChild) {
        containerRef.current.removeChild(containerRef.current.firstChild);
      }
    };
  }, [src, dimensions, isVisible]);

  // Transición de visibilidad
  useEffect(() => {
    if (!materialRef.current) return;

    materialRef.current.uniforms.uOpacity.value = isVisible ? 1 : 0;
    materialRef.current.uniforms.uWaveIntensity.value = isVisible ? 1 : 0;
  }, [isVisible]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        ...style,
        width: dimensions.width,
        height: dimensions.height,
        position: 'absolute',
        pointerEvents: 'none',
      }}
    />
  );
}
