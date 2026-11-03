'use client';

import { useEffect, useLayoutEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { useDarkMode } from '@/contexts/DarkModeContext';
// v2 (nov 2026, "R3·A2"): copia de ProjectImageSliderThreeGrid con el slider
// index6 — las hojas sin foco en una tira al borde (cols 11–12) y la ficha de
// la imagen DENTRO del hueco que deja la hoja en foco: el hueco es la etiqueta
// de lo que falta. Mismo esquema etiqueta | valor que la ficha del proyecto. La v1 sigue intacta: para volver,
// loadDesktopSlider → ProjectImageSliderThreeGrid en src/lib/lazyComponents.js.
import SliderThree4, { CURTAIN } from '../SliderThree/index6';
import { mediaKey, mediaSrc } from '@/lib/media';
import { PAGE, columnsWidthPx } from '@/lib/pageGrid';
import { PROJECT_NAME } from '@/components/data/grid';
import AboutContactSheet from '@/components/about/AboutContactSheet';
import AboutGridCut from '@/components/about/AboutGridCut';
import AboutPaper from '@/components/about/AboutPaper';
import AboutFold from '@/components/about/AboutFold';
import { aboutHandoff } from '@/lib/aboutHandoff';
import { capFirst, parseInfo } from '@/lib/projectInfo';

// About de escritorio:
//   'fold'          → v5 (oct 2026): la foto entera con las esquinas plegadas; al hover se despliega y ondea (WebGL).
//   'paper'         → v4 (oct 2026): 4 retales rectangulares (cols 9–12) que se unen al hover como hojas de papel (WebGL).
//   'grid-cut'      → v3 (oct 2026): tiras líquidas (mercurio) en las cols 9–12, se funden al hover (WebGL).
//   'contact-sheet' → v2 (oct 2026): tira de 12 recortes + ampliada + servicios.
//   'stack'         → v1: la foto 3 veces en vertical + bio abajo a la izquierda.
// Para volver a una versión anterior basta con cambiar este valor.
const ABOUT_LAYOUT = 'paper';

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
 * Leyenda de la imagen en foco (junto al hueco de la tira).
 *  - enter: al abrir el detalle entran las filas (etiqueta + valor) por líneas
 *  - swap: al pasar de imagen las etiquetas no se mueven; solo ruedan los
 *    valores que cambian, todos a la vez (stagger mínimo) y en el sentido del
 *    paso: a la siguiente, lo viejo sale hacia arriba y lo nuevo entra desde
 *    abajo; a la anterior, al revés. Ease-out siempre (nunca ease-in en UI) e
 *    interrumpible: con scroll rápido no se hace cola.
 *  - exit: al soltar el foco sale todo hacia arriba.
 */
const CAPTION_ANIM = {
  inDelay: 0.55,      // primera entrada: cuando la tira ya casi se ha asentado
  enter: { duration: 0.6, ease: 'expo.out', stagger: 0.04 },
  swap: { out: 0.16, outEase: 'power2.out', in: 0.36, ease: 'expo.out', stagger: 0.015 },
  exit: { duration: 0.22, ease: 'power2.out', stagger: 0.015 },
};

// El hueco que deja la hoja en foco en la tira se queda vacío (sin contorno ni
// fantasma): así se lee el viaje de la hoja de la tira al foco y de vuelta.

const pad2 = (n) => String(n).padStart(2, '0');

// Ficha del proyecto (abajo-izquierda): Client / Scope / Stack / Web, desde
// lib/projectInfo (la misma que la hoja Info móvil).

// Red de seguridad: si algo no llega a cargar, "back menu" aparece igualmente.
const READY_FALLBACK_MS = 5000;

export default function ProjectImageSliderThree({ project, shouldHide = false, onReady }) {
    const { isDarkMode } = useDarkMode();
    const [isVisible, setIsVisible] = useState(false);
    // Desde el hover del About la foto ya está en pantalla: sin fundido.
    const [fromHover] = useState(() => project?.id === 'about' && aboutHandoff.isArmed());
    const [focusIndex, setFocusIndex] = useState(null);
    // Imagen que muestra el caption: va un paso por detrás de focusIndex, cambia
    // cuando las líneas ya han salido. Objeto nuevo en cada cambio para que la
    // entrada se dispare también al reabrir la misma imagen.
    const [caption, setCaption] = useState({ index: 0, changed: null, dir: 1 });
    const textRef = useRef(null);
    const splitRef = useRef(null);
    const captionRef = useRef(null);
    const captionLinesRef = useRef([]);
    const captionTlRef = useRef(null);
    const captionShownRef = useRef(false);
    const captionDelayRef = useRef(0);
    const captionIndexRef = useRef(0);
    const captionLabelRefs = useRef([]);
    const holeLastRef = useRef('');

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
    // La línea de la imagen se pinta en <body> (portal): dentro del contenedor
    // fijo del slider el mix-blend-mode quedaría aislado y no vería las hojas.
    const [portalReady, setPortalReady] = useState(false);
    useEffect(() => setPortalReady(true), []);

    if (!project || !project.slider) return null;

    const { images = [], text } = project.slider;

    if (!images.length) return null;

    const [navbarHeight, setNavbarHeight] = useState(0);
    const isAbout = project.id === 'about';

    // Texto de cada fila de la leyenda (Image, Page, View, Link), para saber
    // cuáles cambian al pasar de imagen.
    const captionRowsFor = (i) => {
        const img = images[Math.min(i, images.length - 1)] || {};
        return [`${i + 1}/${images.length}`, img.page || 'page', img.view || '', img.path || ''];
    };

    // El slider llama a esto cada frame con el hueco de la hoja en foco (px de
    // pantalla): se escribe directo en el DOM, sin re-render de React. La
    // leyenda va al sitio final del hueco, así se queda quieta al pasar de imagen.
    const handleHoleFrame = (hole) => {
        const el = captionRef.current;
        if (!el || !hole) return;
        const key = `${Math.round(hole.x * 2)}|${Math.round(hole.captionY * 2)}`;
        if (key === holeLastRef.current) return;
        holeLastRef.current = key;
        el.style.transform = `translate3d(${hole.x}px, ${hole.captionY}px, 0)`;
    };

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

    // Cambio de foco: entrada, paso de una imagen a otra o salida de la leyenda.
    useEffect(() => {
        const values = captionLinesRef.current.filter(Boolean);
        const labels = captionLabelRefs.current.filter(Boolean);
        if (!captionRef.current || !values.length) return;
        if (focusIndex === null && !captionShownRef.current) return;
        // Saliendo al menú: el foco se suelta en este mismo ciclo.
        if (shouldHide && focusIndex !== null) return;

        captionTlRef.current?.kill();
        gsap.killTweensOf([...values, ...labels]);
        const tl = gsap.timeline();
        captionTlRef.current = tl;

        if (focusIndex === null) {
            const E = CAPTION_ANIM.exit;
            captionShownRef.current = false;
            tl.to([...labels, ...values], {
                yPercent: -INFO_ANIM.fromYPercent,
                duration: E.duration,
                ease: E.ease,
                stagger: E.stagger,
                force3D: true,
            }, 0);
            tl.set(captionRef.current, { visibility: 'hidden' });
            return;
        }

        if (captionShownRef.current) {
            // De una imagen a otra: solo los valores que cambian (o que se
            // quedaron a medias por un paso anterior interrumpido).
            const S = CAPTION_ANIM.swap;
            const n = images.length;
            const prev = captionIndexRef.current;
            const dir = ((focusIndex - prev + n) % n) <= n / 2 ? 1 : -1;
            const before = captionRowsFor(prev);
            const after = captionRowsFor(focusIndex);
            const changed = after
                .map((row, i) => {
                    const el = captionLinesRef.current[i];
                    if (!el) return -1;
                    return row !== before[i] || Number(gsap.getProperty(el, 'yPercent')) !== 0 ? i : -1;
                })
                .filter((i) => i >= 0);
            captionDelayRef.current = 0;
            if (changed.length) {
                tl.to(changed.map((i) => captionLinesRef.current[i]), {
                    yPercent: -dir * INFO_ANIM.fromYPercent,
                    duration: S.out,
                    ease: S.outEase,
                    stagger: S.stagger,
                    force3D: true,
                }, 0);
            }
            tl.call(() => setCaption({ index: focusIndex, changed, dir }));
            return;
        }

        // Entrada al detalle: la ficha del proyecto se queda; entra la leyenda
        // junto al hueco de la tira.
        captionShownRef.current = true;
        captionDelayRef.current = CAPTION_ANIM.inDelay;
        markReady('text');
        setCaption({ index: focusIndex, changed: null, dir: 1 });
    }, [focusIndex, shouldHide, markReady]);

    // La leyenda con su contenido ya actualizado.
    useLayoutEffect(() => {
        captionIndexRef.current = caption.index;
        const values = captionLinesRef.current;
        const labels = captionLabelRefs.current;
        const all = [...labels, ...values].filter(Boolean);
        if (!captionRef.current || !all.length) return;
        if (!captionShownRef.current) {
            gsap.set(all, { yPercent: INFO_ANIM.fromYPercent });
            return;
        }
        gsap.set(captionRef.current, { visibility: 'visible' });

        if (!caption.changed) {
            // Primera entrada: fila a fila, etiqueta y valor juntos.
            const E = CAPTION_ANIM.enter;
            const delay = captionDelayRef.current;
            gsap.set(all, { yPercent: INFO_ANIM.fromYPercent });
            labels.forEach((label, i) => {
                const pair = [label, values[i]].filter(Boolean);
                if (!pair.length) return;
                gsap.to(pair, {
                    yPercent: 0,
                    duration: E.duration,
                    ease: E.ease,
                    delay: delay + i * E.stagger,
                    force3D: true,
                });
            });
            return;
        }

        const S = CAPTION_ANIM.swap;
        const lines = caption.changed.map((i) => values[i]).filter(Boolean);
        if (lines.length) {
            gsap.fromTo(lines, { yPercent: caption.dir * INFO_ANIM.fromYPercent }, {
                yPercent: 0,
                duration: S.in,
                ease: S.ease,
                stagger: S.stagger,
                force3D: true,
            });
        }
    }, [caption]);

    useEffect(() => () => captionTlRef.current?.kill(), []);

    useEffect(() => {
        const updateNavbarHeight = () => {
            const navbar = document.querySelector('[data-navbar]');
            if (navbar) {
                setNavbarHeight(navbar.getBoundingClientRect().height + 16);
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
                // Aviso para el footer (index6): el nombre de "Next" entra justo
                // detrás del título de la ficha, nunca antes.
                window.dispatchEvent(new CustomEvent('kc:detail-info-in', { detail: { projectId: project?.id } }));
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
    // El dominio ya está en la ficha (Web): en la leyenda va solo la ruta.
    const captionUrlLabel = captionHref
        ? (captionEntry.path || captionHref.replace(/^https?:\/\//, '').replace(/^www\./, ''))
        : null;

    const ink = isDarkMode ? 'white' : 'black';
    const mutedInk = isDarkMode ? PAGE.mutedDark : PAGE.muted;
    const projectName = PROJECT_NAME[project.id] || text.title;
    const labelW = columnsWidthPx(1, viewportW);
    // Fila etiqueta | valor: la etiqueta ocupa 1 columna, el valor empieza en
    // la línea de la columna 2 (mismo esquema en slider y en detalle).
    const row = (label, value, key, style) => (
        <span
            key={key}
            className="grid"
            style={{ gridTemplateColumns: `${labelW}px minmax(0, 1fr)`, columnGap: PAGE.gap, ...style }}
        >
            <span data-split style={{ color: mutedInk }}>{label}</span>
            <span data-split>{value}</span>
        </span>
    );
    const info = parseInfo(text);
    // Línea de la imagen: bajo la hoja en foco, en su borde izquierdo
    // (detailColumn). Desktop = detailSpan cols de ancho; mobile = misma
    // altura que una desktop en detalle (ver heroTarget en index5).
    // Ficha de la imagen: dentro del hueco, 2 columnas (etiqueta | valor),
    // desde su borde superior (ver onHoleFrame).
    const captionW = columnsWidthPx(2, viewportW);
    const lineMask = { paddingBottom: INFO_ANIM.cushion, marginBottom: `-${INFO_ANIM.cushion}` };
    const captionLink = captionHref ? (
        <a
            href={captionHref}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:opacity-80 transition-opacity"
            style={{ pointerEvents: focusIndex === null ? 'none' : 'auto' }}
        >
            {/* Corte preferente tras cada "/": /artist/ ⏎ pyramidal_decode/ */}
            {captionUrlLabel.split('/').map((part, i, arr) => (
                <span key={i}>{part}{i < arr.length - 1 ? <>/<wbr /></> : null}</span>
            ))}{' '}
            <span className="relative top-[0.09em]">{'\u2197\uFE0E'}</span>
        </a>
    ) : null;
    const captionRows = [
        { key: 'image', label: 'Image', value: <span className="tabular-nums">{pad2(captionIndex + 1)} / {pad2(images.length)}</span> },
        { key: 'page', label: 'Page', value: captionEntry.page },
        { key: 'view', label: 'View', value: captionEntry.view ? capFirst(captionEntry.view) : '—' },
        ...(captionLink ? [{ key: 'link', label: 'Link', value: captionLink }] : []),
    ];
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
            // Note: la frase del proyecto (la misma que la hoja Info móvil), con una línea en blanco debajo.
            project.info?.summary ? row('Note', project.info.summary, 'note', { marginBottom: '1em' }) : null,
            info.sector ? row('Sector', info.sector, 'sector') : null,
            project.info?.year ? row('Year', project.info.year, 'year') : null,
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

    if (isAbout && ABOUT_LAYOUT !== 'stack') {
        const AboutLayout =
            {
                fold: AboutFold,
                paper: AboutPaper,
                'grid-cut': AboutGridCut,
            }[ABOUT_LAYOUT] || AboutContactSheet;
        return (
            <div
                className="fixed top-0 left-0 w-full h-screen z-10 transition-opacity pointer-events-none"
                style={{ opacity: isVisible || fromHover ? 1 : 0, transitionDuration: fromHover ? '0s' : '0.8s' }}
            >
                <AboutLayout
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
                    data-detail-info
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
                <>
                    {/* Ancla de la ficha (la mueve onHoleFrame): la ficha va dentro del hueco. */}
                    <div
                        ref={captionRef}
                        className="kc-blend fixed left-0 top-0 z-[40] text-[length:var(--kc-type)] leading-[1] pointer-events-none"
                        style={{ visibility: 'hidden', color: ink, width: 0, willChange: 'transform' }}
                    >
                        <div className="absolute left-0 top-0" style={{ width: captionW }}>
                            {captionRows.map((r, i) => (
                                <div
                                    key={r.key}
                                    className="grid"
                                    style={{
                                        // Dentro del hueco (2 cols) la etiqueta mide lo que "Image" (la
                                        // más larga), igual en todas las filas: así el valor tiene sitio
                                        // para rutas como /artist/pyramidal_decode/.
                                        gridTemplateColumns: '3em minmax(0, 1fr)',
                                        columnGap: PAGE.gap,
                                        marginBottom: r.key === 'view' ? '1em' : 0,
                                    }}
                                >
                                    {/* Etiqueta: solo entra y sale con la leyenda; al pasar de imagen se queda. */}
                                    <span className="block overflow-clip" style={lineMask}>
                                        <span
                                            ref={(el) => {
                                                captionLabelRefs.current[i] = el;
                                            }}
                                            className="block"
                                            style={{ color: mutedInk }}
                                        >
                                            {r.label}
                                        </span>
                                    </span>
                                    {/* Valor: rueda en el sentido del paso. */}
                                    <span className="block overflow-clip" style={lineMask}>
                                        <span
                                            ref={(el) => {
                                                captionLinesRef.current[i] = el;
                                            }}
                                            className="block"
                                            style={{ overflowWrap: 'anywhere' }}
                                        >
                                            {r.value}
                                        </span>
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </>,
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
                        onHoleFrame={handleHoleFrame}
                        onReady={handleSceneReady}
                        hidden={shouldHide}
                    />
                </div>
            )}
        </div>
    );
}
