'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';

export default function SliderThree4({ images, project, navbarHeight }) {
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

            let animationId = null;
            const slides = [];

            const renderer = new THREE.WebGLRenderer({
                alpha: true,
                antialias: true,
                preserveDrawingBuffer: true,
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

            const createSlide = (index) => {
                const geometry = new THREE.PlaneGeometry(slideWidth, slideHeight, 48, 24);
                const material = new THREE.MeshBasicMaterial({
                    color: new THREE.Color(0xffffff),
                    side: THREE.DoubleSide,
                    transparent: true,
                    opacity: 1,
                    depthWrite: false,
                });

                const mesh = new THREE.Mesh(geometry, material);
                mesh.position.x = columnX;
                mesh.position.y = index * (slideHeight + gap);
                mesh.userData = {
                    originalVertices: [...geometry.attributes.position.array],
                    index,
                    currentTilt: 0,
                    currentYaw: 0,
                    baseScaleX: 1,
                    baseScaleY: 1,
                    cloth: { vacuum: 0, vacuumLag: 0, bulge: 0, bulgeLag: 0 },
                };

                const imageIndex = index % images.length;
                const img = images[imageIndex];
                const imagePath = `${project.imagesPath}/${project.id}${img.id}.png`;

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

                        mesh.userData.baseScaleX = mesh.scale.x;
                        mesh.userData.baseScaleY = mesh.scale.y;
                    },
                    undefined,
                    (err) => console.warn(`Couldn't load image ${imagePath}`, err)
                );

                scene.add(mesh);
                slides.push(mesh);
            };

            for (let i = 0; i < slideCount; i++) createSlide(i);

            slides.forEach((slide) => {
                slide.position.y -= totalHeight / 2;
                slide.userData.targetY = slide.position.y;
                slide.userData.currentY = slide.position.y;
            });

            const smoothstep = (t) => t * t * (3 - 2 * t);
            const bezier2 = (a, b, c, t) => {
                const u = 1 - t;
                return u * u * a + 2 * u * t * b + t * t * c;
            };

            const updateCurve = (mesh, distortionFactor, lagFactor, foldDirection, extras = null) => {
                const positionAttribute = mesh.geometry.attributes.position;
                const originalVertices = mesh.userData.originalVertices;
                const stretch = extras ? Math.max(0, extras.stretch || 0) : 0;
                const stretchLag = extras ? Math.max(0, extras.stretchLag ?? stretch) : stretch;
                const vacuum = extras ? Math.max(0, extras.vacuum || 0) : 0;
                const vacuumLag = extras ? Math.max(0, extras.vacuumLag ?? vacuum) : vacuum;
                const bulge = extras ? extras.bulge || 0 : 0;
                const bulgeLag = extras ? extras.bulgeLag ?? bulge : bulge;

                const slideHalfHeight = slideHeight / 2;
                const slideHalfWidth = slideWidth / 2;

                for (let i = 0; i < positionAttribute.count; i++) {
                    const x = originalVertices[i * 3];
                    const y = originalVertices[i * 3 + 1];

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

                    const fromGrab = THREE.MathUtils.clamp(
                        Math.hypot(nx + 1, ny - 1) / 2.828427,
                        0,
                        1
                    );
                    const localDistortion = THREE.MathUtils.lerp(
                        distortionFactor,
                        lagFactor,
                        fromGrab * 0.82
                    );
                    const intensity = settings.maxDistortion * localDistortion;
                    const tiltAmount = settings.tiltStrength * intensity;
                    const foldAmount = settings.bendStrength * intensity;
                    const grabAmount = settings.grabStrength * intensity;
                    const curlAmount = settings.curlStrength * intensity;
                    const leadAmount = settings.leadStrength * intensity;
                    const tuckAmount = settings.tuckStrength * intensity;

                    const tiltZ = -ny * tiltAmount * (0.62 + 0.38 * leftAmount);
                    const radial = (nx * nx * (0.35 + 0.65 * leftAmount) + ny * ny) * 0.5;
                    const foldShape = smoothstep(radial) * 2 - 1;
                    const foldZ = foldShape * foldAmount * foldDirection;
                    const liftZ = Math.pow(cornerLift, 1.25) * grabAmount * foldDirection;
                    const curlZ = Math.pow(topLeft, 2.35) * curlAmount * foldDirection;
                    const leadY = -foldDirection * topLeft * leadAmount;
                    const tuckX = foldDirection * topLeft * tuckAmount;

                    const localStretch = THREE.MathUtils.lerp(stretch, stretchLag, fromGrab);
                    const centerWeight = Math.pow(
                        Math.max(0, 1 - (nx * nx * 0.55 + ny * ny * 0.45)),
                        1.15
                    );
                    const rubberX =
                        (x + slideHalfWidth) * fromGrab * localStretch * 0.18 +
                        centerWeight * localStretch * slideHalfWidth * 0.32;
                    const rubberY =
                        (y - slideHalfHeight) * fromGrab * localStretch * 0.16 -
                        centerWeight * localStretch * slideHalfHeight * 0.14;
                    const rubberZ = -centerWeight * localStretch * 0.22 * foldDirection;

                    // Aspiradora: el centro se hunde hacia el fondo, los bordes llegan tarde.
                    const radius = Math.min(1, Math.hypot(nx, ny));
                    const cup = Math.pow(Math.max(0, 1 - radius), 1.08);
                    const localVacuum = THREE.MathUtils.lerp(vacuum, vacuumLag, Math.pow(radius, 0.7));
                    const vacuumX = -x * cup * localVacuum * 0.24;
                    const vacuumY = -y * cup * localVacuum * 0.2;
                    const vacuumZ =
                        -cup * localVacuum * 0.78
                        - Math.sin(radius * Math.PI) * localVacuum * 0.16
                        + Math.pow(radius, 2.1) * localVacuum * 0.1;

                    // Detalle: vuelo orgánico. Cuenco suave (coseno), sin aristas:
                    // el centro se eleva y las esquinas ceden atrás, como una hoja en el aire.
                    const rFly = Math.hypot(nx, ny);
                    const bowl = 0.5 + 0.5 * Math.cos((Math.min(rFly, 1.42) / 1.42) * Math.PI);
                    const localBulge = THREE.MathUtils.lerp(
                        bulge,
                        bulgeLag,
                        THREE.MathUtils.clamp(rFly / 1.42, 0, 1)
                    );
                    const sail = (1 - bowl) * localBulge;
                    const bulgeX = -x * sail * 0.03;
                    const bulgeY = -y * sail * 0.022;
                    const bulgeZ = (bowl * 0.4 - (1 - bowl) * 0.34) * localBulge;

                    positionAttribute.setX(i, x + tuckX + rubberX + vacuumX + bulgeX);
                    positionAttribute.setY(i, y + leadY + rubberY + vacuumY + bulgeY);
                    positionAttribute.setZ(i, tiltZ + foldZ + liftZ + curlZ + rubberZ + vacuumZ + bulgeZ);
                }

                positionAttribute.needsUpdate = true;
            };

            const applyFocusPose = (mesh, pose) => {
                const t = pose.t;
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
                    slide.visible = true;
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

            const playPaperFlight = (mesh, { toX, toY, toZ, toSx, toSy, departing, onComplete }) => {
                if (focusTimeline) focusTimeline.kill();

                const fromX = mesh.position.x;
                const fromY = mesh.position.y;
                const fromZ = departing ? Math.max(mesh.position.z, 0.22) : mesh.position.z;
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
                recedeOthers(mesh, false);

                playPaperFlight(mesh, {
                    toX: columnX,
                    toY: mesh.userData.currentY,
                    toZ: 0,
                    toSx: mesh.userData.baseScaleX,
                    toSy: mesh.userData.baseScaleY,
                    departing: false,
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
                    },
                });
            };

            const handleWheel = (e) => {
                e.preventDefault();
                if (focus.mesh) return;

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
                if (focus.mesh) return;

                const touchY = e.touches[0].clientY;
                const deltaY = touchY - touchLastY;
                touchLastY = touchY;
                if (Math.abs(e.touches[0].clientX - pointerDownX) > 8 || Math.abs(deltaY) > 8) {
                    pointerMoved = true;
                }

                const touchStrength = Math.abs(deltaY) * 0.02;
                targetDistortionFactor = Math.min(1.0, targetDistortionFactor + touchStrength);

                targetPosition -= deltaY * settings.touchSensitivity;
                isScrolling = true;
            };

            const handleTouchEnd = (e) => {
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

                if (focus.mesh) return;

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
                if (pointerMoved) return;

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

                if (!focus.mesh) {
                    currentPosition += (targetPosition - currentPosition) * settings.smoothing;
                }

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

                    if (slide === focus.mesh) return;
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
                        updateCurve(slide, currentDistortionFactor, currentLagFactor, currentFoldDirection);
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
                if (animationId) cancelAnimationFrame(animationId);
                if (focusTimeline) focusTimeline.kill();
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
