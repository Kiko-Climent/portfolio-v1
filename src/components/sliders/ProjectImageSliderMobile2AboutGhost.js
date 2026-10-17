'use client';

/**
 * [Copia con el About v4 (foto fantasma detrás de la bio, se descubre al tocarla). Guardada por si se vuelve a él.]
 * Detalle móvil v2.
 *   Proyecto: SliderThree4Mobile solo con sus imágenes (mismo papel y misma
 *   cortina que la v1) + la hoja Info (InfoSheetMobile), que abre el footer.
 *   El nombre del proyecto y el contador viven ahora en el navbar
 *   (NavbarLoaderMobNew2); aquí ya no hay bloque de texto abajo.
 *   About (v4, "foto fantasma"): el contacto va en el navbar; debajo la bio en
 *   párrafos a tamaño texto (el último en gris) y "Services" a display (el
 *   mismo tamaño que en escritorio). La foto ya no ocupa sitio: va detrás de
 *   la bio, en las columnas 2–3, casi transparente (ABOUT_GHOST), sin caption.
 *   Entrada: la foto entra entera con la cortina de las imágenes y, a la vez,
 *   el contacto del navbar (onAboutIntro); luego baja a fantasma y entran
 *   encima la bio y los servicios por líneas con máscara.
 *   Al tocarla, aparece de golpe por encima del texto (sin fundido ni
 *   cortina); al tocar otra vez, vuelve a fantasma.
 *   Versiones anteriores: foto en columnas 3–4 encima de la bio
 *   (ProjectImageSliderMobile2AboutPhoto.js) y foto + un solo texto abajo
 *   (ProjectImageSliderMobile2AboutText.js).
 * Versión anterior: ProjectImageSliderMobile.js.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { useDarkMode } from '@/contexts/DarkModeContext';
import SliderThree4Mobile from '@/components/SliderThree/SliderThree4Mobile';
// Info v1 (frase + role/year/stack): InfoSheetMobile.
// import InfoSheetMobile from '@/components/mobile/InfoSheetMobile';
import InfoSheetMobile from '@/components/mobile/InfoSheetMobile2';
import { MOBILE_GRID, colLeftPx, colsWidthPx, mobileAnchorPx } from '@/lib/mobileGrid';
import { mediaAspect, mediaKey, mediaSrc } from '@/lib/media';
import { indexHandoff } from '@/lib/indexHandoff';

gsap.registerPlugin(SplitText);

// Mismo reveal por líneas que la v1 / el bloque de info de escritorio.
const INFO_ANIM = {
    cushion: '0.2em',
    fromYPercent: 130,
    duration: 0.9,
    ease: 'power4.out',
    stagger: 0.09,
    delay: 0.12,
    out: { yPercent: -130, duration: 0.5, ease: 'power3.in', stagger: 0.05 },
};
// Cortina de la foto del About: la misma de las imágenes (clip-path de abajo arriba).
const PHOTO_CURTAIN = { duration: 1.1, ease: 'expo.out', zoomFrom: 1.12, outDuration: 0.5, outEase: 'power3.in' };

// Display: el de los servicios del About de escritorio (SERVICES_TYPE en
// components/about/*) y del índice. Interlineado y tracking, los mismos.
const SERVICES_TYPE = 'clamp(1.75rem, 3.05vw, 3.5rem)';
const SERVICES_LEADING = 0.94;
const SERVICES_TRACKING = '-0.035em';
// La foto no pasa de esto (va detrás de la bio, no debe comérsela entera).
const ABOUT_PHOTO_MAX_H = 220;
// Foto fantasma: opacidad en reposo y orden de la entrada (segundos desde que
// empieza la cortina). Primero la foto entera, luego baja y entran las líneas.
const ABOUT_GHOST = { opacity: 0.08, fadeAt: 1.1, fadeDuration: 0.6, fadeEase: 'power2.inOut', linesAt: 1.6 };

export default function ProjectImageSliderMobile2({ project, shouldHide = false, infoOpen = false, onInfoClose, onAboutIntro }) {
    const { isDarkMode } = useDarkMode();
    const isAbout = project?.id === 'about';
    const images = project?.slider?.images ?? [];
    const text = project?.slider?.text;

    const [anchorPx] = useState(() => mobileAnchorPx());
    // Relevo desde el Index: arranca en la portada y deja su hoja al póster.
    const [handoffImageId] = useState(() => (project?.id ? indexHandoff.armedImage(project.id) : null));
    const [viewportWidth] = useState(() => (typeof window === 'undefined' ? 390 : window.innerWidth));

    const textRef = useRef(null);
    const servicesRef = useRef(null);
    const photoRef = useRef(null);
    const splitRef = useRef(null);
    // Foto descubierta (encima del texto). Solo se puede tocar al acabar la entrada.
    const [photoOpen, setPhotoOpen] = useState(false);
    const photoOpenRef = useRef(false);
    const introDoneRef = useRef(false);
    const onAboutIntroRef = useRef(onAboutIntro);
    useEffect(() => {
        onAboutIntroRef.current = onAboutIntro;
    }, [onAboutIntro]);

    const ink = isDarkMode ? 'white' : 'black';
    const muted = isDarkMode ? '#9ca3af' : '#6b7280';

    // ── About: entrada (foto entera + contacto → fantasma → líneas) ─────
    useEffect(() => {
        if (!isAbout || !textRef.current) return undefined;
        let split;
        let tl;
        introDoneRef.current = false;
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const timer = setTimeout(() => {
            if (!textRef.current) return;
            const targets = [
                ...textRef.current.querySelectorAll('[data-split]'),
                ...(servicesRef.current ? servicesRef.current.querySelectorAll('[data-split]') : []),
            ];
            split = new SplitText(targets, { type: 'lines', mask: 'lines', linesClass: 'info-line' });
            splitRef.current = split;
            split.lines.forEach((line) => {
                const wrap = line.parentElement;
                if (!wrap) return;
                // La máscara tiene que recortar: si no, las líneas suben todas
                // juntas y se ve el bloque entero desplazándose.
                wrap.style.overflow = 'clip';
                wrap.style.paddingBottom = INFO_ANIM.cushion;
                wrap.style.marginBottom = `-${INFO_ANIM.cushion}`;
            });
            textRef.current.style.visibility = 'visible';
            if (servicesRef.current) servicesRef.current.style.visibility = 'visible';
            const photo = photoRef.current;
            // El contacto del navbar entra a la vez que la cortina de la foto.
            onAboutIntroRef.current?.(true);
            if (reduceMotion) {
                gsap.set(split.lines, { yPercent: 0 });
                if (photo) gsap.set(photo, { clipPath: 'inset(0% 0% 0% 0%)', opacity: ABOUT_GHOST.opacity });
                introDoneRef.current = true;
                return;
            }
            tl = gsap.timeline({
                onComplete: () => {
                    introDoneRef.current = true;
                },
            });
            if (photo) {
                const img = photo.querySelector('img');
                tl.fromTo(
                    photo,
                    { clipPath: 'inset(100% 0% 0% 0%)', opacity: 1 },
                    { clipPath: 'inset(0% 0% 0% 0%)', duration: PHOTO_CURTAIN.duration, ease: PHOTO_CURTAIN.ease },
                    0
                );
                if (img) {
                    tl.fromTo(
                        img,
                        { scale: PHOTO_CURTAIN.zoomFrom, transformOrigin: '50% 100%' },
                        { scale: 1, duration: PHOTO_CURTAIN.duration, ease: PHOTO_CURTAIN.ease },
                        0
                    );
                }
                tl.to(
                    photo,
                    { opacity: ABOUT_GHOST.opacity, duration: ABOUT_GHOST.fadeDuration, ease: ABOUT_GHOST.fadeEase },
                    ABOUT_GHOST.fadeAt
                );
                // Ya fantasma: se puede tocar aunque las líneas sigan entrando.
                tl.call(
                    () => {
                        introDoneRef.current = true;
                    },
                    null,
                    ABOUT_GHOST.fadeAt + ABOUT_GHOST.fadeDuration
                );
            }
            tl.fromTo(
                split.lines,
                { yPercent: INFO_ANIM.fromYPercent },
                {
                    yPercent: 0,
                    duration: INFO_ANIM.duration,
                    ease: INFO_ANIM.ease,
                    stagger: INFO_ANIM.stagger,
                    force3D: true,
                },
                photo ? ABOUT_GHOST.linesAt : INFO_ANIM.delay
            );
        }, 60);
        return () => {
            clearTimeout(timer);
            tl?.kill();
            if (split?.revert) split.revert();
            splitRef.current = null;
            onAboutIntroRef.current?.(false);
        };
    }, [isAbout, project?.id]);

    // ── About: foto descubierta (de golpe, sin animación) ──────────────
    const setPhoto = useCallback((open) => {
        photoOpenRef.current = open;
        setPhotoOpen(open);
        if (photoRef.current) gsap.set(photoRef.current, { opacity: open ? 1 : ABOUT_GHOST.opacity });
    }, []);

    // Toque sobre la bio: el texto va encima de la foto, así que se mira si el
    // dedo cae dentro de ella (y la columna sigue pudiendo hacer scroll).
    const handleAboutTap = useCallback(
        (event) => {
            const photo = photoRef.current;
            if (!photo || !introDoneRef.current || photoOpenRef.current) return;
            const rect = photo.getBoundingClientRect();
            const inside =
                event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
            if (inside) setPhoto(true);
        },
        [setPhoto]
    );

    // El botón de la foto: con teclado, o encima del texto cuando está descubierta.
    const handlePhotoButton = useCallback(
        (event) => {
            event.stopPropagation();
            if (!introDoneRef.current) return;
            setPhoto(!photoOpenRef.current);
        },
        [setPhoto]
    );

    // ── About: salida al volver (el footer espera a __mobileInfoHidden) ──
    useEffect(() => {
        if (!isAbout || !shouldHide) return;
        const lines = splitRef.current?.lines;
        const done = () => {
            if (textRef.current) textRef.current.style.visibility = 'hidden';
            if (servicesRef.current) servicesRef.current.style.visibility = 'hidden';
            window.__mobileInfoHidden?.();
        };
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (!lines || reduceMotion) {
            done();
            return;
        }
        gsap.killTweensOf(lines);
        introDoneRef.current = false;
        const stagger = Math.min(INFO_ANIM.out.stagger, 0.35 / Math.max(lines.length - 1, 1));
        if (photoRef.current) {
            // Si sale a media entrada, que la bajada a fantasma no siga sola.
            gsap.killTweensOf(photoRef.current);
            gsap.to(photoRef.current, {
                clipPath: 'inset(0% 0% 100% 0%)',
                duration: PHOTO_CURTAIN.outDuration,
                ease: PHOTO_CURTAIN.outEase,
            });
        }
        gsap.to(lines, {
            yPercent: INFO_ANIM.out.yPercent,
            duration: INFO_ANIM.out.duration,
            ease: INFO_ANIM.out.ease,
            stagger,
            force3D: true,
            onComplete: done,
        });
    }, [shouldHide, isAbout]);

    const bio = useMemo(() => (isAbout ? project?.bio ?? [] : []), [isAbout, project]);
    const services = useMemo(() => (isAbout ? project?.services ?? [] : []), [isAbout, project]);

    if (!project || !project.slider || !images.length || !text) return null;

    if (isAbout) {
        const key = mediaKey(project, 1);
        const photoW = colsWidthPx(2, viewportWidth);
        const photoH = Math.min(ABOUT_PHOTO_MAX_H, Math.round(photoW * mediaAspect(key)));
        const photoLeft = colLeftPx(2, viewportWidth) - MOBILE_GRID.pad;
        const textClass = 'text-[length:var(--kc-type-mobile-2)] font-semibold';
        return (
            <div className="absolute inset-0 w-full h-full" style={{ zIndex: 20 }}>
                {/* Debajo del contacto del navbar (16 px + 3 líneas + 1em + 3 filas + rowGap),
                    hasta abajo; si no cabe, hace scroll todo junto. */}
                <div
                    onClick={handleAboutTap}
                    className={`absolute left-0 right-0 bottom-0 flex flex-col ${textClass}`}
                    style={{
                        zIndex: 30,
                        lineHeight: 'var(--kc-leading-mobile-2)',
                        top: `calc(16px + 1em + 6em * var(--kc-leading-mobile-2) + ${MOBILE_GRID.rowGap}px)`,
                        paddingLeft: MOBILE_GRID.pad,
                        paddingRight: MOBILE_GRID.pad,
                        // Deja sitio a la barra "← Index" del footer (56 px) más el borde seguro.
                        paddingBottom: 'calc(56px + max(var(--mobile-bottom-inset, 0px), env(safe-area-inset-bottom, 0px)))',
                        overflowY: 'auto',
                        overscrollBehavior: 'contain',
                    }}
                >
                    {/* Bio con la foto fantasma detrás (cols 2–3, centrada en vertical) */}
                    <div className="relative" style={{ flex: 'none' }}>
                        <button
                            type="button"
                            onClick={handlePhotoButton}
                            aria-label={photoOpen ? 'Hide portrait' : 'Show portrait'}
                            aria-pressed={photoOpen}
                            className="absolute block p-0 m-0 border-0 bg-transparent"
                            style={{
                                left: photoLeft,
                                top: '50%',
                                width: photoW,
                                height: photoH,
                                transform: 'translateY(-50%)',
                                // Descubierta, de golpe por encima del texto.
                                zIndex: photoOpen ? 2 : 0,
                            }}
                        >
                            <div ref={photoRef} style={{ overflow: 'hidden', clipPath: 'inset(100% 0% 0% 0%)' }}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={mediaSrc(key, 'sm')}
                                    alt="Kiko Climent"
                                    width={Math.round(photoW)}
                                    height={photoH}
                                    style={{ display: 'block', width: photoW, height: photoH, objectFit: 'cover', objectPosition: '50% 20%' }}
                                />
                            </div>
                        </button>

                        {/* Bio: párrafos a tamaño texto, encima de la foto */}
                        <div
                            ref={textRef}
                            className="relative flex flex-col"
                            style={{ zIndex: 1, visibility: 'hidden', gap: '1em' }}
                        >
                            {bio.map((paragraph, i) => {
                                const last = i === bio.length - 1;
                                return (
                                    <p key={i} data-split className="m-0" style={{ color: last ? muted : ink }}>
                                        {paragraph}
                                    </p>
                                );
                            })}
                        </div>
                    </div>

                    {/* Servicios a display; empujados abajo si sobra sitio (como en escritorio) */}
                    <div
                        ref={servicesRef}
                        className="flex flex-col"
                        style={{ visibility: 'hidden', flex: 'none', marginTop: 'auto', paddingTop: MOBILE_GRID.rowGap * 2, gap: '1em' }}
                    >
                        <span data-split style={{ color: muted }}>
                            Services
                        </span>
                        <ul
                            className="m-0 list-none p-0"
                            style={{ fontSize: SERVICES_TYPE, lineHeight: SERVICES_LEADING, letterSpacing: SERVICES_TRACKING, color: ink }}
                        >
                            {services.map((service) => (
                                <li key={service} data-split>
                                    {service}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="absolute inset-0 w-full h-full" style={{ zIndex: 20 }}>
            {/* Al volver no se desmonta de golpe: sus hojas salen con la cortina
                mientras sale la barra, y la Home entra con la suya. */}
            <div className="absolute inset-0 w-full h-full" style={{ zIndex: 25, pointerEvents: shouldHide ? 'none' : 'auto' }}>
                <SliderThree4Mobile
                    images={images}
                    project={project}
                    anchorPx={anchorPx}
                    variant="detail"
                    hiding={shouldHide}
                    startImageId={handoffImageId}
                    handoffImageId={handoffImageId}
                />
            </div>
            <InfoSheetMobile project={project} open={infoOpen && !shouldHide} onClose={onInfoClose} />
        </div>
    );
}
