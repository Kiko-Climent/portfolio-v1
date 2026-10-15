'use client';

/**
 * [Versión descartada: imágenes con las pautas del speed-slider y "entries →". Guardada por si acaso.]
 * Índice móvil v3 — "Index 2a" con las pautas del speed-slider.
 *   Arriba, un solo párrafo a --kc-type-mobile-2, como el índice de un libro:
 *   "Johnny Carretes 13, Salon Vilarnau 11, Against Low Trends 07, MM Discos 09,
 *   About." El seleccionado en negro, el resto en gris; las cifras al mismo
 *   tamaño y en gris (un superíndice chocaría con la línea de arriba con este
 *   interlineado). Enlaces dentro de una frase: WCAG 2.5.8 los exime de los 24 px.
 *   Debajo, las imágenes del proyecto seleccionado enteras (sin recorte),
 *   colocadas como en el speed-slider de escritorio (lib/indexSpeed): x en una
 *   línea de columna, ancho en columnas enteras, y a pasos de 8 px, semilla fija
 *   por imagen y la misma secuencia. Arranca en la portada del proyecto.
 *     - "NN entries →" (barra del footer, FooterMobile3): siguiente imagen, una a
 *       una y con cortes secos; las 3 últimas se quedan apiladas.
 *     - Swipe lateral / tocar un nombre gris: otro proyecto, con el cambio de
 *       hoja de papel del detalle de escritorio (IndexPosterPaper).
 *     - Tocar el nombre seleccionado o la imagen: abre el proyecto. La hoja
 *       vuela a su hueco en el slider del proyecto y le pasa el relevo
 *       (lib/indexHandoff); la galería arranca en esa misma imagen.
 * Versiones anteriores: IndexSheetMobilePoster.js (póster recortado),
 * IndexSheetMobileTable.js (tabla con filetes).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { useDarkMode } from '@/contexts/DarkModeContext';
import { projects } from '@/components/data/projects';
import { PROJECT_NAME, gridFileName, pad2 } from '@/components/data/grid';
import { MOBILE_GRID, mobileAnchorPx } from '@/lib/mobileGrid';
import { mediaSrc } from '@/lib/media';
import { LazyComponent, loadIndexPoster } from '@/lib/lazyComponents';
import { indexHandoff } from '@/lib/indexHandoff';
import { predictSlideRect } from '@/lib/mobileGallery';
import { SPEED, ratioOf, speedImagesOf, speedPlace } from '@/lib/indexSpeed';

export const INDEX_ORDER = ['johnny', 'salon', 'alt', 'mmdiscos', 'about'];

// Portada de cada proyecto (id de imagen = el número del archivo: vilarnau_04.png → 4).
const INDEX_COVER = { johnny: 1, salon: 4, alt: 11, mmdiscos: 9, about: 1 };

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
// Salida en modo relevo: el texto se va y el papel de fondo se aclara para que
// se vea el slider del proyecto debajo mientras la hoja vuela.
const HANDOFF_EXIT = { paperAt: 0.45, paperDuration: 0.35, failSafeMs: 6000 };

const imageCount = (id) => (id === 'about' ? null : pad2(projects[id]?.slider?.images?.length ?? 0));
const coverIndex = (id) => Math.max(0, speedImagesOf(id).findIndex((img) => img.id === (INDEX_COVER[id] ?? 1)));

/**
 * open: visible. activeId: proyecto con el que arranca (el del ancla o el abierto).
 * currentId: proyecto abierto ahora (si el Index está encima de un detalle).
 * onSelect(id, { handoff }): abrir ese proyecto.
 * stepRef: el footer llama a stepRef.current() con "entries →".
 * onEntries({ total }): nº de imágenes del proyecto seleccionado, para la etiqueta.
 */
export default function IndexSheetMobile({ open, activeId, currentId = null, onSelect, stepRef, onEntries }) {
  const { isDarkMode } = useDarkMode();
  const sheetRef = useRef(null);
  const frameRef = useRef(null);
  const tlRef = useRef(null);
  const mountedRef = useRef(false);
  const touchRef = useRef(null);
  const handoffRef = useRef(false);
  const apiRef = useRef(null);
  const shownRef = useRef(false);

  const [selected, setSelected] = useState(0);
  const [imgIdx, setImgIdx] = useState(0);
  // Imágenes anteriores que se quedan apiladas (DOM, debajo de la hoja de papel).
  const [stack, setStack] = useState([]);
  const [stage, setStage] = useState(null);
  const [posterOn, setPosterOn] = useState(false);
  const [posterReady, setPosterReady] = useState(false);

  const paper = isDarkMode ? '#000000' : '#ffffff';
  const paperRef = useRef(paper);
  useEffect(() => {
    paperRef.current = paper;
  }, [paper]);

  const selectedId = INDEX_ORDER[selected];
  const images = speedImagesOf(selectedId);
  const image = images[imgIdx] ?? images[0];

  // Al abrir, arranca en el proyecto activo y en su portada. (Ajuste de estado al cambiar la prop.)
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      const i = Math.max(0, INDEX_ORDER.indexOf(activeId));
      setSelected(i);
      setImgIdx(coverIndex(INDEX_ORDER[i]));
      setStack([]);
      setPosterOn(true);
    }
  }

  // ── Colocación (speed-slider) ───────────────────────────────────────────
  const rectFor = useCallback(
    (projectId, index, prevIndex = null) => {
      if (!stage) return null;
      const list = speedImagesOf(projectId);
      const img = list[index];
      if (!img) return null;
      const prev = prevIndex != null && list[prevIndex] ? { imageIndex: prevIndex, ratio: ratioOf(list[prevIndex]) } : null;
      const p = speedPlace(projectId, index, ratioOf(img), stage, prev);
      return { left: stage.left + p.x, top: stage.top + p.y, width: p.w, height: p.h };
    },
    [stage]
  );
  const imageFor = (projectId, index, prevIndex) => {
    const img = speedImagesOf(projectId)[index];
    const rect = rectFor(projectId, index, prevIndex);
    return img && rect ? { url: mediaSrc(img.key, 'md'), rect, img } : null;
  };

  const measure = () => {
    const frame = frameRef.current;
    if (!frame) return null;
    const box = frame.getBoundingClientRect();
    const next = { left: box.left, top: box.top, width: box.width, height: box.height };
    setStage(next);
    return next;
  };

  useEffect(() => {
    onEntries?.({ total: images.length });
  }, [images.length, onEntries]);

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
      sheet.style.paddingTop = `${mobileAnchorPx()}px`;
      // El papel de fondo siempre opaco al abrir (el relevo lo deja transparente).
      gsap.set(sheet, { display: 'flex', backgroundColor: paperRef.current });
      measure();
      shownRef.current = false;
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
      return undefined;
    }

    const unmountPoster = () => {
      gsap.set(sheet, { display: 'none', backgroundColor: paperRef.current });
      setPosterOn(false);
      setPosterReady(false);
      setStack([]);
    };

    if (handoffRef.current) {
      // Relevo: sin cortina sobre la hoja (taparía la imagen en vuelo).
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
        unmountPoster();
      };
      off = indexHandoff.whenComplete(finish);
      failSafe = setTimeout(() => {
        indexHandoff.complete();
        finish();
      }, HANDOFF_EXIT.failSafeMs);
      setStack([]);
      const tl = gsap.timeline();
      tl.to(inners, { ...TEXT_ANIM.out, force3D: true }, 0);
      tl.to(
        sheet,
        { backgroundColor: isDarkMode ? 'rgba(0,0,0,0)' : 'rgba(255,255,255,0)', duration: HANDOFF_EXIT.paperDuration, ease: 'power2.out' },
        HANDOFF_EXIT.paperAt
      );
      tlRef.current = tl;
      return undefined;
    }

    apiRef.current?.hide();
    const done = () => {
      // Si se ha vuelto a abrir mientras salía, no se desmonta nada.
      if (openRef.current) return;
      unmountPoster();
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

  useEffect(() => {
    const onResize = () => {
      if (openRef.current) measure();
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Primera imagen en cuanto hay hoja de papel y escenario medido.
  const showFirst = () => {
    const api = apiRef.current;
    if (!api || !stage || shownRef.current || !openRef.current) return;
    const first = imageFor(selectedId, imgIdx);
    if (!first) return;
    shownRef.current = true;
    api.show(first);
  };
  useEffect(showFirst);

  // ── Acciones ────────────────────────────────────────────────────────────
  const selectProject = (i) => {
    if (handoffRef.current) return;
    const n = INDEX_ORDER.length;
    const next = ((i % n) + n) % n;
    if (next === selected) return;
    // Hacia delante en el índice, la hoja nueva llega por la derecha.
    const step = (next - selected + n) % n <= n / 2 ? 1 : -1;
    const id = INDEX_ORDER[next];
    const idx = coverIndex(id);
    setSelected(next);
    setImgIdx(idx);
    setStack([]);
    const target = imageFor(id, idx);
    if (target) apiRef.current?.swap(target, step);
  };

  // "entries →": siguiente imagen del proyecto, corte seco; la anterior se queda apilada.
  const stepImage = () => {
    if (handoffRef.current || !images.length) return;
    const prevIdx = imgIdx;
    const nextIdx = (imgIdx + 1) % images.length;
    const prevRect = rectFor(selectedId, prevIdx);
    const target = imageFor(selectedId, nextIdx, prevIdx);
    if (!target) return;
    if (prevRect) {
      setStack((s) => [...s, { key: `${selectedId}-${prevIdx}-${Date.now()}`, url: mediaSrc(images[prevIdx].key, 'md'), rect: prevRect }].slice(-(SPEED.depth - 1)));
    }
    setImgIdx(nextIdx);
    apiRef.current?.cut(target);
  };
  useEffect(() => {
    if (stepRef) stepRef.current = stepImage;
  });

  const openSelected = () => {
    if (handoffRef.current) return;
    const id = selectedId;
    const project = projects[id];
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Mismo proyecto que ya está abierto, el About o sin WebGL: sin relevo.
    if (id === currentId || id === 'about' || !project || reduce || !posterReady || !image) {
      onSelect?.(id, { handoff: false });
      return;
    }
    indexHandoff.arm({ projectId: id, imageId: image.id });
    handoffRef.current = true;
    apiRef.current?.flyTo(predictSlideRect(project, image.id));
    onSelect?.(id, { handoff: true });
  };

  const onNameClick = (i) => {
    if (i === selected) openSelected();
    else selectProject(i);
  };

  // Swipe lateral sobre las imágenes: izquierda → siguiente proyecto, derecha → anterior.
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
  const onFrameClick = () => {
    // Un swipe también dispara click en algunos navegadores: solo abre si fue un toque.
    const moved = touchRef.current?.moved;
    touchRef.current = null;
    if (moved) return;
    openSelected();
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
  const sheetBox = sheetRef.current?.getBoundingClientRect();
  const local = (rect) => ({
    left: rect.left - (sheetBox?.left ?? 0),
    top: rect.top - (sheetBox?.top ?? 0),
    width: rect.width,
    height: rect.height,
  });
  const fallbackRect = !posterReady && image ? rectFor(selectedId, imgIdx) : null;

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
                  {PROJECT_NAME[id]}
                  {count ? (
                    <span className="tabular-nums" style={{ color: muted }}>
                      {` ${count}`}
                    </span>
                  ) : null}
                </button>
                {last ? '.' : ', '}
              </span>
            );
          })}
        </p>
      </div>

      {/* Escenario de las imágenes (las pautas del speed-slider) */}
      <div
        ref={frameRef}
        className="relative"
        style={{ flex: '1 1 auto', minHeight: 0, marginTop: MOBILE_GRID.rowGap, touchAction: 'pan-y', overscrollBehaviorX: 'none' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={onFrameClick}
        role="button"
        tabIndex={0}
        aria-label={`Open ${PROJECT_NAME[selectedId]}`}
      />

      {/* Las anteriores, apiladas debajo de la hoja de papel (cortes secos, sin fundidos) */}
      {stack.map((item) => {
        const r = local(item.rect);
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={item.key}
            src={item.url}
            alt=""
            className="absolute block pointer-events-none"
            style={{ left: r.left, top: r.top, width: r.width, height: r.height, zIndex: 1 }}
          />
        );
      })}

      {/* Respaldo mientras llega el WebGL */}
      {fallbackRect ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={mediaSrc(image.key, 'md')}
          alt=""
          className="absolute block pointer-events-none"
          style={{ ...local(fallbackRect), zIndex: 1 }}
        />
      ) : null}

      {/* Hoja de papel (WebGL): su lienzo cubre toda la hoja del Index */}
      {posterOn ? (
        <LazyComponent
          loader={loadIndexPoster}
          onApi={(api) => {
            apiRef.current = api;
            if (api) showFirst();
          }}
          onReady={() => setPosterReady(true)}
        />
      ) : null}

      {/* Folio: archivo de la imagen y su número en el proyecto */}
      <div className="overflow-hidden" style={{ flex: 'none', marginTop: MOBILE_GRID.captionGap, position: 'relative', zIndex: 3 }}>
        <div data-text-inner className="flex justify-between" style={{ fontSize: MOBILE_GRID.captionSize, lineHeight: `${MOBILE_GRID.captionLine}px` }}>
          <span>{image ? gridFileName(selectedId, image.id) : ''}</span>
          <span className="tabular-nums">{`${pad2(imgIdx + 1)} / ${pad2(images.length)}`}</span>
        </div>
      </div>
    </section>
  );
}
