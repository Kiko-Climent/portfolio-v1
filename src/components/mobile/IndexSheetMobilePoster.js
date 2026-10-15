'use client';

/**
 * [Versión anterior: póster recortado (con IndexPosterPaperCrop.js). Guardada por si se vuelve a ella.]
 * Índice móvil v3 — "Index 2a": índice corrido + póster en papel.
 *   Arriba, un solo párrafo a --kc-type-mobile-2, como el índice de un libro:
 *   "Johnny Carretes 13, Salon Vilarnau 11, Against Low Trends 07, MM Discos 09,
 *   About." (las cifras, mismo tamaño y en gris: un superíndice chocaría con
 *   la línea de arriba con este interlineado). El seleccionado en negro, el resto en gris. Sin filetes ni aire
 *   entre líneas (interlineado de texto). Enlaces dentro de una frase: WCAG
 *   2.5.8 los exime del mínimo de 24 px.
 *   Debajo, la portada del seleccionado ocupa todo el alto libre
 *   (IndexPosterPaper, WebGL). Swipe lateral → proyecto siguiente/anterior con
 *   el cambio de hoja de papel del detalle de escritorio; el nombre activo del
 *   párrafo pasa al nuevo. Tocar un nombre gris lo selecciona; tocar el
 *   seleccionado o el póster abre el proyecto.
 *   Folio bajo el póster: nombre de archivo de la portada y nº de proyecto.
 *   Abrir desde el póster (proyectos, no About) hace el relevo a la galería:
 *   el texto y el papel de fondo se van, y el póster vuela a su hueco en el
 *   slider del proyecto (lib/indexHandoff, lib/mobileGallery).
 * Versión anterior (tabla con filetes): IndexSheetMobileTable.js.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { useDarkMode } from '@/contexts/DarkModeContext';
import { projects } from '@/components/data/projects';
import { PROJECT_NAME, gridFileName, pad2 } from '@/components/data/grid';
import { MOBILE_GRID, mobileAnchorPx } from '@/lib/mobileGrid';
import { mediaKey, mediaSrc } from '@/lib/media';
import { LazyComponent, loadIndexPosterCrop as loadIndexPoster } from '@/lib/lazyComponents';
import { indexHandoff } from '@/lib/indexHandoff';
import { predictSlideRect } from '@/lib/mobileGallery';

export const INDEX_ORDER = ['johnny', 'salon', 'alt', 'mmdiscos', 'about'];

// Portada de cada proyecto en el índice: id de imagen (= el número del
// archivo, vilarnau_04.png → 4) y punto de interés para el recorte del póster
// (focusX / focusY, 0–1 desde la izquierda / desde arriba).
const INDEX_COVER = {
  johnny: { id: 1 },
  salon: { id: 4 },
  alt: { id: 11 },
  mmdiscos: { id: 9, focusX: 0 }, // "LIVING THE MEDITERRANEAN…" se lee desde la izquierda
  about: { id: 1 },
};
const coverOf = (id) => INDEX_COVER[id] ?? { id: 1 };

// Hueco que deja abajo para la barra del footer (FooterMobile3 → BAR_H).
const BAR_SPACE = 56;
const SWIPE = { minPx: 40, ratio: 1.2 };

const SHEET_ANIM = { inDuration: 0.8, inEase: 'expo.out', outDuration: 0.5, outEase: 'power3.in' };
const TEXT_ANIM = {
  fromYPercent: 110,
  duration: 0.8,
  ease: 'power4.out',
  stagger: 0.06,
  delay: 0.12,
  out: { yPercent: -110, duration: 0.3, ease: 'power3.in', stagger: 0.03 },
};

const imageCount = (id) => (id === 'about' ? null : pad2(projects[id]?.slider?.images?.length ?? 0));
const coverKey = (id) => (projects[id] ? mediaKey(projects[id], coverOf(id).id) : null);

// Salida en modo relevo: el texto se va y el papel de fondo se aclara para
// que se vea el slider del proyecto debajo mientras el póster vuela.
const HANDOFF_EXIT = { paperAt: 0.45, paperDuration: 0.35, failSafeMs: 6000 };

/**
 * open: visible. activeId: proyecto con el que arranca (el del ancla o el abierto).
 * currentId: proyecto abierto ahora (si el Index está encima de un detalle).
 * onSelect(id, { handoff }): abrir ese proyecto (handoff = vuela el póster).
 */
export default function IndexSheetMobile({ open, activeId, currentId = null, onSelect }) {
  const { isDarkMode } = useDarkMode();
  const sheetRef = useRef(null);
  const tlRef = useRef(null);
  const mountedRef = useRef(false);
  const touchRef = useRef(null);
  const frameRef = useRef(null);
  const handoffRef = useRef(false);
  const [flight, setFlight] = useState(null);

  const [selected, setSelected] = useState(0);
  const [step, setStep] = useState(1);
  // El póster WebGL vive mientras la hoja está abierta (y durante su salida).
  const [posterOn, setPosterOn] = useState(false);
  const [posterReady, setPosterReady] = useState(false);

  // Al abrir, el índice arranca en el proyecto que estaba en el ancla del slider.
  // (Ajuste de estado al cambiar la prop, sin efecto.)
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      const i = INDEX_ORDER.indexOf(activeId);
      setSelected(i >= 0 ? i : 0);
      setStep(1);
      setPosterOn(true);
    }
  }

  const covers = useMemo(
    () =>
      INDEX_ORDER.map((id) => {
        const key = coverKey(id);
        const { focusX, focusY } = coverOf(id);
        return { id, url: key ? mediaSrc(key, 'md') : '', focusX, focusY };
      }),
    []
  );

  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
    const sheet = sheetRef.current;
    if (!sheet) return undefined;
    // Solo hay salida si antes hubo entrada (en desarrollo, StrictMode
    // relanza el efecto al montar y si no se cerraría una hoja ya cerrada).
    if (!open && !mountedRef.current) return undefined;
    if (open) mountedRef.current = true;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const inners = sheet.querySelectorAll('[data-text-inner]');
    tlRef.current?.kill();

    if (open) {
      sheet.style.paddingTop = `${mobileAnchorPx()}px`;
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
        TEXT_ANIM.delay
      );
      tlRef.current = tl;
    } else if (handoffRef.current) {
      // Relevo: sin cortina sobre la hoja (taparía el póster en vuelo).
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        clearTimeout(failSafe);
        off();
        handoffRef.current = false;
        if (openRef.current) return;
        gsap.set(sheet, { display: 'none', clearProps: 'backgroundColor' });
        sheet.style.backgroundColor = '';
        setPosterOn(false);
        setPosterReady(false);
        setFlight(null);
      };
      const off = indexHandoff.whenComplete(finish);
      const failSafe = setTimeout(() => {
        indexHandoff.complete();
        finish();
      }, HANDOFF_EXIT.failSafeMs);
      const tl = gsap.timeline();
      tl.to(inners, { ...TEXT_ANIM.out, force3D: true }, 0);
      tl.to(
        sheet,
        { backgroundColor: 'rgba(255,255,255,0)', duration: HANDOFF_EXIT.paperDuration, ease: 'power2.out' },
        HANDOFF_EXIT.paperAt
      );
      tlRef.current = tl;
    } else {
      const done = () => {
        // Si se ha vuelto a abrir mientras salía, no se desmonta nada.
        if (openRef.current) return;
        gsap.set(sheet, { display: 'none' });
        setPosterOn(false);
        setPosterReady(false);
      };
      if (reduce) {
        done();
        return undefined;
      }
      const tl = gsap.timeline({ onComplete: done });
      tl.to(inners, { ...TEXT_ANIM.out, force3D: true }, 0);
      tl.to(sheet, { clipPath: 'inset(100% 0% 0% 0%)', duration: SHEET_ANIM.outDuration, ease: SHEET_ANIM.outEase }, 0.25);
      tlRef.current = tl;
    }
    return undefined;
  }, [open]);

  useEffect(() => () => tlRef.current?.kill(), []);

  const select = (i) => {
    const n = INDEX_ORDER.length;
    const next = ((i % n) + n) % n;
    if (next === selected) return;
    // Sentido del vuelo: hacia delante en el índice llega por la derecha.
    const forward = (next - selected + n) % n <= n / 2;
    setStep(forward ? 1 : -1);
    setSelected(next);
  };

  const openSelected = () => {
    const id = INDEX_ORDER[selected];
    const project = projects[id];
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Mismo proyecto que ya está abierto, el About o sin WebGL: sin relevo.
    if (id === currentId || id === 'about' || !project || reduce || !posterReady) {
      onSelect?.(id, { handoff: false });
      return;
    }
    const imageId = coverOf(id).id;
    indexHandoff.arm({ projectId: id, imageId });
    handoffRef.current = true;
    setFlight({ rect: predictSlideRect(project, imageId) });
    onSelect?.(id, { handoff: true });
  };

  const onNameClick = (i) => {
    if (i === selected) openSelected();
    else select(i);
  };

  // Swipe lateral sobre el póster: izquierda → siguiente, derecha → anterior.
  const onTouchStart = (e) => {
    const t = e.touches[0];
    if (t) touchRef.current = { x: t.clientX, y: t.clientY, moved: false };
  };
  const onTouchMove = (e) => {
    const start = touchRef.current;
    const t = e.touches[0];
    if (!start || !t) return;
    if (Math.abs(t.clientX - start.x) > 8 || Math.abs(t.clientY - start.y) > 8) start.moved = true;
  };
  const onTouchEnd = (e) => {
    const start = touchRef.current;
    touchRef.current = null;
    const t = e.changedTouches[0];
    if (!start || !t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) >= SWIPE.minPx && Math.abs(dx) > Math.abs(dy) * SWIPE.ratio) {
      select(selected + (dx < 0 ? 1 : -1));
    }
  };
  const onPosterClick = () => {
    // Un swipe también dispara click en algunos navegadores: solo abre si fue un toque.
    if (touchRef.current?.moved) return;
    openSelected();
  };

  const ink = isDarkMode ? '#ffffff' : '#000000';
  const muted = isDarkMode ? MOBILE_GRID.mutedDark : MOBILE_GRID.muted;
  const paper = isDarkMode ? '#000000' : '#ffffff';
  const selectedId = INDEX_ORDER[selected];
  const selectedKey = coverKey(selectedId);
  const inlineButton = {
    display: 'inline',
    padding: 0,
    border: 0,
    background: 'none',
    font: 'inherit',
    letterSpacing: 'inherit',
    lineHeight: 'inherit',
    cursor: 'pointer',
    textAlign: 'left',
  };

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
        paddingLeft: MOBILE_GRID.pad,
        paddingRight: MOBILE_GRID.pad,
        paddingBottom: `calc(${BAR_SPACE}px + env(safe-area-inset-bottom, 0px))`,
      }}
    >
      {/* Índice corrido */}
      <div className="overflow-hidden" style={{ flex: 'none' }}>
        <p data-text-inner className="m-0" style={{ color: muted }}>
          {INDEX_ORDER.map((id, i) => {
            const count = imageCount(id);
            const last = i === INDEX_ORDER.length - 1;
            return (
              <span key={id}>
                <button
                  type="button"
                  onClick={() => onNameClick(i)}
                  aria-current={i === selected ? 'true' : undefined}
                  style={{ ...inlineButton, color: i === selected ? ink : muted, transition: 'color 0.4s ease' }}
                >
                  {PROJECT_NAME[id]}
                  {count ? (
                    <span className="tabular-nums" style={{ color: muted }}>
                      {`\u2009${count}`}
                    </span>
                  ) : null}
                </button>
                {last ? '.' : ', '}
              </span>
            );
          })}
        </p>
      </div>

      {/* Póster: ocupa todo el alto libre (rowGap de la rejilla por encima) */}
      <div
        ref={frameRef}
        className="relative"
        style={{ flex: '1 1 auto', minHeight: 0, marginTop: MOBILE_GRID.rowGap, touchAction: 'pan-y', overscrollBehaviorX: 'none' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={onPosterClick}
        role="button"
        tabIndex={0}
        aria-label={`Open ${PROJECT_NAME[selectedId]}`}
      >
        {/* Respaldo mientras llega el WebGL (y con prefers-reduced-motion). */}
        {selectedKey && !posterReady ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mediaSrc(selectedKey, 'md')}
            alt=""
            className="absolute inset-0 block w-full h-full object-cover"
            style={{ objectPosition: `${(coverOf(selectedId).focusX ?? 0.5) * 100}% ${(coverOf(selectedId).focusY ?? 0.2) * 100}%` }}
          />
        ) : null}
      </div>

      {/* Póster en papel (WebGL): su lienzo cubre toda la hoja, así puede
          curvarse sin cortarse y volar fuera del marco en el relevo. */}
      {posterOn ? (
        <LazyComponent
          loader={loadIndexPoster}
          covers={covers}
          index={selected}
          step={step}
          frameRef={frameRef}
          closing={!open}
          flight={flight}
          onReady={() => setPosterReady(true)}
        />
      ) : null}

      {/* Folio */}
      <div className="overflow-hidden" style={{ flex: 'none', marginTop: MOBILE_GRID.captionGap }}>
        <div data-text-inner className="flex justify-between" style={{ fontSize: MOBILE_GRID.captionSize, lineHeight: `${MOBILE_GRID.captionLine}px` }}>
          <span>{gridFileName(selectedId, coverOf(selectedId).id)}</span>
          <span className="tabular-nums">{`${pad2(selected + 1)} / ${pad2(INDEX_ORDER.length)}`}</span>
        </div>
      </div>
    </section>
  );
}
