'use client';

/**
 * [Versión anterior: portada recortada a póster. Guardada por si se vuelve a ella.]
 * Póster del índice móvil (Index 2a) en WebGL: la portada del proyecto
 * seleccionado como una hoja de papel. Al pasar de proyecto (swipe lateral o
 * tocando un nombre del párrafo) repite el cambio de imagen del detalle de
 * escritorio (SliderThree/index5.js → swapFocus):
 *   - la hoja que sale vuelve al fondo succionada (vacuum: el centro se hunde
 *     primero y los bordes llegan tarde) y se tapa con la cortina;
 *   - la nueva llega volando desde el fondo con el papel curvado (paper +
 *     bulge) y se asienta plana.
 * La deformación (precomputeCurve / updateCurve), los tiempos (SWAP) y la
 * cortina del shader son los mismos que en escritorio; aquí el vuelo es
 * lateral en vez de vertical.
 * Al abrir el proyecto desde el póster (flight), la hoja vuela con el mismo
 * papel hasta el hueco exacto que su imagen ocupa en el slider del proyecto,
 * se desrecorta (de póster a la imagen entera) y le pasa el relevo a la hoja
 * del slider (lib/indexHandoff).
 * El lienzo cubre toda la hoja del Index (no solo el póster): así el papel no
 * se corta al curvarse y el vuelo puede salir del marco del póster.
 * Solo pinta mientras hay algo animándose (gsap.ticker), en reposo no gasta.
 */

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import { loadTextureSource } from '@/lib/media';
import { createTexture, destroyRenderer } from '@/lib/textures';
import { indexHandoff } from '@/lib/indexHandoff';

const deg = (d) => THREE.MathUtils.degToRad(d);

// Mismos valores que SliderThree/index5.js (settings).
const SETTINGS = {
  maxDistortion: 0.38,
  tiltStrength: 0.28,
  bendStrength: 1.15,
  grabStrength: 1.85,
  curlStrength: 0.55,
  leadStrength: 0.42,
  tuckStrength: 0.22,
  rightCornerRatio: 0.28,
  maxTiltAngle: deg(58),
  maxYawAngle: deg(14),
};
const SWAP = { inDelay: 0.1, duration: 1.05, ease: 'power3.inOut' };
const CURTAIN = {
  duration: 1.1,
  ease: 'expo.out',
  zoomFrom: 1.12,
  out: { duration: 0.6, ease: 'power3.in', zoomTo: 1.06 },
};
// Hasta dónde se va (y desde dónde llega) la hoja: al fondo y a un lado.
const RECEDE = { z: -6, scale: 0.82, side: 0.8 };
// Vuelo del póster a su hueco en la galería (mismos tiempos que el vuelo a detalle).
const FLIGHT = { duration: 1.05, ease: 'power3.inOut', lift: 0.9, adjust: 0.3 };
const FLAT_EPSILON = 0.001;
const SEG_X = 24;
const SEG_Y = 36;
const PLANE_H = 2;

const smoothstep = (t) => t * t * (3 - 2 * t);
const bezier2 = (a, b, c, t) => {
  const u = 1 - t;
  return u * u * a + 2 * u * t * b + t * t * c;
};

// ── Deformación del papel: copia de index5.js ───────────────────────────────
function precomputeCurve(positions, halfW, halfH) {
  const count = positions.length / 3;
  const curve = { count };
  ['x', 'y', 'grab', 'tilt', 'foldZ', 'lead', 'tuck', 'radiusT', 'vacuumX', 'vacuumY', 'vacuumZ', 'bulgeT', 'bulgeX', 'bulgeY', 'bulgeZ'].forEach(
    (name) => {
      curve[name] = new Float32Array(count);
    }
  );
  for (let i = 0; i < count; i++) {
    const x = positions[i * 3];
    const y = positions[i * 3 + 1];
    const nx = THREE.MathUtils.clamp(x / halfW, -1, 1);
    const ny = THREE.MathUtils.clamp(y / halfH, -1, 1);
    const leftAmount = (1 - nx) * 0.5;
    const topAmount = (1 + ny) * 0.5;
    const topLeft = Math.pow(leftAmount, 1.55) * Math.pow(topAmount, 0.9);
    const topRight = Math.pow(1 - leftAmount, 1.45) * Math.pow(topAmount, 1.15) * SETTINGS.rightCornerRatio;
    const cornerLift = Math.min(1, topLeft + topRight);
    const fromGrab = THREE.MathUtils.clamp(Math.hypot(nx + 1, ny - 1) / 2.828427, 0, 1);
    const radial = (nx * nx * (0.35 + 0.65 * leftAmount) + ny * ny) * 0.5;
    const foldShape = smoothstep(radial) * 2 - 1;

    curve.x[i] = x;
    curve.y[i] = y;
    curve.grab[i] = fromGrab * 0.82;
    curve.tilt[i] = -ny * SETTINGS.tiltStrength * (0.62 + 0.38 * leftAmount);
    curve.foldZ[i] =
      foldShape * SETTINGS.bendStrength + Math.pow(cornerLift, 1.25) * SETTINGS.grabStrength + Math.pow(topLeft, 2.35) * SETTINGS.curlStrength;
    curve.lead[i] = -topLeft * SETTINGS.leadStrength;
    curve.tuck[i] = topLeft * SETTINGS.tuckStrength;

    const radius = Math.min(1, Math.hypot(nx, ny));
    const cup = Math.pow(Math.max(0, 1 - radius), 1.08);
    curve.radiusT[i] = Math.pow(radius, 0.7);
    curve.vacuumX[i] = -x * cup * 0.24;
    curve.vacuumY[i] = -y * cup * 0.2;
    curve.vacuumZ[i] = -cup * 0.78 - Math.sin(radius * Math.PI) * 0.16 + Math.pow(radius, 2.1) * 0.1;

    const rFly = Math.hypot(nx, ny);
    const bowl = 0.5 + 0.5 * Math.cos((Math.min(rFly, 1.42) / 1.42) * Math.PI);
    curve.bulgeT[i] = THREE.MathUtils.clamp(rFly / 1.42, 0, 1);
    curve.bulgeX[i] = -x * (1 - bowl) * 0.03;
    curve.bulgeY[i] = -y * (1 - bowl) * 0.022;
    curve.bulgeZ[i] = bowl * 0.4 - (1 - bowl) * 0.34;
  }
  return curve;
}

function updateCurve(mesh, curve, original, paper, paperLag, dir, extras = {}) {
  const attr = mesh.geometry.attributes.position;
  const vacuum = Math.max(0, extras.vacuum || 0);
  const vacuumLag = Math.max(0, extras.vacuumLag ?? vacuum);
  const bulge = extras.bulge || 0;
  const bulgeLag = extras.bulgeLag ?? bulge;
  const hasFold = Math.abs(paper) >= FLAT_EPSILON || Math.abs(paperLag) >= FLAT_EPSILON;
  const hasVacuum = vacuum >= FLAT_EPSILON || vacuumLag >= FLAT_EPSILON;
  const hasBulge = Math.abs(bulge) >= FLAT_EPSILON || Math.abs(bulgeLag) >= FLAT_EPSILON;
  if (!hasFold && !hasVacuum && !hasBulge) {
    if (!mesh.userData.isFlat) {
      attr.array.set(original);
      attr.needsUpdate = true;
      mesh.userData.isFlat = true;
    }
    return;
  }
  mesh.userData.isFlat = false;
  const array = attr.array;
  for (let i = 0, j = 0; i < curve.count; i++, j += 3) {
    const grab = curve.grab[i];
    const intensity = SETTINGS.maxDistortion * ((1 - grab) * paper + grab * paperLag);
    const fold = intensity * dir;
    let x = curve.x[i] + fold * curve.tuck[i];
    let y = curve.y[i] + fold * curve.lead[i];
    let z = intensity * curve.tilt[i] + fold * curve.foldZ[i];
    if (hasVacuum) {
      const t = curve.radiusT[i];
      const v = (1 - t) * vacuum + t * vacuumLag;
      x += curve.vacuumX[i] * v;
      y += curve.vacuumY[i] * v;
      z += curve.vacuumZ[i] * v;
    }
    if (hasBulge) {
      const t = curve.bulgeT[i];
      const b = (1 - t) * bulge + t * bulgeLag;
      x += curve.bulgeX[i] * b;
      y += curve.bulgeY[i] * b;
      z += curve.bulgeZ[i] * b;
    }
    array[j] = x;
    array[j + 1] = y;
    array[j + 2] = z;
  }
  attr.needsUpdate = true;
}

/**
 * covers: [{ id, url, focusX?, focusY? }] en el orden del índice. index: el seleccionado.
 * step: +1 / -1, el sentido del último cambio (de dónde llega la hoja nueva).
 * frameRef: el marco del póster (dentro de la hoja); el lienzo ocupa la hoja entera.
 * closing: true → la hoja sale con la cortina (al cerrar el índice).
 * flight: { rect } → vuela a ese rect (px de viewport) y hace el relevo.
 */
export default function IndexPosterPaper({ covers, index, step = 1, frameRef, closing = false, flight = null, onReady }) {
  const wrapRef = useRef(null);
  const apiRef = useRef(null);
  const propsRef = useRef({ covers, index, onReady });
  useEffect(() => {
    propsRef.current = { covers, index, onReady };
  });

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return undefined;
    let disposed = false;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const canvas = renderer.domElement;
    canvas.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;';
    wrap.appendChild(canvas);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    // home: centro del póster en mundo (z = 0); pxToWorld: 1 px en mundo.
    const view = {
      planeW: 1,
      pxToWorld: 1,
      home: { x: 0, y: 0 },
      host: { left: 0, top: 0, width: 1, height: 1 },
      depthK: (z) => camera.position.z / (camera.position.z - z),
    };
    // Posición en "pantalla" (mundo a z = 0) reproyectada a la profundidad z.
    const place = (mesh, sx, sy, z) => {
      const k = view.depthK(z);
      mesh.position.set(sx / k, sy / k, z);
    };
    let curve = null;
    let original = null;

    // ── Render solo mientras algo se mueve ──
    let running = 0;
    const tick = () => renderer.render(scene, camera);
    const startRender = () => {
      if (running++ === 0) gsap.ticker.add(tick);
    };
    const stopRender = () => {
      running = Math.max(0, running - 1);
      if (running === 0) {
        gsap.ticker.remove(tick);
        tick();
      }
    };

    // ── Hojas ──
    const makeMaterial = () => {
      const uniforms = {
        uClip: { value: new THREE.Vector2(0, -0.01) },
        uZoom: { value: 1 },
        uZoomOrigin: { value: new THREE.Vector2(0.5, 0) },
        uCoverScale: { value: new THREE.Vector2(1, 1) },
        uCoverOffset: { value: new THREE.Vector2(0, 0) },
      };
      const material = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide,
        transparent: true,
        alphaTest: 0.01,
        depthTest: true,
        depthWrite: true,
      });
      material.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms);
        shader.fragmentShader = shader.fragmentShader
          .replace(
            '#include <common>',
            '#include <common>\nuniform vec2 uClip;\nuniform float uZoom;\nuniform vec2 uZoomOrigin;\nuniform vec2 uCoverScale;\nuniform vec2 uCoverOffset;'
          )
          .replace(
            '#include <map_fragment>',
            `#ifdef USE_MAP
              if ( vMapUv.y < uClip.x || vMapUv.y > uClip.y ) discard;
              vec2 zoomed = uZoomOrigin + ( vMapUv - uZoomOrigin ) / uZoom;
              vec4 sampledDiffuseColor = texture2D( map, uCoverOffset + zoomed * uCoverScale );
              diffuseColor *= sampledDiffuseColor;
            #endif`
          );
      };
      return { material, uniforms };
    };

    const makeSheet = () => {
      const { material, uniforms } = makeMaterial();
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, PLANE_H, SEG_X, SEG_Y), material);
      mesh.visible = false;
      mesh.userData = { uniforms, isFlat: true, cloth: { paper: 0, paperLag: 0, bulge: 0, bulgeLag: 0, vacuum: 0, vacuumLag: 0 } };
      scene.add(mesh);
      return mesh;
    };
    const sheets = [makeSheet(), makeSheet()];
    let current = sheets[0];
    let spare = sheets[1];

    const resetSheet = (mesh) => {
      gsap.killTweensOf(mesh.position);
      gsap.killTweensOf(mesh.scale);
      gsap.killTweensOf(mesh.userData.uniforms.uClip.value);
      gsap.killTweensOf(mesh.userData.uniforms.uZoom);
      Object.assign(mesh.userData.cloth, { paper: 0, paperLag: 0, bulge: 0, bulgeLag: 0, vacuum: 0, vacuumLag: 0 });
      mesh.position.set(view.home.x, view.home.y, 0);
      mesh.scale.set(1, 1, 1);
      mesh.rotation.set(0, 0, 0);
      if (original) {
        mesh.geometry.attributes.position.array.set(original);
        mesh.geometry.attributes.position.needsUpdate = true;
      }
      mesh.userData.isFlat = true;
    };

    // Encaje "cover" de la textura en la hoja. El punto de interés de cada
    // portada (focusX / focusY, 0–1 desde la izquierda / desde arriba) decide
    // qué parte se queda al recortar; por defecto, centro y un poco arriba.
    const fitCover = (mesh) => {
      const tex = mesh.material.map;
      if (!tex?.image) return;
      const { focusX = 0.5, focusY = 0.2 } = mesh.userData.focus || {};
      const imgAspect = tex.image.width / tex.image.height;
      const planeAspect = view.planeW / PLANE_H;
      const u = mesh.userData.uniforms;
      if (imgAspect > planeAspect) {
        const sx = planeAspect / imgAspect;
        u.uCoverScale.value.set(sx, 1);
        u.uCoverOffset.value.set((1 - sx) * focusX, 0);
      } else {
        const sy = imgAspect / planeAspect;
        u.uCoverScale.value.set(1, sy);
        // En UV la y crece hacia arriba: focusY 0 = borde superior de la imagen.
        u.uCoverOffset.value.set(0, (1 - sy) * (1 - focusY));
      }
    };

    // Rect en px de viewport → centro y tamaño en mundo (a z = 0).
    const toWorld = (rect) => {
      const cx = rect.left + rect.width / 2 - view.host.left;
      const cy = rect.top + rect.height / 2 - view.host.top;
      return {
        center: { x: (cx - view.host.width / 2) * view.pxToWorld, y: (view.host.height / 2 - cy) * view.pxToWorld },
        w: rect.width * view.pxToWorld,
        h: rect.height * view.pxToWorld,
      };
    };

    // ── Medidas: 1 unidad de mundo = alto del póster / 2 ──
    // El lienzo cubre la hoja entera; el póster es el marco (frameRef) dentro de ella.
    const layout = () => {
      const frame = frameRef?.current;
      const hostBox = wrap.getBoundingClientRect();
      const frameBox = frame?.getBoundingClientRect();
      const cw = hostBox.width;
      const ch = hostBox.height;
      const w = frameBox?.width ?? 0;
      const h = frameBox?.height ?? 0;
      if (!cw || !ch || !w || !h) return false;
      renderer.setSize(cw, ch, false);
      canvas.style.width = `${cw}px`;
      canvas.style.height = `${ch}px`;
      const pxToWorld = PLANE_H / h;
      view.pxToWorld = pxToWorld;
      view.host = { left: hostBox.left, top: hostBox.top, width: cw, height: ch };
      camera.aspect = cw / ch;
      camera.position.z = (ch * pxToWorld) / (2 * Math.tan(deg(camera.fov) * 0.5));
      camera.updateProjectionMatrix();
      view.planeW = w * pxToWorld;
      view.home = toWorld({ left: frameBox.left, top: frameBox.top, width: w, height: h }).center;
      const base = new THREE.PlaneGeometry(view.planeW, PLANE_H, SEG_X, SEG_Y);
      original = base.attributes.position.array.slice();
      curve = precomputeCurve(original, view.planeW / 2, PLANE_H / 2);
      sheets.forEach((mesh) => {
        mesh.geometry.dispose();
        mesh.geometry = base.clone();
        mesh.userData.isFlat = true;
        if (!mesh.userData.flying && !mesh.userData.landed) mesh.position.set(view.home.x, view.home.y, 0);
        fitCover(mesh);
      });
      base.dispose();
      tick();
      return true;
    };

    // ── Texturas (una por portada, cacheadas) ──
    const textures = new Map();
    const getTexture = (url) => {
      if (!textures.has(url)) {
        textures.set(
          url,
          loadTextureSource(url).then((source) => {
            const texture = createTexture(source);
            renderer.initTexture(texture);
            return texture;
          })
        );
      }
      return textures.get(url);
    };
    const setCover = async (mesh, i) => {
      const cover = propsRef.current.covers[i];
      if (!cover) return false;
      const texture = await getTexture(cover.url);
      if (disposed) return false;
      mesh.material.map = texture;
      mesh.material.needsUpdate = true;
      mesh.userData.focus = { focusX: cover.focusX, focusY: cover.focusY };
      fitCover(mesh);
      return true;
    };

    // ── Entrada / salida con la cortina (igual que la galería) ──
    const curtainIn = (mesh) => {
      const u = mesh.userData.uniforms;
      u.uClip.value.set(0, -0.01);
      u.uZoom.value = CURTAIN.zoomFrom;
      mesh.visible = true;
      startRender();
      const tl = gsap.timeline({ onComplete: stopRender });
      tl.to(u.uClip.value, { y: 1, duration: CURTAIN.duration, ease: CURTAIN.ease }, 0);
      tl.to(u.uZoom, { value: 1, duration: CURTAIN.duration, ease: CURTAIN.ease }, 0);
      return tl;
    };
    const curtainOut = (mesh, at = 0, duration = CURTAIN.out.duration) => {
      const u = mesh.userData.uniforms;
      startRender();
      const tl = gsap.timeline({ delay: at, onComplete: stopRender });
      tl.to(u.uClip.value, { x: 1, duration, ease: CURTAIN.out.ease }, 0);
      tl.to(u.uZoom, { value: CURTAIN.out.zoomTo, duration, ease: CURTAIN.out.ease }, 0);
      return tl;
    };

    // ── Cambio de portada: succión de la que sale + vuelo de papel de la nueva ──
    const sideX = () => view.planeW * RECEDE.side;

    const playSuction = (mesh, step) => {
      const cloth = mesh.userData.cloth;
      const kTo = view.depthK(RECEDE.z);
      const pose = { t: 0, s: 1 };
      const { x: hx, y: hy } = view.home;
      const sFromX = hx;
      const sToX = (hx / kTo - step * sideX()) * kTo;
      const sCtrlX = (sFromX + sToX) * 0.5;
      const sCtrlY = hy + 0.25;
      const apply = () => {
        const z = bezier2(0, RECEDE.z * 0.25, RECEDE.z, pose.t);
        place(mesh, bezier2(sFromX, sCtrlX, sToX, pose.t), bezier2(hy, sCtrlY, hy, pose.t), z);
        mesh.scale.set(pose.s, pose.s, 1);
        const toward = cloth.vacuum < cloth.vacuumLag ? 0.16 : 0.055;
        cloth.vacuumLag += (cloth.vacuum - cloth.vacuumLag) * toward;
        updateCurve(mesh, curve, original, 0, 0, 1, { vacuum: cloth.vacuum, vacuumLag: cloth.vacuumLag });
      };
      startRender();
      const tl = gsap.timeline({
        onComplete: () => {
          mesh.visible = false;
          resetSheet(mesh);
          stopRender();
        },
      });
      tl.to(pose, { t: 1, s: RECEDE.scale, duration: SWAP.duration, ease: SWAP.ease, onUpdate: apply }, 0);
      tl.to(cloth, { vacuum: 1.18, duration: 0.42, ease: 'power2.out' }, 0);
      tl.to(cloth, { vacuum: 0, duration: 0.58, ease: 'power3.inOut' }, 0.42);
      // Aquí no hay minimapa al fondo: se tapa con la cortina mientras se aleja.
      tl.add(curtainOut(mesh, 0, 0.55), 0.5);
      return tl;
    };

    const playPaperFlight = (mesh, step, onComplete) => {
      const cloth = mesh.userData.cloth;
      const u = mesh.userData.uniforms;
      const kFrom = view.depthK(RECEDE.z);
      const pose = { t: 0, s: RECEDE.scale, paper: 0.18, bulge: 0.12 };
      const { x: hx, y: hy } = view.home;
      const sFromX = (hx / kFrom + step * sideX()) * kFrom;
      const sToX = hx;
      const sCtrlX = (sFromX + sToX) * 0.5;
      const sCtrlY = hy + 0.25;
      cloth.paperLag = pose.paper;
      cloth.bulgeLag = pose.bulge * 0.35;
      const apply = () => {
        const z = bezier2(RECEDE.z, RECEDE.z + 1.35, 0, pose.t);
        place(mesh, bezier2(sFromX, sCtrlX, sToX, pose.t), bezier2(hy, sCtrlY, hy, pose.t), z);
        mesh.scale.set(pose.s, pose.s, 1);
        const twist = pose.paper * step;
        mesh.rotation.x = SETTINGS.maxTiltAngle * 0.08 * twist;
        mesh.rotation.y = SETTINGS.maxYawAngle * 0.12 * twist;
        cloth.paperLag += (pose.paper - cloth.paperLag) * 0.16;
        cloth.bulgeLag += (pose.bulge - cloth.bulgeLag) * 0.08;
        updateCurve(mesh, curve, original, pose.paper, cloth.paperLag, step, { bulge: pose.bulge, bulgeLag: cloth.bulgeLag });
      };
      u.uClip.value.set(0, -0.01);
      u.uZoom.value = 1;
      mesh.visible = true;
      apply();
      startRender();
      const tl = gsap.timeline({
        onComplete: () => {
          mesh.rotation.set(0, 0, 0);
          Object.assign(cloth, { paper: 0, paperLag: 0, bulge: 0, bulgeLag: 0 });
          updateCurve(mesh, curve, original, 0, 0, 1);
          stopRender();
          onComplete?.();
        },
      });
      tl.to(pose, { t: 1, s: 1, duration: SWAP.duration, ease: SWAP.ease, onUpdate: apply }, 0);
      tl.to(pose, { paper: 0, duration: 0.4, ease: 'power2.out' }, 0);
      tl.to(pose, { bulge: 1, duration: 0.4, ease: 'power2.out' }, 0);
      tl.to(pose, { bulge: 0, duration: 0.62, ease: 'power3.inOut' }, 0.48);
      // Sale del fondo destapándose de abajo arriba (la cortina de la galería).
      tl.to(u.uClip.value, { y: 1, duration: 0.8, ease: CURTAIN.ease }, 0);
      return tl;
    };

    let shownIndex = -1;
    let busy = false;
    let pending = null;
    let pendingFlight = null;

    const goTo = async (i, step) => {
      // Antes de la primera portada no hay nada que cambiar: show() ya lee el índice actual.
      if (disposed || shownIndex === -1 || i === shownIndex) return;
      if (busy) {
        pending = { i, step };
        return;
      }
      busy = true;
      const incoming = spare;
      resetSheet(incoming);
      const ok = await setCover(incoming, i);
      if (!ok || disposed) {
        busy = false;
        return;
      }
      const outgoing = current;
      current = incoming;
      spare = outgoing;
      shownIndex = i;
      if (outgoing.visible) playSuction(outgoing, step);
      gsap.delayedCall(outgoing.visible ? SWAP.inDelay : 0, () => {
        if (disposed) return;
        playPaperFlight(incoming, step, () => {
          busy = false;
          if (pendingFlight) {
            const rect = pendingFlight;
            pendingFlight = null;
            flyTo(rect);
            return;
          }
          if (pending) {
            const next = pending;
            pending = null;
            goTo(next.i, next.step);
          }
        });
      });
    };

    const show = async () => {
      const i = propsRef.current.index;
      const ok = await setCover(current, i);
      if (!ok || disposed) return;
      shownIndex = i;
      // Compila el shader antes de enseñar nada (sin tirón en el primer frame).
      await renderer.compileAsync?.(scene, camera).catch(() => {});
      if (disposed) return;
      propsRef.current.onReady?.();
      curtainIn(current);
      // Precarga del resto de portadas en reposo.
      propsRef.current.covers.forEach((cover) => getTexture(cover.url).catch(() => {}));
    };

    const hide = () => {
      pending = null;
      sheets.forEach((mesh) => {
        if (mesh.visible) curtainOut(mesh);
      });
    };

    // ── Vuelo a la galería + relevo ──
    let flying = false;
    const flyTo = (rect) => {
      if (disposed || flying) return;
      // A mitad de un cambio de portada: el vuelo sale en cuanto la nueva se asienta.
      if (busy) {
        pendingFlight = rect;
        return;
      }
      flying = true;
      pending = null;
      const mesh = current;
      // La otra hoja (si estaba en un cambio) se va con la cortina.
      if (spare.visible) curtainOut(spare, 0, 0.35);
      const cloth = mesh.userData.cloth;
      const u = mesh.userData.uniforms;
      const target = toWorld(rect);
      const from = { x: mesh.position.x, y: mesh.position.y };
      const dir = Math.sign(target.center.y - from.y) || 1;
      const pose = {
        t: 0,
        sx: mesh.scale.x,
        sy: mesh.scale.y,
        paper: 0.18,
        bulge: 0.12,
        csx: u.uCoverScale.value.x,
        csy: u.uCoverScale.value.y,
        cox: u.uCoverOffset.value.x,
        coy: u.uCoverOffset.value.y,
      };
      const toSx = target.w / view.planeW;
      const toSy = target.h / PLANE_H;
      cloth.paperLag = pose.paper;
      cloth.bulgeLag = pose.bulge * 0.35;
      mesh.userData.flying = true;
      const apply = () => {
        const z = bezier2(0, FLIGHT.lift, 0, pose.t);
        place(
          mesh,
          bezier2(from.x, (from.x + target.center.x) * 0.5, target.center.x, pose.t),
          bezier2(from.y, Math.max(from.y, target.center.y) + 0.15, target.center.y, pose.t),
          z
        );
        mesh.scale.set(pose.sx, pose.sy, 1);
        // De póster recortado a la imagen entera, a la vez que cambia de forma.
        u.uCoverScale.value.set(pose.csx, pose.csy);
        u.uCoverOffset.value.set(pose.cox, pose.coy);
        const twist = pose.paper * dir;
        mesh.rotation.x = SETTINGS.maxTiltAngle * 0.08 * twist;
        mesh.rotation.y = SETTINGS.maxYawAngle * 0.12 * twist;
        cloth.paperLag += (pose.paper - cloth.paperLag) * 0.16;
        cloth.bulgeLag += (pose.bulge - cloth.bulgeLag) * 0.08;
        updateCurve(mesh, curve, original, pose.paper, cloth.paperLag, dir, { bulge: pose.bulge, bulgeLag: cloth.bulgeLag });
      };
      let landed = false;
      let gallery = null;
      const handOver = () => {
        if (!landed || !gallery || disposed) return;
        const finish = () => {
          gallery.reveal?.();
          // Dos frames: la hoja del slider ya está pintada cuando el póster se va.
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              if (disposed) return;
              canvas.style.visibility = 'hidden';
              indexHandoff.complete();
            })
          );
        };
        // Si el hueco real no coincide al píxel con el previsto, se ajusta en un momento.
        const real = toWorld(gallery.rect);
        const dx = Math.abs(real.center.x - mesh.position.x) / view.pxToWorld;
        const dy = Math.abs(real.center.y - mesh.position.y) / view.pxToWorld;
        const dw = Math.abs(real.w / view.planeW - mesh.scale.x) * view.planeW / view.pxToWorld;
        const dh = Math.abs(real.h / PLANE_H - mesh.scale.y) * PLANE_H / view.pxToWorld;
        if (Math.max(dx, dy, dw, dh) < 1.5) {
          finish();
          return;
        }
        startRender();
        gsap.to(mesh.position, { x: real.center.x, y: real.center.y, duration: FLIGHT.adjust, ease: 'power2.out' });
        gsap.to(mesh.scale, {
          x: real.w / view.planeW,
          y: real.h / PLANE_H,
          duration: FLIGHT.adjust,
          ease: 'power2.out',
          onComplete: () => {
            stopRender();
            finish();
          },
        });
      };
      const offGallery = indexHandoff.whenGallery((g) => {
        gallery = g;
        handOver();
      });
      startRender();
      const tl = gsap.timeline({
        onComplete: () => {
          mesh.rotation.set(0, 0, 0);
          Object.assign(cloth, { paper: 0, paperLag: 0, bulge: 0, bulgeLag: 0 });
          updateCurve(mesh, curve, original, 0, 0, 1);
          mesh.userData.flying = false;
          mesh.userData.landed = true;
          stopRender();
          landed = true;
          handOver();
        },
      });
      tl.to(pose, { t: 1, sx: toSx, sy: toSy, csx: 1, csy: 1, cox: 0, coy: 0, duration: FLIGHT.duration, ease: FLIGHT.ease, onUpdate: apply }, 0);
      tl.to(pose, { paper: 0, duration: 0.4, ease: 'power2.out' }, 0);
      tl.to(pose, { bulge: 1, duration: 0.4, ease: 'power2.out' }, 0);
      tl.to(pose, { bulge: 0, duration: 0.62, ease: 'power3.inOut' }, 0.48);
      cleanupFlight = () => {
        offGallery();
        tl.kill();
      };
    };
    let cleanupFlight = () => {};

    apiRef.current = { goTo, hide, flyTo };

    const ro = new ResizeObserver(() => layout());
    ro.observe(wrap);
    if (layout()) show();
    else requestAnimationFrame(() => layout() && show());

    return () => {
      disposed = true;
      apiRef.current = null;
      cleanupFlight();
      ro.disconnect();
      gsap.ticker.remove(tick);
      sheets.forEach((mesh) => {
        gsap.killTweensOf(mesh.userData.cloth);
        mesh.geometry.dispose();
        mesh.material.dispose();
      });
      textures.forEach((p) => p.then((t) => t.dispose()).catch(() => {}));
      canvas.remove();
      destroyRenderer(renderer);
    };
    // Una sola vez: índice y cierre llegan por los efectos de abajo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    apiRef.current?.goTo(index, step);
  }, [index, step]);

  // Al cerrar sin relevo, cortina; con vuelo en marcha, el vuelo manda.
  useEffect(() => {
    if (closing && !flight) apiRef.current?.hide();
  }, [closing, flight]);

  useEffect(() => {
    if (flight?.rect) apiRef.current?.flyTo(flight.rect);
  }, [flight]);

  return <div ref={wrapRef} className="absolute inset-0" style={{ pointerEvents: 'none', zIndex: 2 }} aria-hidden="true" />;
}
