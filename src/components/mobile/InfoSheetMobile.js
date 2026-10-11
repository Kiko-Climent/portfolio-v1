'use client';

/**
 * Hoja "Info" del detalle móvil: fondo sólido (sin blur ni transparencia, sin
 * filete), sube con la misma cortina clip-path de abajo arriba que las
 * imágenes y su texto entra por líneas con máscara (INFO_ANIM, como el bloque
 * de info de escritorio). La barra "← Index · Info −" del footer queda encima,
 * en difference: sobre la hoja sale en negro.
 * Datos: project.info (summary, role, year, stack) + project.slider.text (web).
 */

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { useDarkMode } from '@/contexts/DarkModeContext';
import { MOBILE_GRID } from '@/lib/mobileGrid';

gsap.registerPlugin(SplitText);

const SHEET_ANIM = {
    inDuration: 0.8,
    inEase: 'expo.out',
    outDuration: 0.5,
    outEase: 'power3.in',
};
const LINES_ANIM = {
    cushion: '0.2em',
    fromYPercent: 130,
    duration: 0.9,
    ease: 'power4.out',
    stagger: 0.06,
    delay: 0.15,
    out: { yPercent: -130, duration: 0.35, ease: 'power3.in', stagger: 0.02 },
};

// Deslizar hacia abajo para cerrar: a partir de esta distancia (o un gesto rápido) se cierra;
// si no, la hoja vuelve a su sitio.
const DRAG_CLOSE_PX = 70;
const DRAG_CLOSE_VELOCITY = 0.6; // px/ms

export default function InfoSheetMobile({ project, open, onClose }) {
    const { isDarkMode } = useDarkMode();
    const sheetRef = useRef(null);
    const contentRef = useRef(null);
    const splitRef = useRef(null);
    const tlRef = useRef(null);
    const dragRef = useRef(null);
    const draggedOutRef = useRef(false);

    const info = project?.info;
    const text = project?.slider?.text;

    useEffect(() => {
        const sheet = sheetRef.current;
        const content = contentRef.current;
        if (!sheet || !content) return undefined;
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        tlRef.current?.kill();

        if (open) {
            gsap.set(sheet, { display: 'block' });
            splitRef.current?.revert();
            const split = new SplitText(content.querySelectorAll('[data-line]'), {
                type: 'lines',
                mask: 'lines',
                linesClass: 'info-line',
            });
            split.lines.forEach((line) => {
                const wrap = line.parentElement;
                if (!wrap) return;
                wrap.style.overflow = 'clip';
                wrap.style.paddingBottom = LINES_ANIM.cushion;
                wrap.style.marginBottom = `-${LINES_ANIM.cushion}`;
            });
            splitRef.current = split;

            if (reduceMotion) {
                gsap.set(sheet, { clipPath: 'inset(0% 0% 0% 0%)' });
                gsap.set(split.lines, { yPercent: 0 });
                return undefined;
            }
            const tl = gsap.timeline();
            tl.fromTo(
                sheet,
                { clipPath: 'inset(100% 0% 0% 0%)' },
                { clipPath: 'inset(0% 0% 0% 0%)', duration: SHEET_ANIM.inDuration, ease: SHEET_ANIM.inEase },
                0
            );
            tl.fromTo(
                split.lines,
                { yPercent: LINES_ANIM.fromYPercent },
                {
                    yPercent: 0,
                    duration: LINES_ANIM.duration,
                    ease: LINES_ANIM.ease,
                    stagger: LINES_ANIM.stagger,
                    force3D: true,
                },
                LINES_ANIM.delay
            );
            tlRef.current = tl;
        } else {
            const split = splitRef.current;
            if (draggedOutRef.current) {
                draggedOutRef.current = false;
                gsap.set(sheet, { display: 'none', y: 0 });
                split?.revert();
                splitRef.current = null;
                return undefined;
            }
            if (!split) {
                gsap.set(sheet, { display: 'none' });
                return undefined;
            }
            const tl = gsap.timeline({
                onComplete: () => {
                    gsap.set(sheet, { display: 'none' });
                    split.revert();
                    splitRef.current = null;
                },
            });
            if (!reduceMotion) {
                tl.to(split.lines, { ...LINES_ANIM.out, force3D: true }, 0);
                tl.to(
                    sheet,
                    { clipPath: 'inset(100% 0% 0% 0%)', duration: SHEET_ANIM.outDuration, ease: SHEET_ANIM.outEase },
                    0.12
                );
            }
            tlRef.current = tl;
        }
        return undefined;
    }, [open]);

    useEffect(
        () => () => {
            tlRef.current?.kill();
            splitRef.current?.revert();
        },
        []
    );

    const handleTouchStart = (e) => {
        const touch = e.touches[0];
        if (!touch) return;
        dragRef.current = { startY: touch.clientY, lastY: touch.clientY, startT: performance.now() };
    };
    const handleTouchMove = (e) => {
        const drag = dragRef.current;
        const touch = e.touches[0];
        if (!drag || !touch || !sheetRef.current) return;
        drag.lastY = touch.clientY;
        // Solo hacia abajo: hacia arriba la hoja no se mueve.
        gsap.set(sheetRef.current, { y: Math.max(0, touch.clientY - drag.startY) });
    };
    const handleTouchEnd = () => {
        const drag = dragRef.current;
        dragRef.current = null;
        const sheet = sheetRef.current;
        if (!drag || !sheet) return;
        const dy = Math.max(0, drag.lastY - drag.startY);
        const velocity = dy / Math.max(1, performance.now() - drag.startT);
        if (dy > DRAG_CLOSE_PX || (dy > 12 && velocity > DRAG_CLOSE_VELOCITY)) {
            draggedOutRef.current = true;
            tlRef.current?.kill();
            gsap.to(sheet, {
                y: sheet.offsetHeight,
                duration: 0.35,
                ease: 'power3.out',
                onComplete: () => onClose?.(),
            });
        } else {
            gsap.to(sheet, { y: 0, duration: 0.45, ease: 'power3.out' });
        }
    };

    if (!info) return null;

    const ink = isDarkMode ? '#ffffff' : '#000000';
    const muted = isDarkMode ? MOBILE_GRID.mutedDark : MOBILE_GRID.muted;
    const rows = [
        ['Role', info.role],
        ['Year', info.year],
        ['Stack', info.stack],
    ];

    return (
        <section
            ref={sheetRef}
            aria-label={`${project.id} info`}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
            className="fixed left-0 right-0 bottom-0 z-[45] text-[length:var(--kc-type-mobile-2)] font-semibold"
            style={{
                display: 'none',
                lineHeight: 'var(--kc-leading-mobile-2)',
                backgroundColor: isDarkMode ? '#000000' : '#ffffff',
                color: ink,
                padding: `12px ${MOBILE_GRID.pad}px calc(1rem + env(safe-area-inset-bottom, 0px) + 22px + 16px)`,
            }}
        >
            <div ref={contentRef}>
                <p data-line style={{ marginBottom: '14px' }}>
                    {info.summary}
                </p>
                {rows.map(([label, value]) => (
                    <div
                        key={label}
                        className="grid"
                        style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', columnGap: MOBILE_GRID.gap }}
                    >
                        <span data-line style={{ gridColumn: '1 / span 1', color: muted }}>
                            {label}
                        </span>
                        <span data-line style={{ gridColumn: '2 / span 3' }}>
                            {value}
                        </span>
                    </div>
                ))}
                {text?.url ? (
                    <div className="grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', columnGap: MOBILE_GRID.gap }}>
                        <span data-line style={{ gridColumn: '1 / span 1', color: muted }}>
                            Web
                        </span>
                        <span data-line style={{ gridColumn: '2 / span 3' }}>
                            <a href={text.url} target="_blank" rel="noopener noreferrer">
                                {text.title}{' '}
                                <span className="relative top-[0.09em]">{'↗︎'}</span>
                            </a>
                        </span>
                    </div>
                ) : null}
            </div>
        </section>
    );
}
