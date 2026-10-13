'use client';

import { useCallback, useEffect, useRef } from 'react';
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(SplitText);

// Mismos valores que INFO_ANIM en ProjectImageSliderThreeGrid.
export const INFO_ANIM = {
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

/** Línea suelta con su máscara (mismo colchón que las de SplitText). */
export function Line({ lineRef, children, className = '', style }) {
  return (
    <span
      className={`block overflow-clip ${className}`}
      style={{ paddingBottom: INFO_ANIM.cushion, marginBottom: `-${INFO_ANIM.cushion}`, ...style }}
    >
      <span ref={lineRef} className="block">
        {children}
      </span>
    </span>
  );
}

/**
 * Reveal por líneas del About (mismo lenguaje que el bloque de info de las
 * galerías). Junta las líneas sueltas (<Line lineRef={addLine}>) y las de los
 * párrafos marcados con data-split (SplitText), y las ordena por filas: las que
 * están a la misma altura suben juntas. Los bloques dentro de `parallelRef`
 * llevan su propia cuenta de filas y entran a la vez que el resto.
 *
 * Devuelve addLine, reveal() (cuando las imágenes ya están en pantalla) y
 * hide() (salida al volver al menú, apretada para acabar antes de ~1.1 s).
 */
export function useLineReveal({ rootRef, parallelRef, onDone }) {
  const linesRef = useRef(new Set());
  const orderedRef = useRef(null);
  const wantRevealRef = useRef(false);
  const hiddenRef = useRef(false);
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  const addLine = useCallback((el) => {
    if (el) linesRef.current.add(el);
  }, []);

  const play = useCallback(() => {
    const lines = orderedRef.current;
    if (!lines || hiddenRef.current) return;
    gsap.to(lines, {
      yPercent: 0,
      duration: INFO_ANIM.duration,
      ease: INFO_ANIM.ease,
      stagger: (i, el) => Number(el.dataset.row || i) * INFO_ANIM.stagger,
      delay: INFO_ANIM.delay,
      force3D: true,
      onComplete: () => onDoneRef.current?.(),
    });
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    let splits = [];

    const timer = setTimeout(() => {
      splits = Array.from(root.querySelectorAll('[data-split]')).map(
        (cell) => new SplitText(cell, { type: 'lines', mask: 'lines', linesClass: 'info-line' })
      );
      splits.forEach((sp) =>
        sp.lines.forEach((line) => {
          const wrap = line.parentElement;
          if (!wrap) return;
          wrap.style.paddingBottom = INFO_ANIM.cushion;
          wrap.style.marginBottom = `-${INFO_ANIM.cushion}`;
        })
      );

      const lines = [...linesRef.current, ...splits.flatMap((sp) => sp.lines)].filter((l) => l.isConnected);
      if (!lines.length) return;
      const topOf = (l) => Math.round(l.getBoundingClientRect().top);
      const inParallel = (l) => !!parallelRef?.current?.contains(l);
      [false, true].forEach((group) => {
        const groupLines = lines.filter((l) => inParallel(l) === group);
        const tops = [...new Set(groupLines.map(topOf))].sort((a, b) => a - b);
        groupLines.forEach((l) => {
          l.dataset.row = String(tops.indexOf(topOf(l)));
        });
      });
      lines.sort((a, b) => Number(a.dataset.row) - Number(b.dataset.row));
      orderedRef.current = lines;

      gsap.set(lines, { yPercent: INFO_ANIM.fromYPercent });
      if (wantRevealRef.current) play();
    }, 60);

    return () => {
      clearTimeout(timer);
      splits.forEach((sp) => sp.revert());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reveal = useCallback(() => {
    wantRevealRef.current = true;
    play();
  }, [play]);

  const hide = useCallback(() => {
    hiddenRef.current = true;
    const lines = orderedRef.current;
    if (!lines?.length) return;
    const maxRow = Math.max(1, ...lines.map((l) => Number(l.dataset.row || 0)));
    const rowStagger = Math.min(INFO_ANIM.out.stagger, 0.45 / maxRow);
    gsap.killTweensOf(lines);
    gsap.to(lines, {
      yPercent: INFO_ANIM.out.yPercent,
      duration: INFO_ANIM.out.duration,
      ease: INFO_ANIM.out.ease,
      stagger: (i, el) => Number(el.dataset.row || 0) * rowStagger,
      force3D: true,
    });
  }, []);

  return { addLine, reveal, hide };
}
