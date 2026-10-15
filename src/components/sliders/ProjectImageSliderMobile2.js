'use client';

/**
 * Detalle móvil v2.
 *   Proyecto: SliderThree4Mobile solo con sus imágenes (mismo papel y misma
 *   cortina que la v1) + la hoja Info (InfoSheetMobile), que abre el footer.
 *   El nombre del proyecto y el contador viven ahora en el navbar
 *   (NavbarLoaderMobNew2); aquí ya no hay bloque de texto abajo.
 *   About (v3, la estructura del About de escritorio): el contacto va en el
 *   navbar; debajo la foto (columnas 3–4, cortina clip-path de abajo arriba),
 *   la bio en párrafos a tamaño texto (el último en gris; para volver, "← Index"
 *   en la barra o "Kiko Climent" en la cabecera) y
 *   "Services" con los servicios a display (el mismo tamaño que en escritorio).
 *   En una sola columna que hace scroll si no cabe (en un iPhone SE no cabe:
 *   anclar los servicios abajo los cortaba). Todo entra y sale por líneas con máscara.
 *   Versión anterior (foto + un solo texto abajo): ProjectImageSliderMobile2AboutText.js.
 * Versión anterior: ProjectImageSliderMobile.js.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
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
// La foto no pasa de esto: la bio y los servicios caben en una pantalla.
const ABOUT_PHOTO_MAX_H = 220;

export default function ProjectImageSliderMobile2({ project, shouldHide = false, infoOpen = false, onInfoClose }) {
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

    const ink = isDarkMode ? 'white' : 'black';
    const muted = isDarkMode ? '#9ca3af' : '#6b7280';

    // ── About: entrada (foto + líneas) ──────────────────────────────────
    useEffect(() => {
        if (!isAbout || !textRef.current) return undefined;
        let split;
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
            if (reduceMotion) {
                gsap.set(split.lines, { yPercent: 0 });
                if (photo) gsap.set(photo, { clipPath: 'inset(0% 0% 0% 0%)' });
                return;
            }
            if (photo) {
                const img = photo.querySelector('img');
                gsap.fromTo(
                    photo,
                    { clipPath: 'inset(100% 0% 0% 0%)' },
                    { clipPath: 'inset(0% 0% 0% 0%)', duration: PHOTO_CURTAIN.duration, ease: PHOTO_CURTAIN.ease }
                );
                if (img) {
                    gsap.fromTo(
                        img,
                        { scale: PHOTO_CURTAIN.zoomFrom, transformOrigin: '50% 100%' },
                        { scale: 1, duration: PHOTO_CURTAIN.duration, ease: PHOTO_CURTAIN.ease }
                    );
                }
            }
            gsap.fromTo(
                split.lines,
                { yPercent: INFO_ANIM.fromYPercent },
                {
                    yPercent: 0,
                    duration: INFO_ANIM.duration,
                    ease: INFO_ANIM.ease,
                    stagger: INFO_ANIM.stagger,
                    delay: INFO_ANIM.delay,
                    force3D: true,
                }
            );
        }, 60);
        return () => {
            clearTimeout(timer);
            if (split?.revert) split.revert();
            splitRef.current = null;
        };
    }, [isAbout, project?.id]);

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
        const stagger = Math.min(INFO_ANIM.out.stagger, 0.35 / Math.max(lines.length - 1, 1));
        if (photoRef.current) {
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
        const photoLeft = colLeftPx(3, viewportWidth) - MOBILE_GRID.pad;
        const textClass = 'text-[length:var(--kc-type-mobile-2)] font-semibold';
        return (
            <div className="absolute inset-0 w-full h-full" style={{ zIndex: 20 }}>
                {/* Debajo del contacto del navbar (16 px + 3 líneas + 1em + 3 filas + rowGap),
                    hasta abajo; si no cabe, hace scroll todo junto. */}
                <div
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
                    {/* Foto (cols 3–4) con su nombre de archivo */}
                    <div style={{ marginLeft: photoLeft, width: photoW, flex: 'none' }}>
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
                        <span
                            className="block tabular-nums font-normal"
                            style={{
                                marginTop: MOBILE_GRID.captionGap,
                                fontSize: MOBILE_GRID.captionSize,
                                lineHeight: `${MOBILE_GRID.captionLine}px`,
                                color: ink,
                            }}
                        >
                            about.jpg
                        </span>
                    </div>

                    {/* Bio: párrafos a tamaño texto */}
                    <div
                        ref={textRef}
                        className="flex flex-col"
                        style={{ visibility: 'hidden', flex: 'none', marginTop: MOBILE_GRID.rowGap, gap: '1em' }}
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
