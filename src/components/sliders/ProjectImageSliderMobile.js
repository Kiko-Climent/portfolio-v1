'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { useDarkMode } from '@/contexts/DarkModeContext';
import SliderThree3Mobile from '@/components/SliderThree/SliderThree3Mobile';

gsap.registerPlugin(SplitText);

/**
 * Mismo reveal por líneas que el bloque de info de escritorio
 * (ProjectImageSliderThree): cada línea sube desde su máscara y, al
 * volver, sale hacia arriba. No se funde el bloque entero.
 */
const INFO_ANIM = {
    cushion: '0.2em',
    fromYPercent: 130,
    duration: 0.9,
    ease: 'power4.out',
    stagger: 0.09,
    delay: 0.12,
    out: {
        yPercent: -130,
        duration: 0.5,
        ease: 'power3.in',
        stagger: 0.05,
    },
};

export default function ProjectImageSliderMobile({ project, shouldHide = false }) {
    const { isDarkMode } = useDarkMode();
    const isAbout = project?.id === 'about';
    const images = project?.slider?.images ?? [];
    const text = project?.slider?.text;

    const [navbarHeight, setNavbarHeight] = useState(0);
    const textRef = useRef(null);
    const splitRef = useRef(null);
    const imagesOnScreenRef = useRef(false);
    const pendingTextRevealRef = useRef(null);
    const shouldHideRef = useRef(shouldHide);
    shouldHideRef.current = shouldHide;

    const handleImagesReady = useCallback(() => {
        if (imagesOnScreenRef.current) return;
        imagesOnScreenRef.current = true;
        pendingTextRevealRef.current?.();
        pendingTextRevealRef.current = null;
    }, []);

    useEffect(() => {
        const updateNavbarHeight = () => {
            const navbar = document.querySelector('[data-navbar]');
            if (navbar) {
                setNavbarHeight(navbar.getBoundingClientRect().height + 16);
            }
        };

        updateNavbarHeight();
        window.addEventListener('resize', updateNavbarHeight);
        return () => window.removeEventListener('resize', updateNavbarHeight);
    }, []);

    // About no tiene cortina de imágenes: el texto puede entrar al montarse.
    useEffect(() => {
        if (isAbout) handleImagesReady();
    }, [isAbout, project?.id, handleImagesReady]);

    // Si la cortina no avisa, el texto entra igualmente.
    useEffect(() => {
        const fallback = setTimeout(handleImagesReady, 4000);
        return () => clearTimeout(fallback);
    }, [project?.id, handleImagesReady]);

    // Reveal por líneas del título + descripción, cuando las imágenes ya se ven.
    useEffect(() => {
        if (!textRef.current) return undefined;

        imagesOnScreenRef.current = isAbout;
        let split;
        const timer = setTimeout(() => {
            if (!textRef.current) return;
            split = new SplitText(textRef.current, {
                type: 'lines',
                mask: 'lines',
                linesClass: 'info-line',
            });
            splitRef.current = split;

            split.lines.forEach((line) => {
                const wrap = line.parentElement;
                if (!wrap) return;
                wrap.style.paddingBottom = INFO_ANIM.cushion;
                wrap.style.marginBottom = `-${INFO_ANIM.cushion}`;
            });

            const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            gsap.set(split.lines, { yPercent: reduceMotion ? 0 : INFO_ANIM.fromYPercent });
            textRef.current.style.visibility = 'visible';

            const reveal = () => {
                if (shouldHideRef.current || !splitRef.current) return;
                if (reduceMotion) {
                    gsap.set(split.lines, { yPercent: 0 });
                    return;
                }
                gsap.to(split.lines, {
                    yPercent: 0,
                    duration: INFO_ANIM.duration,
                    ease: INFO_ANIM.ease,
                    stagger: INFO_ANIM.stagger,
                    delay: INFO_ANIM.delay,
                    force3D: true,
                });
            };

            if (imagesOnScreenRef.current) reveal();
            else pendingTextRevealRef.current = reveal;
        }, 60);

        return () => {
            clearTimeout(timer);
            pendingTextRevealRef.current = null;
            if (split && split.revert) split.revert();
            splitRef.current = null;
        };
    }, [project?.id, isAbout]);

    // Salida por líneas al volver al menú. El bloque sigue montado hasta que
    // el footer termina; si se desmontara aquí, el texto desaparecería de golpe.
    useEffect(() => {
        if (!shouldHide || !splitRef.current?.lines) return;
        const lines = splitRef.current.lines;
        gsap.killTweensOf(lines);
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduceMotion) {
            gsap.set(lines, { yPercent: INFO_ANIM.out.yPercent });
            return;
        }
        gsap.to(lines, {
            yPercent: INFO_ANIM.out.yPercent,
            duration: INFO_ANIM.out.duration,
            ease: INFO_ANIM.out.ease,
            stagger: INFO_ANIM.out.stagger,
            force3D: true,
        });
    }, [shouldHide]);

    if (!project || !project.slider || !images.length || !text) return null;

    return (
        <div className="absolute inset-0 w-full h-full" style={{ zIndex: 20 }}>
            {!isAbout && !shouldHide && (
                <div className="absolute inset-0 w-full h-full" style={{ zIndex: 25 }}>
                    <SliderThree3Mobile
                        images={images}
                        project={project}
                        navbarHeight={navbarHeight}
                        onImagesReady={handleImagesReady}
                    />
                </div>
            )}

            <div
                className="absolute left-4 right-4"
                style={{
                    zIndex: 30,
                    pointerEvents: isAbout ? 'auto' : 'none',
                    bottom:
                        'calc(1rem + max(var(--mobile-bottom-inset, 0px), env(safe-area-inset-bottom, 0px)))',
                }}
            >
                <div
                    ref={textRef}
                    className="text-[clamp(1.0625rem,1.75vw,1.3125rem)] font-semibold leading-[1.1]"
                    style={{
                        visibility: 'hidden',
                        ...(isAbout
                            ? {
                                  maxHeight: `calc(100dvh - ${navbarHeight}px - 3.5rem)`,
                                  overflowY: 'auto',
                                  overscrollBehavior: 'contain',
                              }
                            : null),
                    }}
                >
                    {text.url ? (
                        <a
                            href={text.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                color: isDarkMode ? 'white' : 'black',
                                pointerEvents: 'auto',
                            }}
                            className="hover:opacity-80 transition-opacity"
                        >
                            {text.title}
                        </a>
                    ) : (
                        <span style={{ color: isDarkMode ? 'white' : 'black' }}>
                            {text.title}
                        </span>
                    )}{' '}
                    <span
                        style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}
                        className="lowercase"
                    >
                        {text.description}
                    </span>
                    {isAbout ? (
                        <>
                            {' '}
                            <button
                                type="button"
                                className="inline cursor-pointer underline-offset-2 hover:opacity-80"
                                style={{ color: isDarkMode ? 'white' : 'black' }}
                                onClick={() => window.__footerMobileRequestBack?.()}
                            >
                                back home
                            </button>
                        </>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
