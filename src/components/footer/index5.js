'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { useDarkMode } from '@/contexts/DarkModeContext';
import { PAGE, columnLeft, columnsWidth } from '@/lib/pageGrid';

gsap.registerPlugin(SplitText);

/**
 * Footer de escritorio (copia de index3 con el footer nuevo).
 *
 * La lista de proyectos NO se mueve entre páginas: misma posición (col 7),
 * mismos números a la derecha. Lo único que cambia es el color:
 *   - home: el proyecto activo/hover en negro, el resto en gris
 *   - galería: el proyecto abierto en negro, el resto en gris, y encima
 *     aparece "← Index" (vuelve al menú) con el mismo mask reveal por chars.
 * Desde la galería, click en otro proyecto = cambio directo (onProjectSwitch).
 * Solo "← Index" tiene reveal por letras: la lista no se mueve.
 *
 * Lleva la clase kc-blend (globals.css): mix-blend-mode difference, así sigue
 * leyéndose cuando las hojas del slider pasan por debajo.
 */
const MASK_CUSHION = '0.25em';

const ANIM = {
  indexIn: { duration: 0.6, ease: 'power4.out', staggerEach: 0.022, fromYPercent: 140 },
  indexOut: { duration: 0.45, ease: 'power3.in', staggerEach: 0.018, yPercent: -140 },
  // Lo que antes tardaba la entrada del título: el slider se monta a la vez.
  openDone: 0.6,
  // Lo que antes tardaban la salida del título + la vuelta del menú: da tiempo
  // a que la cortina de salida de la galería termine antes de desmontarla.
  backDone: 1.1,
  // Entre volver al menú y abrir el siguiente proyecto (cambio desde la galería).
  switchGap: 0.15,
  // Cambio directo de proyecto desde la galería: la fila no admite otro
  // click hasta que la nueva galería ha tenido tiempo de entrar.
  switchLock: 1.6,
};

const ITEMS = [
  { title: 'Johnny Carretes', number: '01', id: 'johnny' },
  { title: 'Salon Vilarnau', number: '02', id: 'salon' },
  { title: 'Against Low Trends', number: '03', id: 'alt' },
  { title: 'MM Discos', number: '04', id: 'mmdiscos' },
  { title: 'About', number: '05', id: 'about' },
];

export default function Footer5({ activeProject, onHover, onProjectClick, onProjectSwitch, isVisible = true, backReady = false }) {
  const { isDarkMode } = useDarkMode();
  const [openId, setOpenId] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  const openRef = useRef(null);
  const busyRef = useRef(false);
  const pendingRef = useRef(null);
  const indexRef = useRef(null);
  const indexSplitRef = useRef(null);
  const indexShownRef = useRef(false);
  const openDoneRef = useRef(false);
  const backReadyRef = useRef(backReady);
  const timersRef = useRef([]);

  const later = (seconds, fn) => {
    const id = setTimeout(fn, seconds * 1000);
    timersRef.current.push(id);
  };

  useEffect(() => () => timersRef.current.forEach(clearTimeout), []);

  // "← Index": partido en chars con máscara, oculto hasta abrir una galería.
  useEffect(() => {
    const el = indexRef.current;
    if (!el) return undefined;
    const split = new SplitText(el, { type: 'chars', mask: 'chars', charsClass: 'char' });
    split.chars.forEach((char) => {
      const wrap = char.parentElement;
      if (!wrap) return;
      wrap.style.paddingTop = MASK_CUSHION;
      wrap.style.paddingBottom = MASK_CUSHION;
      wrap.style.marginTop = `-${MASK_CUSHION}`;
      wrap.style.marginBottom = `-${MASK_CUSHION}`;
    });
    gsap.set(split.chars, { yPercent: ANIM.indexIn.fromYPercent });
    indexSplitRef.current = split;
    return () => split.revert();
  }, []);

  const showIndex = useCallback(() => {
    const split = indexSplitRef.current;
    if (!split || indexShownRef.current) return;
    indexShownRef.current = true;
    gsap.killTweensOf(split.chars);
    gsap.to(split.chars, {
      yPercent: 0,
      duration: ANIM.indexIn.duration,
      ease: ANIM.indexIn.ease,
      stagger: ANIM.indexIn.staggerEach,
      force3D: true,
    });
  }, []);

  const hideIndex = () => {
    const split = indexSplitRef.current;
    if (!split) return;
    indexShownRef.current = false;
    gsap.killTweensOf(split.chars);
    gsap.to(split.chars, {
      yPercent: ANIM.indexOut.yPercent,
      duration: ANIM.indexOut.duration,
      ease: ANIM.indexOut.ease,
      stagger: ANIM.indexOut.staggerEach,
      force3D: true,
      onComplete: () => gsap.set(split.chars, { yPercent: ANIM.indexIn.fromYPercent }),
    });
  };

  // "← Index" entra cuando la galería está entera en pantalla (igual que el
  // antiguo "back menu"): no compite con la carga de texturas.
  useEffect(() => {
    backReadyRef.current = backReady;
    if (backReady && openDoneRef.current) showIndex();
  }, [backReady, showIndex]);

  const open = (id) => {
    if (busyRef.current || openRef.current || !id) return;
    busyRef.current = true;
    openRef.current = id;
    openDoneRef.current = false;
    setOpenId(id);
    setHoveredId(null);
    onProjectClick?.(id);
    later(ANIM.openDone, () => {
      busyRef.current = false;
      openDoneRef.current = true;
      window.__footerAnimationComplete?.();
      if (backReadyRef.current) showIndex();
    });
  };

  const back = () => {
    if (busyRef.current || !openRef.current) return;
    busyRef.current = true;
    openDoneRef.current = false;
    window.__footerBackStarted?.();
    hideIndex();
    later(ANIM.backDone, () => {
      openRef.current = null;
      setOpenId(null);
      onProjectClick?.(null);
      busyRef.current = false;
      const next = pendingRef.current;
      pendingRef.current = null;
      if (next) later(ANIM.switchGap, () => open(next));
    });
  };

  const handleRowClick = (id) => {
    if (!openRef.current) {
      open(id);
      return;
    }
    if (id === openRef.current || busyRef.current) return;
    // Desde la galería: cambio directo de proyecto, sin pasar por la home
    // (la galería sale con su cortina y entra la nueva). "← Index" se queda.
    if (onProjectSwitch) {
      busyRef.current = true;
      openRef.current = id;
      setOpenId(id);
      setHoveredId(null);
      onProjectSwitch(id);
      later(ANIM.switchLock, () => {
        busyRef.current = false;
      });
      return;
    }
    // Sin onProjectSwitch: volver y abrir el otro proyecto.
    pendingRef.current = id;
    back();
  };

  const full = isDarkMode ? '#ffffff' : '#000000';
  const muted = isDarkMode ? PAGE.mutedDark : PAGE.muted;
  const lit = openId ? (hoveredId || openId) : (hoveredId || activeProject);

  return (
    <div
      data-footer
      className="kc-blend absolute bottom-4 z-50 flex text-[length:var(--kc-type)] leading-[1] transition-opacity duration-700"
      style={{
        left: columnLeft(7),
        width: columnsWidth(6),
        opacity: isVisible ? 1 : 0,
        pointerEvents: isVisible ? 'auto' : 'none',
      }}
      onMouseLeave={() => {
        setHoveredId(null);
        if (!openRef.current) onHover?.(null);
      }}
    >
      <nav aria-label="Projects" className="flex w-full flex-col whitespace-nowrap">
        <button
          type="button"
          onClick={back}
          className="flex cursor-pointer justify-between text-left"
          style={{
            color: full,
            pointerEvents: openId ? 'auto' : 'none',
            background: 'none',
            border: 0,
            padding: 0,
            font: 'inherit',
          }}
          aria-hidden={!openId}
          tabIndex={openId ? 0 : -1}
        >
          <span ref={indexRef} className="flex">{'←︎ Index'}</span>
        </button>

        {ITEMS.map(({ title, number, id }) => (
          <div
            key={number}
            role="button"
            tabIndex={0}
            className="flex cursor-pointer justify-between"
            style={{
              color: lit && lit !== id ? muted : full,
              transition: 'color 150ms linear',
            }}
            onMouseEnter={() => {
              setHoveredId(id);
              // El speed-slider solo en la home.
              if (!openRef.current) onHover?.(id);
            }}
            onMouseLeave={() => setHoveredId(null)}
            onClick={() => handleRowClick(id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleRowClick(id);
              }
            }}
          >
            <h1 className="flex">{title}</h1>
            <p className="flex w-[2ch] text-right tabular-nums">{number}</p>
          </div>
        ))}
      </nav>
    </div>
  );
}
