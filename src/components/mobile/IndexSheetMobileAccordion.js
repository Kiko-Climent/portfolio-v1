'use client';

/**
 * Índice móvil v4 — "Index 11b": acordeón.
 *   Una columna a --kc-type-mobile-2 bajo la etiqueta gris "Projects": cada
 *   fila es el nombre (con su número de imágenes pequeño arriba a la derecha)
 *   y, en el otro margen, el número de proyecto. El activo en negro, el resto
 *   en gris. About va aparte, tras una línea en blanco, como 05.
 *   El proyecto activo se abre DENTRO de su fila: la frase corta
 *   (project.info.summary, columnas 2–4, en gris) y debajo su hoja de
 *   contactos (4 columnas, alineadas abajo, cada miniatura con su proporción
 *   en una caja de 1 columna × THUMB_MAX_H). Los demás proyectos y About bajan.
 *     - Tocar otro proyecto (o swipe lateral sobre sus miniaturas): se cierra
 *       el acordeón abierto y se abre el nuevo a la vez; las miniaturas entran
 *       con la cortina.
 *     - Tocar una miniatura: abre el proyecto en esa imagen, con el vuelo del
 *       papel hasta su hueco en la galería (IndexPosterPaper, lib/indexHandoff).
 *     - Tocar el proyecto abierto: lo mismo desde su portada.
 *     - Tocar About: abre el About.
 * Versiones anteriores: IndexSheetMobile.js (6c, índice corrido + contactos),
 * IndexSheetMobileSpeed.js, IndexSheetMobilePoster.js, IndexSheetMobileTable.js.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { useDarkMode } from '@/contexts/DarkModeContext';
import { projects } from '@/components/data/projects';
import { PROJECT_NAME, gridFileName, pad2 } from '@/components/data/grid';
import { MOBILE_GRID, colsWidthPx, mobileHeadAnchorPx } from '@/lib/mobileGrid';
import { mediaAspect, mediaKey, mediaSrc } from '@/lib/media';
import { LazyComponent, loadIndexPoster } from '@/lib/lazyComponents';
import { indexHandoff } from '@/lib/indexHandoff';
import { predictSlideRect } from '@/lib/mobileGallery';

// El mismo orden que la 6c (el footer cuenta las entradas con esto).
export const INDEX_ORDER = ['johnny', 'salon', 'alt', 'mmdiscos', 'about'];
const PROJECT_ORDER = INDEX_ORDER.filter((id) => id !== 'about');

// Portada de cada proyecto (id de imagen = el número del archivo: vilarnau_04.png → 4).
const INDEX_COVER = { johnny: 1, salon: 4, alt: 11, mmdiscos: 9 };

// Alto máximo de una miniatura: las verticales se quedan en esto.
const THUMB_MAX_H = 72;
// Hueco que deja abajo para la barra del footer (FooterMobile3 → BAR_H).
const BAR_SPACE = 56;
const SWIPE = { minPx: 40, ratio: 1.2 };
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
// Acordeón: el que se cierra y el que se abre, con la misma curva, a la vez.
const ACCORDION_ANIM = { duration: 0.65, ease: 'power3.inOut' };
// Cortina de las miniaturas (el mismo gesto que las hojas de la galería).
const THUMB_ANIM = {
  in: { duration: 0.7, ease: 'expo.out', stagger: 0.025, delay: 0.15 },
  out: { duration: 0.3, ease: 'power3.in', stagger: 0.01 },
};
// Salida en modo relevo: el texto se va y el papel de fondo se aclara para que
// se vea el slider del proyecto debajo (ver IndexSheetMobile.js).
const HANDOFF_EXIT = { paperAt: 1.0, paperDuration: 0.3, failSafeMs: 6000 };

const imageCount = (id) => pad2(projects[id]?.slider?.images?.length ?? 0);
const imagesOf = (id) => projects[id]?.slider?.images ?? [];
const thumbUrl = (id, imageId) => mediaSrc(mediaKey(projects[id], imageId), 'sm');
const indexOfProject = (id) => PROJECT_ORDER.indexOf(id);

/**
 * open: visible. activeId: proyecto con el que arranca (el del ancla o el abierto).
 * currentId: proyecto abierto ahora (si el Index está encima de un detalle).
 * onSelect(id, { handoff }): abrir ese proyecto.
 */
export default function IndexSheetMobileAccordion({ open, activeId, currentId = null, onSelect }) {
  const { isDarkMode } = useDarkMode();
  const sheetRef = useRef(null);
  const scrollRef = useRef(null);
  const tlRef = useRef(null);
  const mountedRef = useRef(false);
  const touchRef = useRef(null);
  const handoffRef = useRef(false);
  const apiRef = useRef(null);
  const thumbRefs = useRef({});
  const rowRefs = useRef({});
  const panelRefs = useRef({});
  const accordionTlRef = useRef(null);
  // Al abrir la hoja el acordeón ya está abierto (sin animar su alto).
  const skipAccordionRef = useRef(true);

  // Índice en PROJECT_ORDER del proyecto abierto (-1: ninguno, p. ej. desde el About).
  const [selected, setSelected] = useState(0);
  // El que se está cerrando: sigue montado hasta que termina su animación.
  const [closing, setClosing] = useState(null);
  const [posterOn, setPosterOn] = useState(false);
  const [vw, setVw] = useState(390);

  const paper = isDarkMode ? '#000000' : '#ffffff';
  const paperRef = useRef(paper);
  useEffect(() => {
    paperRef.current = paper;
  }, [paper]);

  const selectedId = PROJECT_ORDER[selected] ?? null;

  // Al abrir, arranca en el proyecto activo. (Ajuste de estado al cambiar la prop.)
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setSelected(indexOfProject(activeId));
      setClosing(null);
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
      // Bajo la cabecera de tres líneas (aunque encima del About asome su contacto).
      sheet.style.paddingTop = `${mobileHeadAnchorPx()}px`;
      if (scrollRef.current) scrollRef.current.scrollTop = 0;
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
        currentId === 'about' ? TEXT_ANIM.delayOverAbout : TEXT_ANIM.delay
      );
      tlRef.current = tl;
      return undefined;
    }

    const unmount = () => {
      gsap.set(sheet, { display: 'none', backgroundColor: paperRef.current });
      gsap.set(sheet.querySelectorAll('[data-thumb]'), { clearProps: 'clipPath' });
      // La miniatura que voló se escondió al despegar: vuelve a estar en su sitio.
      gsap.set(sheet.querySelectorAll('[data-thumb] img'), { clearProps: 'visibility' });
      accordionTlRef.current?.kill();
      skipAccordionRef.current = true;
      setClosing(null);
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

  useEffect(
    () => () => {
      tlRef.current?.kill();
      accordionTlRef.current?.kill();
    },
    []
  );

  // ── Acordeón: abre el seleccionado (y cierra el anterior) ──────────────
  useLayoutEffect(() => {
    if (!open || !selectedId) return undefined;
    const panel = panelRefs.current[selectedId];
    if (!panel) return undefined;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const thumbs = panel.querySelectorAll('[data-thumb]');
    const summary = panel.querySelectorAll('[data-panel-text]');
    const oldPanel = closing ? panelRefs.current[closing] : null;
    const first = skipAccordionRef.current;
    skipAccordionRef.current = false;

    apiRef.current?.preload(imagesOf(selectedId).map((img) => thumbUrl(selectedId, img.id)));
    accordionTlRef.current?.kill();

    if (reduce) {
      gsap.set(panel, { height: 'auto' });
      gsap.set(thumbs, { clipPath: 'inset(0% 0% 0% 0%)' });
      gsap.set(summary, { yPercent: 0 });
      if (oldPanel) setClosing(null);
      return undefined;
    }

    const tl = gsap.timeline();
    accordionTlRef.current = tl;
    if (first) {
      // Recién abierta la hoja: el acordeón ya está abierto; solo entran las miniaturas.
      gsap.set(panel, { height: 'auto' });
      gsap.set(summary, { yPercent: 0 });
      tl.fromTo(thumbs, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', ...THUMB_ANIM.in }, 0.2);
      return () => tl.kill();
    }

    // Cambio de proyecto: el viejo se pliega y el nuevo se despliega a la vez.
    const target = panel.scrollHeight;
    gsap.set(thumbs, { clipPath: 'inset(100% 0% 0% 0%)' });
    tl.fromTo(panel, { height: 0 }, { height: target, ...ACCORDION_ANIM }, 0);
    tl.fromTo(
      summary,
      { yPercent: TEXT_ANIM.fromYPercent },
      { yPercent: 0, duration: TEXT_ANIM.duration, ease: TEXT_ANIM.ease, force3D: true },
      0.15
    );
    tl.to(thumbs, { clipPath: 'inset(0% 0% 0% 0%)', ...THUMB_ANIM.in }, 0.1);
    if (oldPanel) {
      tl.to(oldPanel.querySelectorAll('[data-thumb]'), { clipPath: 'inset(0% 0% 100% 0%)', ...THUMB_ANIM.out }, 0);
      tl.to(oldPanel, { height: 0, ...ACCORDION_ANIM }, 0);
    }
    tl.call(() => {
      gsap.set(panel, { height: 'auto' });
      setClosing(null);
      // Si el proyecto nuevo queda fuera de la vista, la columna sube hasta él.
      const scroller = scrollRef.current;
      const row = rowRefs.current[selectedId];
      if (!scroller || !row) return;
      const rowTop = row.offsetTop;
      const panelBottom = panel.offsetTop + panel.offsetHeight;
      const viewBottom = scroller.scrollTop + scroller.clientHeight;
      if (rowTop < scroller.scrollTop || panelBottom > viewBottom) {
        const top = Math.min(rowTop, Math.max(0, panelBottom - scroller.clientHeight));
        gsap.to(scroller, { scrollTop: top, duration: 0.6, ease: 'power3.inOut' });
      }
    });
    return () => tl.kill();
    // closing se lee en el momento del cambio, no es una dependencia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, open]);

  // ── Acciones ────────────────────────────────────────────────────────────
  const selectProject = (i) => {
    if (handoffRef.current) return;
    const n = PROJECT_ORDER.length;
    const next = ((i % n) + n) % n;
    if (next === selected) return;
    setClosing(selectedId);
    setSelected(next);
  };

  // Abre el proyecto en esa imagen. Con la hoja de papel lista, la miniatura vuela.
  const openAt = (id, imageId) => {
    if (handoffRef.current) return;
    const project = projects[id];
    const thumb = thumbRefs.current[`${id}-${imageId}`];
    const api = apiRef.current;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Mismo proyecto que ya está abierto, sin WebGL o sin miniatura: sin relevo.
    if (id === currentId || !project || reduce || !api || !thumb) {
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

  const onRowClick = (i) => {
    const id = PROJECT_ORDER[i];
    if (i === selected) openAt(id, INDEX_COVER[id] ?? imagesOf(id)[0]?.id ?? 1);
    else selectProject(i);
  };

  const onAboutClick = () => {
    if (handoffRef.current) return;
    onSelect?.('about', { handoff: false });
  };

  // Swipe lateral sobre las miniaturas: izquierda → siguiente, derecha → anterior.
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
  const onThumbClick = (id, imageId) => {
    // Un swipe también dispara click en algunos navegadores: solo abre si fue un toque.
    const moved = touchRef.current?.moved;
    touchRef.current = null;
    if (moved) return;
    openAt(id, imageId);
  };

  const ink = isDarkMode ? '#ffffff' : '#000000';
  const muted = isDarkMode ? MOBILE_GRID.mutedDark : MOBILE_GRID.muted;
  // Etiqueta de sección ("Projects"): un gris más claro que el de los inactivos.
  const label = isDarkMode ? '#5c5c5c' : '#b3b3b3';
  const rowButton = {
    display: 'block',
    width: '100%',
    padding: 0,
    border: 0,
    background: 'none',
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

  const renderPanel = (id) => {
    const isOpen = id === selectedId;
    const summary = projects[id]?.info?.summary;
    return (
      <div
        ref={(el) => {
          panelRefs.current[id] = el;
        }}
        // El alto lo lleva GSAP (0 ↔ su alto natural); React no lo toca.
        style={{ overflow: 'hidden' }}
        aria-hidden={!isOpen}
      >
        <div style={{ paddingBottom: MOBILE_GRID.rowGap }}>
          {summary ? (
            <div style={{ ...grid4, paddingBottom: MOBILE_GRID.gap }}>
              <span style={{ ...mask, gridColumn: '2 / span 3' }}>
                <span data-panel-text data-text-inner className="block" style={{ color: muted }}>
                  {summary}
                </span>
              </span>
            </div>
          ) : null}
          <div
            style={{ ...grid4, rowGap: MOBILE_GRID.gap, alignItems: 'end', touchAction: 'pan-y', overscrollBehaviorX: 'none' }}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            {imagesOf(id).map((img) => {
              const size = thumbSize(id, img.id);
              return (
                <button
                  key={`${id}-${img.id}`}
                  type="button"
                  tabIndex={isOpen ? 0 : -1}
                  onClick={() => onThumbClick(id, img.id)}
                  aria-label={`Open ${PROJECT_NAME[id]}, ${gridFileName(id, img.id)}`}
                  className="flex flex-col items-start text-left cursor-pointer"
                  style={{ padding: 0, border: 0, background: 'none', font: 'inherit', color: 'inherit', minWidth: 0 }}
                >
                  <span data-thumb className="block" style={{ clipPath: 'inset(100% 0% 0% 0%)' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      ref={(el) => {
                        thumbRefs.current[`${id}-${img.id}`] = el;
                      }}
                      src={thumbUrl(id, img.id)}
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
                      {gridFileName(id, img.id)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
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
          position: 'relative',
          zIndex: 1,
        }}
      >
        <span style={mask}>
          <span data-text-inner className="block" style={{ color: label }}>
            Projects
          </span>
        </span>

        {PROJECT_ORDER.map((id, i) => {
          const isOpen = i === selected;
          const mounted = isOpen || id === closing;
          return (
            <div key={id}>
              <button
                ref={(el) => {
                  rowRefs.current[id] = el;
                }}
                type="button"
                onClick={() => onRowClick(i)}
                aria-expanded={isOpen}
                aria-current={isOpen ? 'true' : undefined}
                aria-label={isOpen ? `Open ${PROJECT_NAME[id]}` : `${PROJECT_NAME[id]}, ${imageCount(id)} images`}
                // Sin acordeón abierto (encima del About) todos en negro; si hay uno, el resto en gris.
                style={{ ...rowButton, color: isOpen || selected === -1 ? ink : muted, transition: 'color 0.4s ease' }}
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
              {mounted ? renderPanel(id) : null}
            </div>
          );
        })}

        <button
          type="button"
          onClick={onAboutClick}
          style={{
            ...rowButton,
            // About en gris solo si hay un proyecto abierto.
            color: selected === -1 ? ink : muted,
            marginTop: 'calc(var(--kc-leading-mobile-2) * 1em)',
            marginBottom: MOBILE_GRID.rowGap,
          }}
        >
          <span style={mask}>
            <span data-text-inner className="flex justify-between">
              <span>{PROJECT_NAME.about}</span>
              <span className="tabular-nums">{pad2(INDEX_ORDER.length)}</span>
            </span>
          </span>
        </button>
      </nav>

      {/* Hoja de papel (WebGL) para el vuelo: su lienzo cubre toda la hoja del Index */}
      {posterOn ? (
        <LazyComponent
          loader={loadIndexPoster}
          onApi={(api) => {
            apiRef.current = api;
            const id = PROJECT_ORDER[selected];
            if (id) api?.preload(imagesOf(id).map((img) => thumbUrl(id, img.id)));
          }}
        />
      ) : null}
    </section>
  );
}
