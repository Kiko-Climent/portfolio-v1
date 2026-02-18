'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function SliderThree2Mobile({ images, project, navbarHeight }) {
    const containerRef = useRef(null);
    const rendererRef = useRef(null);
    const cleanupRef = useRef(null);

    useEffect(() => {
        if (!containerRef.current || !images.length) return;

        // Esperar a que el contenedor tenga dimensiones
        const initThree = () => {
            if (!containerRef.current) return;

            const width = containerRef.current.clientWidth;
            const height = containerRef.current.clientHeight;

            // Si no tiene dimensiones, reintentar después de un pequeño delay
            if (width === 0 || height === 0) {
                setTimeout(initThree, 50);
                return;
            }

            let animationId = null;
            const slides = [];

            // Renderer
            const renderer = new THREE.WebGLRenderer({
                alpha: true,
                antialias: true,
                preserveDrawingBuffer: true,
            });

            renderer.setSize(width, height);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            containerRef.current.appendChild(renderer.domElement);
            rendererRef.current = renderer;

            // Scene & Camera
            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(
                45,
                width / height,
                0.1,
                100
            );
            camera.position.z = 7;

            // Settings
            const settings = {
                wheelSensitivity: 0.01,
                touchSensitivity: 0.01,
                momentumMultiplier: 2,
                smoothing: 0.1,
                slideLerp: 0.075,
                distortionDecay: 0.95,
                maxDistortion: 0.35,
                distortionSensitivity: 0.1,
                distortionSmoothing: 0.06,
                tiltStrength: 0.42,
                bendStrength: 0.08,
                maxTiltAngle: THREE.MathUtils.degToRad(65),
                tiltLerp: 0.12,
            };

            // Slide dimensions (móvil)
            const slideWidth = 2.5;
            const slideHeight = 2.0;
            const gap = 0.15;
            const slideCount = images.length * 2; // Duplicamos para loop infinito
            const totalHeight = slideCount * (slideHeight + gap);
            const slideUnit = slideHeight + gap;

            // Scroll state
            let currentPosition = 0;
            let targetPosition = 0;
            let isScrolling = false;
            let autoScrollSpeed = 0;
            let lastTime = 0;
            let touchStartY = 0;
            let touchLastY = 0;

            // Distortion state
            let currentDistortionFactor = 0;
            let targetDistortionFactor = 0;
            let peakVelocity = 0;
            let velocityHistory = [0, 0, 0, 0, 0];

            // Color correction
            const correctImageColor = (texture) => {
                texture.colorSpace = THREE.SRGBColorSpace;
                return texture;
            };

            // Create slide
            const createSlide = (index) => {
                const geometry = new THREE.PlaneGeometry(slideWidth, slideHeight, 32, 16);
                const material = new THREE.MeshBasicMaterial({
                    color: new THREE.Color(0xffffff),
                    side: THREE.DoubleSide,
                });

                const mesh = new THREE.Mesh(geometry, material);
                mesh.position.y = index * (slideHeight + gap);
                mesh.userData = {
                    originalVertices: [...geometry.attributes.position.array],
                    index,
                    currentTilt: 0,
                };

                // Cargar imagen
                const imageIndex = index % images.length;
                const img = images[imageIndex];
                const imagePath = img.src
                    ? img.src
                    : (project.id === 'about' && img.id === 1)
                        ? `${project.imagesPath}/about.png`
                        : `${project.imagesPath}/${project.id}${img.id}.png`;

                new THREE.TextureLoader().load(
                    imagePath,
                    (texture) => {
                        correctImageColor(texture);
                        material.map = texture;
                        material.needsUpdate = true;

                        const imgAspect = texture.image.width / texture.image.height;
                        const slideAspect = slideWidth / slideHeight;

                        if (imgAspect > slideAspect) {
                            mesh.scale.y = slideAspect / imgAspect;
                        } else {
                            mesh.scale.x = imgAspect / slideAspect;
                        }
                    },
                    undefined,
                    (err) => console.warn(`Couldn't load image ${imagePath}`, err)
                );

                scene.add(mesh);
                slides.push(mesh);
            };

            // Create all slides
            for (let i = 0; i < slideCount; i++) createSlide(i);

            // Position slides
            slides.forEach((slide) => {
                slide.position.y -= totalHeight / 2;
                slide.userData.targetY = slide.position.y;
                slide.userData.currentY = slide.position.y;
            });

            // Update curve distortion
            const updateCurve = (mesh, _worldPositionY, distortionFactor) => {
                const positionAttribute = mesh.geometry.attributes.position;
                const originalVertices = mesh.userData.originalVertices;

                const slideHalfHeight = slideHeight / 2;
                const distortionIntensity = settings.maxDistortion * distortionFactor;
                const tiltAmount = settings.tiltStrength * distortionIntensity;
                const bendAmount = settings.bendStrength * distortionIntensity;

                for (let i = 0; i < positionAttribute.count; i++) {
                    const y = originalVertices[i * 3 + 1];

                    // Distancia relativa al centro de la slide (-1 a 1)
                    const relativeY = y / slideHalfHeight;
                    const normalizedY = THREE.MathUtils.clamp(relativeY, -1, 1);

                    // "Medio volteo" suave: inclinación vertical con una curvatura mínima
                    // para evitar el efecto de ola y que la parte inferior crezca demasiado.
                    const tiltZ = -normalizedY * tiltAmount;
                    const bendZ = -(1 - normalizedY * normalizedY) * bendAmount;
                    const curveZ = tiltZ + bendZ;

                    positionAttribute.setZ(i, curveZ);
                }

                positionAttribute.needsUpdate = true;
                mesh.geometry.computeVertexNormals();
            };

            // Event handlers
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

            // Animation loop
            const animate = (time) => {
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
                const targetTilt = settings.maxTiltAngle * currentDistortionFactor * scrollDirection;

                slides.forEach((slide, i) => {
                    let baseY = i * slideUnit - currentPosition;
                    baseY = ((baseY % totalHeight) + totalHeight) % totalHeight;
                    if (baseY > totalHeight / 2) baseY -= totalHeight;

                    const isWrapping = Math.abs(baseY - slide.userData.targetY) > slideHeight * 2;
                    if (isWrapping) slide.userData.currentY = baseY;

                    slide.userData.targetY = baseY;
                    slide.userData.currentY += (slide.userData.targetY - slide.userData.currentY) * settings.slideLerp;

                    const wrapThreshold = totalHeight / 2 + slideHeight;
                    if (Math.abs(slide.userData.currentY) < wrapThreshold * 1.5) {
                        slide.position.y = slide.userData.currentY;
                        slide.userData.currentTilt += (targetTilt - slide.userData.currentTilt) * settings.tiltLerp;
                        slide.rotation.x = slide.userData.currentTilt;
                        updateCurve(slide, slide.position.y, currentDistortionFactor);
                    }
                });

                renderer.render(scene, camera);
            };

            // Start animation
            animate();

            // Event listeners
            containerRef.current.addEventListener('wheel', handleWheel, { passive: false });
            containerRef.current.addEventListener('touchstart', handleTouchStart, { passive: false });
            containerRef.current.addEventListener('touchmove', handleTouchMove, { passive: false });
            containerRef.current.addEventListener('touchend', handleTouchEnd);
            window.addEventListener('resize', handleResize);

            // Cleanup function
            cleanupRef.current = () => {
                if (animationId) cancelAnimationFrame(animationId);

                window.removeEventListener('resize', handleResize);

                if (containerRef.current) {
                    containerRef.current.removeEventListener('wheel', handleWheel);
                    containerRef.current.removeEventListener('touchstart', handleTouchStart);
                    containerRef.current.removeEventListener('touchmove', handleTouchMove);
                    containerRef.current.removeEventListener('touchend', handleTouchEnd);
                }

                slides.forEach((slide) => {
                    if (slide.geometry) slide.geometry.dispose();
                    if (slide.material) {
                        if (slide.material.map) slide.material.map.dispose();
                        slide.material.dispose();
                    }
                    scene.remove(slide);
                });

                if (containerRef.current && renderer.domElement && containerRef.current.contains(renderer.domElement)) {
                    containerRef.current.removeChild(renderer.domElement);
                }

                renderer.dispose();
            };
        };

        // Iniciar después de un pequeño delay para asegurar que el DOM esté listo
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
