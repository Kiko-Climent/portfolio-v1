'use client';

/**
 * [Versión anterior, tabla con filetes — guardada por si se vuelve a ella.]
 * Índice móvil (v3, "opción 1": un solo tamaño de texto en toda la web).
 * Tabla de contenidos a pantalla completa: No. · Project · Images, con filete
 * negro bajo la cabecera y filetes finos entre filas, como el índice de un
 * informe. Filas de 32 px (zona táctil por encima de los 24 px de WCAG 2.5.8)
 * con el texto a --kc-type-mobile-2: el aire es de tabla, no de párrafo, así
 * que el interlineado sigue apretado dentro de cada fila.
 * Debajo, la primera imagen del proyecto activo (sliderBus 'active').
 * Fondo sólido; sube con la misma cortina clip-path que InfoSheetMobile y las
 * filas entran con máscara. La abre/cierra la barra de FooterMobile3.
 */

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { useDarkMode } from '@/contexts/DarkModeContext';
import { projects } from '@/components/data/projects';
import { PROJECT_NAME, gridFileName, pad2 } from '@/components/data/grid';
import { MOBILE_GRID, mobileAnchorPx } from '@/lib/mobileGrid';
import { mediaAspect, mediaKey, mediaSrc } from '@/lib/media';

export const INDEX_ORDER = ['johnny', 'salon', 'alt', 'mmdiscos', 'about'];

const ROW_H = 32;
// Hueco que deja abajo para la barra del footer (FooterMobile3 → BAR_H).
const BAR_SPACE = 56;

const SHEET_ANIM = { inDuration: 0.8, inEase: 'expo.out', outDuration: 0.5, outEase: 'power3.in' };
const ROWS_ANIM = {
  fromYPercent: 110,
  duration: 0.8,
  ease: 'power4.out',
  stagger: 0.045,
  delay: 0.12,
  out: { yPercent: -110, duration: 0.3, ease: 'power3.in', stagger: 0.02 },
};

const firstImageId = (id) => projects[id]?.slider?.images?.[0]?.id ?? 1;
const imageCount = (id) => (id === 'about' ? '—' : pad2(projects[id]?.slider?.images?.length ?? 0));

export default function IndexSheetMobile({ open, activeId, onSelect }) {
  const { isDarkMode } = useDarkMode();
  const sheetRef = useRef(null);
  const tlRef = useRef(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet) return undefined;
    const first = !mountedRef.current;
    mountedRef.current = true;
    if (first && !open) return undefined;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const inners = sheet.querySelectorAll('[data-row-inner]');
    tlRef.current?.kill();

    if (open) {
      // Debajo del navbar, en la misma línea donde se asienta la hoja activa.
      sheet.style.paddingTop = `${mobileAnchorPx()}px`;
      gsap.set(sheet, { display: 'block', y: 0 });
      if (reduce) {
        gsap.set(sheet, { clipPath: 'inset(0% 0% 0% 0%)' });
        gsap.set(inners, { yPercent: 0 });
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
        inners,
        { yPercent: ROWS_ANIM.fromYPercent },
        { yPercent: 0, duration: ROWS_ANIM.duration, ease: ROWS_ANIM.ease, stagger: ROWS_ANIM.stagger, force3D: true },
        ROWS_ANIM.delay
      );
      tlRef.current = tl;
    } else {
      if (reduce) {
        gsap.set(sheet, { display: 'none' });
        return undefined;
      }
      const tl = gsap.timeline({ onComplete: () => gsap.set(sheet, { display: 'none' }) });
      tl.to(inners, { ...ROWS_ANIM.out, force3D: true }, 0);
      tl.to(
        sheet,
        { clipPath: 'inset(100% 0% 0% 0%)', duration: SHEET_ANIM.outDuration, ease: SHEET_ANIM.outEase },
        0.1
      );
      tlRef.current = tl;
    }
    return undefined;
  }, [open]);

  useEffect(() => () => tlRef.current?.kill(), []);

  const ink = isDarkMode ? '#ffffff' : '#000000';
  const muted = isDarkMode ? MOBILE_GRID.mutedDark : MOBILE_GRID.muted;
  const rule = isDarkMode ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.1)';
  const paper = isDarkMode ? '#000000' : '#ffffff';

  const previewId = INDEX_ORDER.includes(activeId) ? activeId : INDEX_ORDER[0];
  const previewProject = projects[previewId];
  const previewKey = previewProject ? mediaKey(previewProject, firstImageId(previewId)) : null;
  const grid = { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', columnGap: MOBILE_GRID.gap };

  return (
    <section
      ref={sheetRef}
      role="dialog"
      aria-modal="true"
      aria-label="Index"
      aria-hidden={!open}
      className="absolute inset-0 z-40 text-[length:var(--kc-type-mobile-2)] font-semibold"
      style={{
        display: 'none',
        backgroundColor: paper,
        color: ink,
        lineHeight: 'var(--kc-leading-mobile-2)',
        letterSpacing: '-0.01em',
        paddingLeft: MOBILE_GRID.pad,
        paddingRight: MOBILE_GRID.pad,
        paddingBottom: `calc(${BAR_SPACE}px + env(safe-area-inset-bottom, 0px))`,
      }}
    >
      {/* Cabecera de la tabla */}
      <div className="overflow-hidden" style={{ borderBottom: `1px solid ${ink}` }}>
        <div data-row-inner style={{ ...grid, paddingBottom: 8, fontSize: 10, lineHeight: '12px', color: muted }}>
          <span>No.</span>
          <span style={{ gridColumn: '2 / span 2' }}>Project</span>
          <span style={{ textAlign: 'right' }}>Images</span>
        </div>
      </div>

      {INDEX_ORDER.map((id, i) => (
        <button
          key={id}
          type="button"
          onClick={() => onSelect?.(id)}
          className="block w-full overflow-hidden text-left cursor-pointer"
          style={{ height: ROW_H, borderBottom: `1px solid ${rule}`, color: id === previewId ? ink : muted }}
        >
          <span data-row-inner style={{ ...grid, height: ROW_H, alignItems: 'center' }}>
            <span className="tabular-nums">{pad2(i + 1)}</span>
            <span style={{ gridColumn: '2 / span 2' }}>{PROJECT_NAME[id]}</span>
            <span className="tabular-nums" style={{ textAlign: 'right' }}>{imageCount(id)}</span>
          </span>
        </button>
      ))}

      {previewKey ? (
        <div className="overflow-hidden" style={{ marginTop: 32 }}>
          <figure data-row-inner className="m-0" style={grid}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mediaSrc(previewKey, 'sm')}
              alt=""
              className="block w-full object-cover"
              style={{ gridColumn: '2 / span 3', aspectRatio: `1 / ${mediaAspect(previewKey)}` }}
            />
            <figcaption style={{ gridColumn: '2 / span 3', marginTop: 4, fontSize: 10, lineHeight: '11px' }}>
              {gridFileName(previewId, 1)}
            </figcaption>
          </figure>
        </div>
      ) : null}
    </section>
  );
}
