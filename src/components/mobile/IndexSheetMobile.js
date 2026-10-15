'use client';

/**
 * Índice móvil v3 — "Index 6c": índice corrido numerado + hoja de contactos.
 *   Arriba, un solo párrafo a --kc-type-mobile-2, como el índice de un libro:
 *   "01 Johnny Carretes¹³, 02 Salon Vilarnau¹¹, 03 Against Low Trends⁰⁷,
 *   04 MM Discos⁰⁹, 05 About." El seleccionado en negro, el resto en gris. La
 *   cifra de imágenes, pequeña y alineada arriba de su línea (no sube por
 *   encima de las mayúsculas: no choca con la línea de arriba aunque el
 *   interlineado vaya pegado). Enlaces dentro de una frase: WCAG 2.5.8 los
 *   exime del mínimo de 24 px.
 *   Debajo, la hoja de contactos del proyecto seleccionado: por filas, en las
 *   4 columnas de la rejilla móvil, alineadas abajo (los nombres de archivo en
 *   un mismo renglón). Cada miniatura con su proporción dentro de una caja de
 *   1 columna × THUMB_MAX_H: las apaisadas a todo el ancho, las verticales a
 *   ese alto.
 *     - Tocar un nombre gris o swipe lateral: otro proyecto (la hoja de
 *       contactos entra con la cortina, de abajo arriba y escalonada).
 *     - Tocar una miniatura: abre el proyecto en esa imagen. La miniatura vuela
 *       con el papel de escritorio hasta su hueco en el slider del proyecto
 *       (IndexPosterPaper → flyTo, lib/indexHandoff); el resto sale con la cortina.
 *     - Tocar el nombre seleccionado: lo mismo desde su portada.
 * Versiones anteriores: IndexSheetMobileSpeed.js (speed-slider),
 * IndexSheetMobilePoster.js (póster), IndexSheetMobileTable.js (tabla).
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { useDarkMode } from '@/contexts/DarkModeContext';
import { projects } from '@/components/data/projects';
import { PROJECT_NAME, gridFileName, pad2 } from '@/components/data/grid';
import { MOBILE_GRID, colsWidthPx, mobileAnchorPx } from '@/lib/mobileGrid';
import { mediaAspect, mediaKey, mediaSrc } from '@/lib/media';
import { LazyComponent, loadIndexPoster } from '@/lib/lazyComponents';
import { indexHandoff } from '@/lib/indexHandoff';
import { predictSlideRect } from '@/lib/mobileGallery';

export const INDEX_ORDER = ['johnny', 'salon', 'alt', 'mmdiscos', 'about'];

// Portada de cada proyecto (id de imagen = el número del archivo: vilarnau_04.png → 4).
const INDEX_COVER = { johnny: 1, salon: 4, alt: 11, mmdiscos: 9, about: 1 };

// Alto máximo de una miniatura: las verticales se quedan en esto.
const THUMB_MAX_H = 72;
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
// Cortina de las miniaturas (el mismo gesto que las hojas de la galería).
const THUMB_ANIM = {
  in: { duration: 0.7, ease: 'expo.out', stagger: 0.025, delay: 0.1 },
  out: { duration: 0.35, ease: 'power3.in', stagger: 0.015 },
};
// Salida en modo relevo: el texto se va y el papel de fondo se aclara para que
// se vea el slider del proyecto debajo. Espera a que la Home (o la galería
// anterior) haya salido con su cortina: si no, se vería pasar por debajo.
const HANDOFF_EXIT = { paperAt: 1.0, paperDuration: 0.3, failSafeMs: 6000 };

const imageCount = (id) => (id === 'about' ? null : pad2(projects[id]?.slider?.images?.length ?? 0));
const imagesOf = (id) => projects[id]?.slider?.images ?? [];
const thumbUrl = (id, imageId) => mediaSrc(mediaKey(projects[id], imageId), 'sm');

/**
 * open: visible. activeId: proyecto con el que arranca (el del ancla o el abierto).
 * currentId: proyecto abierto ahora (si el Index está encima de un detalle).
 * onSelect(id, { handoff }): abrir ese proyecto.
 */
export default function IndexSheetMobile({ open, activeId, currentId = null, onSelect }) {
  const { isDarkMode } = useDarkMode();
  const sheetRef = useRef(null);
  const gridRef = useRef(null);
  const tlRef = useRef(null);
  const mountedRef = useRef(false);
  const touchRef = useRef(null);
  const handoffRef = useRef(false);
  const apiRef = useRef(null);
  const thumbRefs = useRef({});

  const [selected, setSelected] = useState(0);
  const [posterOn, setPosterOn] = useState(false);
  const [vw, setVw] = useState(390);

  const paper = isDarkMode ? '#000000' : '#ffffff';
  const paperRef = useRef(paper);
  useEffect(() => {
    paperRef.current = paper;
  }, [paper]);

  const selectedId = INDEX_ORDER[selected];
  const images = imagesOf(selectedId);

  // Al abrir, arranca en el proyecto activo. (Ajuste de estado al cambiar la prop.)
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setSelected(Math.max(0, INDEX_ORDER.indexOf(activeId)));
      setPosterOn(true);
    }
  }

  // Ancho de columna real (la miniatura mide 1 columna).
  useEffect(() => {
    const update = () => setVw(window.innerWidth);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  const colW = colsWidthPx(1, vw);
  const thumbSize = (id, imageId) => {
    const ratio = 1 / (mediaAspect(mediaKey(projects[id], imageId)) || 1);
    return colW / ratio <= THUMB_MAX_H
      ? { width: colW, height: colW / ratio }
      : { width: THUMB_MAX_H * ratio, height: THUMB_MAX_H };
  };

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
    const thumbs = sheet.querySelectorAll('[data-thumb]');
    tlRef.current?.kill();

    if (open) {
      sheet.style.paddingTop = `${mobileAnchorPx()}px`;
      // El papel de fondo siempre opaco al abrir (el relevo lo deja transparente).
      gsap.set(sheet, { display: 'flex', backgroundColor: paperRef.current });
      if (reduce) {
        gsap.set(sheet, { clipPath: 'inset(0% 0% 0% 0%)' });
        gsap.set(inners, { yPercent: 0 });
        gsap.set(thumbs, { clipPath: 'inset(0% 0% 0% 0%)' });
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
      return undefined;
    }

    const unmount = () => {
      gsap.set(sheet, { display: 'none', backgroundColor: paperRef.current });
      gsap.set(sheet.querySelectorAll('[data-thumb]'), { clearProps: 'clipPath' });
      // La miniatura que voló se escondió al despegar: vuelve a estar en su sitio.
      gsap.set(sheet.querySelectorAll('[data-thumb] img'), { clearProps: 'visibility' });
      setPosterOn(false);
    };

    if (handoffRef.current) {
      // Relevo: sin cortina sobre la hoja (taparía la miniatura en vuelo).
      let finished = false;
      let failSafe = null;
      let off = () => {};
      const finish = () => {
        if (finished) return;
        finished = true;
        clearTimeout(failSafe);
        off();
        handoffRef.current = false;
        if (openRef.current) return;
        unmount();
      };
      off = indexHandoff.whenComplete(finish);
      failSafe = setTimeout(() => {
        indexHandoff.complete();
        finish();
      }, HANDOFF_EXIT.failSafeMs);
      const tl = gsap.timeline();
      tl.to(inners, { ...TEXT_ANIM.out, force3D: true }, 0);
      tl.to(thumbs, { clipPath: 'inset(0% 0% 100% 0%)', ...THUMB_ANIM.out }, 0);
      tl.to(
        sheet,
        { backgroundColor: isDarkMode ? 'rgba(0,0,0,0)' : 'rgba(255,255,255,0)', duration: HANDOFF_EXIT.paperDuration, ease: 'power2.out' },
        HANDOFF_EXIT.paperAt
      );
      tlRef.current = tl;
      return undefined;
    }

    const done = () => {
      // Si se ha vuelto a abrir mientras salía, no se desmonta nada.
      if (openRef.current) return;
      unmount();
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
    // isDarkMode solo para el color de la salida en relevo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => () => tlRef.current?.kill(), []);

  // Hoja de contactos: entra con la cortina cada vez que cambia el proyecto (y al abrir).
  useLayoutEffect(() => {
    if (!open) return undefined;
    const thumbs = gridRef.current?.querySelectorAll('[data-thumb]');
    if (!thumbs?.length) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const tween = gsap.fromTo(
      thumbs,
      { clipPath: 'inset(100% 0% 0% 0%)' },
      { clipPath: 'inset(0% 0% 0% 0%)', ...THUMB_ANIM.in }
    );
    apiRef.current?.preload(images.map((img) => thumbUrl(selectedId, img.id)));
    return () => tween.kill();
    // images cambia con selectedId.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, open]);

  // ── Acciones ────────────────────────────────────────────────────────────
  const selectProject = (i) => {
    if (handoffRef.current) return;
    const n = INDEX_ORDER.length;
    const next = ((i % n) + n) % n;
    if (next !== selected) setSelected(next);
  };

  // Abre el proyecto en esa imagen. Con la hoja de papel lista, la miniatura vuela.
  const openAt = (imageId) => {
    if (handoffRef.current) return;
    const id = selectedId;
    const project = projects[id];
    const thumb = thumbRefs.current[`${id}-${imageId}`];
    const api = apiRef.current;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Mismo proyecto que ya está abierto, el About o sin WebGL: sin relevo.
    if (id === currentId || id === 'about' || !project || reduce || !api || !thumb) {
      onSelect?.(id, { handoff: false });
      return;
    }
    const box = thumb.getBoundingClientRect();
    indexHandoff.arm({ projectId: id, imageId });
    handoffRef.current = true;
    // La hoja de papel se pone encima de la miniatura y la miniatura se esconde.
    api.cut({
      url: thumbUrl(id, imageId),
      rect: { left: box.left, top: box.top, width: box.width, height: box.height },
      onShown: () => gsap.set(thumb, { visibility: 'hidden' }),
    });
    api.flyTo(predictSlideRect(project, imageId));
    onSelect?.(id, { handoff: true });
  };

  const onNameClick = (i) => {
    if (i === selected) openAt(INDEX_COVER[selectedId] ?? images[0]?.id ?? 1);
    else selectProject(i);
  };

  // Swipe lateral sobre la hoja de contactos: izquierda → siguiente, derecha → anterior.
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
    const t = e.changedTouches[0];
    if (!start || !t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) >= SWIPE.minPx && Math.abs(dx) > Math.abs(dy) * SWIPE.ratio) {
      selectProject(selected + (dx < 0 ? 1 : -1));
    }
  };
  const onThumbClick = (imageId) => {
    // Un swipe también dispara click en algunos navegadores: solo abre si fue un toque.
    const moved = touchRef.current?.moved;
    touchRef.current = null;
    if (moved) return;
    openAt(imageId);
  };

  const ink = isDarkMode ? '#ffffff' : '#000000';
  const muted = isDarkMode ? MOBILE_GRID.mutedDark : MOBILE_GRID.muted;
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
      {/* Índice corrido numerado */}
      <div className="overflow-hidden" style={{ flex: 'none', position: 'relative', zIndex: 3 }}>
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
                  <span className="tabular-nums">{pad2(i + 1)}</span>
                  {` ${PROJECT_NAME[id]}`}
                  {count ? (
                    <span className="tabular-nums" style={capStyle}>
                      {count}
                    </span>
                  ) : null}
                </button>
                {last ? '.' : ', '}
              </span>
            );
          })}
        </p>
      </div>

      {/* Hoja de contactos del proyecto seleccionado */}
      <div
        ref={gridRef}
        style={{
          flex: '1 1 auto',
          minHeight: 0,
          marginTop: MOBILE_GRID.rowGap,
          overflowY: 'auto',
          touchAction: 'pan-y',
          overscrollBehaviorX: 'none',
          position: 'relative',
          zIndex: 1,
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${MOBILE_GRID.columns}, minmax(0, 1fr))`,
            columnGap: MOBILE_GRID.gap,
            rowGap: MOBILE_GRID.gap,
            alignItems: 'end',
          }}
        >
          {images.map((img) => {
            const size = thumbSize(selectedId, img.id);
            return (
              <button
                key={`${selectedId}-${img.id}`}
                type="button"
                onClick={() => onThumbClick(img.id)}
                aria-label={`Open ${PROJECT_NAME[selectedId]}, ${gridFileName(selectedId, img.id)}`}
                className="flex flex-col items-start text-left cursor-pointer"
                style={{ padding: 0, border: 0, background: 'none', font: 'inherit', color: 'inherit', minWidth: 0 }}
              >
                <span data-thumb className="block" style={{ clipPath: 'inset(100% 0% 0% 0%)' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    ref={(el) => {
                      thumbRefs.current[`${selectedId}-${img.id}`] = el;
                    }}
                    src={thumbUrl(selectedId, img.id)}
                    alt=""
                    className="block"
                    style={{ width: size.width, height: size.height }}
                  />
                  <span
                    className="block"
                    style={{
                      marginTop: MOBILE_GRID.captionGap,
                      fontSize: MOBILE_GRID.captionSize,
                      lineHeight: `${MOBILE_GRID.captionLine}px`,
                      color: muted,
                      whiteSpace: 'nowrap',
                      maxWidth: colW,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {gridFileName(selectedId, img.id)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Hoja de papel (WebGL) para el vuelo: su lienzo cubre toda la hoja del Index */}
      {posterOn ? (
        <LazyComponent
          loader={loadIndexPoster}
          onApi={(api) => {
            apiRef.current = api;
            api?.preload(imagesOf(INDEX_ORDER[selected]).map((img) => thumbUrl(INDEX_ORDER[selected], img.id)));
          }}
        />
      ) : null}
    </section>
  );
}
