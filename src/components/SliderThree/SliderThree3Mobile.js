'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import { loadTextureSource, mediaAspect, mediaColor, mediaKey, mediaSrc } from '@/lib/media';
import { createTexture, destroyRenderer } from '@/lib/textures';

const getPerfProfile = (variant, imageCount) => {
    const mash = variant === 'mash' || imageCount > 18;

    return {
        mash,
        segmentsX: mash ? 20 : 28,
        segmentsY: mash ? 10 : 16,
        pixelRatio: mash ? 1.25 : 1.5,
        antialias: false,
        loopCopies: mash ? 1 : 2,
        viewRange: mash ? 5.2 : 6.5,
        loadRange: mash ? 8 : 12,
    };
};

// Las variantes "sm" (lado mayor 640px) ya vienen del tamaño justo para un
// canvas con pixelRatio ≤ 1.5: no hace falta reescalar nada en el móvil.
const TEXTURE_SIZE = 'sm';

const resolveMediaKey = (img, project) => img.key ?? mediaKey(project, img.id);

// Por debajo de esto la escena se considera quieta y se deja de renderizar.
const SETTLE_EPSILON = 1e-4;

// Misma cortina que el grid de escritorio (clip-path de abajo arriba) y que
// la galería de escritorio: aquí vive en el shader porque cada imagen es una
// hoja WebGL. La de llegada (todas las imágenes) espera un poco más; la de
// la galería elegida en el footer arranca en cuanto el slider se monta.
const CURTAIN = {
    duration: 1.1,
    ease: 'expo.out',
    zoomFrom: 1.12,
    stagger: 0.12,
    mashDelay: 0.2,
    detailDelay: 0.12,
    readyAt: 0.6, // fracción a partir de la cual el texto puede entrar, como en desktop
};

export default function SliderThree3Mobile({ images, project, navbarHeight, variant = 'detail', onImagesReady }) {
    const containerRef = useRef(null);
    const rendererRef = useRef(null);
    const cleanupRef = useRef(null);
    const onImagesReadyRef = useRef(onImagesReady);
    onImagesReadyRef.current = onImagesReady;

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

            const perf = getPerfProfile(variant, images.length);
            let animationId = null;
            let disposed = false;
            const slides = [];
            const textureCache = new Map();
            const textureWaiters = new Map();

            // Render bajo demanda: con la escena quieta no se pinta (batería y
            // temperatura del móvil). Cualquier interacción o textura nueva
            // reabre la ventana de render.
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

            renderer.setSize(width, height);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, perf.pixelRatio));
            containerRef.current.appendChild(renderer.domElement);
            rendererRef.current = renderer;

            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
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

            const slideWidth = 2.5;
            const slideHeight = 2.0;
            const gap = 0.15;
            const slideCount = images.length * perf.loopCopies;
            const totalHeight = slideCount * (slideHeight + gap);
            const slideUnit = slideHeight + gap;
            const slideHalfHeight = slideHeight / 2;
            const slideHalfWidth = slideWidth / 2;

            let currentPosition = 0;
            let targetPosition = 0;
            let isScrolling = false;
            let autoScrollSpeed = 0;
            let lastTime = 0;
            let touchStartY = 0;
            let touchLastY = 0;
            let isTabHidden = false;

            let currentDistortionFactor = 0;
            let targetDistortionFactor = 0;
            let currentLagFactor = 0;
            let peakVelocity = 0;
            let velocityHistory = [0, 0, 0, 0, 0];
            let currentFoldDirection = 1;

            const smoothstep = (t) => t * t * (3 - 2 * t);

            const precomputeCurve = (geometry) => {
                const count = geometry.attributes.position.count;
                const curve = {
                    x: new Float32Array(count),
                    y: new Float32Array(count),
                    ny: new Float32Array(count),
                    leftAmount: new Float32Array(count),
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
                        Math.pow(1 - leftAmount, 1.45) *
                        Math.pow(topAmount, 1.15) *
                        settings.rightCornerRatio;
                    const cornerLift = Math.min(1, topLeft + topRight);
                    const radial = (nx * nx * (0.35 + 0.65 * leftAmount) + ny * ny) * 0.5;

                    curve.x[i] = x;
                    curve.y[i] = y;
                    curve.ny[i] = ny;
                    curve.leftAmount[i] = leftAmount;
                    curve.topLeft[i] = topLeft;
                    curve.liftShape[i] = Math.pow(cornerLift, 1.25);
                    curve.curlShape[i] = Math.pow(topLeft, 2.35);
                    curve.fromGrab[i] = THREE.MathUtils.clamp(
                        Math.hypot(nx + 1, ny - 1) / 2.828427,
                        0,
                        1
                    );
                    curve.foldShape[i] = smoothstep(radial) * 2 - 1;
                    curve.tiltBias[i] = 0.62 + 0.38 * leftAmount;
                }

                return curve;
            };

            const fitSlideToAspect = (mesh, imgAspect) => {
                const slideAspect = slideWidth / slideHeight;
                if (imgAspect > slideAspect) {
                    mesh.scale.set(1, slideAspect / imgAspect, 1);
                } else {
                    mesh.scale.set(imgAspect / slideAspect, 1, 1);
                }
            };

            let onSlideTexture = () => {};

            const applyTextureToSlide = (mesh, texture) => {
                mesh.material.map = texture;
                mesh.material.color.set(0xffffff);
                mesh.material.needsUpdate = true;
                mesh.userData.textureReady = true;
                fitSlideToAspect(mesh, texture.image.width / texture.image.height);
                keepRendering();
                onSlideTexture(mesh);
            };

            // Las texturas llegan ya decodificadas (ImageBitmap) desde la caché
            // compartida; la intro ha precargado las primeras.
            const requestTexture = (mesh) => {
                const url = mesh.userData.textureUrl;

                const cached = textureCache.get(url);
                if (cached) {
                    applyTextureToSlide(mesh, cached);
                    return;
                }

                if (textureWaiters.has(url)) {
                    textureWaiters.get(url).push(mesh);
                    return;
                }

                textureWaiters.set(url, [mesh]);

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
                        waiters.forEach((waitingMesh) => applyTextureToSlide(waitingMesh, texture));
                    })
                    .catch((err) => {
                        textureWaiters.delete(url);
                        console.warn(`Couldn't load image ${url}`, err);
                    });
            };

            const createSlide = (index) => {
                const key = resolveMediaKey(images[index % images.length], project);
                const geometry = new THREE.PlaneGeometry(
                    slideWidth,
                    slideHeight,
                    perf.segmentsX,
                    perf.segmentsY
                );
                // Mientras llega la textura: su color dominante y su proporción real.
                // La cortina (uClip.x = borde inferior, uClip.y = superior) arranca
                // tapada: es el clip-path del grid, en el espacio de la hoja.
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
                mesh.position.y = index * (slideHeight + gap);
                mesh.frustumCulled = true;
                fitSlideToAspect(mesh, 1 / mediaAspect(key));
                mesh.userData = {
                    originalVertices: geometry.attributes.position.array.slice(),
                    curve: precomputeCurve(geometry),
                    index,
                    currentTilt: 0,
                    currentYaw: 0,
                    isFlat: true,
                    textureRequested: false,
                    textureReady: false,
                    textureUrl: mediaSrc(key, TEXTURE_SIZE),
                    intro: false,
                    reveal: false,
                    curtain,
                };

                scene.add(mesh);
                slides.push(mesh);
            };

            for (let i = 0; i < slideCount; i++) createSlide(i);

            // La misma posición envuelta que usa el bucle de animación: si no,
            // la cortina cae en hojas que el carrusel saca de pantalla y las
            // que se ven entran ya descubiertas.
            slides.forEach((slide, i) => {
                let baseY = i * slideUnit;
                baseY = ((baseY % totalHeight) + totalHeight) % totalHeight;
                if (baseY > totalHeight / 2) baseY -= totalHeight;
                slide.position.y = baseY;
                slide.userData.targetY = baseY;
                slide.userData.currentY = baseY;
            });

            // Solo las hojas visibles al montar hacen la cortina (de arriba
            // abajo). El resto queda ya descubierto: al hacer scroll entran enteras.
            const introSlides = slides
                .filter((slide) => Math.abs(slide.userData.currentY) < perf.viewRange)
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
                const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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
                    curtainTimeline.to(
                        curtain.uClip.value,
                        { y: 1, duration: CURTAIN.duration, ease: CURTAIN.ease },
                        at
                    );
                    curtainTimeline.to(
                        curtain.uZoom,
                        { value: 1, duration: CURTAIN.duration, ease: CURTAIN.ease },
                        at
                    );
                });

                const readyCount = introSlides.filter((slide) => slide.userData.textureReady).length;
                const lastAt = Math.max(0, readyCount - 1) * CURTAIN.stagger;
                curtainTimeline.call(
                    () => onImagesReadyRef.current?.(),
                    null,
                    reduceMotion ? 0 : lastAt + CURTAIN.duration * CURTAIN.readyAt
                );

                const span =
                    delay +
                    Math.max(0, introSlides.length - 1) * CURTAIN.stagger +
                    CURTAIN.duration +
                    0.3;
                keepRendering(span * 1000);
            };

            const startReveal = () => {
                if (curtainPlayed || disposed) return;
                curtainPlayed = true;
                clearTimeout(curtainFailSafe);
                // Visibles pero tapadas, para que compileAsync coja el shader
                // con la textura. El clip sigue cerrado hasta playCurtain.
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

            onSlideTexture = (mesh) => {
                if (!mesh.userData.intro || mesh.userData.introCounted) return;
                mesh.userData.introCounted = true;
                introReady += 1;
                if (!curtainPlayed && introReady >= introSlides.length) startReveal();
                else if (curtainPlayed) {
                    const ref = introSlides.find((slide) => slide.userData.reveal)?.userData.curtain;
                    if (ref) {
                        mesh.userData.curtain.uClip.value.copy(ref.uClip.value);
                        mesh.userData.curtain.uZoom.value = ref.uZoom.value;
                    } else {
                        mesh.userData.curtain.uClip.value.set(0, 1);
                        mesh.userData.curtain.uZoom.value = 1;
                    }
                    mesh.userData.reveal = true;
                    keepRendering();
                }
            };

            introSlides.forEach((slide) => {
                slide.userData.textureRequested = true;
                requestTexture(slide);
            });

            const updateCurve = (mesh, distortionFactor, lagFactor, foldDirection) => {
                const positionAttribute = mesh.geometry.attributes.position;
                const curve = mesh.userData.curve;
                const count = positionAttribute.count;

                if (distortionFactor < 0.001 && lagFactor < 0.001) {
                    if (!mesh.userData.isFlat) {
                        positionAttribute.array.set(mesh.userData.originalVertices);
                        positionAttribute.needsUpdate = true;
                        mesh.userData.isFlat = true;
                    }
                    return;
                }

                mesh.userData.isFlat = false;

                for (let i = 0; i < count; i++) {
                    const fromGrab = curve.fromGrab[i];
                    const localDistortion =
                        distortionFactor + (lagFactor - distortionFactor) * (fromGrab * 0.82);
                    const intensity = settings.maxDistortion * localDistortion;
                    const tiltAmount = settings.tiltStrength * intensity;
                    const foldAmount = settings.bendStrength * intensity;
                    const grabAmount = settings.grabStrength * intensity;
                    const curlAmount = settings.curlStrength * intensity;
                    const leadAmount = settings.leadStrength * intensity;
                    const tuckAmount = settings.tuckStrength * intensity;

                    const tiltZ = -curve.ny[i] * tiltAmount * curve.tiltBias[i];
                    const foldZ = curve.foldShape[i] * foldAmount * foldDirection;
                    const liftZ = curve.liftShape[i] * grabAmount * foldDirection;
                    const curlZ = curve.curlShape[i] * curlAmount * foldDirection;
                    const leadY = -foldDirection * curve.topLeft[i] * leadAmount;
                    const tuckX = foldDirection * curve.topLeft[i] * tuckAmount;

                    positionAttribute.setX(i, curve.x[i] + tuckX);
                    positionAttribute.setY(i, curve.y[i] + leadY);
                    positionAttribute.setZ(i, tiltZ + foldZ + liftZ + curlZ);
                }

                positionAttribute.needsUpdate = true;
            };

            const handleWheel = (e) => {
                e.preventDefault();
                keepRendering();
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
            };

            const handleTouchMove = (e) => {
                e.preventDefault();
                keepRendering();
                const touchY = e.touches[0].clientY;
                const deltaY = touchY - touchLastY;
                touchLastY = touchY;

                const touchStrength = Math.abs(deltaY) * 0.02;
                targetDistortionFactor = Math.min(1.0, targetDistortionFactor + touchStrength);

                targetPosition -= deltaY * settings.touchSensitivity;
                isScrolling = true;
            };

            const handleTouchEnd = () => {
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

            const handleResize = () => {
                if (!containerRef.current || !renderer) return;

                const resizeWidth = containerRef.current.clientWidth;
                const resizeHeight = containerRef.current.clientHeight;
                if (resizeWidth === 0 || resizeHeight === 0) return;

                camera.aspect = resizeWidth / resizeHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(resizeWidth, resizeHeight);
                keepRendering();
            };

            const animate = (time) => {
                if (isTabHidden) {
                    animationId = null;
                    return;
                }

                animationId = requestAnimationFrame(animate);

                const deltaTime = lastTime ? (time - lastTime) / 1000 : 0.016;
                lastTime = time;

                const prevPos = currentPosition;

                if (isScrolling) {
                    targetPosition += autoScrollSpeed;
                    const speedBasedDecay = 0.97 - Math.abs(autoScrollSpeed) * 0.5;
                    autoScrollSpeed *= Math.max(0.92, speedBasedDecay);
                    if (Math.abs(autoScrollSpeed) < 0.001) autoScrollSpeed = 0;
                }

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

                let sceneMoving =
                    isScrolling ||
                    Math.abs(targetPosition - currentPosition) > SETTLE_EPSILON ||
                    currentDistortionFactor > SETTLE_EPSILON ||
                    currentLagFactor > SETTLE_EPSILON;

                slides.forEach((slide, i) => {
                    let baseY = i * slideUnit - currentPosition;
                    baseY = ((baseY % totalHeight) + totalHeight) % totalHeight;
                    if (baseY > totalHeight / 2) baseY -= totalHeight;

                    const isWrapping = Math.abs(baseY - slide.userData.targetY) > slideHeight * 2;
                    if (isWrapping) slide.userData.currentY = baseY;

                    slide.userData.targetY = baseY;
                    slide.userData.currentY += (slide.userData.targetY - slide.userData.currentY) * settings.slideLerp;
                    slide.position.y = slide.userData.currentY;

                    const absY = Math.abs(slide.userData.currentY);
                    const inView = absY < perf.viewRange;
                    // Las de la cortina no se pintan hasta que su textura está
                    // y el reveal ha empezado: si no, se vería el plano de color.
                    slide.visible = inView && (!slide.userData.intro || slide.userData.reveal);

                    if (!slide.userData.textureRequested && absY < perf.loadRange) {
                        slide.userData.textureRequested = true;
                        requestTexture(slide);
                    }

                    if (!slide.visible) return;

                    if (
                        Math.abs(slide.userData.targetY - slide.userData.currentY) > SETTLE_EPSILON ||
                        Math.abs(targetTilt - slide.userData.currentTilt) > SETTLE_EPSILON ||
                        Math.abs(targetYaw - slide.userData.currentYaw) > SETTLE_EPSILON
                    ) {
                        sceneMoving = true;
                    }

                    slide.userData.currentTilt += (targetTilt - slide.userData.currentTilt) * settings.tiltLerp;
                    slide.userData.currentYaw += (targetYaw - slide.userData.currentYaw) * settings.tiltLerp;
                    slide.rotation.x = slide.userData.currentTilt;
                    slide.rotation.y = slide.userData.currentYaw;
                    updateCurve(slide, currentDistortionFactor, currentLagFactor, currentFoldDirection);
                });

                if (sceneMoving || performance.now() < renderUntil) {
                    renderer.render(scene, camera);
                }
            };

            const handleVisibility = () => {
                isTabHidden = document.hidden;
                if (!isTabHidden && !animationId) {
                    keepRendering();
                    animate();
                }
            };

            animate();

            containerRef.current.addEventListener('wheel', handleWheel, { passive: false });
            containerRef.current.addEventListener('touchstart', handleTouchStart, { passive: false });
            containerRef.current.addEventListener('touchmove', handleTouchMove, { passive: false });
            containerRef.current.addEventListener('touchend', handleTouchEnd);
            window.addEventListener('resize', handleResize);
            document.addEventListener('visibilitychange', handleVisibility);

            cleanupRef.current = () => {
                disposed = true;
                clearTimeout(curtainFailSafe);
                if (curtainTimeline) curtainTimeline.kill();
                if (animationId) cancelAnimationFrame(animationId);

                window.removeEventListener('resize', handleResize);
                document.removeEventListener('visibilitychange', handleVisibility);

                if (containerRef.current) {
                    containerRef.current.removeEventListener('wheel', handleWheel);
                    containerRef.current.removeEventListener('touchstart', handleTouchStart);
                    containerRef.current.removeEventListener('touchmove', handleTouchMove);
                    containerRef.current.removeEventListener('touchend', handleTouchEnd);
                }

                slides.forEach((slide) => {
                    if (slide.geometry) slide.geometry.dispose();
                    if (slide.material) slide.material.dispose();
                    scene.remove(slide);
                });

                textureCache.forEach((texture) => texture.dispose());
                textureCache.clear();
                textureWaiters.clear();

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
    }, [images, project, variant]);

    return (
        <div
            ref={containerRef}
            className="w-full h-full"
            style={{ cursor: 'grab' }}
        />
    );
}
