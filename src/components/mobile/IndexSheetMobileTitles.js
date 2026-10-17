'use client';

/**
 * Índice móvil v5 — "E1": solo títulos + colofón.
 *   La Home y el detalle ya están llenos de imágenes: el Index se queda sin
 *   fotos, solo la tabla de contenidos, para que la página respire.
 *   Una columna a --kc-type-mobile-2 bajo la etiqueta gris "Projects": cada
 *   fila es el nombre (con su número de imágenes pequeño arriba a la derecha)
 *   y, en el otro margen, el número de proyecto. About va aparte, tras una
 *   línea en blanco, como 05. Un toque abre el proyecto (el que ya está
 *   abierto debajo cierra el Index; lo resuelve FooterMobile3).
 *   Abajo, encima de la barra, el colofón con la etiqueta en la columna 1
 *   (como la hoja Info): Location / Local time (en vivo) / Date, de Berlín.
 *   La frase de cada proyecto vive ahora en la hoja Info del detalle.
 * Versión anterior (acordeón con frase y miniaturas, vuelo del papel WebGL):
 * IndexSheetMobileAccordion.js.
 */

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { useDarkMode } from '@/contexts/DarkModeContext';
import { projects } from '@/components/data/projects';
import { PROJECT_NAME, pad2 } from '@/components/data/grid';
import { MOBILE_GRID, mobileHeadAnchorPx } from '@/lib/mobileGrid';

// El mismo orden que la 6c (el footer cuenta las entradas con esto).
export const INDEX_ORDER = ['johnny', 'salon', 'alt', 'mmdiscos', 'about'];
const PROJECT_ORDER = INDEX_ORDER.filter((id) => id !== 'about');

// Hueco que deja abajo para la barra del footer (FooterMobile3 → BAR_H).
const BAR_SPACE = 56;
// Aire bajo cada línea enmascarada para que no se corten los descendentes.
const CUSHION = '0.2em';

const SHEET_ANIM = { inDuration: 0.8, inEase: 'expo.out', outDuration: 0.5, outEase: 'power3.in' };
const TEXT_ANIM = {
  fromYPercent: 110,
  duration: 0.8,
  ease: 'power4.out',
  stagger: 0.04,
  delay: 0.12,
  out: { yPercent: -110, duration: 0.3, ease: 'power3.in', stagger: 0.02 },
  // Encima del About: los títulos esperan a que salgan las filas de contacto de
  // la cabecera (NavbarLoaderMobNew3 → CONTACT_ANIM.outForIndex), que ocupan ese sitio.
  delayOverAbout: 0.42,
};

// Colofón: dónde está el estudio. La hora y la fecha, siempre las de Berlín.
const LOCATION = 'Berlin, Friedrichshain';
const TIME_ZONE = 'Europe/Berlin';
const timeFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
  timeZoneName: 'short',
});
const dateFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});
const partsOf = (format, date) =>
  Object.fromEntries(format.formatToParts(date).map(({ type, value }) => [type, value]));
// 14:32:07 CEST
const formatTime = (date) => {
  const p = partsOf(timeFormat, date);
  return `${p.hour}:${p.minute}:${p.second} ${p.timeZoneName}`;
};
// Sun 18.10.2026
const formatDate = (date) => {
  const p = partsOf(dateFormat, date);
  return `${p.weekday} ${p.day}.${p.month}.${p.year}`;
};

const imageCount = (id) => pad2(projects[id]?.slider?.images?.length ?? 0);

/**
 * open: visible. currentId: proyecto abierto ahora (si el Index está encima
 * de un detalle o del About). onSelect(id, { handoff }): abrir ese proyecto.
 * (activeId lo pasa el footer por compatibilidad con el acordeón; aquí no hay
 * proyecto seleccionado.)
 */
export default function IndexSheetMobileTitles({ open, currentId = null, onSelect }) {
  const { isDarkMode } = useDarkMode();
  const sheetRef = useRef(null);
  const scrollRef = useRef(null);
  const tlRef = useRef(null);
  const mountedRef = useRef(false);
  const [now, setNow] = useState(() => new Date());

  // Reloj del colofón: solo corre con el Index abierto.
  useEffect(() => {
    if (!open) return undefined;
    const tick = () => setNow(new Date());
    const first = requestAnimationFrame(tick);
    const timer = setInterval(tick, 1000);
    return () => {
      cancelAnimationFrame(first);
      clearInterval(timer);
    };
  }, [open]);

  // ── Entrada / salida de la hoja ─────────────────────────────────────────
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
    const sheet = sheetRef.current;
    if (!sheet) return undefined;
    // Solo hay salida si antes hubo entrada (StrictMode relanza el efecto al montar).
    if (!open && !mountedRef.current) return undefined;
    if (open) mountedRef.current = true;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const inners = sheet.querySelectorAll('[data-text-inner]');
    tlRef.current?.kill();

    if (open) {
      // Bajo la cabecera de tres líneas (aunque encima del About asome su contacto).
      sheet.style.paddingTop = `${mobileHeadAnchorPx()}px`;
      if (scrollRef.current) scrollRef.current.scrollTop = 0;
      gsap.set(sheet, { display: 'flex' });
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
        { yPercent: TEXT_ANIM.fromYPercent },
        { yPercent: 0, duration: TEXT_ANIM.duration, ease: TEXT_ANIM.ease, stagger: TEXT_ANIM.stagger, force3D: true },
        currentId === 'about' ? TEXT_ANIM.delayOverAbout : TEXT_ANIM.delay
      );
      tlRef.current = tl;
      return undefined;
    }

    const done = () => {
      // Si se ha vuelto a abrir mientras salía, no se desmonta nada.
      if (openRef.current) return;
      gsap.set(sheet, { display: 'none' });
    };
    if (reduce) {
      done();
      return undefined;
    }
    const tl = gsap.timeline({ onComplete: done });
    tl.to(inners, { ...TEXT_ANIM.out, force3D: true }, 0);
    tl.to(sheet, { clipPath: 'inset(100% 0% 0% 0%)', duration: SHEET_ANIM.outDuration, ease: SHEET_ANIM.outEase }, 0.25);
    tlRef.current = tl;
    return undefined;
    // currentId se lee al abrir; no relanza la entrada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => () => tlRef.current?.kill(), []);

  const select = (id) => onSelect?.(id, { handoff: false });

  const ink = isDarkMode ? '#ffffff' : '#000000';
  const muted = isDarkMode ? MOBILE_GRID.mutedDark : MOBILE_GRID.muted;
  // Etiqueta de sección ("Projects"): un gris más claro que el de los inactivos.
  const label = isDarkMode ? '#5c5c5c' : '#b3b3b3';
  const paper = isDarkMode ? '#000000' : '#ffffff';
  const rowButton = {
    display: 'block',
    width: '100%',
    padding: 0,
    border: 0,
    background: 'none',
    color: ink,
    font: 'inherit',
    letterSpacing: 'inherit',
    lineHeight: 'inherit',
    textAlign: 'left',
    cursor: 'pointer',
  };
  // Máscara de una línea para la entrada por líneas (con aire para los descendentes).
  const mask = { display: 'block', overflow: 'hidden', paddingBottom: CUSHION, marginBottom: `-${CUSHION}` };
  // Cifra volada: pequeña y pegada arriba de su línea, sin pasar de las mayúsculas.
  const capStyle = {
    fontSize: '0.64em',
    lineHeight: 1,
    verticalAlign: 'top',
    position: 'relative',
    top: '0.02em',
    marginLeft: '0.12em',
    letterSpacing: 0,
  };
  const grid4 = {
    display: 'grid',
    gridTemplateColumns: `repeat(${MOBILE_GRID.columns}, minmax(0, 1fr))`,
    columnGap: MOBILE_GRID.gap,
  };

  const colophon = [
    ['Location', LOCATION],
    ['Local time', formatTime(now)],
    ['Date', formatDate(now)],
  ];

  return (
    <section
      ref={sheetRef}
      role="dialog"
      aria-modal="true"
      aria-label="Index"
      aria-hidden={!open}
      className="absolute inset-0 z-40 flex-col text-[length:var(--kc-type-mobile-2)] font-semibold"
      style={{
        display: 'none',
        backgroundColor: paper,
        color: ink,
        lineHeight: 'var(--kc-leading-mobile-2)',
        letterSpacing: '-0.01em',
        paddingBottom: `calc(${BAR_SPACE}px + env(safe-area-inset-bottom, 0px))`,
      }}
    >
      <nav
        ref={scrollRef}
        aria-label="Projects"
        style={{
          flex: '1 1 auto',
          minHeight: 0,
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          paddingLeft: MOBILE_GRID.pad,
          paddingRight: MOBILE_GRID.pad,
        }}
      >
        <span style={mask}>
          <span data-text-inner className="block" style={{ color: label }}>
            Projects
          </span>
        </span>

        {PROJECT_ORDER.map((id, i) => (
          <button
            key={id}
            type="button"
            onClick={() => select(id)}
            aria-current={id === currentId ? 'page' : undefined}
            aria-label={`Open ${PROJECT_NAME[id]}, ${imageCount(id)} images`}
            style={rowButton}
          >
            <span style={mask}>
              <span data-text-inner className="flex justify-between">
                <span>
                  {PROJECT_NAME[id]}
                  <span className="tabular-nums" style={capStyle}>
                    {imageCount(id)}
                  </span>
                </span>
                <span className="tabular-nums">{pad2(i + 1)}</span>
              </span>
            </span>
          </button>
        ))}

        <button
          type="button"
          onClick={() => select('about')}
          aria-current={currentId === 'about' ? 'page' : undefined}
          style={{ ...rowButton, marginTop: 'calc(var(--kc-leading-mobile-2) * 1em)', marginBottom: MOBILE_GRID.rowGap }}
        >
          <span style={mask}>
            <span data-text-inner className="flex justify-between">
              <span>{PROJECT_NAME.about}</span>
              <span className="tabular-nums">{pad2(INDEX_ORDER.length)}</span>
            </span>
          </span>
        </button>
      </nav>

      {/* Colofón: etiqueta en la columna 1, valor en las 2–4 (como la hoja Info) */}
      <dl
        className="m-0"
        style={{
          ...grid4,
          flex: 'none',
          paddingLeft: MOBILE_GRID.pad,
          paddingRight: MOBILE_GRID.pad,
          paddingBottom: MOBILE_GRID.gap,
        }}
      >
        {colophon.map(([term, value]) => (
          <div key={term} style={{ display: 'contents' }}>
            <dt style={{ ...mask, gridColumn: '1 / span 1' }}>
              <span data-text-inner className="block" style={{ color: muted }}>
                {term}
              </span>
            </dt>
            <dd className="m-0" style={{ ...mask, gridColumn: '2 / span 3' }}>
              <span data-text-inner className="block tabular-nums">
                {value}
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
