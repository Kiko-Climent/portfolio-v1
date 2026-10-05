'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import { getSlideSources } from '@/lib/optimizedImage';
import { loadTextureSource, preloadTextureSources } from '@/lib/media';
import { createTexture, destroyRenderer } from '@/lib/textures';

// Por debajo de esto una placa se considera plana (ver updateCurve).
const FLAT_EPSILON = 0.001;

/**
 * Navegación en detalle: con scroll, la hoja en foco vuelve a su hueco de la
 * columna (ya al fondo) succionada, y la vecina sube a detalle con el mismo
 * vuelo que al hacer click. Un cambio por gesto de rueda/swipe.
 */
const SWAP = {
    wheelThreshold: 40,  // delta de rueda acumulado para pasar de imagen
    gestureGap: 180,     // ms sin eventos de rueda = gesto nuevo (la inercia del trackpad no encadena)
    touchThreshold: 50,  // px de swipe
    inDelay: 0.1,        // la nueva hoja arranca un pelo después de que salga la anterior
    duration: 1.05,
    ease: 'power3.inOut',
};

/**
 * Cortina de entrada/salida de las imágenes de la galería: el mismo gesto que
 * el grid de la home (clip-path), hecho en el shader de cada hoja, así sigue
 * la curvatura del papel. Entra de abajo arriba con un leve asentamiento; al
 * salir la cortina sigue subiendo y tapa la imagen hacia arriba.
 */
export const CURTAIN = {
    // El slider se monta al hacer click, a la vez que el grid empieza a taparse.
    // Su cortina no arranca antes de este tiempo desde el montaje: se cruzan.
    minDelay: 0.35,
    duration: 1.1,
    ease: 'expo.out',      // mismo easing que el reveal del grid
    zoomFrom: 1.12,        // la imagen se asienta dentro de su hoja mientras sube la cortina
    stagger: 0.12,         // de arriba abajo entre las hojas visibles
    readyAt: 0.6,          // fracción de la cortina a partir de la cual cuenta como "en pantalla"
    out: {
        duration: 0.6,
        ease: 'power3.in', // mismo easing que la salida del grid y del menú
        zoomTo: 1.06,
        stagger: 0.06,
    },
};

// Dos resoluciones por imagen (columna ligera / detalle en alta): ver
// getSlideSources en src/lib/optimizedImage.js, compartido con la precarga.

export default function SliderThree4({
    images,
    project,
    navbarHeight,
    onFocusChange,
    onReady,
    hidden = false,
}) {
    const containerRef = useRef(null);
    const rendererRef = useRef(null);
    const cleanupRef = useRef(null);
    const curtainControlsRef = useRef(null);
    const onFocusChangeRef = useRef(onFocusChange);
    onFocusChangeRef.current = onFocusChange;
    const onReadyRef = useRef(onReady);
    const hiddenRef = useRef(hidden);
    useEffect(() => {
        onReadyRef.current = onReady;
    }, [onReady]);

    // Salida de la galería: la cortina inversa. Si llega antes de que el slider
    // exista, se aplica al revelarse (queda tapado).
    useEffect(() => {
        hiddenRef.current = hidden;
        if (hidden) curtainControlsRef.current?.hide();
    }, [hidden]);

    useEffect(() => {
        if (!containerRef.current || !images.length) return;

        const initThree = () => {
            if (!containerRef.current) return;

            const width = containerRef.current.clientWidth;
            const height = containerRef.current.clientHeight;

            if (width === 0 || height === 0) {
                setTimeout(initThree, 50);
                return;
            }

            let animationId = null;
            const slides = [];
            const mountedAt = performance.now();

            const renderer = new THREE.WebGLRenderer({
                alpha: true,
                // En retina el MSAA apenas se nota y a pantalla completa es caro.
                antialias: (window.devicePixelRatio || 1) < 2,
            });

            renderer.setSize(width, height);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            renderer.setClearColor(0x000000, 0);
            containerRef.current.appendChild(renderer.domElement);
            rendererRef.current = renderer;

            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(
                45,
                width / height,
                0.1,
                100
            );
            camera.position.z = 7;

            const settings = {
                wheelSensitivity: 0.01,
                touchSensitivity: 0.01,
                momentumMultiplier: 2,
                smoothing: 0.1,
                slideLerp: 0.075,
                distortionDecay: 0.95,
                maxDistortion: 0.38,
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
                maxTiltAngle: THREE.MathUtils.degToRad(58),
                maxYawAngle: THREE.MathUtils.degToRad(14),
                tiltLerp: 0.12,
            };

            const slideWidth = 3.5;
            const slideHeight = 2.0;
            const gap = 0.15;
            const slideCount = images.length * 2;
            const totalHeight = slideCount * (slideHeight + gap);
            const slideUnit = slideHeight + gap;

            const getColumnX = () => {
                const visibleHeight =
                    2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) * 0.5) * camera.position.z;
                return visibleHeight * camera.aspect * 0.25;
            };

            const getHeroScale = (mesh) => {
                const targetZ = 0.85;
                const dist = Math.max(0.35, camera.position.z - targetZ);
                const visibleHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) * 0.5) * dist;
                const visibleWidth = visibleHeight * camera.aspect;
                const baseX = mesh.userData.baseScaleX || 1;
                const baseY = mesh.userData.baseScaleY || 1;
                const worldW = slideWidth * baseX;
                const worldH = slideHeight * baseY;
                return Math.min((visibleWidth * 0.58) / worldW, (visibleHeight * 0.72) / worldH);
            };

            let columnX = getColumnX();
            let currentPosition = 0;
            let targetPosition = 0;
            let isScrolling = false;
            let autoScrollSpeed = 0;
            let lastTime = 0;
            let touchStartY = 0;
            let touchLastY = 0;

            let currentDistortionFactor = 0;
            let targetDistortionFactor = 0;
            let currentLagFactor = 0;
            let peakVelocity = 0;
            let velocityHistory = [0, 0, 0, 0, 0];
            let currentFoldDirection = 1;

            let pointerDownX = 0;
            let pointerDownY = 0;
            let pointerMoved = false;
            let focusTimeline = null;
            let disposed = false;
            // Sin interacción hasta que la cortina de entrada arranca, ni durante la salida.
            let interactive = false;
            let curtainTimeline = null;
            const swap = { acc: 0, lastWheel: 0, needsFreshGesture: false, outTimeline: null, inCall: null };
            const focus = {
                mesh: null,
                animating: false,
                phase: null,
                paper: 0,
                paperLag: 0,
                stretchLag: 0,
                bulgeLag: 0,
                dir: 1,
            };

            const raycaster = new THREE.Raycaster();
            const pointer = new THREE.Vector2();

            const correctImageColor = (texture) => {
                texture.colorSpace = THREE.SRGBColorSpace;
                return texture;
            };

            const setPointerFromEvent = (e) => {
                const rect = renderer.domElement.getBoundingClientRect();
                pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
                pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            };

            const hitSlide = (e) => {
                setPointerFromEvent(e);
                raycaster.setFromCamera(pointer, camera);
                const hits = raycaster.intersectObjects(slides.filter((slide) => slide.visible));
                return hits[0]?.object || null;
            };

            // Subidas a la GPU repartidas entre frames (~6 ms de presupuesto por
            // frame): si las imágenes ya estaban decodificadas (precarga del hover)
            // llegarían todas en el mismo tick y bloquearían un frame largo justo
            // mientras el grid se tapa. Cabe de sobra dentro de CURTAIN.minDelay.
            const uploadQueue = [];
            let uploadFrame = null;
            const flushUploads = () => {
                uploadFrame = null;
                const start = performance.now();
                while (uploadQueue.length && performance.now() - start < 6) {
                    uploadQueue.shift()();
                }
                if (uploadQueue.length) uploadFrame = requestAnimationFrame(flushUploads);
            };
            const scheduleUpload = (upload) => {
                uploadQueue.push(upload);
                if (!uploadFrame) uploadFrame = requestAnimationFrame(flushUploads);
            };

            // Cada imagen se carga y se sube a la GPU una sola vez: las dos copias
            // de la columna (scroll infinito) comparten textura.
            const texturePromises = new Map();
            const loadedTextures = new Set();
            const loadTexture = (imagePath) => {
                if (!texturePromises.has(imagePath)) {
                    // La imagen llega ya decodificada fuera del hilo principal
                    // (ImageBitmap, caché compartida con la precarga del hover del
                    // footer): texImage2D solo sube píxeles, no decodifica.
                    texturePromises.set(imagePath, loadTextureSource(imagePath).then(
                        (source) => new Promise((resolve) => {
                            scheduleUpload(() => {
                                if (disposed) {
                                    resolve(null);
                                    return;
                                }
                                const texture = correctImageColor(createTexture(source));
                                renderer.initTexture(texture);
                                loadedTextures.add(texture);
                                resolve(texture);
                            });
                        }),
                        (err) => {
                            console.warn(`Couldn't load image ${imagePath}`, err);
                            return null;
                        }
                    ));
                }
                return texturePromises.get(imagePath);
            };

            const slideSources = getSlideSources(project, images);

            // Con la primera textura se compila el shader de las hojas en paralelo
            // (KHR_parallel_shader_compile) y no se hacen visibles hasta que está
            // listo: si no, el primer frame que las pinta compila en el hilo
            // principal (~30-40 ms) en plena transición. Todas comparten programa.
            let shaderReady = null;
            const showWhenShaderReady = (mesh) => {
                if (!shaderReady) shaderReady = renderer.compileAsync(scene, camera).catch(() => {});
                shaderReady.then(() => {
                    if (!disposed) mesh.visible = true;
                });
            };

            const createSlide = (index) => {
                const geometry = new THREE.PlaneGeometry(slideWidth, slideHeight, 48, 24);
                const material = new THREE.MeshBasicMaterial({
                    color: new THREE.Color(0xffffff),
                    side: THREE.DoubleSide,
                    transparent: true,
                    opacity: 1,
                    depthWrite: false,
                    // Los texels transparentes no escriben profundidad cuando una
                    // hoja vuela con depth buffer (cambio de imagen en detalle).
                    alphaTest: 0.01,
                });

                // Cortina en el shader: banda visible en V (x = borde inferior,
                // y = superior) y zoom de la imagen dentro de la hoja. Arranca
                // tapada; es el equivalente a clip-path en el espacio de la hoja.
                const curtain = {
                    uClip: { value: new THREE.Vector2(0, -0.01) },
                    uZoom: { value: CURTAIN.zoomFrom },
                    uZoomOrigin: { value: new THREE.Vector2(0.5, 0) },
                };
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
                mesh.position.x = columnX;
                mesh.position.y = index * (slideHeight + gap);
                // Sin textura no se pinta (evita planos blancos mientras carga).
                mesh.visible = false;
                mesh.userData = {
                    index,
                    currentTilt: 0,
                    currentYaw: 0,
                    baseScaleX: 1,
                    baseScaleY: 1,
                    cloth: { vacuum: 0, vacuumLag: 0, bulge: 0, bulgeLag: 0 },
                    curtain,
                };

                loadTexture(slideSources[index % images.length].low).then((texture) => {
                    if (!texture || disposed) return;
                    material.map = texture;
                    material.needsUpdate = true;
                    showWhenShaderReady(mesh);

                    const imgAspect = texture.image.width / texture.image.height;
                    const slideAspect = slideWidth / slideHeight;

                    if (imgAspect > slideAspect) {
                        mesh.scale.y = slideAspect / imgAspect;
                    } else {
                        mesh.scale.x = imgAspect / slideAspect;
                    }

                    mesh.userData.baseScaleX = mesh.scale.x;
                    mesh.userData.baseScaleY = mesh.scale.y;
                });

                scene.add(mesh);
                slides.push(mesh);
            };

            for (let i = 0; i < slideCount; i++) createSlide(i);

            slides.forEach((slide) => {
                slide.position.y -= totalHeight / 2;
                slide.userData.targetY = slide.position.y;
                slide.userData.currentY = slide.position.y;
            });

            // ── Cortina de entrada / salida ────────────────────────────
            const visibleHalfHeight = () =>
                Math.tan(THREE.MathUtils.degToRad(camera.fov) * 0.5) * camera.position.z;
            // Y en pantalla (proyectada a z = 0): la ola va de arriba abajo.
            const screenY = (slide) =>
                (slide.position.y * camera.position.z) / (camera.position.z - slide.position.z);
            const isOnScreen = (slide) =>
                slide.visible && Math.abs(screenY(slide)) < visibleHalfHeight() + slideHeight;

            const playCurtainIn = () => {
                if (curtainTimeline) curtainTimeline.kill();
                const onScreen = slides.filter(isOnScreen).sort((a, b) => screenY(b) - screenY(a));
                // Las de fuera de pantalla quedan ya descubiertas: aparecen al hacer scroll.
                slides.forEach((slide) => {
                    if (onScreen.includes(slide)) return;
                    slide.userData.curtain.uClip.value.set(0, 1);
                    slide.userData.curtain.uZoom.value = 1;
                });

                interactive = true;
                // Si las texturas llegan muy rápido, se espera un poco: el grid
                // tiene que haber empezado a taparse para que las cortinas se crucen.
                const sinceMount = (performance.now() - mountedAt) / 1000;
                curtainTimeline = gsap.timeline({ delay: Math.max(0, CURTAIN.minDelay - sinceMount) });
                onScreen.forEach((slide, i) => {
                    const curtain = slide.userData.curtain;
                    curtain.uZoomOrigin.value.set(0.5, 0);
                    const at = i * CURTAIN.stagger;
                    curtainTimeline.to(curtain.uClip.value, { y: 1, duration: CURTAIN.duration, ease: CURTAIN.ease }, at);
                    curtainTimeline.to(curtain.uZoom, { value: 1, duration: CURTAIN.duration, ease: CURTAIN.ease }, at);
                });
                // "En pantalla" (para el resto de la interfaz, p. ej. back menu).
                const lastAt = Math.max(0, onScreen.length - 1) * CURTAIN.stagger;
                curtainTimeline.call(
                    () => {
                        onReadyRef.current?.();
                        preloadDetailImages();
                    },
                    null,
                    lastAt + CURTAIN.duration * CURTAIN.readyAt
                );
            };

            // Ya con la galería en pantalla: las versiones de alta resolución se
            // descargan y decodifican en segundo plano (sin subirlas a la GPU),
            // así el cambio a detalle es inmediato.
            const preloadDetailImages = () => {
                preloadTextureSources(
                    slideSources.filter(({ low, high }) => high !== low).map(({ high }) => high),
                    { concurrency: 2 }
                );
            };

            // La imagen en detalle pasa a alta resolución al terminar su vuelo:
            // ya está quieta, así que la subida a la GPU no se nota.
            const upgradeToDetail = (mesh) => {
                const imageIndex = mesh.userData.index % images.length;
                const { low, high } = slideSources[imageIndex];
                if (high === low) return;
                loadTexture(high).then((texture) => {
                    if (!texture || disposed) return;
                    slides.forEach((slide) => {
                        if (slide.userData.index % images.length === imageIndex) slide.material.map = texture;
                    });
                });
            };

            // La inversa: la cortina sigue subiendo y tapa cada imagen hacia arriba,
            // incluida la que esté en detalle.
            const playCurtainOut = () => {
                interactive = false;
                if (curtainTimeline) curtainTimeline.kill();
                const onScreen = slides
                    .filter((slide) => slide === focus.mesh || isOnScreen(slide))
                    .sort((a, b) => screenY(b) - screenY(a));
                slides.forEach((slide) => {
                    if (!onScreen.includes(slide)) slide.userData.curtain.uClip.value.set(1.01, 1);
                });

                curtainTimeline = gsap.timeline();
                onScreen.forEach((slide, i) => {
                    const curtain = slide.userData.curtain;
                    curtain.uZoomOrigin.value.set(0.5, 1);
                    const at = i * CURTAIN.out.stagger;
                    const vars = { duration: CURTAIN.out.duration, ease: CURTAIN.out.ease };
                    curtainTimeline.to(curtain.uClip.value, { x: 1.01, ...vars }, at);
                    curtainTimeline.to(curtain.uZoom, { value: CURTAIN.out.zoomTo, ...vars }, at);
                });
            };

            curtainControlsRef.current = { hide: playCurtainOut };

            // Con todas las texturas ya subidas a la GPU (el hilo principal libre)
            // arranca la cortina de entrada.
            Promise.all(texturePromises.values()).then(() => shaderReady).then(() => {
                requestAnimationFrame(() => requestAnimationFrame(() => {
                    if (disposed) return;
                    // Si ya se está saliendo de la galería, se queda tapada.
                    if (hiddenRef.current) return;
                    playCurtainIn();
                }));
            });

            const smoothstep = (t) => t * t * (3 - 2 * t);
            const bezier2 = (a, b, c, t) => {
                const u = 1 - t;
                return u * u * a + 2 * u * t * b + t * t * c;
            };

            // Todas las placas comparten la geometría base, así que todo lo que la
            // deformación calcula a partir de la posición del vértice (pow, hypot,
            // sin, cos...) se precalcula una sola vez. En cada frame solo quedan
            // multiplicaciones por la intensidad del momento.
            const precomputeCurve = (positions) => {
                const count = positions.length / 3;
                const halfW = slideWidth / 2;
                const halfH = slideHeight / 2;
                const curve = { count };
                [
                    'x', 'y', 'grab', 'tilt', 'foldZ', 'lead', 'tuck',
                    'fromGrab', 'rubberX', 'rubberY', 'rubberZ',
                    'radiusT', 'vacuumX', 'vacuumY', 'vacuumZ',
                    'bulgeT', 'bulgeX', 'bulgeY', 'bulgeZ',
                ].forEach((name) => {
                    curve[name] = new Float32Array(count);
                });

                for (let i = 0; i < count; i++) {
                    const x = positions[i * 3];
                    const y = positions[i * 3 + 1];
                    const nx = THREE.MathUtils.clamp(x / halfW, -1, 1);
                    const ny = THREE.MathUtils.clamp(y / halfH, -1, 1);
                    const leftAmount = (1 - nx) * 0.5;
                    const topAmount = (1 + ny) * 0.5;

                    const topLeft = Math.pow(leftAmount, 1.55) * Math.pow(topAmount, 0.9);
                    const topRight =
                        Math.pow(1 - leftAmount, 1.45) *
                        Math.pow(topAmount, 1.15) *
                        settings.rightCornerRatio;
                    const cornerLift = Math.min(1, topLeft + topRight);
                    const fromGrab = THREE.MathUtils.clamp(Math.hypot(nx + 1, ny - 1) / 2.828427, 0, 1);
                    const radial = (nx * nx * (0.35 + 0.65 * leftAmount) + ny * ny) * 0.5;
                    const foldShape = smoothstep(radial) * 2 - 1;

                    curve.x[i] = x;
                    curve.y[i] = y;
                    // Papel: inclinación, pliegue, esquina levantada y rizo.
                    curve.grab[i] = fromGrab * 0.82;
                    curve.tilt[i] = -ny * settings.tiltStrength * (0.62 + 0.38 * leftAmount);
                    curve.foldZ[i] =
                        foldShape * settings.bendStrength +
                        Math.pow(cornerLift, 1.25) * settings.grabStrength +
                        Math.pow(topLeft, 2.35) * settings.curlStrength;
                    curve.lead[i] = -topLeft * settings.leadStrength;
                    curve.tuck[i] = topLeft * settings.tuckStrength;

                    // Goma (stretch).
                    const centerWeight = Math.pow(Math.max(0, 1 - (nx * nx * 0.55 + ny * ny * 0.45)), 1.15);
                    curve.fromGrab[i] = fromGrab;
                    curve.rubberX[i] = (x + halfW) * fromGrab * 0.18 + centerWeight * halfW * 0.32;
                    curve.rubberY[i] = (y - halfH) * fromGrab * 0.16 - centerWeight * halfH * 0.14;
                    curve.rubberZ[i] = -centerWeight * 0.22;

                    // Aspiradora: el centro se hunde hacia el fondo, los bordes llegan tarde.
                    const radius = Math.min(1, Math.hypot(nx, ny));
                    const cup = Math.pow(Math.max(0, 1 - radius), 1.08);
                    curve.radiusT[i] = Math.pow(radius, 0.7);
                    curve.vacuumX[i] = -x * cup * 0.24;
                    curve.vacuumY[i] = -y * cup * 0.2;
                    curve.vacuumZ[i] =
                        -cup * 0.78 - Math.sin(radius * Math.PI) * 0.16 + Math.pow(radius, 2.1) * 0.1;

                    // Detalle: vuelo orgánico. Cuenco suave (coseno), sin aristas:
                    // el centro se eleva y las esquinas ceden atrás, como una hoja en el aire.
                    const rFly = Math.hypot(nx, ny);
                    const bowl = 0.5 + 0.5 * Math.cos((Math.min(rFly, 1.42) / 1.42) * Math.PI);
                    curve.bulgeT[i] = THREE.MathUtils.clamp(rFly / 1.42, 0, 1);
                    curve.bulgeX[i] = -x * (1 - bowl) * 0.03;
                    curve.bulgeY[i] = -y * (1 - bowl) * 0.022;
                    curve.bulgeZ[i] = bowl * 0.4 - (1 - bowl) * 0.34;
                }

                return curve;
            };

            const SEGMENTS_X = 48;
            const SEGMENTS_Y = 24;
            const baseGeometry = new THREE.PlaneGeometry(slideWidth, slideHeight, SEGMENTS_X, SEGMENTS_Y);
            const originalVertices = baseGeometry.attributes.position.array.slice();
            const curve = precomputeCurve(originalVertices);
            baseGeometry.dispose();

            const updateCurve = (mesh, distortionFactor, lagFactor, foldDirection, extras = null) => {
                const positionAttribute = mesh.geometry.attributes.position;
                const stretch = extras ? Math.max(0, extras.stretch || 0) : 0;
                const stretchLag = extras ? Math.max(0, extras.stretchLag ?? stretch) : stretch;
                const vacuum = extras ? Math.max(0, extras.vacuum || 0) : 0;
                const vacuumLag = extras ? Math.max(0, extras.vacuumLag ?? vacuum) : vacuum;
                const bulge = extras ? extras.bulge || 0 : 0;
                const bulgeLag = extras ? extras.bulgeLag ?? bulge : bulge;

                const hasFold = Math.abs(distortionFactor) >= FLAT_EPSILON || Math.abs(lagFactor) >= FLAT_EPSILON;
                const hasStretch = stretch >= FLAT_EPSILON || stretchLag >= FLAT_EPSILON;
                const hasVacuum = vacuum >= FLAT_EPSILON || vacuumLag >= FLAT_EPSILON;
                const hasBulge = Math.abs(bulge) >= FLAT_EPSILON || Math.abs(bulgeLag) >= FLAT_EPSILON;

                // En reposo basta con restaurar la placa plana una vez.
                if (!hasFold && !hasStretch && !hasVacuum && !hasBulge) {
                    if (!mesh.userData.isFlat) {
                        positionAttribute.array.set(originalVertices);
                        positionAttribute.needsUpdate = true;
                        mesh.userData.isFlat = true;
                    }
                    return;
                }

                mesh.userData.isFlat = false;

                const array = positionAttribute.array;
                const maxDistortion = settings.maxDistortion;

                for (let i = 0, j = 0; i < curve.count; i++, j += 3) {
                    const grab = curve.grab[i];
                    const intensity = maxDistortion * ((1 - grab) * distortionFactor + grab * lagFactor);
                    const fold = intensity * foldDirection;

                    let x = curve.x[i] + fold * curve.tuck[i];
                    let y = curve.y[i] + fold * curve.lead[i];
                    let z = intensity * curve.tilt[i] + fold * curve.foldZ[i];

                    if (hasStretch) {
                        const t = curve.fromGrab[i];
                        const localStretch = (1 - t) * stretch + t * stretchLag;
                        x += curve.rubberX[i] * localStretch;
                        y += curve.rubberY[i] * localStretch;
                        z += curve.rubberZ[i] * localStretch * foldDirection;
                    }

                    if (hasVacuum) {
                        const t = curve.radiusT[i];
                        const localVacuum = (1 - t) * vacuum + t * vacuumLag;
                        x += curve.vacuumX[i] * localVacuum;
                        y += curve.vacuumY[i] * localVacuum;
                        z += curve.vacuumZ[i] * localVacuum;
                    }

                    if (hasBulge) {
                        const t = curve.bulgeT[i];
                        const localBulge = (1 - t) * bulge + t * bulgeLag;
                        x += curve.bulgeX[i] * localBulge;
                        y += curve.bulgeY[i] * localBulge;
                        z += curve.bulgeZ[i] * localBulge;
                    }

                    array[j] = x;
                    array[j + 1] = y;
                    array[j + 2] = z;
                }

                positionAttribute.needsUpdate = true;
            };

            const applyFocusPose = (mesh, pose) => {
                const t = pose.t;
                // Volviendo a la columna: el hueco puede moverse (la columna avanza al
                // pasar de imagen en detalle), así que el destino lo sigue.
                if (pose.trackSlot) pose.toY = mesh.userData.currentY;
                mesh.position.x = bezier2(pose.fromX, pose.ctrlX, pose.toX, t);
                mesh.position.y = bezier2(pose.fromY, pose.ctrlY, pose.toY, t);
                mesh.position.z = bezier2(pose.fromZ, pose.ctrlZ, pose.toZ, t);
                mesh.scale.x = pose.sx;
                mesh.scale.y = pose.sy;

                const twist = pose.paper * pose.dir;
                mesh.userData.currentTilt = settings.maxTiltAngle * 0.08 * twist;
                mesh.userData.currentYaw = settings.maxYawAngle * 0.12 * twist;
                mesh.rotation.x = mesh.userData.currentTilt;
                mesh.rotation.y = mesh.userData.currentYaw;
                mesh.rotation.z = 0;

                focus.paper = pose.paper;
                focus.paperLag += (focus.paper - focus.paperLag) * 0.16;
                focus.stretchLag += (pose.stretch - focus.stretchLag) * 0.14;
                focus.bulgeLag += (pose.bulge - focus.bulgeLag) * 0.08;
                focus.dir = pose.dir;
                updateCurve(mesh, focus.paper, focus.paperLag, focus.dir, {
                    stretch: pose.stretch,
                    stretchLag: focus.stretchLag,
                    bulge: pose.bulge,
                    bulgeLag: focus.bulgeLag,
                    t,
                });
            };

            const RECEDE = {
                z: -9.2,
                scale: 0.82,
                duration: 1.05,
                ease: 'power3.inOut',
                stagger: 0.035,
            };

            const recedeOthers = (except, departing) => {
                slides.forEach((slide) => {
                    if (slide === except) return;
                    slide.material.transparent = true;
                    slide.material.depthWrite = false;
                    slide.visible = !!slide.material.map;
                    slide.material.opacity = 1;
                    gsap.killTweensOf(slide.material);
                    gsap.killTweensOf(slide.position);
                    gsap.killTweensOf(slide.scale);
                    gsap.killTweensOf(slide.rotation);
                    gsap.killTweensOf(slide.userData.cloth);

                    const dist = Math.abs(slide.userData.index - except.userData.index);
                    const delay = Math.min(dist * RECEDE.stagger, 0.18);
                    const cloth = slide.userData.cloth;
                    const toZ = departing ? RECEDE.z : 0;
                    const toSx = slide.userData.baseScaleX * (departing ? RECEDE.scale : 1);
                    const toSy = slide.userData.baseScaleY * (departing ? RECEDE.scale : 1);

                    if (departing) {
                        cloth.vacuum = Math.min(0.22, currentDistortionFactor);
                        cloth.vacuumLag = cloth.vacuum * 0.45;
                        cloth.bulge = 0;
                        cloth.bulgeLag = 0;
                        gsap.to(slide.rotation, {
                            x: 0,
                            y: 0,
                            z: 0,
                            duration: 0.42,
                            delay,
                            ease: 'power2.out',
                        });
                        gsap.to(cloth, {
                            vacuum: 1.18,
                            duration: 0.42,
                            delay,
                            ease: 'power2.out',
                        });
                        gsap.to(cloth, {
                            vacuum: 0,
                            duration: 0.58,
                            delay: delay + 0.42,
                            ease: 'power3.inOut',
                            onComplete: () => {
                                cloth.vacuum = 0;
                                cloth.vacuumLag = 0;
                                cloth.bulge = 0;
                                cloth.bulgeLag = 0;
                                updateCurve(slide, 0, 0, 1);
                            },
                        });
                    } else {
                        cloth.vacuum = 0;
                        cloth.vacuumLag = 0;
                        cloth.bulge = 0;
                        cloth.bulgeLag = 0;
                        gsap.to(cloth, {
                            bulge: 1,
                            duration: 0.42,
                            delay,
                            ease: 'power2.out',
                        });
                        gsap.to(cloth, {
                            bulge: 0,
                            duration: 0.58,
                            delay: delay + 0.42,
                            ease: 'power3.inOut',
                            onComplete: () => {
                                cloth.vacuum = 0;
                                cloth.vacuumLag = 0;
                                cloth.bulge = 0;
                                cloth.bulgeLag = 0;
                                updateCurve(slide, 0, 0, 1);
                            },
                        });
                    }

                    gsap.to(slide.position, {
                        z: toZ,
                        duration: RECEDE.duration,
                        delay,
                        ease: RECEDE.ease,
                    });
                    gsap.to(slide.scale, {
                        x: toSx,
                        y: toSy,
                        duration: RECEDE.duration,
                        delay,
                        ease: RECEDE.ease,
                    });
                });
            };

            const playPaperFlight = (mesh, {
                toX,
                toY,
                toZ,
                toSx,
                toSy,
                departing,
                fromDepth = false,
                trackSlot = false,
                onComplete,
            }) => {
                if (focusTimeline) focusTimeline.kill();

                const fromX = mesh.position.x;
                const fromY = mesh.position.y;
                // Desde la columna se recoge un poco al frente; desde el fondo
                // (navegación en detalle) sale de su profundidad real.
                const fromZ = departing && !fromDepth ? Math.max(mesh.position.z, 0.22) : mesh.position.z;
                const dir = Math.sign(toY - fromY) || focus.dir || 1;
                // Recoge la hoja en su sitio (X casi quieta, Z al frente)
                // y recién entonces la lleva al centro, sin atravesar la columna.
                const pose = {
                    t: 0,
                    paper: Math.min(0.18, Math.max(focus.paper, currentDistortionFactor)),
                    dir,
                    fromX,
                    fromY,
                    fromZ,
                    ctrlX: departing ? fromX : toX,
                    ctrlY: (fromY + toY) * 0.5,
                    ctrlZ: Math.max(fromZ, toZ) + 1.35,
                    toX,
                    toY,
                    toZ,
                    sx: mesh.scale.x,
                    sy: mesh.scale.y,
                    stretch: 0,
                    bulge: departing ? 0.12 : 0,
                    trackSlot,
                };

                const bulgePeak = departing ? 1 : -1;

                focus.paperLag = pose.paper;
                focus.stretchLag = 0;
                focus.bulgeLag = pose.bulge * 0.35;
                focus.dir = dir;
                mesh.position.z = fromZ;
                applyFocusPose(mesh, pose);

                focusTimeline = gsap.timeline({
                    defaults: { overwrite: 'auto' },
                    onComplete: () => {
                        pose.bulge = 0;
                        focus.bulgeLag = 0;
                        focus.paper = 0;
                        focus.paperLag = 0;
                        mesh.rotation.set(0, 0, 0);
                        updateCurve(mesh, 0, 0, 1);
                        onComplete?.();
                    },
                });

                focusTimeline.to(pose, {
                    t: 1,
                    duration: 1.05,
                    ease: 'power3.inOut',
                    onUpdate: () => applyFocusPose(mesh, pose),
                }, 0);

                focusTimeline.to(pose, {
                    paper: 0,
                    duration: 0.4,
                    ease: 'power2.out',
                    onUpdate: () => applyFocusPose(mesh, pose),
                }, 0);

                focusTimeline.to(pose, {
                    bulge: bulgePeak,
                    duration: 0.4,
                    ease: 'power2.out',
                    onUpdate: () => applyFocusPose(mesh, pose),
                }, 0);
                focusTimeline.to(pose, {
                    bulge: 0,
                    duration: 0.62,
                    ease: 'power3.inOut',
                    onUpdate: () => applyFocusPose(mesh, pose),
                }, 0.48);

                focusTimeline.to(pose, {
                    sx: toSx,
                    sy: toSy,
                    duration: 1.05,
                    ease: 'power3.inOut',
                    onUpdate: () => applyFocusPose(mesh, pose),
                }, 0);

                return pose;
            };

            const unfocusSlide = () => {
                const mesh = focus.mesh;
                if (!mesh || focus.animating) return;

                focus.animating = true;
                focus.phase = 'out';
                onFocusChangeRef.current?.(null);
                recedeOthers(mesh, false);

                playPaperFlight(mesh, {
                    toX: columnX,
                    toY: mesh.userData.currentY,
                    toZ: 0,
                    toSx: mesh.userData.baseScaleX,
                    toSy: mesh.userData.baseScaleY,
                    departing: false,
                    trackSlot: true,
                    onComplete: () => {
                        mesh.renderOrder = 0;
                        mesh.material.depthTest = true;
                        mesh.position.x = columnX;
                        mesh.position.z = 0;
                        mesh.rotation.set(0, 0, 0);
                        mesh.scale.x = mesh.userData.baseScaleX;
                        mesh.scale.y = mesh.userData.baseScaleY;
                        focus.mesh = null;
                        focus.animating = false;
                        focus.phase = null;
                        focus.paper = 0;
                        focus.paperLag = 0;
                        focus.stretchLag = 0;
                        focus.bulgeLag = 0;
                        focusTimeline = null;
                        if (containerRef.current) containerRef.current.style.cursor = 'grab';
                    },
                });
            };

            const focusSlide = (mesh) => {
                if (focus.mesh || focus.animating) return;

                focus.mesh = mesh;
                focus.animating = true;
                focus.phase = 'in';
                mesh.renderOrder = 10;
                mesh.material.depthTest = false;
                mesh.material.depthWrite = false;

                const hero = getHeroScale(mesh);
                recedeOthers(mesh, true);
                onFocusChangeRef.current?.(mesh.userData.index % images.length);
                if (containerRef.current) containerRef.current.style.cursor = 'pointer';

                playPaperFlight(mesh, {
                    toX: 0,
                    toY: 0,
                    toZ: 0.85,
                    toSx: mesh.userData.baseScaleX * hero,
                    toSy: mesh.userData.baseScaleY * hero,
                    departing: true,
                    onComplete: () => {
                        focus.animating = false;
                        upgradeToDetail(mesh);
                    },
                });
            };

            // La hoja que deja el detalle vuelve a su hueco de la columna (ya al
            // fondo) succionada: el centro se hunde primero y los bordes llegan
            // tarde, el mismo vacuum que usa la columna al alejarse.
            const playSuctionFlight = (mesh, { onComplete }) => {
                const cloth = mesh.userData.cloth;
                gsap.killTweensOf(cloth);
                cloth.vacuum = 0;
                cloth.vacuumLag = 0;
                cloth.bulge = 0;
                cloth.bulgeLag = 0;

                const fromY = mesh.position.y;
                const fromZ = mesh.position.z;
                const pose = {
                    t: 0,
                    fromX: mesh.position.x,
                    fromY,
                    fromZ,
                    ctrlX: THREE.MathUtils.lerp(mesh.position.x, columnX, 0.35),
                    ctrlY: (fromY + mesh.userData.currentY) * 0.5,
                    ctrlZ: THREE.MathUtils.lerp(fromZ, RECEDE.z, 0.25),
                    toX: columnX,
                    toY: mesh.userData.currentY,
                    toZ: RECEDE.z,
                    sx: mesh.scale.x,
                    sy: mesh.scale.y,
                    rx: mesh.rotation.x,
                    ry: mesh.rotation.y,
                };

                const apply = () => {
                    pose.toY = mesh.userData.currentY;
                    mesh.position.x = bezier2(pose.fromX, pose.ctrlX, pose.toX, pose.t);
                    mesh.position.y = bezier2(pose.fromY, pose.ctrlY, pose.toY, pose.t);
                    mesh.position.z = bezier2(pose.fromZ, pose.ctrlZ, pose.toZ, pose.t);
                    mesh.scale.x = pose.sx;
                    mesh.scale.y = pose.sy;
                    mesh.rotation.set(pose.rx, pose.ry, 0);

                    const toward = cloth.vacuum < cloth.vacuumLag ? 0.16 : 0.055;
                    cloth.vacuumLag += (cloth.vacuum - cloth.vacuumLag) * toward;
                    updateCurve(mesh, 0, 0, 1, { vacuum: cloth.vacuum, vacuumLag: cloth.vacuumLag });
                };

                const tl = gsap.timeline({
                    onComplete: () => {
                        cloth.vacuum = 0;
                        cloth.vacuumLag = 0;
                        mesh.rotation.set(0, 0, 0);
                        updateCurve(mesh, 0, 0, 1);
                        onComplete?.();
                    },
                });
                tl.to(pose, { t: 1, duration: SWAP.duration, ease: SWAP.ease, onUpdate: apply }, 0);
                tl.to(pose, {
                    sx: mesh.userData.baseScaleX * RECEDE.scale,
                    sy: mesh.userData.baseScaleY * RECEDE.scale,
                    rx: 0,
                    ry: 0,
                    duration: SWAP.duration,
                    ease: SWAP.ease,
                }, 0);
                tl.to(cloth, { vacuum: 1.18, duration: 0.42, ease: 'power2.out' }, 0);
                tl.to(cloth, { vacuum: 0, duration: 0.58, ease: 'power3.inOut' }, 0.42);
                return tl;
            };

            // Paso a la imagen vecina estando en detalle. step = signo del scroll:
            // igual que en la columna, hacia abajo trae la hoja de debajo.
            const swapFocus = (step) => {
                const current = focus.mesh;
                if (!current || focus.animating) return;

                const next = slides[(current.userData.index - step + slideCount) % slideCount];
                focus.animating = true;
                swap.needsFreshGesture = true;

                // La columna (al fondo) avanza un hueco: al salir del detalle cada
                // hoja vuelve a un sitio visible.
                targetPosition -= step * slideUnit;

                // Las dos hojas en vuelo van por encima de la columna (mismo
                // renderOrder) y se tapan entre sí por su profundidad real (depth
                // buffer): la que sube desde el fondo queda detrás de la que está
                // en detalle hasta que de verdad la adelanta, y al cruzarse el
                // papel curvado se atraviesa como en 3D.
                const flyWithDepth = (mesh) => {
                    mesh.renderOrder = 10;
                    mesh.material.depthTest = true;
                    mesh.material.depthWrite = true;
                };

                flyWithDepth(current);
                current.userData.flying = true;
                swap.outTimeline = playSuctionFlight(current, {
                    onComplete: () => {
                        // De vuelta en la columna: mismo estado que el resto.
                        current.userData.flying = false;
                        current.renderOrder = 0;
                        current.material.depthTest = true;
                        current.material.depthWrite = false;
                        swap.outTimeline = null;
                    },
                });

                gsap.killTweensOf(next.position);
                gsap.killTweensOf(next.scale);
                gsap.killTweensOf(next.rotation);
                gsap.killTweensOf(next.userData.cloth);
                Object.assign(next.userData.cloth, { vacuum: 0, vacuumLag: 0, bulge: 0, bulgeLag: 0 });
                focus.mesh = next;
                flyWithDepth(next);
                onFocusChangeRef.current?.(next.userData.index % images.length);

                const hero = getHeroScale(next);
                swap.inCall = gsap.delayedCall(SWAP.inDelay, () => {
                    swap.inCall = null;
                    playPaperFlight(next, {
                        toX: 0,
                        toY: 0,
                        toZ: 0.85,
                        toSx: next.userData.baseScaleX * hero,
                        toSy: next.userData.baseScaleY * hero,
                        departing: true,
                        fromDepth: true,
                        onComplete: () => {
                            // Ya en detalle: mismo estado que tras un click.
                            next.material.depthTest = false;
                            next.material.depthWrite = false;
                            focus.animating = false;
                            upgradeToDetail(next);
                        },
                    });
                });
            };

            // Rueda en detalle: un cambio por gesto. Un gesto nuevo empieza tras
            // una pausa; la inercia del trackpad no encadena varias imágenes.
            const handleDetailWheel = (e) => {
                const now = performance.now();
                if (now - swap.lastWheel > SWAP.gestureGap) {
                    swap.acc = 0;
                    swap.needsFreshGesture = false;
                }
                swap.lastWheel = now;
                if (focus.animating || swap.needsFreshGesture) return;

                swap.acc += e.deltaY;
                if (Math.abs(swap.acc) < SWAP.wheelThreshold) return;
                const step = Math.sign(swap.acc);
                swap.acc = 0;
                swapFocus(step);
            };

            const handleWheel = (e) => {
                e.preventDefault();
                if (!interactive) return;
                if (focus.mesh) {
                    handleDetailWheel(e);
                    return;
                }

                const wheelStrength = Math.abs(e.deltaY) * 0.001;
                targetDistortionFactor = Math.min(1.0, targetDistortionFactor + wheelStrength);

                targetPosition -= e.deltaY * settings.wheelSensitivity;
                isScrolling = true;
                autoScrollSpeed = Math.min(Math.abs(e.deltaY) * 0.0005, 0.05) * Math.sign(e.deltaY);

                clearTimeout(window.scrollTimeout);
                window.scrollTimeout = setTimeout(() => {
                    isScrolling = false;
                }, 150);
            };

            const handleTouchStart = (e) => {
                touchStartY = e.touches[0].clientY;
                touchLastY = touchStartY;
                isScrolling = false;
                pointerDownX = e.touches[0].clientX;
                pointerDownY = e.touches[0].clientY;
                pointerMoved = false;
            };

            const handleTouchMove = (e) => {
                e.preventDefault();
                if (!interactive) return;

                const touchY = e.touches[0].clientY;
                const deltaY = touchY - touchLastY;
                touchLastY = touchY;
                // Distancia total (no solo la del último evento): un swipe lento
                // tampoco debe contar como tap.
                if (
                    Math.abs(e.touches[0].clientX - pointerDownX) > 8 ||
                    Math.abs(touchY - touchStartY) > 8 ||
                    Math.abs(deltaY) > 8
                ) {
                    pointerMoved = true;
                }
                // En detalle el swipe se resuelve al soltar (handleTouchEnd).
                if (focus.mesh) return;

                const touchStrength = Math.abs(deltaY) * 0.02;
                targetDistortionFactor = Math.min(1.0, targetDistortionFactor + touchStrength);

                targetPosition -= deltaY * settings.touchSensitivity;
                isScrolling = true;
            };

            const handleTouchEnd = (e) => {
                if (!interactive) return;
                if (!pointerMoved) {
                    const lastTouch = e.changedTouches?.[0];
                    if (lastTouch) {
                        const fakeEvent = { clientX: lastTouch.clientX, clientY: lastTouch.clientY };
                        if (focus.mesh) unfocusSlide();
                        else {
                            const mesh = hitSlide(fakeEvent);
                            if (mesh) focusSlide(mesh);
                        }
                    }
                    return;
                }

                if (focus.mesh) {
                    // Mismo sentido que el scroll táctil de la columna.
                    const swipe = touchLastY - touchStartY;
                    if (Math.abs(swipe) > SWAP.touchThreshold) swapFocus(Math.sign(swipe));
                    return;
                }

                const velocity = (touchLastY - touchStartY) * 0.005;
                if (Math.abs(velocity) > 0.5) {
                    autoScrollSpeed = -velocity * settings.momentumMultiplier * 0.05;
                    targetDistortionFactor = Math.min(
                        1.0,
                        Math.abs(velocity) * 3 * settings.distortionSensitivity
                    );
                    isScrolling = true;
                    setTimeout(() => {
                        isScrolling = false;
                    }, 800);
                }
            };

            const handlePointerDown = (e) => {
                pointerDownX = e.clientX;
                pointerDownY = e.clientY;
                pointerMoved = false;
            };

            const handlePointerMove = (e) => {
                if (Math.hypot(e.clientX - pointerDownX, e.clientY - pointerDownY) > 6) {
                    pointerMoved = true;
                }

                if (!containerRef.current) return;
                if (focus.mesh) {
                    containerRef.current.style.cursor = 'pointer';
                    return;
                }

                containerRef.current.style.cursor = hitSlide(e) ? 'pointer' : 'grab';
            };

            const handleClick = (e) => {
                if (!interactive || pointerMoved) return;

                if (focus.mesh) {
                    unfocusSlide();
                    return;
                }

                const mesh = hitSlide(e);
                if (mesh) focusSlide(mesh);
            };

            const handleResize = () => {
                if (!containerRef.current || !renderer) return;

                const resizeWidth = containerRef.current.clientWidth;
                const resizeHeight = containerRef.current.clientHeight;
                if (resizeWidth === 0 || resizeHeight === 0) return;

                camera.aspect = resizeWidth / resizeHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(resizeWidth, resizeHeight);
                columnX = getColumnX();

                if (!focus.mesh) {
                    slides.forEach((slide) => {
                        slide.position.x = columnX;
                    });
                }
            };

            const animate = (time) => {
                animationId = requestAnimationFrame(animate);

                const deltaTime = lastTime ? (time - lastTime) / 1000 : 0.016;
                lastTime = time;

                const prevPos = currentPosition;

                if (!focus.mesh && isScrolling) {
                    targetPosition += autoScrollSpeed;
                    const speedBasedDecay = 0.97 - Math.abs(autoScrollSpeed) * 0.5;
                    autoScrollSpeed *= Math.max(0.92, speedBasedDecay);
                    if (Math.abs(autoScrollSpeed) < 0.001) autoScrollSpeed = 0;
                }

                // También en detalle: al pasar de imagen la columna avanza un hueco al fondo.
                currentPosition += (targetPosition - currentPosition) * settings.smoothing;

                const currentVelocity = Math.abs(currentPosition - prevPos) / deltaTime;
                const scrollDelta = currentPosition - prevPos;
                const scrollDirection = Math.sign(scrollDelta);
                velocityHistory.push(currentVelocity);
                velocityHistory.shift();

                if (Math.abs(scrollDelta) > 0.0003) {
                    currentFoldDirection += (scrollDirection - currentFoldDirection) * 0.15;
                }

                const avgVelocity = velocityHistory.reduce((sum, val) => sum + val, 0) / velocityHistory.length;
                if (avgVelocity > peakVelocity) peakVelocity = avgVelocity;

                const velocityRatio = avgVelocity / (peakVelocity + 0.001);
                const isDecelerating = velocityRatio < 0.7 && peakVelocity > 0.5;
                peakVelocity *= 0.99;

                const movementDistortion = Math.min(1.0, currentVelocity * 0.1);
                if (currentVelocity > 0.05) {
                    targetDistortionFactor = Math.max(targetDistortionFactor, movementDistortion);
                }

                if (isDecelerating || avgVelocity < 0.2) {
                    const decayRate = isDecelerating ? settings.distortionDecay : settings.distortionDecay * 0.9;
                    targetDistortionFactor *= decayRate;
                }

                currentDistortionFactor += (targetDistortionFactor - currentDistortionFactor) * settings.distortionSmoothing;
                currentLagFactor += (currentDistortionFactor - currentLagFactor) * settings.lagLerp;
                const targetTilt = settings.maxTiltAngle * currentDistortionFactor * currentFoldDirection;
                const targetYaw = settings.maxYawAngle * currentDistortionFactor * currentFoldDirection;

                slides.forEach((slide, i) => {
                    let baseY = i * slideUnit - currentPosition;
                    baseY = ((baseY % totalHeight) + totalHeight) % totalHeight;
                    if (baseY > totalHeight / 2) baseY -= totalHeight;

                    const isWrapping = Math.abs(baseY - slide.userData.targetY) > slideHeight * 2;
                    if (isWrapping) slide.userData.currentY = baseY;

                    slide.userData.targetY = baseY;
                    slide.userData.currentY += (slide.userData.targetY - slide.userData.currentY) * settings.slideLerp;

                    // La hoja en foco y la que vuelve succionada tienen su propio vuelo.
                    if (slide === focus.mesh || slide.userData.flying) return;
                    // En foco, gsap posee z y scale; el loop mantiene la columna
                    // y aplica la succión de papel hacia el fondo.
                    if (focus.phase === 'in' || focus.phase === 'out') {
                        slide.position.x = columnX;
                        slide.position.y = slide.userData.currentY;
                        const cloth = slide.userData.cloth;
                        const vacuumLag = cloth.vacuum < cloth.vacuumLag ? 0.16 : 0.055;
                        cloth.vacuumLag += (cloth.vacuum - cloth.vacuumLag) * vacuumLag;
                        const toward = Math.abs(cloth.bulge) < Math.abs(cloth.bulgeLag) ? 0.16 : 0.08;
                        cloth.bulgeLag += (cloth.bulge - cloth.bulgeLag) * toward;
                        updateCurve(slide, 0, 0, 1, {
                            vacuum: cloth.vacuum,
                            vacuumLag: cloth.vacuumLag,
                            bulge: cloth.bulge,
                            bulgeLag: cloth.bulgeLag,
                        });
                        return;
                    }

                    const wrapThreshold = totalHeight / 2 + slideHeight;
                    if (Math.abs(slide.userData.currentY) < wrapThreshold * 1.5) {
                        slide.position.x = columnX;
                        slide.position.y = slide.userData.currentY;
                        slide.position.z = 0;
                        slide.userData.currentTilt += (targetTilt - slide.userData.currentTilt) * settings.tiltLerp;
                        slide.userData.currentYaw += (targetYaw - slide.userData.currentYaw) * settings.tiltLerp;
                        slide.rotation.x = slide.userData.currentTilt;
                        slide.rotation.y = slide.userData.currentYaw;
                        slide.rotation.z = 0;
                        // Fuera de pantalla no se ve la curva: no hace falta recalcularla.
                        if (Math.abs(slide.userData.currentY) < visibleHalfHeight() + slideHeight) {
                            updateCurve(slide, currentDistortionFactor, currentLagFactor, currentFoldDirection);
                        }
                    }
                });

                renderer.render(scene, camera);
            };

            animate();

            containerRef.current.addEventListener('wheel', handleWheel, { passive: false });
            containerRef.current.addEventListener('touchstart', handleTouchStart, { passive: false });
            containerRef.current.addEventListener('touchmove', handleTouchMove, { passive: false });
            containerRef.current.addEventListener('touchend', handleTouchEnd);
            containerRef.current.addEventListener('pointerdown', handlePointerDown);
            containerRef.current.addEventListener('pointermove', handlePointerMove);
            containerRef.current.addEventListener('click', handleClick);
            window.addEventListener('resize', handleResize);

            cleanupRef.current = () => {
                disposed = true;
                if (animationId) cancelAnimationFrame(animationId);
                // Las subidas pendientes se resuelven en vacío (disposed).
                if (uploadFrame) cancelAnimationFrame(uploadFrame);
                uploadQueue.splice(0).forEach((upload) => upload());
                if (focusTimeline) focusTimeline.kill();
                if (swap.outTimeline) swap.outTimeline.kill();
                if (swap.inCall) swap.inCall.kill();
                if (curtainTimeline) curtainTimeline.kill();
                curtainControlsRef.current = null;
                slides.forEach((slide) => {
                    gsap.killTweensOf(slide.material);
                    gsap.killTweensOf(slide.position);
                    gsap.killTweensOf(slide.scale);
                    gsap.killTweensOf(slide.rotation);
                    gsap.killTweensOf(slide.userData.cloth);
                });

                window.removeEventListener('resize', handleResize);

                if (containerRef.current) {
                    containerRef.current.removeEventListener('wheel', handleWheel);
                    containerRef.current.removeEventListener('touchstart', handleTouchStart);
                    containerRef.current.removeEventListener('touchmove', handleTouchMove);
                    containerRef.current.removeEventListener('touchend', handleTouchEnd);
                    containerRef.current.removeEventListener('pointerdown', handlePointerDown);
                    containerRef.current.removeEventListener('pointermove', handlePointerMove);
                    containerRef.current.removeEventListener('click', handleClick);
                }

                slides.forEach((slide) => {
                    if (slide.geometry) slide.geometry.dispose();
                    if (slide.material) slide.material.dispose();
                    scene.remove(slide);
                });
                loadedTextures.forEach((texture) => texture.dispose());

                if (containerRef.current && renderer.domElement && containerRef.current.contains(renderer.domElement)) {
                    containerRef.current.removeChild(renderer.domElement);
                }

                destroyRenderer(renderer);
            };
        };

        const timeoutId = setTimeout(initThree, 100);

        return () => {
            clearTimeout(timeoutId);
            if (cleanupRef.current) cleanupRef.current();
        };
    }, [images, project]);

    return (
        <div
            ref={containerRef}
            className="w-full h-full"
            style={{ cursor: 'grab' }}
        />
    );
}
