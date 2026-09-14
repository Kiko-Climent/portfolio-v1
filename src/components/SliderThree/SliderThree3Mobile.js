'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { getOptimizedImageUrl } from '@/lib/optimizedImage';

const getPerfProfile = (variant, imageCount) => {
    const mash = variant === 'mash' || imageCount > 18;

    return {
        mash,
        segmentsX: mash ? 20 : 28,
        segmentsY: mash ? 10 : 16,
        textureWidth: mash ? 640 : 1080,
        textureMaxSize: mash ? 640 : 1080,
        quality: mash ? 50 : 75,
        pixelRatio: mash ? 1.25 : 1.5,
        antialias: false,
        loopCopies: mash ? 1 : 2,
        viewRange: mash ? 5.2 : 6.5,
        loadRange: mash ? 8 : 12,
    };
};

const downsampleTexture = (texture, maxSize) => {
    const image = texture.image;
    if (!image || !image.width || !image.height) return texture;

    const largest = Math.max(image.width, image.height);
    if (largest <= maxSize) return texture;

    const scale = maxSize / largest;
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.drawImage(image, 0, 0, width, height);
    texture.image = canvas;
    texture.needsUpdate = true;
    return texture;
};

const resolveImagePath = (img, project) => {
    if (img.src) return img.src;
    if (project.id === 'about' && img.id === 1) return `${project.imagesPath}/about.png`;
    return `${project.imagesPath}/${project.id}${img.id}.png`;
};

export default function SliderThree3Mobile({ images, project, navbarHeight, variant = 'detail' }) {
    const containerRef = useRef(null);
    const rendererRef = useRef(null);
    const cleanupRef = useRef(null);

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
            const slides = [];
            const textureCache = new Map();
            const textureWaiters = new Map();
            const loader = new THREE.TextureLoader();

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

            const applyTextureToSlide = (mesh, texture) => {
                mesh.material.map = texture;
                mesh.material.needsUpdate = true;

                const imgAspect = texture.image.width / texture.image.height;
                const slideAspect = slideWidth / slideHeight;
                if (imgAspect > slideAspect) {
                    mesh.scale.set(1, slideAspect / imgAspect, 1);
                } else {
                    mesh.scale.set(imgAspect / slideAspect, 1, 1);
                }
            };

            const requestTexture = (mesh) => {
                const originalPath = mesh.userData.imagePath;
                const optimizedPath = getOptimizedImageUrl(originalPath, {
                    width: perf.textureWidth,
                    quality: perf.quality,
                });

                const cached = textureCache.get(originalPath);
                if (cached) {
                    applyTextureToSlide(mesh, cached);
                    return;
                }

                if (textureWaiters.has(originalPath)) {
                    textureWaiters.get(originalPath).push(mesh);
                    return;
                }

                textureWaiters.set(originalPath, [mesh]);

                const onReady = (texture) => {
                    downsampleTexture(texture, perf.textureMaxSize);
                    texture.colorSpace = THREE.SRGBColorSpace;
                    texture.anisotropy = 1;
                    texture.generateMipmaps = false;
                    texture.minFilter = THREE.LinearFilter;
                    texture.magFilter = THREE.LinearFilter;
                    textureCache.set(originalPath, texture);

                    const waiters = textureWaiters.get(originalPath) || [];
                    textureWaiters.delete(originalPath);
                    waiters.forEach((waitingMesh) => applyTextureToSlide(waitingMesh, texture));
                };

                loader.load(optimizedPath, onReady, undefined, () => {
                    loader.load(originalPath, onReady, undefined, (err) => {
                        textureWaiters.delete(originalPath);
                        console.warn(`Couldn't load image ${originalPath}`, err);
                    });
                });
            };

            const createSlide = (index) => {
                const geometry = new THREE.PlaneGeometry(
                    slideWidth,
                    slideHeight,
                    perf.segmentsX,
                    perf.segmentsY
                );
                const material = new THREE.MeshBasicMaterial({
                    color: new THREE.Color(0xffffff),
                    side: THREE.DoubleSide,
                });

                const mesh = new THREE.Mesh(geometry, material);
                mesh.position.y = index * (slideHeight + gap);
                mesh.frustumCulled = true;
                mesh.userData = {
                    originalVertices: geometry.attributes.position.array.slice(),
                    curve: precomputeCurve(geometry),
                    index,
                    currentTilt: 0,
                    currentYaw: 0,
                    isFlat: true,
                    textureRequested: false,
                    imagePath: resolveImagePath(images[index % images.length], project),
                };

                scene.add(mesh);
                slides.push(mesh);
            };

            for (let i = 0; i < slideCount; i++) createSlide(i);

            slides.forEach((slide) => {
                slide.position.y -= totalHeight / 2;
                slide.userData.targetY = slide.position.y;
                slide.userData.currentY = slide.position.y;
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
                    const visible = absY < perf.viewRange;
                    slide.visible = visible;

                    if (!slide.userData.textureRequested && absY < perf.loadRange) {
                        slide.userData.textureRequested = true;
                        requestTexture(slide);
                    }

                    if (!visible) return;

                    slide.userData.currentTilt += (targetTilt - slide.userData.currentTilt) * settings.tiltLerp;
                    slide.userData.currentYaw += (targetYaw - slide.userData.currentYaw) * settings.tiltLerp;
                    slide.rotation.x = slide.userData.currentTilt;
                    slide.rotation.y = slide.userData.currentYaw;
                    updateCurve(slide, currentDistortionFactor, currentLagFactor, currentFoldDirection);
                });

                renderer.render(scene, camera);
            };

            const handleVisibility = () => {
                isTabHidden = document.hidden;
                if (!isTabHidden && !animationId) animate();
            };

            animate();

            containerRef.current.addEventListener('wheel', handleWheel, { passive: false });
            containerRef.current.addEventListener('touchstart', handleTouchStart, { passive: false });
            containerRef.current.addEventListener('touchmove', handleTouchMove, { passive: false });
            containerRef.current.addEventListener('touchend', handleTouchEnd);
            window.addEventListener('resize', handleResize);
            document.addEventListener('visibilitychange', handleVisibility);

            cleanupRef.current = () => {
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

                renderer.dispose();
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
