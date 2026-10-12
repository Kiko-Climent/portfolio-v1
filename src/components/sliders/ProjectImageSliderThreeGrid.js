'use client';

import { useEffect, useLayoutEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { useDarkMode } from '@/contexts/DarkModeContext';
// Copia de ProjectImageSliderThree con el slider encajado en las 12 columnas (index5).
import SliderThree4, { CURTAIN, GRID_FIT } from '../SliderThree/index5';
import { mediaAspect, mediaKey, mediaSrc } from '@/lib/media';
import { PAGE, columnsWidthPx } from '@/lib/pageGrid';
import { PROJECT_NAME, gridFileName } from '@/components/data/grid';
import AboutContactSheet from '@/components/about/AboutContactSheet';

// About de escritorio:
//   'contact-sheet' → v2 (oct 2026): tira de 12 recortes + ampliada + servicios.
//   'stack'         → v1: la foto 3 veces en vertical + bio abajo a la izquierda.
// Para volver a la v1 basta con cambiar este valor.
const ABOUT_LAYOUT = 'contact-sheet';

gsap.registerPlugin(SplitText);

/**
 * Reveal editorial por líneas (mismo lenguaje que el footer):
 * cada línea del bloque de info sube desde su propia máscara
 * (overflow:clip) con stagger + easing. En body copy multilínea
 * el mask por líneas es más limpio que char a char.
 */
const INFO_ANIM = {
  cushion: '0.2em',   // colchón inferior para no cortar descendentes (g, y, j)
  fromYPercent: 130,  // > (lineHeight + cushion) / lineHeight, para ocultar del todo
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

/**
 * Caption de la imagen en detalle (abajo-izquierda, en el hueco del bloque de
 * info): mismo reveal por líneas. Al pasar de imagen, las líneas salen hacia
 * arriba, cambia el contenido y entran desde abajo mientras llega la hoja.
 */
const CAPTION_ANIM = {
  inDelay: 0.3,       // primera entrada: deja salir antes al bloque de info
  duration: 0.9,
  ease: 'power4.out',
  stagger: 0.07,
  out: {
    duration: 0.4,
    ease: 'power3.in',
    stagger: 0.04,
  },
};

const pad2 = (n) => String(n).padStart(2, '0');

/**
 * Ficha del proyecto (abajo-izquierda), sacada de project.slider.text sin
 * inventar datos: la description se parte en Client (primer término),
 * Scope (el resto) y Stack (las tecnologías conocidas), y Web es la url.
 * Para afinar los textos, editar las descriptions en projects.js.
 */
const TECH = {
    'next.js': 'Next.js', javascript: 'JavaScript', javascriptt: 'JavaScript', gsap: 'GSAP',
    'framer motion': 'Framer Motion', 'three.js': 'Three.js', shaders: 'Shaders', vercel: 'Vercel',
    tailwindcss: 'Tailwind CSS', 'motion ui': 'Motion UI', firebase: 'Firebase',
    responsive: 'Responsive', 'headless tech': 'Headless',
};
const capFirst = (str) => (str ? str.charAt(0).toUpperCase() + str.slice(1) : str);
function parseInfo(text) {
    const terms = (text?.description || '')
        .split(',')
        .map((t) => t.trim().replace(/[.,]+$/, ''))
        .filter(Boolean);
    const stack = [];
    const rest = [];
    terms.forEach((t) => {
        const tech = TECH[t.toLowerCase()];
        if (tech) {
            if (!stack.includes(tech)) stack.push(tech);
        } else rest.push(t);
    });
    return {
        client: capFirst(rest[0] || ''),
        scope: capFirst(rest.slice(1).join(', ').toLowerCase()),
        stack: stack.join(', '),
    };
}

// Red de seguridad: si algo no llega a cargar, "back menu" aparece igualmente.
const READY_FALLBACK_MS = 5000;

export default function ProjectImageSliderThree({ project, shouldHide = false, onReady }) {
    const { isDarkMode } = useDarkMode();
    const [isVisible, setIsVisible] = useState(false);
    const [focusIndex, setFocusIndex] = useState(null);
    // Imagen que muestra el caption: va un paso por detrás de focusIndex, cambia
    // cuando las líneas ya han salido. Objeto nuevo en cada cambio para que la
    // entrada se dispare también al reabrir la misma imagen.
    const [caption, setCaption] = useState({ index: 0 });
    const textRef = useRef(null);
    const splitRef = useRef(null);
    const captionRef = useRef(null);
    const captionLinesRef = useRef([]);
    const captionTlRef = useRef(null);
    const captionShownRef = useRef(false);
    const captionDelayRef = useRef(0);

    // "Todo en pantalla": las imágenes ya descubiertas y el bloque de info
    // terminado de entrar. Solo entonces se avisa (p. ej. al footer).
    const onReadyRef = useRef(onReady);
    const readyRef = useRef({ scene: false, text: false, sent: false });
    const markReady = useCallback((part) => {
        const state = readyRef.current;
        state[part] = true;
        if (state.scene && state.text && !state.sent) {
            state.sent = true;
            onReadyRef.current?.();
        }
    }, []);

    // El texto sube cuando las imágenes ya están en pantalla: para entonces el
    // grid ha terminado de taparse bajo él.
    const imagesOnScreenRef = useRef(false);
    const pendingTextRevealRef = useRef(null);
    const handleSceneReady = useCallback(() => {
        imagesOnScreenRef.current = true;
        markReady('scene');
        pendingTextRevealRef.current?.();
        pendingTextRevealRef.current = null;
    }, [markReady]);

    useEffect(() => {
        onReadyRef.current = onReady;
    }, [onReady]);

    useEffect(() => {
        readyRef.current = { scene: false, text: false, sent: false };
        imagesOnScreenRef.current = false;
        const fallback = setTimeout(() => {
            handleSceneReady();
            markReady('text');
        }, READY_FALLBACK_MS);
        return () => clearTimeout(fallback);
    }, [project?.id, markReady, handleSceneReady]);

    // About no tiene slider WebGL: sus imágenes (HTML) entran y salen con la
    // misma cortina (clip-path) que el grid y el slider.
    const aboutImagesRef = useRef([]);
    useLayoutEffect(() => {
        const imgs = aboutImagesRef.current.filter(Boolean);
        if (!imgs.length) return undefined;

        gsap.set(imgs, { clipPath: 'inset(100% 0% 0% 0%)' });
        let cancelled = false;
        const mountedAt = performance.now();
        Promise.all(imgs.map((img) => (img.decode ? img.decode().catch(() => {}) : null))).then(() => {
            if (cancelled) return;
            // Igual que el slider: no antes de minDelay desde el montaje (≈ el click),
            // para cruzarse con el grid que ya se está tapando.
            const delay = Math.max(0, CURTAIN.minDelay - (performance.now() - mountedAt) / 1000);
            gsap.to(imgs, {
                clipPath: 'inset(0% 0% 0% 0%)',
                delay,
                duration: CURTAIN.duration,
                ease: CURTAIN.ease,
                stagger: CURTAIN.stagger,
            });
            gsap.delayedCall(
                delay + (imgs.length - 1) * CURTAIN.stagger + CURTAIN.duration * CURTAIN.readyAt,
                () => !cancelled && handleSceneReady()
            );
        });

        return () => {
            cancelled = true;
            gsap.killTweensOf(imgs);
        };
    }, [project?.id, handleSceneReady]);

    useEffect(() => {
        const imgs = aboutImagesRef.current.filter(Boolean);
        if (!shouldHide || !imgs.length) return;
        gsap.killTweensOf(imgs);
        gsap.to(imgs, {
            clipPath: 'inset(0% 0% 100% 0%)',
            duration: CURTAIN.out.duration,
            ease: CURTAIN.out.ease,
            stagger: CURTAIN.out.stagger,
        });
    }, [shouldHide]);

    // Hooks nuevos antes de los return tempranos (orden estable de hooks).
    const [viewportW, setViewportW] = useState(1440);
    const [gridTop, setGridTop] = useState(128);
    // La línea de la imagen se pinta en <body> (portal): dentro del contenedor
    // fijo del slider el mix-blend-mode quedaría aislado y no vería las hojas.
    const [portalReady, setPortalReady] = useState(false);
    useEffect(() => setPortalReady(true), []);

    if (!project || !project.slider) return null;

    const { images = [], text } = project.slider;

    if (!images.length) return null;

    const [navbarHeight, setNavbarHeight] = useState(0);
    const isAbout = project.id === 'about';

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsVisible(true);
        }, 50);

        return () => clearTimeout(timer);
    }, []);

    // Al volver al menú el contenedor ya no se funde: salen las cortinas de las
    // imágenes (slider / About) y el texto por líneas.
    useEffect(() => {
        if (shouldHide) {
            setFocusIndex(null);
        }
    }, [shouldHide]);

    useEffect(() => {
        setFocusIndex(null);
    }, [project?.id]);

    // Cambio de foco: salen las líneas en pantalla (bloque de info o caption
    // anterior) y, ya ocultas, se cambia el contenido del caption.
    useEffect(() => {
        const lines = captionLinesRef.current.filter(Boolean);
        if (!captionRef.current || !lines.length) return;
        if (focusIndex === null && !captionShownRef.current) return;
        // Saliendo al menú: el foco se suelta en este mismo ciclo.
        if (shouldHide && focusIndex !== null) return;

        captionTlRef.current?.kill();
        gsap.killTweensOf(lines);
        const tl = gsap.timeline();
        captionTlRef.current = tl;

        const captionOut = {
            yPercent: INFO_ANIM.out.yPercent,
            duration: CAPTION_ANIM.out.duration,
            ease: CAPTION_ANIM.out.ease,
            stagger: CAPTION_ANIM.out.stagger,
            force3D: true,
        };

        if (focusIndex === null) {
            captionShownRef.current = false;
            tl.to(lines, captionOut, 0);
            tl.set(captionRef.current, { visibility: 'hidden' });
            // La ficha del proyecto se queda siempre (antes volvía a entrar aquí).
            return;
        }

        if (captionShownRef.current) {
            // De una imagen a otra: fuera, cambio de contenido, dentro.
            captionDelayRef.current = 0;
            tl.to(lines, captionOut, 0);
            tl.call(() => setCaption({ index: focusIndex }));
            return;
        }

        // Entrada al detalle: la ficha del proyecto se queda (antes salía por
        // líneas); solo entra la línea de la imagen bajo la hoja en foco.
        captionShownRef.current = true;
        captionDelayRef.current = CAPTION_ANIM.inDelay;
        markReady('text');
        setCaption({ index: focusIndex });
    }, [focusIndex, shouldHide, markReady]);

    // Entrada del caption con su contenido ya actualizado.
    useLayoutEffect(() => {
        const lines = captionLinesRef.current.filter(Boolean);
        if (!captionRef.current || !lines.length) return;
        gsap.set(lines, { yPercent: INFO_ANIM.fromYPercent });
        if (!captionShownRef.current) return;

        gsap.set(captionRef.current, { visibility: 'visible' });
        gsap.to(lines, {
            yPercent: 0,
            duration: CAPTION_ANIM.duration,
            ease: CAPTION_ANIM.ease,
            stagger: CAPTION_ANIM.stagger,
            delay: captionDelayRef.current,
            force3D: true,
        });
    }, [caption]);

    useEffect(() => () => captionTlRef.current?.kill(), []);

    useEffect(() => {
        const updateNavbarHeight = () => {
            const navbar = document.querySelector('[data-navbar]');
            if (navbar) {
                setNavbarHeight(navbar.getBoundingClientRect().height + 16);
                setGridTop(navbar.getBoundingClientRect().bottom + PAGE.rowGap);
            }
            setViewportW(window.innerWidth);
        };

        updateNavbarHeight();
        setViewportW(window.innerWidth);
        window.addEventListener('resize', updateNavbarHeight);
        return () => window.removeEventListener('resize', updateNavbarHeight);
    }, []);

    // Reveal por líneas del bloque de info
    useEffect(() => {
        if (!textRef.current) return undefined;

        let split;
        const timer = setTimeout(() => {
            // Mismo reveal que el original: SplitText por líneas visuales, con
            // máscara por línea. Se parte cada celda de texto (nombre, etiquetas,
            // valores) para no romper la rejilla, y las líneas se ordenan de
            // arriba abajo: las que están a la misma altura (etiqueta + valor)
            // suben juntas, cada renglón con su stagger, como el párrafo original.
            const cells = Array.from(textRef.current.querySelectorAll('[data-split]'));
            const splits = cells.map((cell) => new SplitText(cell, {
                type: 'lines',
                mask: 'lines',
                linesClass: 'info-line',
            }));
            const lines = splits.flatMap((sp) => sp.lines);
            if (!lines.length) return;
            const tops = [...new Set(lines.map((l) => Math.round(l.getBoundingClientRect().top)))].sort((a, b) => a - b);
            lines.forEach((l) => {
                l.dataset.row = String(tops.indexOf(Math.round(l.getBoundingClientRect().top)));
            });
            lines.sort((a, b) => Number(a.dataset.row) - Number(b.dataset.row));
            split = { lines, revert: () => splits.forEach((sp) => sp.revert()) };
            splitRef.current = split;

            // Colchón inferior en la máscara: el descendente entra en la zona
            // visible y el margin negativo idéntico mantiene el interlineado.
            split.lines.forEach((line) => {
                const wrap = line.parentElement;
                if (!wrap) return;
                wrap.style.paddingBottom = INFO_ANIM.cushion;
                wrap.style.marginBottom = `-${INFO_ANIM.cushion}`;
            });

            gsap.set(split.lines, { yPercent: INFO_ANIM.fromYPercent });
            const reveal = () => {
                gsap.to(split.lines, {
                    yPercent: 0,
                    duration: INFO_ANIM.duration,
                    ease: INFO_ANIM.ease,
                    stagger: (i, el) => Number(el.dataset.row || i) * INFO_ANIM.stagger,
                    delay: INFO_ANIM.delay,
                    force3D: true,
                    onComplete: () => markReady('text'),
                });
            };
            if (imagesOnScreenRef.current) reveal();
            else pendingTextRevealRef.current = reveal;
        }, 60);

        return () => {
            clearTimeout(timer);
            pendingTextRevealRef.current = null;
            if (split && split.revert) split.revert();
        };
    }, [project?.id, markReady]);

    // Salida por líneas al volver al menú
    useEffect(() => {
        if (!shouldHide || !splitRef.current) return;
        gsap.to(splitRef.current.lines, {
            yPercent: INFO_ANIM.out.yPercent,
            duration: INFO_ANIM.out.duration,
            ease: INFO_ANIM.out.ease,
            stagger: INFO_ANIM.out.stagger,
            force3D: true,
        });
    }, [shouldHide]);

    // Función para obtener la ruta de la imagen de about
    const captionIndex = Math.min(caption.index, images.length - 1);
    const captionImage = images[captionIndex];
    const captionEntry = {
        page: captionImage?.page || 'page',
        view: captionImage?.view,
        path: captionImage?.path,
    };
    const captionHref = (() => {
        if (!text.url && !captionEntry.path) return null;
        if (!text.url) return captionEntry.path || null;
        try {
            const origin = new URL(text.url).origin;
            return `${origin}${captionEntry.path || ''}`;
        } catch {
            return text.url;
        }
    })();
    const captionUrlLabel = captionHref
        ? captionHref.replace(/^https?:\/\//, '').replace(/^www\./, '')
        : null;

    const ink = isDarkMode ? 'white' : 'black';
    const mutedInk = isDarkMode ? PAGE.mutedDark : PAGE.muted;
    const projectName = PROJECT_NAME[project.id] || text.title;
    const labelW = columnsWidthPx(1, viewportW);
    // Fila etiqueta | valor: la etiqueta ocupa 1 columna, el valor empieza en
    // la línea de la columna 2 (mismo esquema en slider y en detalle).
    const row = (label, value, key) => (
        <span
            key={key}
            className="grid"
            style={{ gridTemplateColumns: `${labelW}px minmax(0, 1fr)`, columnGap: PAGE.gap }}
        >
            <span data-split style={{ color: mutedInk }}>{label}</span>
            <span data-split>{value}</span>
        </span>
    );
    const info = parseInfo(text);
    // Línea de la imagen: bajo la hoja en foco, en su borde izquierdo
    // (detailColumn). Desktop = detailSpan cols de ancho; mobile = misma
    // altura que una desktop en detalle (ver heroTarget en index5).
    const colLeftPx = (column) => {
        const track = (viewportW - PAGE.pad * 2 - (PAGE.columns - 1) * PAGE.gap) / PAGE.columns;
        return PAGE.pad + (column - 1) * (track + PAGE.gap);
    };
    const captionPos = (() => {
        const detailW = columnsWidthPx(GRID_FIT.detailSpan, viewportW);
        const aspect = captionImage ? mediaAspect(mediaKey(project, captionImage.id)) : 1 / GRID_FIT.deskAspect;
        const imageH = aspect <= 1 ? detailW * aspect : detailW / GRID_FIT.deskAspect;
        return { left: colLeftPx(GRID_FIT.detailColumn), top: gridTop + imageH + 10 };
    })();
    const webLink = text.url ? (
        <a href={text.url} target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity">
            {text.title}{' '}
            <span className="relative top-[0.09em]">{'\u2197\uFE0E'}</span>
        </a>
    ) : null;
    const infoLines = isAbout
        ? [
            <span key="name" data-split className="block">{projectName}</span>,
            <span key="bio" data-split className="block" style={{ color: mutedInk, whiteSpace: 'normal', marginTop: '0.4em' }}>
                {capFirst(text.description)}
            </span>,
        ]
        : [
            <span key="name" data-split className="block">{projectName}</span>,
            info.client ? row('Client', info.client, 'client') : null,
            info.scope ? row('Scope', info.scope, 'scope') : null,
            info.stack ? row('Stack', info.stack, 'stack') : null,
            webLink ? row('Web', webLink, 'web') : null,
        ].filter(Boolean);

    const getAboutImageSrc = () => {
        if (isAbout && images[0]) {
            return mediaSrc(mediaKey(project, images[0].id), 'md');
        }
        return null;
    };

    if (isAbout && ABOUT_LAYOUT === 'contact-sheet') {
        return (
            <div
                className="fixed top-0 left-0 w-full h-screen z-10 transition-opacity pointer-events-none"
                style={{ opacity: isVisible ? 1 : 0, transitionDuration: '0.8s' }}
            >
                <AboutContactSheet
                    project={project}
                    shouldHide={shouldHide}
                    onSceneReady={handleSceneReady}
                    onTextReady={() => markReady('text')}
                />
            </div>
        );
    }

    return (
        <div
            className="fixed top-0 left-0 w-full h-screen z-10 transition-opacity"
            style={{
              opacity: isVisible ? 1 : 0,
              transitionDuration: '0.8s' // ⭐ MISMO TIMING QUE LA ANIMACIÓN DEL FOOTER
            }}
        >
            <div className="relative z-20 w-1/2 h-full pointer-events-none">
                <div
                    ref={textRef}
                    className="absolute bottom-4 left-4 text-[length:var(--kc-type)] leading-[1] pointer-events-auto"
                    style={{
                        width: columnsWidthPx(5, viewportW),
                        pointerEvents: 'auto',
                        color: ink,
                    }}
                >
                    {infoLines}
                </div>
            </div>

            {portalReady ? createPortal(
                <div
                    ref={captionRef}
                    className="kc-blend fixed z-[40] flex flex-col items-start whitespace-nowrap text-[length:var(--kc-type)] leading-[1] pointer-events-none"
                    style={{ visibility: 'hidden', color: ink, left: captionPos.left, top: captionPos.top }}
                >
                    {[
                        <span key="line" className="flex items-baseline" style={{ gap: '0.5em' }}>
                            <span>{gridFileName(project.id, captionIndex + 1)}</span>
                            <span style={{ color: mutedInk }}>—</span>
                            <span>{captionEntry.page}{captionEntry.view ? `, ${capFirst(captionEntry.view)}` : ''}</span>
                            <span style={{ color: mutedInk }}>—</span>
                            <span className="tabular-nums">{pad2(captionIndex + 1)} / {pad2(images.length)}</span>
                            {captionHref ? <span style={{ color: mutedInk }}>—</span> : null}
                            {captionHref ? (
                                <a
                                    href={captionHref}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:opacity-80 transition-opacity"
                                    style={{ pointerEvents: focusIndex === null ? 'none' : 'auto' }}
                                >
                                    {captionUrlLabel}{' '}
                                    <span className="relative top-[0.09em]">{'\u2197\uFE0E'}</span>
                                </a>
                            ) : null}
                        </span>,
                    ].filter(Boolean).map((line, i) => (
                        // Máscara por línea, con el mismo colchón que el bloque de info.
                        <span
                            key={i}
                            className="block overflow-clip"
                            style={{
                                paddingBottom: INFO_ANIM.cushion,
                                marginBottom: `-${INFO_ANIM.cushion}`,
                            }}
                        >
                            <span
                                ref={(el) => {
                                    captionLinesRef.current[i] = el;
                                }}
                                className="block"
                            >
                                {line}
                            </span>
                        </span>
                    ))}
                </div>,
                document.body
            ) : null}

            {isAbout ? (
                <div
                    className="absolute right-0 top-0 w-1/2 h-full z-[15] flex flex-col items-center justify-center gap-8 px-8"
                    style={{ paddingTop: `${navbarHeight}px` }}
                >
                    {[1, 2, 3].map((index) => (
                        <img
                            key={index}
                            ref={(el) => {
                                aboutImagesRef.current[index - 1] = el;
                            }}
                            src={getAboutImageSrc()}
                            alt="About"
                            className="object-contain"
                            style={{
                                width: images[0]?.width || '40%',
                                maxHeight: 'calc((100vh - 200px) / 3)',
                            }}
                        />
                    ))}
                </div>
            ) : (
                <div className="absolute inset-0 z-[15]">
                    <SliderThree4
                        images={images}
                        project={project}
                        navbarHeight={navbarHeight}
                        onFocusChange={setFocusIndex}
                        onReady={handleSceneReady}
                        hidden={shouldHide}
                    />
                </div>
            )}
        </div>
    );
}
