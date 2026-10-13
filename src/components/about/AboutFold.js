'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import { useDarkMode } from '@/contexts/DarkModeContext';
import { CURTAIN } from '@/components/SliderThree/index5';
import { loadTextureSource, mediaKey, mediaSrc } from '@/lib/media';
import { createTexture, destroyRenderer } from '@/lib/textures';
import { PAGE, columnLeft, columnsWidth, columnsWidthPx } from '@/lib/pageGrid';
import { gridFileName } from '@/components/data/grid';
import { Line, useLineReveal } from './useLineReveal';

/**
 * About v5 — "Hoja plegada" (oct 2026).
 *
 * La foto entera en las cols 9–12 como una sola hoja de papel. En reposo
 * las esquinas están enrolladas hacia dentro como canutos (cada una con su
 * tamaño), con el dorso del papel a la vista y una sombra suave sobre la
 * foto; los canutos respiran un poco. Al pasar el ratón se desenrollan
 * (empieza el más cercano al cursor) y la foto queda entera y ondeando muy
 * suave, con la misma ondulación que las fotos del hover del home
 * (WaveImage) más una bandera ligera en profundidad. El viento está siempre
 * (poco en reposo) y al desplegarse entra una ráfaga que acompaña al
 * desenrollado. Al salir se vuelven
 * a enrollar.
 *
 * Una malla subdividida; el enrollado se calcula en el vertex shader: a
 * partir de una línea paralela al pliegue de cada esquina, el papel se
 * enrolla en espiral (un cilindro que se cierra un poco en cada vuelta, algo
 * cónico a lo largo). Desenrollar = esa línea viaja hacia la esquina.
 * Cortina de entrada/salida: la
 * misma CURTAIN del slider. Sin WebGL, la foto se pinta entera en un <img>.
 *
 * La v4 (retales de papel) sigue en AboutPaper y la v3 (mercurio) en
 * AboutGridCut; se elige en ProjectImageSliderThreeGrid (ABOUT_LAYOUT).
 */

/**
 * La hoja:
 *  flaps     esquinas enrolladas: [esquina, largo en el borde horizontal
 *            (fracción del ancho), largo en el borde vertical (fracción del
 *            alto), cuánto está enrollada en reposo (1 = hasta esa línea),
 *            radio de su canuto (px)]
 *  tube      canuto: radio por defecto (px), separación entre vueltas (px), conicidad
 *            (0 = cilindro; 0.4 = un extremo un 40 % más ancho que el otro)
 *  idle      respiración en reposo: cuánto (fracción) y velocidad
 *  shadow    sombra del canuto sobre la foto (0–1)
 *  unfold    duración, easing y escalonado al desenrollar (desde la esquina
 *            más cercana al cursor)
 *  refold    lo mismo al volver a enrollarse
 *  wave      viento: la ondulación de las fotos del home (desplazamiento de
 *            la imagen en uv: x, y) y bandera en profundidad (px,
 *            frecuencia, velocidad). rest = cuánto hay en reposo; al
 *            desplegarse entra una ráfaga (gust) que acompaña al
 *            desenrollado y se asienta en 1 (in, s); al salir vuelve a
 *            rest (out, s)
 *  back      color del dorso del papel y cuánto se transparenta la foto
 *  shade     sombreado del papel curvado (0 = plano)
 *  fov       apertura de la cámara (más = más perspectiva)
 *  segments  subdivisión de la hoja (x, y)
 */
const FOLD = {
  flaps: [
    ['tl', 0.8, 0.62, 1, 30],
    ['tr', 0.2, 0.3, 0.95, 15],
    ['br', 0.75, 0.4, 1, 26],
    ['bl', 0.25, 0.38, 0.9, 18],
  ],
  tube: [18, 2.5, 0.4],
  idle: [0.06, 1.1],
  shadow: 0.32,
  unfold: { duration: 1.6, ease: 'expo.out', stagger: 0.1 },
  refold: { duration: 1.3, ease: 'power3.inOut', stagger: 0.08 },
  wave: { uv: [0.004, 0.003], flag: [6, 0.011, 1.5], rest: 0.35, gust: 1.8, in: 1.4, out: 0.9 },
  back: { color: [0.93, 0.93, 0.92], see: 0.07 },
  shade: 0.35,
  fov: 33,
  segments: [170, 210],
};
// Lo que el lienzo WebGL desborda la foto por cada lado (perspectiva de los
// canutos y la bandera).
const MARGIN = 120;
// Única excepción al tipo único: los servicios (~44 px a 1440).
const SERVICES_TYPE = 'clamp(1.75rem, 3.05vw, 3.5rem)';
const FLAPS = FOLD.flaps.length;

const VERTEX = /* glsl */ `
#define FLAPS ${FLAPS}
uniform vec2 uRes;          // px CSS de la foto
uniform vec2 uCanvas;       // px del lienzo (la foto + uMargin por cada lado)
uniform float uMargin;
uniform vec4 uFlap[FLAPS];  // pliegue de cada esquina: A.xy, B.xy (px de la foto)
uniform vec2 uCorner[FLAPS];
uniform float uRoll[FLAPS]; // px de papel enrollado desde la esquina (0 = plana)
uniform vec3 uTube;         // radio (px), separación entre vueltas (px), conicidad
uniform float uRad[FLAPS];  // radio del canuto de cada esquina (px)
uniform float uWave;        // 0 → 1 bandera
uniform vec3 uFlag;         // amplitud (px), frecuencia, velocidad
uniform float uTime;
varying vec2 vQ;            // px de la foto sin enrollar (la imagen va con el papel)
varying vec3 vPos;
varying vec3 vNormal;
varying float vShadow;

void main() {
  vec2 v = vec2(position.x + 0.5, 0.5 - position.y) * uRes;
  vQ = v;
  vec3 p = vec3(v, 0.0);
  vec3 nrm = vec3(0.0, 0.0, 1.0);
  float shadow = 0.0;
  for (int k = 0; k < FLAPS; k++) {
    float L = uRoll[k];
    if (L < 0.5) continue;
    vec2 A = uFlap[k].xy;
    vec2 B = uFlap[k].zw;
    vec2 D = normalize(B - A);
    vec2 N = vec2(-D.y, D.x);
    if (dot(uCorner[k] - A, N) < 0.0) N = -N;
    float c = dot(uCorner[k] - A, N) - L;   // donde empieza el canuto
    float d = dot(v - A, N);
    float t = clamp(dot(v - A, D) / max(length(B - A), 1.0), 0.0, 1.0);
    float R = max(3.0, uRad[k] * (1.0 + uTube.z * (t - 0.5) * 2.0));
    if (d > c) {
      // Espiral: el papel da vueltas a un cilindro que se cierra un poco en
      // cada vuelta (así las capas no se pisan).
      float a = (d - c) / R;
      float rho = max(1.0, R - uTube.y * a / 6.2831853);
      p = vec3(A + D * dot(v - A, D) + N * (c + rho * sin(a)), R - rho * cos(a));
      // Normal exacta del canuto, en mundo (y hacia arriba).
      nrm = vec3(-sin(a) * N.x, sin(a) * N.y, cos(a));
      // El arranque del canuto sigue en la sombra (sin escalón con la foto).
      shadow = max(shadow, (1.0 - smoothstep(0.0, 1.5, a)) * smoothstep(0.5, 24.0, L));
    } else {
      // Sombra del canuto sobre la foto, justo delante de él.
      shadow = max(shadow, (1.0 - smoothstep(0.0, R * 2.5, c - d)) * smoothstep(0.5, 24.0, L));
    }
  }
  vShadow = shadow;
  vNormal = nrm;
  // Bandera: una onda muy suave en profundidad, solo con la hoja desplegada.
  p.z += sin(v.x * uFlag.y + v.y * uFlag.y * 0.35 + uTime * uFlag.z) * uFlag.x * uWave;

  vec3 world = vec3(p.x + uMargin - uCanvas.x * 0.5, uCanvas.y * 0.5 - (p.y + uMargin), p.z);
  vPos = world;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
uniform sampler2D uTex;
uniform vec2 uTexSize;
uniform vec2 uRes;
uniform vec4 uCrop;         // zona útil de la foto en uv (x0, y0, x1, y1), y desde abajo
uniform float uFocus;       // -1 arriba … 0 centro … 1 abajo (encuadre vertical del cover)
uniform float uReveal;      // cortina de entrada: 0 → 1 (sube desde abajo)
uniform float uHide;        // cortina de salida: 0 → 1 (se va por arriba)
uniform float uZoom;
uniform float uShade;
uniform float uWave;
uniform vec2 uWaveUv;       // ondulación de la imagen (la de WaveImage)
uniform float uTime;
uniform vec4 uBack;         // dorso: color, cuánto se transparenta la foto
uniform float uShadow;
varying vec2 vQ;
varying vec3 vPos;
varying vec3 vNormal;
varying float vShadow;

vec4 sampleCover(vec2 q) {
  vec2 cropSize = uCrop.zw - uCrop.xy;
  float imgAspect = (cropSize.x * uTexSize.x) / (cropSize.y * uTexSize.y);
  float boxAspect = uRes.x / uRes.y;
  vec2 s = vec2(1.0);
  if (boxAspect > imgAspect) s.y = imgAspect / boxAspect; else s.x = boxAspect / imgAspect;
  vec2 uv = (q / uRes - 0.5) * s + 0.5;
  uv.y += uFocus * (1.0 - s.y) * 0.5;
  vec2 u = clamp(uv, 0.0, 1.0);
  return texture2D(uTex, vec2(uCrop.x + u.x * cropSize.x, uCrop.w - u.y * cropSize.y));
}

void main() {
  if (uReveal < 0.999 && vQ.y < uRes.y * (1.0 - uReveal)) discard;
  if (uHide > 0.001 && vQ.y > uRes.y * (1.0 - uHide)) discard;
  vec2 uv = vQ / uRes;
  // Misma ondulación que las fotos del hover del home.
  vec2 wave = vec2(sin(uv.y * 8.0 + uTime) * uWaveUv.x, cos(uv.x * 8.0 + uTime) * uWaveUv.y) * uWave;
  vec2 cc = uRes * 0.5;
  vec2 q = cc + (vQ + wave * uRes - cc) / uZoom;
  vec3 col = sampleCover(q).rgb;

  vec3 n = normalize(vNormal);
  if (!gl_FrontFacing) n = -n;
  vec3 L = normalize(vec3(-0.35, 0.45, 1.0));
  float shade = 1.0 + uShade * (dot(n, L) - L.z) * 2.0;
  if (!gl_FrontFacing) {
    // Dorso del papel: casi blanco, con la foto transparentándose un poco.
    float g = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(uBack.rgb, vec3(g), uBack.a);
  }
  gl_FragColor = vec4(col * shade * (1.0 - uShadow * vShadow), 1.0);
}
`;

export default function AboutFold({ project, shouldHide = false, onSceneReady, onTextReady }) {
  const { isDarkMode } = useDarkMode();
  const ink = isDarkMode ? '#ffffff' : '#000000';
  const mutedInk = isDarkMode ? PAGE.mutedDark : PAGE.muted;

  const { services = [], bio = [], gridCut = {} } = project;
  const columns = gridCut.columns || 4;
  const startColumn = gridCut.startColumn || PAGE.columns - columns + 1;
  const src = mediaSrc(mediaKey(project, 1), 'lg');

  const rootRef = useRef(null);
  const servicesRef = useRef(null);
  const holderRef = useRef(null);
  const glRef = useRef(null);
  const hiddenRef = useRef(false);
  const wholeRef = useRef(false);
  const [box, setBox] = useState(null);
  const [fallback, setFallback] = useState(false);

  const { addLine, reveal, hide } = useLineReveal({ rootRef, parallelRef: servicesRef, onDone: onTextReady });

  // ── Medidas: `columns` columnas desde `startColumn`, arriba en la línea de
  // la rejilla; alto = el de la proporción (ratio) sin pisar el footer.
  useLayoutEffect(() => {
    const measure = () => {
      const vw = window.innerWidth;
      const navbar = document.querySelector('[data-navbar]');
      const footer = document.querySelector('[data-footer]');
      const top = navbar ? navbar.getBoundingClientRect().bottom + PAGE.rowGap : 128;
      const fontSize = parseFloat(getComputedStyle(rootRef.current || document.body).fontSize) || 15;
      const captionH = fontSize + 6;
      const bottom = footer ? footer.getBoundingClientRect().top - PAGE.gap * 2 - captionH : window.innerHeight * 0.85;
      const colW = columnsWidthPx(1, vw);
      const width = columnsWidthPx(columns, vw);
      setBox({
        top,
        left: PAGE.pad + (startColumn - 1) * (colW + PAGE.gap),
        width,
        height: Math.max(120, Math.min(bottom - top, width * (gridCut.ratio || 1.25))),
        colW,
      });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [columns, startColumn, gridCut.ratio]);

  // ── WebGL: una hoja subdividida; el plegado de las esquinas y la bandera
  // se calculan en el vertex shader. Se monta cuando ya hay medidas.
  const ready = !!box;
  useEffect(() => {
    const holder = holderRef.current;
    if (!holder || glRef.current) return undefined;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, premultipliedAlpha: false });
    } catch {
      setFallback(true);
      onSceneReady?.();
      reveal();
      return undefined;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    Object.assign(renderer.domElement.style, {
      display: 'block',
      position: 'absolute',
      left: `${-MARGIN}px`,
      top: `${-MARGIN}px`,
      pointerEvents: 'none',
    });
    holder.appendChild(renderer.domElement);

    const crop = gridCut.crop || [0, 0, 1, 1];
    const rest = FOLD.flaps.map(([, , , roll]) => roll);
    // Estado: cuánto está enrollada cada esquina (fracción, GSAP), bandera y cortina.
    const flaps = rest.map((a) => ({ a }));
    let reach = FOLD.flaps.map(() => 0); // px de la esquina a su pliegue
    const sheet = { wave: FOLD.wave.rest, reveal: 0, hide: 0, zoom: CURTAIN.zoomFrom };
    const uniforms = {
      uTex: { value: null },
      uTexSize: { value: new THREE.Vector2(1, 1) },
      uRes: { value: new THREE.Vector2(1, 1) },
      uCanvas: { value: new THREE.Vector2(1, 1) },
      uMargin: { value: MARGIN },
      // projects.js da el recorte con y desde arriba; en la textura va desde abajo.
      uCrop: { value: new THREE.Vector4(crop[0], 1 - crop[3], crop[2], 1 - crop[1]) },
      uFocus: { value: gridCut.focus ?? -0.6 },
      uFlap: { value: FOLD.flaps.map(() => new THREE.Vector4()) },
      uCorner: { value: FOLD.flaps.map(() => new THREE.Vector2()) },
      uRoll: { value: FOLD.flaps.map(() => 0) },
      uTube: { value: new THREE.Vector3(...FOLD.tube) },
      uRad: { value: FOLD.flaps.map((f) => f[4] ?? FOLD.tube[0]) },
      uShadow: { value: FOLD.shadow },
      uWave: { value: 0 },
      uWaveUv: { value: new THREE.Vector2(...FOLD.wave.uv) },
      uFlag: { value: new THREE.Vector3(...FOLD.wave.flag) },
      uTime: { value: 0 },
      uReveal: { value: 0 },
      uHide: { value: 0 },
      uZoom: { value: CURTAIN.zoomFrom },
      uShade: { value: FOLD.shade },
      uBack: { value: new THREE.Vector4(...FOLD.back.color, FOLD.back.see) },
    };
    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms,
      side: THREE.DoubleSide,
    });
    const geometry = new THREE.PlaneGeometry(1, 1, ...FOLD.segments);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    const scene = new THREE.Scene();
    scene.add(mesh);
    const camera = new THREE.PerspectiveCamera(FOLD.fov, 1, 1, 10000);

    // Líneas de pliegue en px de la foto: desde el borde horizontal al vertical
    // de cada esquina.
    let corners = [];
    const layout = (b) => {
      const { width: W, height: H } = b;
      corners = FOLD.flaps.map(([corner, fx, fy], k) => {
        const right = corner[1] === 'r';
        const bottom = corner[0] === 'b';
        const cx = right ? W : 0;
        const cy = bottom ? H : 0;
        const ax = right ? W - fx * W : fx * W;
        const by = bottom ? H - fy * H : fy * H;
        uniforms.uFlap.value[k].set(ax, cy, cx, by);
        uniforms.uCorner.value[k].set(cx, cy);
        return [cx, cy];
      });
      // Distancia de cada esquina a su pliegue.
      reach = FOLD.flaps.map(([, fx, fy]) => {
        const a = fx * W;
        const b = fy * H;
        return (a * b) / Math.hypot(a, b);
      });
    };

    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let texture = null;
    let dirty = true;
    let last = performance.now();

    const tick = () => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const u = uniforms;
      // Enrollado (con respiración en reposo).
      if (!still) u.uTime.value += dt;
      flaps.forEach((f, k) => {
        const breathe = still ? 1 : 1 + FOLD.idle[0] * Math.sin(u.uTime.value * FOLD.idle[1] + k * 1.7);
        const roll = f.a * reach[k] * breathe;
        if (u.uRoll.value[k] !== roll) {
          u.uRoll.value[k] = roll;
          dirty = true;
        }
      });
      if (u.uWave.value !== sheet.wave) {
        u.uWave.value = sheet.wave;
        dirty = true;
      }
      if (sheet.wave > 0.001 && !still) dirty = true;
      if (u.uReveal.value !== sheet.reveal || u.uHide.value !== sheet.hide || u.uZoom.value !== sheet.zoom) {
        u.uReveal.value = sheet.reveal;
        u.uHide.value = sheet.hide;
        u.uZoom.value = sheet.zoom;
        dirty = true;
      }
      if (dirty && texture) {
        renderer.render(scene, camera);
        dirty = false;
      }
    };
    gsap.ticker.add(tick);

    const resize = (b) => {
      const cw = b.width + MARGIN * 2;
      const ch = b.height + MARGIN * 2;
      renderer.setSize(cw, ch);
      // Cámara en perspectiva con 1 unidad = 1 px en z = 0.
      camera.aspect = cw / ch;
      camera.position.set(0, 0, ch / 2 / Math.tan(THREE.MathUtils.degToRad(FOLD.fov / 2)));
      camera.far = camera.position.z * 4;
      camera.updateProjectionMatrix();
      uniforms.uRes.value.set(b.width, b.height);
      uniforms.uCanvas.value.set(cw, ch);
      layout(b);
      dirty = true;
    };

    // Desenrollar / enrollar: empieza la esquina más cercana al cursor.
    const state = { active: false, ready: false, x: 0, y: 0 };
    const setOrigin = (x, y) => {
      state.x = x;
      state.y = y;
    };
    const setActive = (active) => {
      if (hiddenRef.current || !state.ready || active === state.active) return;
      state.active = active;
      wholeRef.current = active;
      const order = flaps
        .map((_, k) => k)
        .sort((a, b) => {
          const da = corners[a] ? Math.hypot(corners[a][0] - state.x, corners[a][1] - state.y) : a;
          const db = corners[b] ? Math.hypot(corners[b][0] - state.x, corners[b][1] - state.y) : b;
          return da - db;
        });
      const cfg = active ? FOLD.unfold : FOLD.refold;
      order.forEach((k, rank) => {
        gsap.to(flaps[k], {
          a: active ? 0 : rest[k],
          duration: still ? 0.01 : cfg.duration,
          ease: cfg.ease,
          delay: still ? 0 : rank * cfg.stagger,
          overwrite: 'auto',
        });
      });
      // Viento: al desplegarse, una ráfaga que acompaña al desenrollado y se
      // asienta; al plegarse, vuelve a la brisa de reposo.
      gsap.killTweensOf(sheet, 'wave');
      if (still) return;
      if (active) {
        gsap
          .timeline()
          .to(sheet, { wave: FOLD.wave.gust, duration: cfg.duration * 0.45, ease: 'power2.out' })
          .to(sheet, { wave: 1, duration: FOLD.wave.in, ease: 'power2.inOut' });
      } else {
        gsap.to(sheet, { wave: FOLD.wave.rest, duration: FOLD.wave.out, ease: 'power2.inOut' });
      }
    };

    let cancelled = false;
    const mountedAt = performance.now();
    loadTextureSource(src).then(
      (source) => {
        if (cancelled) return;
        texture = createTexture(source);
        // Shader propio: el color pasa tal cual (sin conversión de espacio).
        texture.colorSpace = THREE.NoColorSpace;
        texture.minFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;
        uniforms.uTex.value = texture;
        uniforms.uTexSize.value.set(source.image.width, source.image.height);
        dirty = true;

        // Cortina de entrada: la misma que las hojas del slider.
        const delay = Math.max(0, CURTAIN.minDelay - (performance.now() - mountedAt) / 1000);
        gsap.to(sheet, { reveal: 1, zoom: 1, delay, duration: CURTAIN.duration, ease: CURTAIN.ease });
        gsap.delayedCall(delay + CURTAIN.duration * CURTAIN.readyAt, () => {
          if (cancelled) return;
          state.ready = true;
          onSceneReady?.();
          reveal();
        });
      },
      () => {
        if (cancelled) return;
        setFallback(true);
        onSceneReady?.();
        reveal();
      }
    );

    // El ratón se sigue en toda la ventana: dentro de la foto se despliega,
    // fuera se pliega; la posición decide qué esquina empieza.
    const onWindowMove = (e) => {
      if (e.pointerType === 'touch') return;
      const r = holder.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      const inside = x >= 0 && y >= 0 && x <= r.width && y <= r.height;
      setOrigin(x, y);
      if (inside !== state.active) setActive(inside);
    };
    const onWindowOut = (e) => {
      if (e.relatedTarget) return;
      setActive(false);
    };
    window.addEventListener('pointermove', onWindowMove);
    document.addEventListener('pointerout', onWindowOut);

    // `strips` mantiene la interfaz de las otras versiones (cortina de salida).
    glRef.current = { strips: [sheet], resize, setActive, setOrigin };
    resize(box);

    return () => {
      cancelled = true;
      window.removeEventListener('pointermove', onWindowMove);
      document.removeEventListener('pointerout', onWindowOut);
      gsap.ticker.remove(tick);
      gsap.killTweensOf(flaps);
      gsap.killTweensOf(sheet);
      texture?.dispose();
      geometry.dispose();
      material.dispose();
      renderer.domElement.remove();
      destroyRenderer(renderer);
      glRef.current = null;
    };
    // Una vez, en cuanto hay medidas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  useEffect(() => {
    if (box && glRef.current) glRef.current.resize(box);
  }, [box]);

  // ── Salida al volver al menú / cambiar de proyecto.
  useEffect(() => {
    if (!shouldHide) return;
    const gl = glRef.current;
    gl?.setActive(false);
    hiddenRef.current = true;
    hide();
    if (!gl) return;
    gsap.killTweensOf(gl.strips);
    gsap.to(gl.strips, {
      hide: 1,
      zoom: CURTAIN.out.zoomTo,
      duration: CURTAIN.out.duration,
      ease: CURTAIN.out.ease,
      stagger: CURTAIN.out.stagger,
    });
  }, [shouldHide, hide]);

  const pointerIn = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  const onTap = useCallback((e) => {
    if (e.pointerType !== 'touch') return;
    const [x, y] = pointerIn(e);
    // Táctil: un toque funde alrededor del dedo (más cerca del centro, más
    // foto); otro toque lo suelta.
    const next = !wholeRef.current;
    glRef.current?.setOrigin(x, y, next);
    glRef.current?.setActive(next);
  }, []);

  return (
    <div
      ref={rootRef}
      className="absolute inset-0 text-[length:var(--kc-type)] leading-[1] pointer-events-none"
      style={{ color: ink }}
    >
      {/* Bio: cols 1–4, en la línea de la rejilla */}
      <div
        className="absolute grid items-start"
        style={{
          top: box?.top ?? 128,
          left: PAGE.pad,
          right: PAGE.pad,
          gridTemplateColumns: `repeat(${PAGE.columns}, minmax(0, 1fr))`,
          columnGap: PAGE.gap,
        }}
      >
        <div className="flex flex-col pointer-events-auto" style={{ gridColumn: '1 / span 4', gap: '1em' }}>
          <Line lineRef={addLine}>About</Line>
          {bio.map((paragraph, i) => (
            <p key={i} data-split className="m-0" style={{ color: i === bio.length - 1 ? mutedInk : ink }}>
              {paragraph}
            </p>
          ))}
        </div>
      </div>

      {/* Foto cortada por la rejilla */}
      {box ? (
        <figure className="absolute m-0 flex flex-col" style={{ top: box.top, left: box.left, width: box.width, gap: 6 }}>
          <div
            ref={holderRef}
            role="img"
            aria-label="Portrait of Kiko Climent on a sheet of paper with rolled corners; hover to unroll it"
            className="relative pointer-events-auto"
            style={{ width: box.width, height: box.height, cursor: 'crosshair' }}
            onPointerUp={onTap}
          >
            {fallback ? (
              <img
                src={src}
                alt=""
                className="absolute inset-0 block h-full w-full object-cover"
                style={{ objectPosition: '50% 20%' }}
              />
            ) : null}
          </div>
          {/* Nombre de archivo, como el caption de las galerías (mismo cuerpo que el footer). */}
          <figcaption style={{ color: ink }}>
            <Line lineRef={addLine}>{gridFileName(project.id, 1)}</Line>
          </figcaption>
        </figure>
      ) : null}

      {/* Servicios destacados, abajo a la izquierda */}
      <div
        ref={servicesRef}
        className="absolute flex flex-col pointer-events-auto"
        style={{ left: columnLeft(1), width: columnsWidth(6), bottom: PAGE.pad, gap: '1em' }}
      >
        <Line lineRef={addLine} style={{ color: mutedInk }}>
          Services
        </Line>
        <ul className="m-0 list-none p-0" style={{ fontSize: SERVICES_TYPE, lineHeight: 0.94, letterSpacing: '-0.035em' }}>
          {services.map((service) => (
            <li key={service}>
              <Line lineRef={addLine}>{service}</Line>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
