'use client';

/**
 * Imagen del Index móvil (Index 2a) en WebGL, como una hoja de papel.
 * Ya no es un póster recortado: cada imagen va entera, con su proporción, y
 * colocada con las pautas del speed-slider de escritorio (lib/indexSpeed); la
 * hoja de papel es la imagen de arriba de la pila (las anteriores son DOM).
 *   - cut(): pone la hoja en un rect al instante (corte seco). El Index la usa
 *     para colocarla encima de una miniatura antes de que vuele (flyTo).
 *   - swap(): otro proyecto (swipe o nombre): el cambio de hoja del detalle de
 *     escritorio (SliderThree/index5.js → swapFocus): la que sale vuelve al
 *     fondo succionada y la nueva llega volando con el papel curvado.
 *   - flyTo(): al abrir el proyecto, la hoja vuela con el mismo papel hasta el
 *     hueco exacto que su imagen ocupa en el slider del proyecto y le pasa el
 *     relevo a esa hoja (lib/indexHandoff).
 * La deformación (precomputeCurve / updateCurve), los tiempos y la cortina del
 * shader son los de escritorio. El lienzo cubre toda la hoja del Index: el
 * papel no se corta al curvarse y el vuelo puede salir del marco.
 * Solo pinta mientras hay algo animándose (gsap.ticker); en reposo no gasta.
 * Versión anterior (póster recortado): IndexPosterPaperCrop.js.
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
const CURTAIN = { duration: 1.1, ease: 'expo.out', zoomFrom: 1.12, out: { duration: 0.6, ease: 'power3.in', zoomTo: 1.06 } };
const RECEDE = { z: -6, scale: 0.82, side: 0.8 };
const FLIGHT = { duration: 1.05, ease: 'power3.inOut', lift: 0.9, adjust: 0.3 };
const FLAT_EPSILON = 0.001;
// Placa base (la de la v1 móvil, 2.5 × 2): la curva está calibrada para ella;
// cada hoja se escala a su rect.
const BASE_W = 2.5;
const PLANE_H = 2;
const SEG_X = 28;
const SEG_Y = 22;
// 1 unidad de mundo = WORLD_PX px (a z = 0).
const WORLD_PX = 200;

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
 * onApi(api): recibe { show, cut, swap, hide, flyTo, preload }. Cada imagen es { url, rect }
 * (rect en px de viewport). onReady(): la primera imagen ya está en pantalla.
 */
export default function IndexPosterPaper({ onApi, onReady }) {
  const wrapRef = useRef(null);
  const cbRef = useRef({ onApi, onReady });
  useEffect(() => {
    cbRef.current = { onApi, onReady };
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
    const pxToWorld = 1 / WORLD_PX;
    const host = { left: 0, top: 0, width: 1, height: 1 };
    const depthK = (z) => camera.position.z / (camera.position.z - z);
    const place = (mesh, sx, sy, z) => {
      const k = depthK(z);
      mesh.position.set(sx / k, sy / k, z);
    };
    const toWorld = (rect) => ({
      x: (rect.left + rect.width / 2 - host.left - host.width / 2) * pxToWorld,
      y: (host.height / 2 - (rect.top + rect.height / 2 - host.top)) * pxToWorld,
      sx: (rect.width * pxToWorld) / BASE_W,
      sy: (rect.height * pxToWorld) / PLANE_H,
    });
    // La curva escala con la hoja (también en z): mismo papel en grande y en pequeño.
    const setSize = (mesh, sx, sy) => mesh.scale.set(sx, sy, Math.min(sx, sy));

    const base = new THREE.PlaneGeometry(BASE_W, PLANE_H, SEG_X, SEG_Y);
    const original = base.attributes.position.array.slice();
    const curve = precomputeCurve(original, BASE_W / 2, PLANE_H / 2);

    const layout = () => {
      const box = wrap.getBoundingClientRect();
      if (!box.width || !box.height) return false;
      Object.assign(host, { left: box.left, top: box.top, width: box.width, height: box.height });
      renderer.setSize(box.width, box.height, false);
      canvas.style.width = `${box.width}px`;
      canvas.style.height = `${box.height}px`;
      camera.aspect = box.width / box.height;
      camera.position.z = (box.height * pxToWorld) / (2 * Math.tan(deg(camera.fov) * 0.5));
      camera.updateProjectionMatrix();
      sheets.forEach((mesh) => {
        if (mesh.visible && mesh.userData.rect && !mesh.userData.moving) {
          const t = toWorld(mesh.userData.rect);
          mesh.position.set(t.x, t.y, 0);
          setSize(mesh, t.sx, t.sy);
        }
      });
      tick();
      return true;
    };

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
    const makeSheet = () => {
      const uniforms = {
        uClip: { value: new THREE.Vector2(0, -0.01) },
        uZoom: { value: 1 },
        uZoomOrigin: { value: new THREE.Vector2(0.5, 0) },
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
          .replace('#include <common>', '#include <common>\nuniform vec2 uClip;\nuniform float uZoom;\nuniform vec2 uZoomOrigin;')
          .replace(
            '#include <map_fragment>',
            `#ifdef USE_MAP
              if ( vMapUv.y < uClip.x || vMapUv.y > uClip.y ) discard;
              vec4 sampledDiffuseColor = texture2D( map, uZoomOrigin + ( vMapUv - uZoomOrigin ) / uZoom );
              diffuseColor *= sampledDiffuseColor;
            #endif`
          );
      };
      const mesh = new THREE.Mesh(base.clone(), material);
      mesh.visible = false;
      mesh.userData = { uniforms, isFlat: true, rect: null, moving: false, cloth: { paperLag: 0, bulgeLag: 0, vacuum: 0, vacuumLag: 0 } };
      scene.add(mesh);
      return mesh;
    };
    const sheets = [makeSheet(), makeSheet()];
    let current = sheets[0];
    let spare = sheets[1];

    const resetSheet = (mesh) => {
      gsap.killTweensOf(mesh.userData.uniforms.uClip.value);
      gsap.killTweensOf(mesh.userData.uniforms.uZoom);
      gsap.killTweensOf(mesh.userData.cloth);
      Object.assign(mesh.userData.cloth, { paperLag: 0, bulgeLag: 0, vacuum: 0, vacuumLag: 0 });
      mesh.rotation.set(0, 0, 0);
      mesh.geometry.attributes.position.array.set(original);
      mesh.geometry.attributes.position.needsUpdate = true;
      mesh.userData.isFlat = true;
      mesh.userData.moving = false;
    };

    // ── Texturas ──
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
    const prepare = async (mesh, image) => {
      const texture = await getTexture(image.url);
      if (disposed) return false;
      mesh.material.map = texture;
      mesh.material.needsUpdate = true;
      mesh.userData.rect = image.rect;
      return true;
    };
    const setAt = (mesh, rect) => {
      const t = toWorld(rect);
      mesh.position.set(t.x, t.y, 0);
      setSize(mesh, t.sx, t.sy);
    };

    // ── Cortina (entrada / salida) ──
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
    const curtainOut = (mesh, duration = CURTAIN.out.duration) => {
      const u = mesh.userData.uniforms;
      startRender();
      const tl = gsap.timeline({ onComplete: stopRender });
      tl.to(u.uClip.value, { x: 1, duration, ease: CURTAIN.out.ease }, 0);
      tl.to(u.uZoom, { value: CURTAIN.out.zoomTo, duration, ease: CURTAIN.out.ease }, 0);
      return tl;
    };

    // ── Cambio de proyecto: succión + vuelo de papel ──
    const sideX = () => (host.width * pxToWorld) * 0.45 * RECEDE.side;

    const playSuction = (mesh, step) => {
      const cloth = mesh.userData.cloth;
      const kTo = depthK(RECEDE.z);
      const from = { x: mesh.position.x, y: mesh.position.y, sx: mesh.scale.x, sy: mesh.scale.y };
      const pose = { t: 0, s: 1 };
      const sToX = (from.x / kTo - step * sideX()) * kTo;
      mesh.userData.moving = true;
      const apply = () => {
        const z = bezier2(0, RECEDE.z * 0.25, RECEDE.z, pose.t);
        place(mesh, bezier2(from.x, (from.x + sToX) * 0.5, sToX, pose.t), bezier2(from.y, from.y + 0.25, from.y, pose.t), z);
        setSize(mesh, from.sx * pose.s, from.sy * pose.s);
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
      tl.add(curtainOut(mesh, 0.55), 0.5);
    };

    const playPaperFlight = (mesh, step, onComplete) => {
      const cloth = mesh.userData.cloth;
      const u = mesh.userData.uniforms;
      const kFrom = depthK(RECEDE.z);
      const to = toWorld(mesh.userData.rect);
      const pose = { t: 0, s: RECEDE.scale, paper: 0.18, bulge: 0.12 };
      const sFromX = (to.x / kFrom + step * sideX()) * kFrom;
      cloth.paperLag = pose.paper;
      cloth.bulgeLag = pose.bulge * 0.35;
      mesh.userData.moving = true;
      const apply = () => {
        const z = bezier2(RECEDE.z, RECEDE.z + 1.35, 0, pose.t);
        place(mesh, bezier2(sFromX, (sFromX + to.x) * 0.5, to.x, pose.t), bezier2(to.y, to.y + 0.25, to.y, pose.t), z);
        setSize(mesh, to.sx * pose.s, to.sy * pose.s);
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
          Object.assign(cloth, { paperLag: 0, bulgeLag: 0 });
          updateCurve(mesh, curve, original, 0, 0, 1);
          mesh.userData.moving = false;
          setAt(mesh, mesh.userData.rect);
          stopRender();
          onComplete?.();
        },
      });
      tl.to(pose, { t: 1, s: 1, duration: SWAP.duration, ease: SWAP.ease, onUpdate: apply }, 0);
      tl.to(pose, { paper: 0, duration: 0.4, ease: 'power2.out' }, 0);
      tl.to(pose, { bulge: 1, duration: 0.4, ease: 'power2.out' }, 0);
      tl.to(pose, { bulge: 0, duration: 0.62, ease: 'power3.inOut' }, 0.48);
      tl.to(u.uClip.value, { y: 1, duration: 0.8, ease: CURTAIN.ease }, 0);
    };

    // ── Cola: una operación cada vez (la última pendiente gana) ──
    let busy = false;
    let pending = null;
    let flying = false;
    const runNext = () => {
      busy = false;
      if (!pending || disposed) return;
      const next = pending;
      pending = null;
      next();
    };
    const enqueue = (fn) => {
      if (flying) return;
      if (busy) {
        pending = fn;
        return;
      }
      busy = true;
      fn();
    };

    const show = (image) =>
      enqueue(async () => {
        const ok = await prepare(current, image);
        if (!ok) return runNext();
        setAt(current, image.rect);
        await renderer.compileAsync?.(scene, camera).catch(() => {});
        if (disposed) return;
        cbRef.current.onReady?.();
        curtainIn(current);
        runNext();
      });

    // Siguiente imagen del mismo proyecto: corte seco, misma hoja.
    const cut = (image) =>
      enqueue(async () => {
        const ok = await prepare(current, image);
        if (!ok) return runNext();
        resetSheet(current);
        current.userData.uniforms.uClip.value.set(0, 1);
        current.userData.uniforms.uZoom.value = 1;
        current.visible = true;
        setAt(current, image.rect);
        tick();
        // Ya está pintada encima del original (p. ej. la miniatura): quien llama puede esconderlo.
        image.onShown?.();
        runNext();
      });

    const swap = (image, step) =>
      enqueue(async () => {
        const incoming = spare;
        resetSheet(incoming);
        const ok = await prepare(incoming, image);
        if (!ok) return runNext();
        const outgoing = current;
        current = incoming;
        spare = outgoing;
        if (outgoing.visible) playSuction(outgoing, step);
        gsap.delayedCall(outgoing.visible ? SWAP.inDelay : 0, () => {
          if (disposed) return;
          playPaperFlight(incoming, step, runNext);
        });
      });

    const hide = () => {
      pending = null;
      sheets.forEach((mesh) => {
        if (mesh.visible) curtainOut(mesh);
      });
    };

    // ── Vuelo a la galería + relevo ──
    let cleanupFlight = () => {};
    const doFlight = (rect) => {
      flying = true;
      const mesh = current;
      if (spare.visible) curtainOut(spare, 0.35);
      const cloth = mesh.userData.cloth;
      const target = toWorld(rect);
      const from = { x: mesh.position.x, y: mesh.position.y, sx: mesh.scale.x, sy: mesh.scale.y };
      const dir = Math.sign(target.y - from.y) || 1;
      const pose = { t: 0, sx: from.sx, sy: from.sy, paper: 0.18, bulge: 0.12 };
      cloth.paperLag = pose.paper;
      cloth.bulgeLag = pose.bulge * 0.35;
      mesh.userData.moving = true;
      const apply = () => {
        const z = bezier2(0, FLIGHT.lift, 0, pose.t);
        place(
          mesh,
          bezier2(from.x, (from.x + target.x) * 0.5, target.x, pose.t),
          bezier2(from.y, Math.max(from.y, target.y) + 0.15, target.y, pose.t),
          z
        );
        setSize(mesh, pose.sx, pose.sy);
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
          // Dos frames: la hoja del slider ya está pintada cuando esta se va.
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              if (disposed) return;
              canvas.style.visibility = 'hidden';
              indexHandoff.complete();
            })
          );
        };
        const real = toWorld(gallery.rect);
        const off = Math.max(
          Math.abs(real.x - mesh.position.x),
          Math.abs(real.y - mesh.position.y),
          Math.abs(real.sx - mesh.scale.x) * BASE_W,
          Math.abs(real.sy - mesh.scale.y) * PLANE_H
        ) / pxToWorld;
        if (off < 1.5) {
          finish();
          return;
        }
        // El hueco real no coincide al píxel con el previsto: se ajusta en un momento.
        const adj = { x: mesh.position.x, y: mesh.position.y, sx: mesh.scale.x, sy: mesh.scale.y };
        startRender();
        gsap.to(adj, {
          x: real.x,
          y: real.y,
          sx: real.sx,
          sy: real.sy,
          duration: FLIGHT.adjust,
          ease: 'power2.out',
          onUpdate: () => {
            mesh.position.set(adj.x, adj.y, 0);
            setSize(mesh, adj.sx, adj.sy);
          },
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
          Object.assign(cloth, { paperLag: 0, bulgeLag: 0 });
          updateCurve(mesh, curve, original, 0, 0, 1);
          stopRender();
          landed = true;
          handOver();
        },
      });
      tl.to(pose, { t: 1, sx: target.sx, sy: target.sy, duration: FLIGHT.duration, ease: FLIGHT.ease, onUpdate: apply }, 0);
      tl.to(pose, { paper: 0, duration: 0.4, ease: 'power2.out' }, 0);
      tl.to(pose, { bulge: 1, duration: 0.4, ease: 'power2.out' }, 0);
      tl.to(pose, { bulge: 0, duration: 0.62, ease: 'power3.inOut' }, 0.48);
      cleanupFlight = () => {
        offGallery();
        tl.kill();
      };
    };
    // A mitad de un cambio de proyecto: el vuelo sale en cuanto la nueva se asienta.
    const flyTo = (rect) => {
      if (disposed || flying) return;
      if (busy) pending = () => doFlight(rect);
      else doFlight(rect);
    };

    const ro = new ResizeObserver(() => layout());
    ro.observe(wrap);
    layout();
    // Decodifica de antemano (las miniaturas visibles): el vuelo sale sin esperar a la red.
    const preload = (urls) => urls.forEach((url) => getTexture(url).catch(() => {}));
    cbRef.current.onApi?.({ show, cut, swap, hide, flyTo, preload });

    return () => {
      disposed = true;
      cbRef.current.onApi?.(null);
      cleanupFlight();
      ro.disconnect();
      gsap.ticker.remove(tick);
      sheets.forEach((mesh) => {
        gsap.killTweensOf(mesh.userData.cloth);
        mesh.geometry.dispose();
        mesh.material.dispose();
      });
      base.dispose();
      textures.forEach((p) => p.then((t) => t.dispose()).catch(() => {}));
      canvas.remove();
      destroyRenderer(renderer);
    };
  }, []);

  return <div ref={wrapRef} className="absolute inset-0" style={{ pointerEvents: 'none', zIndex: 2 }} aria-hidden="true" />;
}
