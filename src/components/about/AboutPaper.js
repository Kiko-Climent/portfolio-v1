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
 * About v4 — "Retales de papel" (oct 2026, boceto 07a del canvas).
 *
 * La foto ocupa paper.columns columnas desde paper.startColumn (oct 2026:
 * 2 columnas, cols 7–8, bajo el contacto del navbar) y cada columna se parte
 * en paper.split subcolumnas (con medio gutter entre ellas): un retal
 * rectangular por subcolumna, cada uno con su ancho y su alto (asimétricos).
 * Al pasar el ratón los retales crecen hasta cubrir su subcolumna y medio
 * hueco a cada lado y revelan la foto entera; al salir se vuelven a cortar.
 *
 * Cada retal es una hoja de papel: una malla subdividida que se curva en el
 * vertex shader con la misma forma que las hojas del slider (updateCurve de
 * SliderThree/index5: inclinación, pliegue, esquina de arriba a la izquierda
 * levantada y rizo, con la esquina llegando tarde). El pliegue sale de la
 * velocidad del retal: se curva mientras se mueve y se queda plano al
 * llegar. Empieza el retal más cercano al cursor y le siguen los demás. En
 * reposo son rectángulos secos.
 *
 * La imagen va pegada al papel (se deforma con la hoja). Cortina de entrada
 * y salida: la misma CURTAIN del slider, por retal. Sin WebGL, la foto se
 * pinta entera en un <img>.
 *
 * Datos: projects.about.paper (columnas, subcolumnas y retales) y
 * projects.about.gridCut (proporción, recorte, encuadre). La v3 (mercurio) sigue en
 * AboutGridCut; se elige en ProjectImageSliderThreeGrid (ABOUT_LAYOUT).
 */

/**
 * El papel:
 *  duration  segundos de la unión / de la separación
 *  ease      easing de la unión / de la separación
 *  stagger   retardo entre retales, del más cercano al cursor al más lejano
 *  bend      velocidad del retal → pliegue (más = se curva más)
 *  smooth    suavizado del pliegue / retardo de la esquina cogida (por frame)
 *  depth     profundidad del papel: px por unidad del slider
 *  shape     tilt, bend, grab, curl (los settings del slider)
 *  leadTuck  cuánto baja / se mete la esquina cogida (lead, tuck del slider)
 *  amp       exageración del pliegue (0.38 = lo mismo que el slider)
 *  pinch     concavidad mientras se estira: lados hacia dentro (fracción del
 *            medio ancho), arriba/abajo hacia dentro (fracción del medio alto)
 *            y cuenco: al unirse el centro se hunde (succión); al separarse
 *            se hunde también, menos (unidades del slider)
 *  expel     pliegue al separarse respecto al de unirse (positivo = también
 *            cóncavo; negativo = se abomba hacia fuera, como el slider)
 *  shade     sombreado del papel al curvarse (0 = plano)
 *  fov       apertura de la cámara (más = más perspectiva)
 *  reshuffle al separarse, retales nuevos al azar (la primera vez, los de
 *            projects.js): un ancho de cada tipo (fracción de la subcolumna) y
 *            un alto de cada tipo (px para 573 de alto), repartidos al azar
 *  segments  subdivisión de cada hoja (x, y)
 *  subGap    hueco entre las subcolumnas de una columna (fracción del gutter)
 *  depth3d   cada retal en su plano, como las hojas del slider: profundidad
 *            en reposo de cada uno (px para 573 de alto; negativo = al
 *            fondo), cuánto pasan por delante al unirse (bump), paralaje
 *            con el ratón (px por cada 100 px de profundidad) y su suavizado.
 *            random: al repartirse de nuevo, cada retal recibe una
 *            profundidad de un tipo distinto (cerca, medio, lejos y, a veces,
 *            muy al fondo: más pequeño). fade: lo lejano se aclara hacia el
 *            fondo, como una segunda tinta (0 = nada)
 */
const PAPER = {
  duration: [1.3, 1.0],
  ease: ['power3.inOut', 'power3.inOut'],
  stagger: 0.08,
  bend: 0.7,
  smooth: [0.1, 0.12],
  depth: 150,
  shape: [0.28, 1.15, 1.85, 0.55],
  leadTuck: [0.42, 0.22],
  amp: 0.5,
  pinch: [0.14, 0.04, 0.55],
  expel: 0.5,
  shade: 0.16,
  fov: 33,
  segments: [12, 40],
  subGap: 0.5,
  depth3d: {
    rest: [-90, 40, -200, -30],
    bump: 60,
    parallax: 6,
    ease: 0.06,
    random: { near: [10, 60], mid: [-60, -130], far: [-170, -280], deep: [-420, -620], deepChance: 0.45 },
    fade: 0.22,
  },
  reshuffle: {
    enabled: true,
    widths: [[0.5, 0.62], [0.66, 0.78], [0.82, 0.92], [1, 1]],
    heights: [[330, 380], [400, 450], [460, 510], [520, 573]],
  },
};
// Retales por defecto (07a, sin subcolumnas): por columna, [x, ancho] en
// fracción de la columna (x desde su borde izquierdo) y [arriba, alto] en px para una foto
// de 573 px de alto.
const DEFAULT_STRIPS = [
  [0, 0.43, 72, 440],
  [0, 1, 0, 512],
  [0.29, 0.71, 128, 445],
  [0, 0.84, 24, 352],
];
// Retales al azar: cada retal recibe un ancho y un alto de un tipo distinto
// (fino, medio, ancho, entero), así siempre quedan asimétricos; se pegan a la
// izquierda, a la derecha o a un punto al azar de su columna, y arriba, abajo
// o a una altura al azar.
const pick = ([a, b]) => a + Math.random() * (b - a);
const shuffled = (list) => {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};
const randomStrips = (n) => {
  const { widths, heights } = PAPER.reshuffle;
  const ws = shuffled(widths);
  const hs = shuffled(heights);
  return Array.from({ length: n }, (_, i) => {
    const fw = Math.min(1, pick(ws[i % ws.length]));
    const h = Math.round(Math.min(573, pick(hs[i % hs.length])));
    const free = 573 - h;
    const r = Math.random();
    const top = r < 0.3 ? 0 : r < 0.55 ? free : Math.round(Math.random() * free);
    const align = Math.floor(Math.random() * 3);
    const fx = fw >= 1 ? 0 : align === 0 ? 0 : align === 1 ? 1 - fw : Math.random() * (1 - fw);
    return [fx, fw, top, h];
  });
};
// Profundidades al azar: una de cada tipo y, a veces, una muy al fondo.
const randomDepths = (n) => {
  const { near, mid, far, deep, deepChance } = PAPER.depth3d.random;
  const kinds = shuffled([near, mid, far, Math.random() < deepChance ? deep : far]);
  return Array.from({ length: n }, (_, i) => pick(kinds[i % kinds.length]));
};
// Lo que el lienzo WebGL desborda la foto por cada lado: la esquina levantada
// se sale de la foto.
const MARGIN = 200;
// Única excepción al tipo único: los servicios (~44 px a 1440).
const SERVICES_TYPE = 'clamp(1.75rem, 3.05vw, 3.5rem)';

const VERTEX = /* glsl */ `
uniform vec4 uRect;        // retal en px de la foto: x, y (desde arriba), ancho, alto
uniform vec2 uCanvas;      // px del lienzo (la foto + uMargin por cada lado)
uniform float uMargin;
uniform float uFold;       // pliegue 0 → 1 (velocidad del retal)
uniform float uLag;        // el mismo pliegue con retardo (la esquina cogida llega tarde)
uniform float uDir;        // 1 al unirse, -1 al separarse
uniform float uDepth;      // px de profundidad por unidad del slider
uniform vec4 uShape;       // tilt, bend, grab, curl
uniform vec2 uLeadTuck;
uniform float uZ;          // profundidad del retal (px; negativo = al fondo)
uniform vec2 uParallax;    // paralaje: px por cada 100 px de profundidad
uniform float uAmp;        // exageración del pliegue
uniform vec3 uPinch;       // lados, arriba/abajo, cuenco
uniform float uExpel;      // pliegue al separarse respecto al de unirse
varying vec2 vQ;           // px de la foto sin deformar (la imagen va con el papel)
varying vec3 vPos;

void main() {
  // Misma forma que precomputeCurve del slider (plano de -1 a 1).
  float nx = clamp(position.x * 2.0, -1.0, 1.0);
  float ny = clamp(position.y * 2.0, -1.0, 1.0);
  float leftAmount = (1.0 - nx) * 0.5;
  float topAmount = (1.0 + ny) * 0.5;
  float topLeft = pow(leftAmount, 1.55) * pow(topAmount, 0.9);
  float topRight = pow(1.0 - leftAmount, 1.45) * pow(topAmount, 1.15) * 0.28;
  float cornerLift = min(1.0, topLeft + topRight);
  float fromGrab = clamp(length(vec2(nx + 1.0, ny - 1.0)) / 2.828427, 0.0, 1.0);
  float radial = clamp((nx * nx * (0.35 + 0.65 * leftAmount) + ny * ny) * 0.5, 0.0, 1.0);
  float foldShape = radial * radial * (3.0 - 2.0 * radial) * 2.0 - 1.0;
  float grab = fromGrab * 0.82;
  float tilt = -ny * uShape.x * (0.62 + 0.38 * leftAmount);
  float foldZ = foldShape * uShape.y + pow(cornerLift, 1.25) * uShape.z + pow(topLeft, 2.35) * uShape.w;
  float intensity = uAmp * ((1.0 - grab) * uFold + grab * uLag);
  float dirK = uDir > 0.0 ? 1.0 : uExpel;
  float fold = intensity * dirK;

  vec2 base = uRect.xy + vec2(position.x + 0.5, 0.5 - position.y) * uRect.zw;
  vQ = base;
  vec2 p = base + vec2(uLeadTuck.y, uLeadTuck.x) * fold * topLeft * uDepth;
  float z = (intensity * tilt + fold * foldZ) * uDepth;

  // Concavidad: mientras el retal se estira, el medio de cada borde llega
  // tarde (las esquinas tiran), así los lados se hunden hacia dentro. El
  // centro se va al fondo (succión al unirse; con expel > 0 también al separarse).
  float side = 1.0 - ny * ny;      // 1 a media altura, 0 en las esquinas
  float across = 1.0 - nx * nx;    // 1 en el eje, 0 en los lados
  float pull = mix(uFold, uLag, 0.35);
  p.x += -nx * side * uPinch.x * uRect.z * 0.5 * pull;
  p.y += ny * across * uPinch.y * uRect.w * 0.5 * pull;
  z += -dirK * across * side * uPinch.z * uDepth * pull;
  vec3 world = vec3(p.x + uMargin - uCanvas.x * 0.5, uCanvas.y * 0.5 - (p.y + uMargin), z + uZ);
  // Paralaje: lo que está al fondo se desplaza con el ratón; z = 0 no se mueve.
  world.xy -= uParallax * world.z / 100.0;
  vPos = world;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
uniform sampler2D uTex;
uniform vec2 uTexSize;
uniform vec2 uRes;          // px CSS de la foto
uniform vec4 uCrop;         // zona útil de la foto en uv (x0, y0, x1, y1), y desde abajo
uniform float uFocus;       // -1 arriba … 0 centro … 1 abajo (encuadre vertical del cover)
uniform float uReveal;      // cortina de entrada: 0 → 1 (sube desde abajo)
uniform float uHide;        // cortina de salida: 0 → 1 (se va por arriba)
uniform float uZoom;
uniform float uShade;
uniform float uFade;       // 0 → 1: lo lejano se aclara hacia el fondo
uniform float uBgTone;     // 1 = fondo blanco, 0 = negro (modo oscuro)
varying vec2 vQ;
varying vec3 vPos;

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
  vec2 cc = uRes * 0.5;
  vec4 col = sampleCover(cc + (vQ - cc) / uZoom);
  // Papel: luz de arriba a la izquierda; plano = sin cambio.
  vec3 n = normalize(cross(dFdx(vPos), dFdy(vPos)));
  vec3 L = normalize(vec3(-0.35, 0.45, 1.0));
  float shade = 1.0 + uShade * (dot(n, L) - L.z) * 2.0;
  gl_FragColor = vec4(mix(col.rgb * shade, vec3(uBgTone), uFade), 1.0);
}
`;

export default function AboutPaper({ project, shouldHide = false, onSceneReady, onTextReady }) {
  const { isDarkMode } = useDarkMode();
  // Tono del fondo para el WebGL (lo lejano se aclara hacia él).
  const bgRef = useRef(1);
  bgRef.current = isDarkMode ? 0 : 1;
  const ink = isDarkMode ? '#ffffff' : '#000000';
  const mutedInk = isDarkMode ? PAGE.mutedDark : PAGE.muted;

  const { services = [], bio = [], gridCut = {}, paper = {} } = project;
  // La foto: paper.columns desde paper.startColumn (si no, las de gridCut).
  const columns = paper.columns || gridCut.columns || 4;
  const startColumn = paper.startColumn || gridCut.startColumn || PAGE.columns - columns + 1;
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

  // ── WebGL: una hoja de papel (malla subdividida) por retal; el pliegue se
  // calcula en el vertex shader. Se monta cuando ya hay medidas.
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
    let cuts = project.paper?.strips || DEFAULT_STRIPS;
    const split = project.paper?.split || 1;
    let depths = [...PAPER.depth3d.rest];
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(PAPER.fov, 1, 1, 10000);
    const geometry = new THREE.PlaneGeometry(1, 1, ...PAPER.segments);
    // Uniforms comunes (mismos objetos en todas las hojas).
    const shared = {
      uTex: { value: null },
      uTexSize: { value: new THREE.Vector2(1, 1) },
      uRes: { value: new THREE.Vector2(1, 1) },
      uCanvas: { value: new THREE.Vector2(1, 1) },
      uMargin: { value: MARGIN },
      // projects.js da el recorte con y desde arriba; en la textura va desde abajo.
      uCrop: { value: new THREE.Vector4(crop[0], 1 - crop[3], crop[2], 1 - crop[1]) },
      uFocus: { value: gridCut.focus ?? -0.6 },
      uDepth: { value: PAPER.depth },
      uShape: { value: new THREE.Vector4(...PAPER.shape) },
      uLeadTuck: { value: new THREE.Vector2(...PAPER.leadTuck) },
      uAmp: { value: PAPER.amp },
      uPinch: { value: new THREE.Vector3(...PAPER.pinch) },
      uExpel: { value: PAPER.expel },
      uShade: { value: PAPER.shade },
      uParallax: { value: new THREE.Vector2() },
      uBgTone: { value: 1 },
    };
    // Estado por retal: progreso 0 (cortado) → 1 (entero) que anima GSAP,
    // pliegue y retardo de la esquina, dirección y cortina.
    const strips = cuts.map(() => {
      const uniforms = {
        ...shared,
        uRect: { value: new THREE.Vector4(0, 0, 1, 1) },
        uFold: { value: 0 },
        uLag: { value: 0 },
        uDir: { value: 1 },
        uReveal: { value: 0 },
        uHide: { value: 0 },
        uZoom: { value: CURTAIN.zoomFrom },
        uZ: { value: 0 },
        uFade: { value: 0 },
      };
      const material = new THREE.ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        uniforms,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.frustumCulled = false;
      scene.add(mesh);
      return { mesh, material, uniforms, p: 0, prev: 0, fold: 0, lag: 0, dir: 1, reveal: 0, hide: 0, zoom: CURTAIN.zoomFrom };
    });

    // Rectángulos de cada retal (px de la foto): cortado y entero.
    let geo = null;
    let lastBox = null;
    const layout = (b) => {
      const k = b.height / 573;
      const gap = PAGE.gap;
      // Cada columna se parte en `split` subcolumnas; un retal por subcolumna.
      const subGap = split > 1 ? gap * PAPER.subGap : 0;
      const subW = (b.colW - subGap * (split - 1)) / split;
      geo = cuts.map(([fx, fw, top, h], i) => {
        const c = Math.floor(i / split);
        const sub = i % split;
        const left = c * (b.colW + gap) + sub * (subW + subGap);
        const before = sub === 0 ? gap : subGap;
        const after = sub === split - 1 ? gap : subGap;
        const L = i === 0 ? 0 : left - before / 2;
        const R = i === cuts.length - 1 ? b.width : left + subW + after / 2;
        return {
          cut: [left + fx * subW, top * k, fw * subW, Math.min(b.height - top * k, h * k)],
          whole: [L, 0, R - L, b.height],
        };
      });
    };

    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let texture = null;
    let dirty = true;
    // Ratón en la ventana, de -1 a 1 (para el paralaje).
    const pointer = { x: 0, y: 0 };
    let last = performance.now();
    const lerp = (a, b, t) => a + (b - a) * t;

    const tick = () => {
      const now = performance.now();
      const dt = Math.max(1 / 240, Math.min(0.05, (now - last) / 1000));
      last = now;
      const f = dt * 60;
      strips.forEach((s, i) => {
        // Pliegue = velocidad del retal, suavizado; la esquina cogida lo sigue tarde.
        const v = (s.p - s.prev) / dt;
        s.prev = s.p;
        if (Math.abs(v) > 0.01) s.dir = v > 0 ? 1 : -1;
        const target = still ? 0 : Math.min(1, Math.abs(v) * PAPER.bend);
        s.fold += (target - s.fold) * (1 - Math.pow(1 - PAPER.smooth[0], f));
        s.lag += (s.fold - s.lag) * (1 - Math.pow(1 - PAPER.smooth[1], f));
        if (target === 0 && s.fold < 1e-4) s.fold = 0;
        if (s.fold === 0 && s.lag < 1e-4) s.lag = 0;

        const u = s.uniforms;
        if (geo) {
          const { cut, whole } = geo[i];
          const r = u.uRect.value;
          const x = lerp(cut[0], whole[0], s.p);
          const y = lerp(cut[1], whole[1], s.p);
          const w = lerp(cut[2], whole[2], s.p);
          const h = lerp(cut[3], whole[3], s.p);
          if (r.x !== x || r.y !== y || r.z !== w || r.w !== h) {
            r.set(x, y, w, h);
            dirty = true;
          }
          // Profundidad: cada retal en su plano; al unirse vuelven todos a z = 0
          // pasando un poco por delante (como la hoja de detalle del slider).
          const kz = lastBox ? lastBox.height / 573 : 1;
          const { bump, fade } = PAPER.depth3d;
          const z = lerp(depths[i % depths.length] * kz, 0, s.p) + bump * kz * Math.sin(Math.PI * s.p);
          const tint = fade * Math.min(1, Math.max(0, -z / (600 * kz)));
          if (u.uZ.value !== z || u.uFade.value !== tint) {
            u.uZ.value = z;
            u.uFade.value = tint;
            dirty = true;
          }
        }
        if (
          u.uFold.value !== s.fold ||
          u.uLag.value !== s.lag ||
          u.uDir.value !== s.dir ||
          u.uReveal.value !== s.reveal ||
          u.uHide.value !== s.hide ||
          u.uZoom.value !== s.zoom
        ) {
          u.uFold.value = s.fold;
          u.uLag.value = s.lag;
          u.uDir.value = s.dir;
          u.uReveal.value = s.reveal;
          u.uHide.value = s.hide;
          u.uZoom.value = s.zoom;
          dirty = true;
        }
      });
      if (shared.uBgTone.value !== bgRef.current) {
        shared.uBgTone.value = bgRef.current;
        dirty = true;
      }
      // Paralaje: el ratón desplaza un poco los retales según su profundidad.
      const par = shared.uParallax.value;
      const tx = still ? 0 : pointer.x * PAPER.depth3d.parallax;
      const ty = still ? 0 : -pointer.y * PAPER.depth3d.parallax;
      if (Math.abs(par.x - tx) > 0.002 || Math.abs(par.y - ty) > 0.002) {
        const e = 1 - Math.pow(1 - PAPER.depth3d.ease, f);
        par.set(par.x + (tx - par.x) * e, par.y + (ty - par.y) * e);
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
      camera.position.set(0, 0, ch / 2 / Math.tan(THREE.MathUtils.degToRad(PAPER.fov / 2)));
      camera.far = camera.position.z * 4;
      camera.updateProjectionMatrix();
      shared.uRes.value.set(b.width, b.height);
      shared.uCanvas.value.set(cw, ch);
      // Profundidad pensada para una foto de 573 px de alto.
      shared.uDepth.value = PAPER.depth * (b.height / 573);
      lastBox = b;
      layout(b);
      dirty = true;
    };

    // Unión / separación: empieza el retal más cercano al cursor.
    const state = { active: false, ready: false, x: 0 };
    const setOrigin = (x) => {
      state.x = x;
    };
    const setActive = (active) => {
      if (hiddenRef.current || !state.ready || active === state.active) return;
      state.active = active;
      wholeRef.current = active;
      // Al separarse desde la foto entera, retales nuevos al azar.
      if (!active && PAPER.reshuffle.enabled && lastBox && strips.every((s) => s.p > 0.98)) {
        cuts = randomStrips(cuts.length);
        depths = randomDepths(cuts.length);
        layout(lastBox);
      }
      const centers = geo ? geo.map((g) => g.whole[0] + g.whole[2] / 2) : strips.map((_, i) => i);
      const order = strips
        .map((_, i) => i)
        .sort((a, b) => Math.abs(centers[a] - state.x) - Math.abs(centers[b] - state.x));
      const k = active ? 0 : 1;
      order.forEach((i, rank) => {
        gsap.to(strips[i], {
          p: active ? 1 : 0,
          duration: still ? 0.01 : PAPER.duration[k],
          ease: PAPER.ease[k],
          delay: still ? 0 : rank * PAPER.stagger,
          overwrite: 'auto',
        });
      });
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
        shared.uTex.value = texture;
        shared.uTexSize.value.set(source.image.width, source.image.height);
        dirty = true;

        // Cortina de entrada: igual que las hojas del slider, de izquierda a derecha.
        const delay = Math.max(0, CURTAIN.minDelay - (performance.now() - mountedAt) / 1000);
        gsap.to(strips, { reveal: 1, zoom: 1, delay, duration: CURTAIN.duration, ease: CURTAIN.ease, stagger: CURTAIN.stagger });
        gsap.delayedCall(delay + (strips.length - 1) * CURTAIN.stagger + CURTAIN.duration * CURTAIN.readyAt, () => {
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

    // El ratón se sigue en toda la ventana: dentro de la foto se unen, fuera
    // se separan; la x decide qué retal empieza.
    const onWindowMove = (e) => {
      if (e.pointerType === 'touch') return;
      const r = holder.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      const inside = x >= 0 && y >= 0 && x <= r.width && y <= r.height;
      state.x = x;
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
      if (inside !== state.active) setActive(inside);
    };
    const onWindowOut = (e) => {
      if (e.relatedTarget) return;
      setActive(false);
    };
    window.addEventListener('pointermove', onWindowMove);
    document.addEventListener('pointerout', onWindowOut);

    glRef.current = { strips, resize, setActive, setOrigin };
    resize(box);

    return () => {
      cancelled = true;
      window.removeEventListener('pointermove', onWindowMove);
      document.removeEventListener('pointerout', onWindowOut);
      gsap.ticker.remove(tick);
      gsap.killTweensOf(strips);
      texture?.dispose();
      geometry.dispose();
      strips.forEach((s) => s.material.dispose());
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
            aria-label="Portrait of Kiko Climent in four paper strips; hover to join them"
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
