'use client';

/**
 * Slider WebGL móvil v2 — misma "hoja de papel" que SliderThree3Mobile (vértices
 * deformados en cada frame: bend, curl, tilt, yaw) y misma cortina en el shader
 * (uClip / uZoom), pero colocado sobre la rejilla de 4 columnas (lib/mobileGrid):
 *   - apaisadas a 4 columnas; verticales a 2, alternando columnas 3–4 / 1–2
 *   - la hoja activa se asienta en el ancla (bajo el navbar) y hace snap al parar;
 *     la anterior queda encima, pasando por debajo del navbar en difference
 *   - 24 px entre hojas + caption con el nombre de archivo (10 px) bajo cada una
 *   - emite el progreso continuo (contador rodante) y el proyecto activo (Home)
 *     por lib/sliderBus, sin re-renders de React
 *   - reduce-motion o un móvil que no llega a ~45 fps: sin deformación, mismo layout
 * Texturas: variante "sm" del manifest (640 px de lado mayor), como la v1.
 * Versión anterior: SliderThree3Mobile.js (no se toca).
 */

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import { loadTextureSource, mediaAspect, mediaColor, mediaKey, mediaSrc } from '@/lib/media';
import { createTexture, destroyRenderer } from '@/lib/textures';
import { gridFileName } from '@/components/data/grid';
import { MOBILE_GRID, colLeftPx, colsWidthPx } from '@/lib/mobileGrid';
import { sliderBus } from '@/lib/sliderBus';
import { useDarkMode } from '@/contexts/DarkModeContext';

const getPerfProfile = (variant, imageCount) => {
    const mash = variant === 'mash' || imageCount > 18;
    return {
        mash,
        segmentsX: mash ? 20 : 28,
        segmentsY: mash ? 10 : 16,
        pixelRatio: mash ? 1.25 : 1.5,
        antialias: false,
        loopCopies: mash ? 1 : 2,
    };
};

const TEXTURE_SIZE = 'sm';
const SETTLE_EPSILON = 1e-4;

const CURTAIN = {
    duration: 1.1,
    ease: 'expo.out',
    zoomFrom: 1.12,
    stagger: 0.12,
    mashDelay: 0.2,
    detailDelay: 0.12,
    readyAt: 0.6,
};

// Snap: asentar la hoja más cercana en el ancla al soltar. Desactivado: el papel
// termina su inercia donde caiga (como la v1) y es el contador el que se asienta
// en el número más cercano (RollingCounter). Para probarlo de nuevo: true.
const SNAP_TO_SLIDE = false;
const SNAP_IDLE_MS = 140;
// Cortina de salida (al abrir un proyecto desde la Home y al volver del detalle):
// la misma cortina del shader, ahora cerrándose de abajo arriba, hoja a hoja.
const CURTAIN_OUT = { duration: 0.45, ease: 'power3.in', stagger: 0.04 };

// Primeros segundos en movimiento: si la media de frame supera esto, se apaga la deformación.
const SLOW_FRAME_MS = 22;

const resolveMediaKey = (img, project) => img.key ?? mediaKey(project, img.id);
// "johnny/johnny3" → { projectId: 'johnny', id: 3 } (en el manifest, carpeta = id del proyecto)
const parseKey = (key) => {
    const [folder, file] = key.split('/');
    const id = parseInt(file.replace(/^\D+/, ''), 10);
    return { projectId: folder, id: Number.isFinite(id) ? id : 1 };
};

export default function SliderThree4Mobile({
    images,
    project,
    navbarHeight = 0,
    anchorPx,
    variant = 'detail',
    onImagesReady,
    hiding = false,
    onHidden,
}) {
    const { isDarkMode } = useDarkMode();
    const containerRef = useRef(null);
    const cleanupRef = useRef(null);
    const onImagesReadyRef = useRef(onImagesReady);
    useEffect(() => {
        onImagesReadyRef.current = onImagesReady;
    }, [onImagesReady]);
    const inkRef = useRef(isDarkMode ? 0xffffff : 0x000000);
    const exitRef = useRef(null);
    const hidingRef = useRef(hiding);
    const onHiddenRef = useRef(onHidden);
    useEffect(() => {
        onHiddenRef.current = onHidden;
    }, [onHidden]);

    // Salida con cortina: el padre la pide con hiding; si llega antes de que la
    // escena exista, se lanza en cuanto se monte.
    useEffect(() => {
        hidingRef.current = hiding;
        if (hiding) exitRef.current?.();
    }, [hiding]);
    const recolorRef = useRef(null);

    // Caption en blanco/negro según el modo, sin relanzar la escena.
    useEffect(() => {
        inkRef.current = isDarkMode ? 0xffffff : 0x000000;
        recolorRef.current?.();
    }, [isDarkMode]);

    useEffect(() => {
        if (!containerRef.current || !images.length) return undefined;

        const initThree = () => {
            if (!containerRef.current) return;

            let width = containerRef.current.clientWidth;
            let height = containerRef.current.clientHeight;
            if (width === 0 || height === 0) {
                setTimeout(initThree, 50);
                return;
            }

            const perf = getPerfProfile(variant, images.length);
            const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            let animationId = null;
            let disposed = false;
            const slides = [];
            const textureCache = new Map();
            const textureWaiters = new Map();

            let renderUntil = performance.now() + 1000;
            const keepRendering = (ms = 250) => {
                renderUntil = Math.max(renderUntil, performance.now() + ms);
            };

            const renderer = new THREE.WebGLRenderer({
                alpha: true,
                antialias: perf.antialias,
                preserveDrawingBuffer: false,
                powerPreference: 'high-performance',
                stencil: false,
                depth: true,
            });
            const pixelRatio = Math.min(window.devicePixelRatio || 1, perf.pixelRatio);
            renderer.setSize(width, height);
            renderer.setPixelRatio(pixelRatio);
            containerRef.current.appendChild(renderer.domElement);

            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
            camera.position.z = 7;

            // Mismos valores que la v1: el papel se comporta igual.
            const settings = {
                wheelSensitivity: 0.01,
                momentumMultiplier: 2,
                smoothing: 0.1,
                slideLerp: 0.075,
                distortionDecay: 0.95,
                maxDistortion: reduceMotion ? 0 : 0.38,
                distortionSensitivity: 0.1,
                distortionSmoothing: 0.06,
                tiltStrength: 0.28,
                bendStrength: 1.15,
                grabStrength: 1.85,
                curlStrength: 0.55,
                leadStrength: 0.42,
                tuckStrength: 0.22,
                rightCornerRatio: 0.28,
                lagLerp: 0.038,
                maxTiltAngle: reduceMotion ? 0 : THREE.MathUtils.degToRad(58),
                maxYawAngle: reduceMotion ? 0 : THREE.MathUtils.degToRad(14),
                tiltLerp: 0.12,
            };

            // Geometría base de la v1 (2.5 × 2.0): las curvas están calibradas para
            // ella. Cada hoja se escala a su tamaño en la rejilla.
            const slideWidth = 2.5;
            const slideHeight = 2.0;
            const slideHalfHeight = slideHeight / 2;
            const slideHalfWidth = slideWidth / 2;
            const slideCount = images.length * perf.loopCopies;

            // ── Rejilla: px → mundo ───────────────────────────────────────────
            let worldH = 1;
            let worldPerPx = 1;
            let anchorWorldY = 0;
            let totalLength = 1;
            let touchSensitivity = 0.01;
            const anchorFor = () => (anchorPx ?? (navbarHeight > 0 ? navbarHeight + MOBILE_GRID.rowGap : MOBILE_GRID.fallbackAnchor));

            const computeLayout = () => {
                worldH = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
                worldPerPx = worldH / height;
                anchorWorldY = worldH / 2 - anchorFor() * worldPerPx;
                // El dedo arrastra el papel 1:1 con un pequeño extra, como un scroll nativo.
                touchSensitivity = worldPerPx * 1.15;

                let portraitCount = 0;
                let offset = 0;
                slides.forEach((slide) => {
                    const d = slide.userData;
                    const portrait = d.aspect < 1;
                    const span = portrait ? 2 : 4;
                    const startCol = portrait ? (portraitCount % 2 === 0 ? 3 : 1) : 1;
                    if (portrait) portraitCount += 1;
                    const wPx = colsWidthPx(span, width);
                    const hPx = wPx / d.aspect;
                    const leftPx = colLeftPx(startCol, width);
                    d.w = wPx * worldPerPx;
                    d.h = hPx * worldPerPx;
                    d.x = (leftPx + wPx / 2 - width / 2) * worldPerPx;
                    d.offset = offset;
                    d.slot = (hPx + MOBILE_GRID.captionGap + MOBILE_GRID.captionLine + MOBILE_GRID.rowGap) * worldPerPx;
                    offset += d.slot;

                    slide.position.x = d.x;
                    d.mesh.scale.set(d.w / slideWidth, d.h / slideHeight, 1);
                    layoutCaption(slide);
                });
                totalLength = Math.max(offset, worldH + 1);
            };

            let currentPosition = 0;
            let targetPosition = 0;
            let isScrolling = false;
            let isTouching = false;
            let autoScrollSpeed = 0;
            let lastTime = 0;
            let lastInputAt = 0;
            let snapped = true;
            let touchStartY = 0;
            let touchLastY = 0;
            let isTabHidden = false;
            let exiting = false;
            let exitTimeline = null;

            let currentDistortionFactor = 0;
            let targetDistortionFactor = 0;
            let currentLagFactor = 0;
            let peakVelocity = 0;
            const velocityHistory = [0, 0, 0, 0, 0];
            let currentFoldDirection = 1;

            // Medición de rendimiento: solo mientras se mueve, los primeros segundos.
            let perfSamples = 0;
            let perfTotal = 0;
            let perfChecked = reduceMotion;

            const smoothstep = (t) => t * t * (3 - 2 * t);

            const precomputeCurve = (geometry) => {
                const count = geometry.attributes.position.count;
                const curve = {
                    x: new Float32Array(count),
                    y: new Float32Array(count),
                    ny: new Float32Array(count),
                    topLeft: new Float32Array(count),
                    liftShape: new Float32Array(count),
                    curlShape: new Float32Array(count),
                    fromGrab: new Float32Array(count),
                    foldShape: new Float32Array(count),
                    tiltBias: new Float32Array(count),
                };
                for (let i = 0; i < count; i++) {
                    const x = geometry.attributes.position.getX(i);
                    const y = geometry.attributes.position.getY(i);
                    const nx = THREE.MathUtils.clamp(x / slideHalfWidth, -1, 1);
                    const ny = THREE.MathUtils.clamp(y / slideHalfHeight, -1, 1);
                    const leftAmount = (1 - nx) * 0.5;
                    const topAmount = (1 + ny) * 0.5;
                    const topLeft = Math.pow(leftAmount, 1.55) * Math.pow(topAmount, 0.9);
                    const topRight =
                        Math.pow(1 - leftAmount, 1.45) * Math.pow(topAmount, 1.15) * settings.rightCornerRatio;
                    const cornerLift = Math.min(1, topLeft + topRight);
                    const radial = (nx * nx * (0.35 + 0.65 * leftAmount) + ny * ny) * 0.5;

                    curve.x[i] = x;
                    curve.y[i] = y;
                    curve.ny[i] = ny;
                    curve.topLeft[i] = topLeft;
                    curve.liftShape[i] = Math.pow(cornerLift, 1.25);
                    curve.curlShape[i] = Math.pow(topLeft, 2.35);
                    curve.fromGrab[i] = THREE.MathUtils.clamp(Math.hypot(nx + 1, ny - 1) / 2.828427, 0, 1);
                    curve.foldShape[i] = smoothstep(radial) * 2 - 1;
                    curve.tiltBias[i] = 0.62 + 0.38 * leftAmount;
                }
                return curve;
            };

            // ── Caption (nombre de archivo) ───────────────────────────────────
            // Plano aparte, hijo del grupo de la hoja: gira con ella pero no se
            // estira con su escala. Texto blanco en la textura; el color lo pone el material.
            const fontFamily = getComputedStyle(document.body).fontFamily || 'sans-serif';
            const captionScale = Math.min(window.devicePixelRatio || 1, 2) * 2;
            const makeCaption = (text) => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const fontPx = MOBILE_GRID.captionSize * captionScale;
                ctx.font = `${fontPx}px ${fontFamily}`;
                const textW = Math.ceil(ctx.measureText(text).width) + 2;
                const lineH = Math.ceil(MOBILE_GRID.captionLine * captionScale);
                canvas.width = textW;
                canvas.height = lineH;
                ctx.font = `${fontPx}px ${fontFamily}`;
                ctx.fillStyle = '#ffffff';
                ctx.textBaseline = 'middle';
                ctx.fillText(text, 0, lineH / 2);
                const texture = new THREE.CanvasTexture(canvas);
                texture.colorSpace = THREE.SRGBColorSpace;
                texture.minFilter = THREE.LinearFilter;
                texture.generateMipmaps = false;
                const material = new THREE.MeshBasicMaterial({
                    map: texture,
                    color: inkRef.current,
                    transparent: true,
                    depthWrite: false,
                });
                const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
                mesh.userData.pxW = textW / captionScale;
                mesh.userData.pxH = lineH / captionScale;
                mesh.visible = false;
                return mesh;
            };

            const layoutCaption = (slide) => {
                const d = slide.userData;
                const cap = d.caption;
                const capW = cap.userData.pxW * worldPerPx;
                const capH = cap.userData.pxH * worldPerPx;
                cap.scale.set(capW, capH, 1);
                cap.position.set(-d.w / 2 + capW / 2, -d.h / 2 - MOBILE_GRID.captionGap * worldPerPx - capH / 2, 0);
            };

            recolorRef.current = () => {
                slides.forEach((slide) => slide.userData.caption.material.color.set(inkRef.current));
                keepRendering();
            };

            // ── Texturas ──────────────────────────────────────────────────────
            let onSlideTexture = () => {};

            const applyTextureToSlide = (slide, texture) => {
                const mesh = slide.userData.mesh;
                mesh.material.map = texture;
                mesh.material.color.set(0xffffff);
                mesh.material.needsUpdate = true;
                slide.userData.textureReady = true;
                keepRendering();
                onSlideTexture(slide);
            };

            const requestTexture = (slide) => {
                const url = slide.userData.textureUrl;
                const cached = textureCache.get(url);
                if (cached) {
                    applyTextureToSlide(slide, cached);
                    return;
                }
                if (textureWaiters.has(url)) {
                    textureWaiters.get(url).push(slide);
                    return;
                }
                textureWaiters.set(url, [slide]);
                loadTextureSource(url)
                    .then((source) => {
                        if (disposed) return;
                        const texture = createTexture(source);
                        texture.anisotropy = 1;
                        texture.generateMipmaps = false;
                        texture.minFilter = THREE.LinearFilter;
                        texture.magFilter = THREE.LinearFilter;
                        textureCache.set(url, texture);
                        const waiters = textureWaiters.get(url) || [];
                        textureWaiters.delete(url);
                        waiters.forEach((waiting) => applyTextureToSlide(waiting, texture));
                    })
                    .catch((err) => {
                        textureWaiters.delete(url);
                        console.warn(`Couldn't load image ${url}`, err);
                    });
            };

            const createSlide = (index) => {
                const img = images[index % images.length];
                const key = resolveMediaKey(img, project);
                const parsed = img.key ? parseKey(img.key) : { projectId: project.id, id: img.id };
                const geometry = new THREE.PlaneGeometry(slideWidth, slideHeight, perf.segmentsX, perf.segmentsY);
                const curtain = {
                    uClip: { value: new THREE.Vector2(0, -0.01) },
                    uZoom: { value: CURTAIN.zoomFrom },
                    uZoomOrigin: { value: new THREE.Vector2(0.5, 0) },
                };
                const material = new THREE.MeshBasicMaterial({
                    color: new THREE.Color(mediaColor(key)),
                    side: THREE.DoubleSide,
                    alphaTest: 0.01,
                });
                material.customProgramCacheKey = () => 'mobile-curtain';
                material.onBeforeCompile = (shader) => {
                    Object.assign(shader.uniforms, curtain);
                    shader.fragmentShader = shader.fragmentShader
                        .replace(
                            '#include <common>',
                            '#include <common>\nuniform vec2 uClip;\nuniform float uZoom;\nuniform vec2 uZoomOrigin;'
                        )
                        .replace(
                            '#include <map_fragment>',
                            `#ifdef USE_MAP
                                if ( vMapUv.y < uClip.x || vMapUv.y > uClip.y ) discard;
                                vec4 sampledDiffuseColor = texture2D( map, uZoomOrigin + ( vMapUv - uZoomOrigin ) / uZoom );
                                diffuseColor *= sampledDiffuseColor;
                            #endif`
                        );
                };

                const mesh = new THREE.Mesh(geometry, material);
                const caption = makeCaption(gridFileName(parsed.projectId, parsed.id));
                const group = new THREE.Group();
                group.add(mesh);
                group.add(caption);

                group.userData = {
                    mesh,
                    caption,
                    originalVertices: geometry.attributes.position.array.slice(),
                    curve: precomputeCurve(geometry),
                    index,
                    imageIndex: index % images.length,
                    projectId: parsed.projectId,
                    aspect: 1 / mediaAspect(key),
                    currentTilt: 0,
                    currentYaw: 0,
                    isFlat: true,
                    textureRequested: false,
                    textureReady: false,
                    textureUrl: mediaSrc(key, TEXTURE_SIZE),
                    intro: false,
                    reveal: false,
                    curtain,
                    currentY: 0,
                    targetY: 0,
                };
                scene.add(group);
                slides.push(group);
            };

            for (let i = 0; i < slideCount; i++) createSlide(i);
            computeLayout();

            // Distancia (en mundo) de la parte de arriba de la hoja al ancla, envuelta
            // alrededor del ancla: negativa = encima (la anterior), positiva = debajo.
            const wrappedRel = (slide, position) => {
                let rel = slide.userData.offset - position;
                rel = ((rel % totalLength) + totalLength) % totalLength;
                if (rel > totalLength / 2) rel -= totalLength;
                return rel;
            };
            const centerYFor = (slide, position) => anchorWorldY - wrappedRel(slide, position) - slide.userData.h / 2;
            const isInView = (slide, cy) => {
                const half = slide.userData.h / 2 + slide.userData.slot * 0.1;
                return cy - half < worldH / 2 + 0.2 && cy + half > -worldH / 2 - 0.2;
            };

            slides.forEach((slide) => {
                const cy = centerYFor(slide, 0);
                slide.position.y = cy;
                slide.userData.targetY = cy;
                slide.userData.currentY = cy;
            });

            // Cortina de entrada: solo las hojas visibles al montar, de arriba abajo.
            const introSlides = slides
                .filter((slide) => isInView(slide, slide.userData.currentY))
                .sort((a, b) => b.userData.currentY - a.userData.currentY);

            slides.forEach((slide) => {
                if (!introSlides.includes(slide)) {
                    slide.userData.curtain.uClip.value.set(0, 1);
                    slide.userData.curtain.uZoom.value = 1;
                }
            });
            introSlides.forEach((slide) => {
                slide.userData.intro = true;
            });

            let curtainTimeline = null;
            let curtainPlayed = false;
            let introReady = 0;

            const playCurtain = () => {
                const delay = variant === 'mash' ? CURTAIN.mashDelay : CURTAIN.detailDelay;
                curtainTimeline = gsap.timeline({
                    delay: reduceMotion ? 0 : delay,
                    onUpdate: () => keepRendering(120),
                });
                introSlides.forEach((slide, i) => {
                    if (!slide.userData.textureReady) return;
                    slide.userData.reveal = true;
                    const curtain = slide.userData.curtain;
                    curtain.uZoomOrigin.value.set(0.5, 0);
                    if (reduceMotion) {
                        curtain.uClip.value.set(0, 1);
                        curtain.uZoom.value = 1;
                        return;
                    }
                    const at = i * CURTAIN.stagger;
                    curtainTimeline.to(curtain.uClip.value, { y: 1, duration: CURTAIN.duration, ease: CURTAIN.ease }, at);
                    curtainTimeline.to(curtain.uZoom, { value: 1, duration: CURTAIN.duration, ease: CURTAIN.ease }, at);
                });
                const readyCount = introSlides.filter((slide) => slide.userData.textureReady).length;
                const lastAt = Math.max(0, readyCount - 1) * CURTAIN.stagger;
                curtainTimeline.call(
                    () => onImagesReadyRef.current?.(),
                    null,
                    reduceMotion ? 0 : lastAt + CURTAIN.duration * CURTAIN.readyAt
                );
                const span = delay + Math.max(0, introSlides.length - 1) * CURTAIN.stagger + CURTAIN.duration + 0.3;
                keepRendering(span * 1000);
            };

            const startReveal = () => {
                if (curtainPlayed || disposed) return;
                curtainPlayed = true;
                clearTimeout(curtainFailSafe);
                introSlides.forEach((slide) => {
                    if (!slide.userData.textureReady) return;
                    slide.userData.reveal = true;
                    slide.visible = true;
                });
                keepRendering(400);
                const begin = () => {
                    if (!disposed) playCurtain();
                };
                renderer.compileAsync(scene, camera).then(begin, begin);
            };

            const curtainFailSafe = setTimeout(startReveal, 2500);

            onSlideTexture = (slide) => {
                if (!slide.userData.intro || slide.userData.introCounted) return;
                slide.userData.introCounted = true;
                introReady += 1;
                if (!curtainPlayed && introReady >= introSlides.length) startReveal();
                else if (curtainPlayed) {
                    const ref = introSlides.find((s) => s.userData.reveal)?.userData.curtain;
                    if (ref) {
                        slide.userData.curtain.uClip.value.copy(ref.uClip.value);
                        slide.userData.curtain.uZoom.value = ref.uZoom.value;
                    } else {
                        slide.userData.curtain.uClip.value.set(0, 1);
                        slide.userData.curtain.uZoom.value = 1;
                    }
                    slide.userData.reveal = true;
                    keepRendering();
                }
            };

            introSlides.forEach((slide) => {
                slide.userData.textureRequested = true;
                requestTexture(slide);
            });

            const updateCurve = (slide, distortionFactor, lagFactor, foldDirection) => {
                const mesh = slide.userData.mesh;
                const positionAttribute = mesh.geometry.attributes.position;
                const curve = slide.userData.curve;
                const count = positionAttribute.count;

                if (distortionFactor < 0.001 && lagFactor < 0.001) {
                    if (!slide.userData.isFlat) {
                        positionAttribute.array.set(slide.userData.originalVertices);
                        positionAttribute.needsUpdate = true;
                        slide.userData.isFlat = true;
                    }
                    return;
                }
                slide.userData.isFlat = false;

                for (let i = 0; i < count; i++) {
                    const fromGrab = curve.fromGrab[i];
                    const localDistortion = distortionFactor + (lagFactor - distortionFactor) * (fromGrab * 0.82);
                    const intensity = settings.maxDistortion * localDistortion;
                    const tiltZ = -curve.ny[i] * settings.tiltStrength * intensity * curve.tiltBias[i];
                    const foldZ = curve.foldShape[i] * settings.bendStrength * intensity * foldDirection;
                    const liftZ = curve.liftShape[i] * settings.grabStrength * intensity * foldDirection;
                    const curlZ = curve.curlShape[i] * settings.curlStrength * intensity * foldDirection;
                    const leadY = -foldDirection * curve.topLeft[i] * settings.leadStrength * intensity;
                    const tuckX = foldDirection * curve.topLeft[i] * settings.tuckStrength * intensity;
                    positionAttribute.setX(i, curve.x[i] + tuckX);
                    positionAttribute.setY(i, curve.y[i] + leadY);
                    positionAttribute.setZ(i, tiltZ + foldZ + liftZ + curlZ);
                }
                positionAttribute.needsUpdate = true;
            };

            // ── Entrada: rueda y dedo. Avanzar = el papel sube (como un scroll nativo). ──
            const markInput = () => {
                lastInputAt = performance.now();
                snapped = false;
                keepRendering();
            };

            let wheelTimer = null;
            const handleWheel = (e) => {
                e.preventDefault();
                if (exiting) return;
                markInput();
                targetDistortionFactor = Math.min(1.0, targetDistortionFactor + Math.abs(e.deltaY) * 0.001);
                targetPosition += e.deltaY * settings.wheelSensitivity;
                isScrolling = true;
                autoScrollSpeed = Math.min(Math.abs(e.deltaY) * 0.0005, 0.05) * Math.sign(e.deltaY);
                clearTimeout(wheelTimer);
                wheelTimer = setTimeout(() => {
                    isScrolling = false;
                }, 150);
            };

            const handleTouchStart = (e) => {
                touchStartY = e.touches[0].clientY;
                touchLastY = touchStartY;
                isScrolling = false;
                isTouching = true;
                autoScrollSpeed = 0;
                markInput();
            };

            const handleTouchMove = (e) => {
                e.preventDefault();
                if (exiting) return;
                markInput();
                const touchY = e.touches[0].clientY;
                const deltaY = touchY - touchLastY;
                touchLastY = touchY;
                targetDistortionFactor = Math.min(1.0, targetDistortionFactor + Math.abs(deltaY) * 0.02);
                // Dedo hacia arriba (deltaY < 0) → avanza → el papel sube con el dedo.
                targetPosition -= deltaY * touchSensitivity;
                isScrolling = true;
            };

            let momentumTimer = null;
            const handleTouchEnd = () => {
                isTouching = false;
                markInput();
                const velocity = (touchLastY - touchStartY) * 0.005;
                if (Math.abs(velocity) > 0.5) {
                    autoScrollSpeed = -velocity * settings.momentumMultiplier * 0.05;
                    targetDistortionFactor = Math.min(1.0, Math.abs(velocity) * 3 * settings.distortionSensitivity);
                    isScrolling = true;
                    clearTimeout(momentumTimer);
                    momentumTimer = setTimeout(() => {
                        isScrolling = false;
                    }, 800);
                } else {
                    isScrolling = false;
                }
            };

            // Hoja más cercana al ancla (en la posición dada, con el bucle).
            const nearestOffset = (position) => {
                const local = ((position % totalLength) + totalLength) % totalLength;
                let best = 0;
                let bestDist = Infinity;
                for (let i = 0; i < slides.length; i++) {
                    const o = slides[i].userData.offset;
                    const dist = Math.abs(o - local);
                    if (dist < bestDist) {
                        bestDist = dist;
                        best = o;
                    }
                }
                if (Math.abs(totalLength - local) < bestDist) best = totalLength;
                return position - local + best;
            };

            // Progreso continuo: k + fracción entre la hoja k (en el ancla) y la k+1.
            let lastProgress = -1;
            let lastActive = null;
            const emitProgress = () => {
                const local = ((currentPosition % totalLength) + totalLength) % totalLength;
                let k = slides.length - 1;
                for (let i = 0; i < slides.length; i++) {
                    if (slides[i].userData.offset > local) {
                        k = Math.max(0, i - 1);
                        break;
                    }
                }
                const d = slides[k].userData;
                const frac = THREE.MathUtils.clamp((local - d.offset) / d.slot, 0, 1);
                const value = (d.imageIndex + frac) % images.length;
                if (Math.abs(value - lastProgress) > 1e-4) {
                    lastProgress = value;
                    sliderBus.emit('progress', { value, count: images.length });
                }
                const nearest = frac < 0.5 ? slides[k] : slides[(k + 1) % slides.length];
                if (nearest.userData.projectId !== lastActive) {
                    lastActive = nearest.userData.projectId;
                    sliderBus.emit('active', { projectId: lastActive });
                }
            };

            const handleResize = () => {
                if (!containerRef.current) return;
                const w = containerRef.current.clientWidth;
                const h = containerRef.current.clientHeight;
                if (w === 0 || h === 0) return;
                width = w;
                height = h;
                camera.aspect = w / h;
                camera.updateProjectionMatrix();
                renderer.setSize(w, h);
                computeLayout();
                if (SNAP_TO_SLIDE) targetPosition = nearestOffset(targetPosition);
                keepRendering(600);
            };

            exitRef.current = () => {
                if (exiting || disposed) return;
                exiting = true;
                if (curtainTimeline) curtainTimeline.kill();
                isScrolling = false;
                autoScrollSpeed = 0;
                targetPosition = currentPosition;
                const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
                const visible = slides
                    .filter((slide) => slide.visible && slide.userData.textureReady)
                    .sort((a, b) => b.userData.currentY - a.userData.currentY);
                exitTimeline = gsap.timeline({
                    onUpdate: () => keepRendering(120),
                    onComplete: () => onHiddenRef.current?.(),
                });
                visible.forEach((slide, i) => {
                    const clip = slide.userData.curtain.uClip.value;
                    if (reduce) {
                        clip.x = 1.01;
                        return;
                    }
                    exitTimeline.to(clip, { x: 1.01, duration: CURTAIN_OUT.duration, ease: CURTAIN_OUT.ease }, i * CURTAIN_OUT.stagger);
                });
                keepRendering((CURTAIN_OUT.duration + visible.length * CURTAIN_OUT.stagger) * 1000 + 300);
            };

            const animate = (time) => {
                if (isTabHidden) {
                    animationId = null;
                    return;
                }
                animationId = requestAnimationFrame(animate);

                const deltaMs = lastTime ? time - lastTime : 16;
                const deltaTime = deltaMs / 1000;
                lastTime = time;
                const prevPos = currentPosition;

                if (isScrolling) {
                    targetPosition += autoScrollSpeed;
                    const speedBasedDecay = 0.97 - Math.abs(autoScrollSpeed) * 0.5;
                    autoScrollSpeed *= Math.max(0.92, speedBasedDecay);
                    if (Math.abs(autoScrollSpeed) < 0.001) autoScrollSpeed = 0;
                }

                // Snap: quieto el gesto, la hoja más cercana se asienta en el ancla.
                if (
                    SNAP_TO_SLIDE &&
                    !snapped &&
                    !isTouching &&
                    !isScrolling &&
                    autoScrollSpeed === 0 &&
                    performance.now() - lastInputAt > SNAP_IDLE_MS
                ) {
                    targetPosition = nearestOffset(targetPosition);
                    snapped = true;
                }

                currentPosition += (targetPosition - currentPosition) * settings.smoothing;

                const currentVelocity = Math.abs(currentPosition - prevPos) / Math.max(deltaTime, 0.001);
                const scrollDelta = currentPosition - prevPos;
                // Avanzar sube el papel en pantalla: el pliegue va en el sentido del
                // movimiento en pantalla, igual que en la v1.
                const screenDirection = -Math.sign(scrollDelta);
                velocityHistory.push(currentVelocity);
                velocityHistory.shift();
                if (Math.abs(scrollDelta) > 0.0003) {
                    currentFoldDirection += (screenDirection - currentFoldDirection) * 0.15;
                }

                const avgVelocity = velocityHistory.reduce((sum, val) => sum + val, 0) / velocityHistory.length;
                if (avgVelocity > peakVelocity) peakVelocity = avgVelocity;
                const velocityRatio = avgVelocity / (peakVelocity + 0.001);
                const isDecelerating = velocityRatio < 0.7 && peakVelocity > 0.5;
                peakVelocity *= 0.99;

                const movementDistortion = Math.min(1.0, currentVelocity * 0.1);
                if (currentVelocity > 0.05) targetDistortionFactor = Math.max(targetDistortionFactor, movementDistortion);
                if (isDecelerating || avgVelocity < 0.2) {
                    const decayRate = isDecelerating ? settings.distortionDecay : settings.distortionDecay * 0.9;
                    targetDistortionFactor *= decayRate;
                }

                currentDistortionFactor += (targetDistortionFactor - currentDistortionFactor) * settings.distortionSmoothing;
                currentLagFactor += (currentDistortionFactor - currentLagFactor) * settings.lagLerp;
                const targetTilt = settings.maxTiltAngle * currentDistortionFactor * currentFoldDirection;
                const targetYaw = settings.maxYawAngle * currentDistortionFactor * currentFoldDirection;

                let sceneMoving =
                    isScrolling ||
                    Math.abs(targetPosition - currentPosition) > SETTLE_EPSILON ||
                    currentDistortionFactor > SETTLE_EPSILON ||
                    currentLagFactor > SETTLE_EPSILON;

                // Móvil lento: si en movimiento no llega a ~45 fps, papel plano (mismo layout).
                if (!perfChecked && sceneMoving) {
                    perfSamples += 1;
                    perfTotal += deltaMs;
                    if (perfSamples >= 90) {
                        perfChecked = true;
                        if (perfTotal / perfSamples > SLOW_FRAME_MS) {
                            settings.maxDistortion = 0;
                            settings.maxTiltAngle = 0;
                            settings.maxYawAngle = 0;
                        }
                    }
                }

                slides.forEach((slide) => {
                    const d = slide.userData;
                    const cy = centerYFor(slide, currentPosition);
                    const isWrapping = Math.abs(cy - d.targetY) > d.h * 2;
                    if (isWrapping) d.currentY = cy;
                    d.targetY = cy;
                    d.currentY += (d.targetY - d.currentY) * settings.slideLerp;
                    slide.position.y = d.currentY;

                    const inView = isInView(slide, d.currentY);
                    slide.visible = inView && (!d.intro || d.reveal) && !(exiting && !d.textureReady);
                    // El caption aparece cuando la cortina de su hoja ya ha subido.
                    // El caption se esconde al cruzar la línea del ancla hacia arriba: si no,
                    // el de la hoja anterior caería sobre la cabecera (línea 3).
                    const captionY = d.currentY - d.h / 2 - (MOBILE_GRID.captionGap + MOBILE_GRID.captionLine / 2) * worldPerPx;
                    d.caption.visible =
                        slide.visible && !exiting && d.textureReady && d.curtain.uClip.value.y > 0.6 && captionY < anchorWorldY;

                    if (!d.textureRequested && Math.abs(d.currentY) < worldH / 2 + 3) {
                        d.textureRequested = true;
                        requestTexture(slide);
                    }
                    if (!slide.visible) return;

                    if (
                        Math.abs(d.targetY - d.currentY) > SETTLE_EPSILON ||
                        Math.abs(targetTilt - d.currentTilt) > SETTLE_EPSILON ||
                        Math.abs(targetYaw - d.currentYaw) > SETTLE_EPSILON
                    ) {
                        sceneMoving = true;
                    }

                    d.currentTilt += (targetTilt - d.currentTilt) * settings.tiltLerp;
                    d.currentYaw += (targetYaw - d.currentYaw) * settings.tiltLerp;
                    slide.rotation.x = d.currentTilt;
                    slide.rotation.y = d.currentYaw;
                    updateCurve(slide, currentDistortionFactor, currentLagFactor, currentFoldDirection);
                });

                emitProgress();

                if (sceneMoving || performance.now() < renderUntil) renderer.render(scene, camera);
            };

            const handleVisibility = () => {
                isTabHidden = document.hidden;
                if (!isTabHidden && !animationId) {
                    keepRendering();
                    animate(performance.now());
                }
            };

            animate(performance.now());
            if (hidingRef.current) exitRef.current();

            const el = containerRef.current;
            el.addEventListener('wheel', handleWheel, { passive: false });
            el.addEventListener('touchstart', handleTouchStart, { passive: false });
            el.addEventListener('touchmove', handleTouchMove, { passive: false });
            el.addEventListener('touchend', handleTouchEnd);
            el.addEventListener('touchcancel', handleTouchEnd);
            window.addEventListener('resize', handleResize);
            document.addEventListener('visibilitychange', handleVisibility);

            cleanupRef.current = () => {
                disposed = true;
                clearTimeout(curtainFailSafe);
                clearTimeout(wheelTimer);
                clearTimeout(momentumTimer);
                if (curtainTimeline) curtainTimeline.kill();
                if (exitTimeline) exitTimeline.kill();
                if (animationId) cancelAnimationFrame(animationId);
                recolorRef.current = null;
                exitRef.current = null;

                window.removeEventListener('resize', handleResize);
                document.removeEventListener('visibilitychange', handleVisibility);
                el.removeEventListener('wheel', handleWheel);
                el.removeEventListener('touchstart', handleTouchStart);
                el.removeEventListener('touchmove', handleTouchMove);
                el.removeEventListener('touchend', handleTouchEnd);
                el.removeEventListener('touchcancel', handleTouchEnd);

                slides.forEach((slide) => {
                    const { mesh, caption } = slide.userData;
                    mesh.geometry.dispose();
                    mesh.material.dispose();
                    caption.geometry.dispose();
                    caption.material.map?.dispose();
                    caption.material.dispose();
                    scene.remove(slide);
                });
                textureCache.forEach((texture) => texture.dispose());
                textureCache.clear();
                textureWaiters.clear();

                if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
                destroyRenderer(renderer);
                sliderBus.reset('progress');
                sliderBus.reset('active');
            };
        };

        // Con la fuente ya cargada, los captions se dibujan con PP Neue Montreal.
        let cancelled = false;
        let timeoutId = null;
        const start = () => {
            if (!cancelled) timeoutId = setTimeout(initThree, 100);
        };
        if (document.fonts?.ready) document.fonts.ready.then(start, start);
        else start();

        return () => {
            cancelled = true;
            clearTimeout(timeoutId);
            if (cleanupRef.current) cleanupRef.current();
            cleanupRef.current = null;
        };
    }, [images, project, variant, navbarHeight, anchorPx]);

    return <div ref={containerRef} className="w-full h-full" style={{ cursor: 'grab', touchAction: 'none' }} />;
}
