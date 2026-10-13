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
 * About v3 — "Grid cut" líquido (oct 2026, boceto 05b del canvas + referencia
 * emmaportner.com).
 *
 * La foto vive dentro de varias formas líquidas, una por columna (por defecto
 * cols 9–12). En reposo no están quietas: cada tira tiene su grosor, respira,
 * se desplaza un poco y sus bordes ondulan; el contenido de cada una está
 * desplazado en vertical. Al pasar el ratón se funden alrededor del cursor:
 * solo se funde la zona cercana (entrando por una esquina, solo esa esquina)
 * y la zona crece cuanto más se acerca el cursor al centro, donde la foto
 * queda entera en una sola forma que sigue viva:
 * bordes que ondulan y la imagen moviéndose como un líquido muy suave. Mover
 * el ratón rápido empuja el borde cerca del cursor (como el scroll en la
 * referencia).
 *
 * El cursor es un campo (una gaussiana, más alta que ancha) que manda a la
 * vez en dos cosas, así que nunca se pelean:
 *  - hinchado: cada tira engorda donde el campo es fuerte, hacia su columna,
 *    con un tope por debajo de la columna; el último hueco lo cierra el cuello
 *    suave (smooth-min) entre gotas vecinas. No aparece materia nueva.
 *  - atracción: cada tira se inclina hacia el cursor (fracción de la
 *    distancia, nunca lo cruza) y deja de inclinarse cuanto más hinchada está.
 * La atracción empieza antes de tocar la foto (LIQUID.range). Dentro, el
 * campo crece hacia el centro y allí la foto se completa (LIQUID.fill).
 * Posición, fuerza, radio y relleno van con muelles: inercia y un pelín de
 * rebote, sin easing con tiempo fijo.
 *
 * Todo es un único plano WebGL con un fragment shader: cada tira es un
 * rectángulo redondeado (SDF) que se une con las demás con un smooth-min; el
 * borde se deforma con ruido (fbm). La cortina de entrada/salida es la misma
 * CURTAIN del slider. Sin WebGL, la foto se pinta entera en un <img>; con
 * "reducir movimiento" las formas no se mueven solas.
 *
 * Datos (columnas, grosores, recorte, encuadre, desplazamientos):
 * projects.about.gridCut. La v2 (contact sheet) y la v1 siguen en
 * ProjectImageSliderThreeGrid (ABOUT_LAYOUT).
 */

/**
 * El líquido (px salvo que se diga):
 *  speed     velocidad del tiempo (respirar, ondular, fluir)
 *  edge      cuánto ondula el borde en reposo / extra cerca del cursor
 *  flow      cuánto se mueve la imagen dentro en reposo / cerca del cursor
 *  breathe   cuánto cambia el grosor de cada tira (fracción)
 *  drift     cuánto se desplaza cada tira a los lados (fracción de columna)
 *  wobble    irregularidad a lo largo de cada tira, viva: cuánto cambia el
 *            grosor con la altura (fracción), cuánto serpentea el eje (px) y
 *            lo apretadas que van las ondas (más = más cortas)
 *  bridge    suavidad máx. del cuello entre gotas junto al cursor (smooth-min)
 *  inset     margen de la forma entera respecto al lienzo (para que ondule dentro)
 *  radius    esquinas de la foto entera (las tiras separadas son cápsulas)
 *  refraction / blur / glow: junto al borde, cerca del cursor y al moverse
 *  push      abolladura máx. del borde al mover el ratón rápido, y su radio
 *  reach     sigma del campo del cursor (fracción de la diagonal) con el
 *            cursor en un borde / en el centro
 *  reachCurve  cómo crece el campo hacia el centro (más = crece más tarde)
 *  aspect    alto / ancho del campo (> 1 = sigue la tira en vertical)
 *  swell     ganancia del hinchado y tope (fracción de su columna; < 1 deja
 *            que el cuello entre gotas cierre el último hueco)
 *  lean      cuánto se inclina cada tira hacia el cursor (fracción de la
 *            distancia; < 1 = nunca lo cruza)
 *  carry     cuánto viaja la foto con la tira al inclinarse (0 = se queda)
 *  fill      centralidad (0 borde … 1 centro) donde la foto empieza a
 *            completarse / ya está entera: todo lo que quede dentro del
 *            segundo valor es zona "real" (0.4 ≈ el 60 % central de la foto)
 *  range     distancia (px) fuera de la foto a la que el cursor empieza a atraer
 *  spring    muelles [rigidez, amortiguación (< 1 = rebota un poco)] del
 *            radio del campo, de su fuerza y del relleno
 *  follow    lo rápido que el campo sigue al cursor (más = más pegado)
 */
const LIQUID = {
  speed: 0.45,
  edge: [9, 6],
  flow: [3, 7],
  breathe: 0.26,
  drift: 0.1,
  wobble: [0.38, 10, 0.006],
  bridge: 46,
  inset: 12,
  radius: 6,
  refraction: 9,
  blur: 1.5,
  glow: 0.16,
  push: [16, 80],
  reach: [0.15, 0.55],
  reachCurve: 1.6,
  aspect: 1.4,
  swell: [1.4, 0.82],
  lean: 0.5,
  carry: 0.35,
  fill: [0.12, 0.4],
  range: 160,
  spring: { radius: [12, 0.85], strength: [10, 0.75], fill: [7, 0.9] },
  follow: 5,
};
// Lo que el lienzo WebGL desborda la foto por cada lado: sitio para que las
// tiras se inclinen hacia un cursor que aún está fuera y para que el borde
// ondule sin cortarse.
const MARGIN = 48;
// Única excepción al tipo único: los servicios (~44 px a 1440).
const SERVICES_TYPE = 'clamp(1.75rem, 3.05vw, 3.5rem)';

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const fragment = (n) => /* glsl */ `
#define N ${n}
uniform sampler2D uTex;
uniform vec2 uTexSize;
uniform vec2 uRes;          // px CSS de la foto
uniform vec2 uCanvas;       // px CSS del lienzo (la foto + uMargin por cada lado)
uniform float uMargin;
uniform vec4 uCrop;         // zona útil de la foto en uv (x0, y0, x1, y1), y desde abajo
uniform float uFocus;       // -1 arriba … 0 centro … 1 abajo (encuadre vertical del cover)
uniform float uColW;
uniform float uGutter;
uniform float uRadius;      // sigma del campo del cursor (px, en horizontal)
uniform float uStr;         // fuerza del campo 0 → 1 (cerca / dentro de la foto)
uniform float uFill;        // 0 → 1: la foto se completa (cursor hacia el centro)
uniform vec4 uField;        // aspecto del campo, ganancia y tope del hinchado, inclinación
uniform float uCarry;       // cuánto viaja la foto con la tira inclinada
uniform vec3 uWobble;       // irregularidad a lo largo: grosor, eje (px), frecuencia
uniform float uAct;         // 0 → 1 según cuánto se mueve (radio o cursor)
uniform vec2 uMouse;        // px, y desde arriba
uniform float uPush;        // 0 → 1 según la velocidad del ratón
uniform float uTime;
uniform vec2 uEdge;         // ondulación del borde: reposo, extra en la fusión
uniform vec2 uFlow;         // flujo de la imagen: reposo, extra en la fusión
uniform vec4 uShape;        // breathe, drift, bridge, inset
uniform vec4 uFx;           // radius, refracción, blur, glow
uniform vec2 uPushK;        // abolladura máx., radio
uniform float uW[N];        // grosor de cada tira separada (fracción de la columna)
uniform float uTop[N];      // margen arriba de cada tira separada (px)
uniform float uBot[N];      // margen abajo de cada tira separada (px)
uniform float uOff[N];      // desplazamiento del contenido de cada tira (px)
uniform float uReveal[N];   // cortina de entrada: 0 → 1 (sube desde abajo)
uniform float uHide[N];     // cortina de salida: 0 → 1 (se va por arriba)
uniform float uZoom[N];
varying vec2 vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int o = 0; o < 3; o++) {
    v += a * noise(p);
    p = p * 2.03 + 11.7;
    a *= 0.5;
  }
  return v / 0.875;
}
float sdRoundBox(vec2 p, vec2 b, float r) {
  r = min(r, min(b.x, b.y));
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
float smin(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / max(k, 1e-4);
  return min(a, b) - h * h * k * 0.25;
}

vec4 sampleCover(vec2 q, float blurPx) {
  vec2 cropSize = uCrop.zw - uCrop.xy;
  float imgAspect = (cropSize.x * uTexSize.x) / (cropSize.y * uTexSize.y);
  float boxAspect = uRes.x / uRes.y;
  vec2 s = vec2(1.0);
  if (boxAspect > imgAspect) s.y = imgAspect / boxAspect; else s.x = boxAspect / imgAspect;
  vec2 uv = (q / uRes - 0.5) * s + 0.5;
  uv.y += uFocus * (1.0 - s.y) * 0.5;
  vec2 texel = s * cropSize / uRes; // uv de textura por px de lienzo
  if (blurPx < 0.05) {
    vec2 u = clamp(uv, 0.0, 1.0);
    return texture2D(uTex, vec2(uCrop.x + u.x * cropSize.x, uCrop.w - u.y * cropSize.y));
  }
  vec4 col = vec4(0.0);
  float total = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 o = vec2(float(x), float(y));
      float w = exp(-dot(o, o) * 0.5);
      vec2 u = clamp(uv + o * texel * blurPx, 0.0, 1.0);
      col += w * texture2D(uTex, vec2(uCrop.x + u.x * cropSize.x, uCrop.w - u.y * cropSize.y));
      total += w;
    }
  }
  return col / total;
}

void main() {
  // px en coordenadas de la foto (el lienzo la desborda uMargin por cada lado).
  vec2 px = vec2(vUv.x * uCanvas.x, (1.0 - vUv.y) * uCanvas.y) - uMargin;
  float stepW = uColW + uGutter;
  float t = uTime;

  // Campo del cursor: una gaussiana (más alta que ancha). Es la única fuente
  // del hinchado, la atracción y los efectos de borde.
  vec2 sig = max(vec2(uRadius, uRadius * uField.x), vec2(1.0));
  vec2 dq = (px - uMouse) / sig;
  float gp = uStr * exp(-0.5 * dot(dq, dq));
  float live = 1.0 - uFill;
  // Refracción, desenfoque y brillo: cerca del cursor, más al moverse; con la
  // foto entera desaparecen.
  float fx = gp * live * (0.35 + 0.65 * uAct);

  // Forma: unión suave de una caja redondeada por tira. Cada tira se hincha
  // hacia su columna y se inclina hacia el cursor según el campo a su altura;
  // el cuello entre vecinas se ablanda cerca del cursor. Con uFill = 1 cubren
  // columna y gutter y queda una sola forma con margen uShape.w.
  float inset = uShape.w;
  float k = max(1.0, uShape.z * gp * (1.0 - uFill * 0.85));
  float soft = max(k * 0.5, 8.0);
  float d = 1e5;
  float offSum = 0.0;
  float leanSum = 0.0;
  float wSum = 0.0;
  for (int i = 0; i < N; i++) {
    float fi = float(i);
    float c = fi * stepW + uColW * 0.5;
    float breathe = 1.0 + uShape.x * sin(t * (1.6 + 0.37 * fi) + fi * 2.1);
    float hw = uColW * 0.5 * uW[i] * breathe;
    float cx = c + sin(t * (0.9 + 0.23 * fi) + fi * 4.7) * uColW * uShape.y;
    // Irregular a lo largo: el grosor y el eje ondulan con la altura y se
    // mueven solos (unas zonas finas, otras gruesas). Se alisa al completarse.
    hw *= 1.0 + uWobble.x * live * 2.0 * (fbm(vec2(px.y * uWobble.z + fi * 13.1, t * 0.45 + fi * 3.0)) - 0.5);
    cx += uWobble.y * live * 2.0 * (fbm(vec2(px.y * uWobble.z * 0.7 + fi * 7.7 + 40.0, t * 0.35)) - 0.5);

    // El campo evaluado en el eje de la tira a esta altura: la sección entera
    // se mueve junta (sin bandas horizontales).
    vec2 dm = vec2(cx - uMouse.x, px.y - uMouse.y) / sig;
    float g = uStr * exp(-0.5 * dot(dm, dm));
    float sl = clamp(g * uField.y, 0.0, 1.0);
    sl = sl * sl * (3.0 - 2.0 * sl);
    float sw = max(sl * uField.z, uFill);
    float lean = (uMouse.x - cx) * uField.w * g * (1.0 - sw) * live;

    float colL = i == 0 ? inset : fi * stepW - uGutter * 0.5 - 12.0 * uFill;
    float colR = i == N - 1 ? uRes.x - inset : fi * stepW + uColW + uGutter * 0.5 + 12.0 * uFill;
    float l = mix(cx - hw, colL, sw) + lean;
    float r = mix(cx + hw, colR, sw) + lean;
    float top = mix(uTop[i], inset, uFill);
    float bot = mix(uRes.y - uBot[i], uRes.y - inset, uFill);
    vec2 hb = vec2((r - l) * 0.5, (bot - top) * 0.5);
    float rad = mix(hb.x, uFx.x, uFill); // cápsula → esquina casi recta
    float di = sdRoundBox(px - vec2((l + r) * 0.5, (top + bot) * 0.5), hb, rad);

    d = i == 0 ? di : smin(d, di, k);
    // El contenido sigue a la gota más cercana (mezcla suave entre vecinas).
    float w = exp(-clamp(di, -40.0, 200.0) / soft);
    offSum += w * uOff[i] * (1.0 - sw);
    leanSum += w * lean;
    wSum += w;
  }

  // Borde vivo: ruido que lo ondula (algo más cerca del cursor) y abolladura
  // cerca del cursor cuando el ratón se mueve rápido.
  d += (fbm(px * 0.0055 + vec2(0.0, t * 0.55)) - 0.5) * 2.0 * (uEdge.x * (1.0 - 0.75 * uFill) + uEdge.y * gp * live);
  vec2 dp = px - uMouse;
  d += uPush * uPushK.x * exp(-dot(dp, dp) / (2.0 * uPushK.y * uPushK.y));

  vec2 grad = vec2(dFdx(d), dFdy(d));
  float aa = max(fwidth(d), 0.5);
  float alpha = smoothstep(aa, -aa, d);

  // Cortina (por tira; en el gutter manda la tira más cercana).
  int kc = int(clamp(floor((px.x + uGutter * 0.5) / stepW), 0.0, float(N - 1)));
  float reveal = 0.0; float hide = 0.0; float zoom = 1.0;
  for (int i = 0; i < N; i++) {
    if (i == kc) { reveal = uReveal[i]; hide = uHide[i]; zoom = uZoom[i]; }
  }
  if (reveal < 0.999 && px.y < uRes.y * (1.0 - reveal)) discard;
  if (hide > 0.001 && px.y > uRes.y * (1.0 - hide)) discard;
  if (alpha <= 0.001) discard;

  // Contenido: desplazamiento de cada tira (se relaja al hincharse), viaja
  // con la inclinación, flujo líquido suave, refracción junto al borde y zoom
  // de la cortina.
  float off = offSum / max(wSum, 1e-4);
  float drag = leanSum / max(wSum, 1e-4) * uCarry;
  // Con la foto entera la imagen casi no se mueve: se ve "real".
  float flow = (uFlow.x + uPush * 8.0) * (1.0 - 0.85 * uFill) + uFlow.y * fx;
  vec2 fl = vec2(fbm(px * 0.004 + vec2(t * 0.3, 0.0)), fbm(px * 0.004 + vec2(7.3, -t * 0.3))) - 0.5;
  float edgeBand = exp(-(d * d) / (2.0 * 14.0 * 14.0));
  vec2 q = vec2(px.x - drag, px.y - off) + fl * 2.0 * flow - grad * edgeBand * uFx.y * fx;
  vec2 cc = uRes * 0.5;
  q = cc + (q - cc) / zoom;
  vec4 col = sampleCover(q, uFx.z * fx);

  // Brillo muy suave en el borde mientras se funde.
  col.rgb = mix(col.rgb, vec3(1.0), clamp(edgeBand * fx * uFx.w, 0.0, 1.0));

  gl_FragColor = vec4(col.rgb, alpha);
}
`;

export default function AboutGridCut({ project, shouldHide = false, onSceneReady, onTextReady }) {
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

  // ── WebGL: un plano que llena el lienzo; todo pasa en el shader.
  // Se monta cuando ya hay medidas (el contenedor no existe antes).
  const ready = !!box;
  useEffect(() => {
    const holder = holderRef.current;
    if (!holder || glRef.current) return undefined;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, premultipliedAlpha: false });
    } catch {
      setFallback(true);
      onSceneReady?.();
      reveal();
      return undefined;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    // El lienzo desborda la foto MARGIN px por cada lado.
    Object.assign(renderer.domElement.style, {
      display: 'block',
      position: 'absolute',
      left: `${-MARGIN}px`,
      top: `${-MARGIN}px`,
      pointerEvents: 'none',
    });
    holder.appendChild(renderer.domElement);

    const crop = gridCut.crop || [0, 0, 1, 1];
    const filled = (v) => Array.from({ length: columns }, () => v);
    const uniforms = {
      uTex: { value: null },
      uTexSize: { value: new THREE.Vector2(1, 1) },
      uRes: { value: new THREE.Vector2(1, 1) },
      uCanvas: { value: new THREE.Vector2(1, 1) },
      uMargin: { value: MARGIN },
      // projects.js da el recorte con y desde arriba; en la textura va desde abajo.
      uCrop: { value: new THREE.Vector4(crop[0], 1 - crop[3], crop[2], 1 - crop[1]) },
      uFocus: { value: gridCut.focus ?? -0.6 },
      uColW: { value: 1 },
      uGutter: { value: PAGE.gap },
      uRadius: { value: 0 },
      uAct: { value: 0 },
      uStr: { value: 0 },
      uFill: { value: 0 },
      uField: { value: new THREE.Vector4(LIQUID.aspect, LIQUID.swell[0], LIQUID.swell[1], Math.min(0.9, LIQUID.lean)) },
      uCarry: { value: LIQUID.carry },
      uWobble: { value: new THREE.Vector3(...LIQUID.wobble) },
      uMouse: { value: new THREE.Vector2(0, 0) },
      uTime: { value: 0 },
      uPush: { value: 0 },
      uEdge: { value: new THREE.Vector2(...LIQUID.edge) },
      uFlow: { value: new THREE.Vector2(...LIQUID.flow) },
      uShape: { value: new THREE.Vector4(LIQUID.breathe, LIQUID.drift, LIQUID.bridge, LIQUID.inset) },
      uFx: { value: new THREE.Vector4(LIQUID.radius, LIQUID.refraction, LIQUID.blur, LIQUID.glow) },
      uPushK: { value: new THREE.Vector2(...LIQUID.push) },
      uW: { value: filled(0.6).map((v, i) => gridCut.widths?.[i % gridCut.widths.length] ?? v) },
      uTop: { value: filled(0) },
      uBot: { value: filled(0) },
      uOff: { value: filled(0) },
      uReveal: { value: filled(0) },
      uHide: { value: filled(0) },
      uZoom: { value: filled(CURTAIN.zoomFrom) },
    };
    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: fragment(columns),
      uniforms,
      // Sin mezcla: el lienzo guarda el color y el alfa tal cual (contexto sin
      // alfa premultiplicado). Con la mezcla normal los bordes se oscurecían.
      blending: THREE.NoBlending,
    });
    const geometry = new THREE.PlaneGeometry(2, 2);
    const scene = new THREE.Scene();
    scene.add(new THREE.Mesh(geometry, material));
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // Estado que anima GSAP; el ticker lo copia a los uniforms. El líquido
    // está vivo siempre (se pinta cada frame); con "reducir movimiento" el
    // tiempo no avanza y solo se pinta cuando algo cambia.
    const strips = Array.from({ length: columns }, () => ({ reveal: 0, hide: 0, zoom: CURTAIN.zoomFrom }));
    // Campo del cursor: radio (fracción de la diagonal), fuerza y relleno, cada
    // uno con su muelle. `active` = cursor dentro (o un toque); `near` = 0 → 1
    // al acercarse desde fuera; `ready` = cuando ha terminado la cortina.
    const fuse = { r: LIQUID.reach[0], v: 0, s: 0, sv: 0, f: 0, fv: 0, active: false, near: 0, ready: false, act: 0 };
    const mouse = { x: 0, y: 0, tx: 0, ty: 0, push: 0, kick: 0 };
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let texture = null;
    let dirty = true;
    let last = performance.now();

    const tick = () => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const u = uniforms;
      if (!still) {
        u.uTime.value += dt * LIQUID.speed;
        dirty = true;
      }
      // El cursor (centro de la zona fundida y de la abolladura) con inercia.
      const follow = 1 - Math.exp(-dt * LIQUID.follow);
      const moved = Math.hypot(mouse.tx - mouse.x, mouse.ty - mouse.y) * follow;
      mouse.x += (mouse.tx - mouse.x) * follow;
      mouse.y += (mouse.ty - mouse.y) * follow;
      u.uMouse.value.set(mouse.x, mouse.y);

      // Centralidad del cursor: 0 en el borde … 1 en el centro de la foto. Con
      // forma de rectángulo redondeado (no de círculo), así la zona "real"
      // sigue la forma de la foto y es amplia.
      const res = u.uRes.value;
      const diag = Math.hypot(res.x, res.y) || 1;
      const cu = Math.abs(mouse.tx / (res.x || 1) - 0.5) * 2;
      const cv = Math.abs(mouse.ty / (res.y || 1) - 0.5) * 2;
      const c = fuse.active ? 1 - Math.min(1, Math.pow(cu ** 4 + cv ** 4, 0.25)) : 0;
      const smooth = (a, b, v) => {
        const x = Math.min(1, Math.max(0, (v - a) / (b - a)));
        return x * x * (3 - 2 * x);
      };
      const spring = (val, vel, target, [stiffness, damping]) => {
        const accel = (target - val) * stiffness - vel * 2 * Math.sqrt(stiffness) * damping;
        const v = vel + accel * dt;
        return [val + v * dt, v];
      };
      const on = fuse.ready && !hiddenRef.current;
      // Radio: pequeño en un borde (o fuera), grande en el centro.
      const eased = Math.pow(smooth(0, LIQUID.fill[1], c), LIQUID.reachCurve);
      const rTarget = LIQUID.reach[0] + (LIQUID.reach[1] - LIQUID.reach[0]) * eased;
      [fuse.r, fuse.v] = spring(fuse.r, fuse.v, rTarget, LIQUID.spring.radius);
      // Fuerza: empieza a `range` px de la foto y es 1 dentro.
      const sTarget = on ? Math.max(fuse.near, fuse.active ? 1 : 0) : 0;
      [fuse.s, fuse.sv] = spring(fuse.s, fuse.sv, sTarget, LIQUID.spring.strength);
      // Relleno: la foto se completa hacia el centro.
      const fTarget = on && fuse.active ? smooth(LIQUID.fill[0], LIQUID.fill[1], c) : 0;
      [fuse.f, fuse.fv] = spring(fuse.f, fuse.fv, fTarget, LIQUID.spring.fill);
      const str = still ? sTarget : Math.min(1.2, Math.max(0, fuse.s));
      const fill = still ? fTarget : Math.min(1, Math.max(0, fuse.f));

      // Actividad: cuánto se mueve el campo (radio o cursor), suavizada.
      const actTarget = str > 0.01 ? Math.min(1, Math.abs(fuse.v) * 4 + moved / Math.max(dt, 1e-3) / 900) : 0;
      fuse.act += (actTarget - fuse.act) * (1 - Math.exp(-dt * 4));
      const changed =
        Math.abs(u.uAct.value - fuse.act) > 1e-3 ||
        Math.abs(u.uStr.value - str) > 1e-4 ||
        Math.abs(u.uFill.value - fill) > 1e-4 ||
        Math.abs(u.uRadius.value - fuse.r * diag) > 0.05;
      if (changed) {
        u.uAct.value = still ? 0 : fuse.act;
        u.uStr.value = str;
        u.uFill.value = fill;
        u.uRadius.value = fuse.r * diag;
        dirty = true;
      }

      mouse.kick *= 0.86;
      mouse.push += (mouse.kick - mouse.push) * 0.18;
      if (Math.abs(u.uPush.value - mouse.push) > 1e-4) {
        u.uPush.value = still ? 0 : mouse.push;
        dirty = true;
      }
      strips.forEach((s, i) => {
        if (u.uReveal.value[i] !== s.reveal || u.uHide.value[i] !== s.hide || u.uZoom.value[i] !== s.zoom) {
          u.uReveal.value[i] = s.reveal;
          u.uHide.value[i] = s.hide;
          u.uZoom.value[i] = s.zoom;
          dirty = true;
        }
      });
      if (dirty && texture) {
        renderer.render(scene, camera);
        dirty = false;
      }
    };
    gsap.ticker.add(tick);

    const resize = (b) => {
      renderer.setSize(b.width + MARGIN * 2, b.height + MARGIN * 2);
      uniforms.uRes.value.set(b.width, b.height);
      uniforms.uCanvas.value.set(b.width + MARGIN * 2, b.height + MARGIN * 2);
      uniforms.uColW.value = b.colW;
      // Desplazamientos y márgenes pensados para una foto de 573 px de alto.
      const k = b.height / 573;
      const at = (list, i, fallbackValue) => (list?.length ? list[i % list.length] : fallbackValue) * k;
      uniforms.uOff.value = filled(0).map((_, i) => at(gridCut.offsets, i, 0));
      uniforms.uTop.value = filled(0).map((_, i) => at(gridCut.tops, i, 0));
      uniforms.uBot.value = filled(0).map((_, i) => at(gridCut.bottoms, i, 0));
      dirty = true;
    };

    let lastMove = null;
    const setOrigin = (x, y, jump) => {
      // Velocidad del ratón → abolladura del borde (0–1).
      const t = performance.now();
      if (lastMove && !jump) {
        const v = Math.hypot(x - lastMove.x, y - lastMove.y) / Math.max(1, t - lastMove.t);
        mouse.kick = Math.min(1, Math.max(mouse.kick, v / 2.2));
      }
      lastMove = { x, y, t };
      mouse.tx = x;
      mouse.ty = y;
      if (jump) {
        mouse.x = x;
        mouse.y = y;
        uniforms.uMouse.value.set(x, y);
      }
    };

    const setActive = (active) => {
      if (hiddenRef.current) return;
      fuse.active = active;
      wholeRef.current = active;
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

        // Cortina de entrada: igual que las hojas del slider, de izquierda a derecha.
        const delay = Math.max(0, CURTAIN.minDelay - (performance.now() - mountedAt) / 1000);
        gsap.to(strips, { reveal: 1, zoom: 1, delay, duration: CURTAIN.duration, ease: CURTAIN.ease, stagger: CURTAIN.stagger });
        gsap.delayedCall(delay + (columns - 1) * CURTAIN.stagger + CURTAIN.duration * CURTAIN.readyAt, () => {
          if (cancelled) return;
          fuse.ready = true;
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

    // El ratón se sigue en toda la ventana: las tiras se inclinan hacia él
    // antes de tocar la foto, y se completa al llegar al centro.
    const onWindowMove = (e) => {
      if (e.pointerType === 'touch') return;
      const r = holder.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      const inside = x >= 0 && y >= 0 && x <= r.width && y <= r.height;
      // Distancia a la foto (0 dentro) → cuánto atrae desde fuera.
      const out = Math.hypot(Math.max(0, -x, x - r.width), Math.max(0, -y, y - r.height));
      const n = Math.min(1, Math.max(0, 1 - out / LIQUID.range));
      fuse.near = n * n * (3 - 2 * n);
      // Si el campo estaba apagado, aparece ya en el cursor (sin viajar desde
      // donde se quedó).
      setOrigin(x, y, fuse.s < 0.02);
      if (inside !== fuse.active) setActive(inside);
    };
    const onWindowOut = (e) => {
      if (e.relatedTarget) return;
      fuse.near = 0;
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
            aria-label="Portrait of Kiko Climent, cut by the grid"
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
