'use client';

import { useRef, useEffect, useLayoutEffect, useState, useCallback } from 'react';
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { useDarkMode } from '@/contexts/DarkModeContext';
import { PAGE, columnLeft, columnsWidth } from '@/lib/pageGrid';

gsap.registerPlugin(SplitText);

/**
 * index6 (nov 2026, "R3·A2"): copia de index5. Dentro de un proyecto la lista
 * de proyectos sale (una cosa por pantalla) y queda una sola fila:
 *   ← Index (cols 7–8)        Next  <siguiente proyecto> → (desde la col 9)
 * "Next" hace el mismo cambio directo que antes hacía click en otra fila. Al
 * volver al Index la lista entra otra vez. Para volver atrás: page.js →
 * footer/index5.
 *
 * Footer de escritorio (copia de index3 con el footer nuevo).
 *
 * La lista de proyectos NO se mueve entre páginas: misma posición (col 7),
 * mismos números a la derecha. Lo único que cambia es el color:
 *   - home: el proyecto activo/hover en negro, el resto en gris
 *   - galería: el proyecto abierto en negro, el resto en gris, y encima
 *     aparece "← Index" (vuelve al menú) con el mismo mask reveal por chars.
 * Desde la galería, click en otro proyecto = cambio directo (onProjectSwitch).
 * "← Index" y "Next <proyecto>" comparten el mismo reveal por letras (ANIM.index*).
 *
 * Lleva la clase kc-blend (globals.css): mix-blend-mode difference, así sigue
 * leyéndose cuando las hojas del slider pasan por debajo.
 */
const MASK_CUSHION = '0.25em';

const ANIM = {
  // Reveal por letras de "← Index" y de "Next <proyecto>" (los dos igual).
  // index6: la salida, in-out en vez de ease-in, un pelo más pausada.
  indexIn: { duration: 0.6, ease: 'power4.out', staggerEach: 0.022, fromYPercent: 140 },
  indexOut: { duration: 0.55, ease: 'power2.inOut', staggerEach: 0.018, yPercent: -140 },
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
  // index6: la lista sale al entrar en un proyecto y vuelve con el Index.
  // Salida pausada (in-out): la lista se va con calma, fila a fila, en vez de
  // desaparecer de golpe.
  listOut: { duration: 0.75, ease: 'power2.inOut', stagger: 0.07, yPercent: -140 },
  listIn: { duration: 0.8, ease: 'power4.out', stagger: 0.06, fromYPercent: 140 },
  // "Next <proyecto>" usa indexIn / indexOut (por letras). Al pasar al
  // siguiente proyecto "Next" se queda y solo sale el nombre; el nuevo no se
  // escribe hasta que el viejo ha salido, y entra cuando la ficha del proyecto
  // nuevo empieza a entrar (evento kc:detail-info-in), detrás del título.
  nameAfterTitle: 0.45, // s detrás del arranque de la ficha
  nameFallback: 5,     // s: si el aviso no llega, el nombre entra igual
};

// Letras con su máscara, igual que las de SplitText en "← Index" (mismo colchón).
const charMaskStyle = {
  paddingTop: MASK_CUSHION,
  paddingBottom: MASK_CUSHION,
  marginTop: `-${MASK_CUSHION}`,
  marginBottom: `-${MASK_CUSHION}`,
};
const maskedChars = (text) =>
  Array.from(text).map((c, i) => (
    <span key={i} className="inline-block overflow-clip" style={charMaskStyle}>
      <span data-ch className="inline-block">{c === ' ' ? '\u00A0' : c}</span>
    </span>
  ));
const charsOf = (el) => Array.from(el?.querySelectorAll('[data-ch]') || []);

// "Next" recorre solo los proyectos (About no es un proyecto: desde About, el primero).
const PROJECT_IDS = ['johnny', 'salon', 'alt', 'mmdiscos'];
const nextProjectId = (id) => {
  const i = PROJECT_IDS.indexOf(id);
  return PROJECT_IDS[(i + 1) % PROJECT_IDS.length];
};

const ITEMS = [
  { title: 'Johnny Carretes', number: '01', id: 'johnny' },
  { title: 'Salon Vilarnau', number: '02', id: 'salon' },
  { title: 'Against Low Trends', number: '03', id: 'alt' },
  { title: 'MM Discos', number: '04', id: 'mmdiscos' },
  { title: 'About', number: '05', id: 'about' },
];

export default function Footer6({ activeProject, onHover, onProjectClick, onProjectSwitch, isVisible = true, backReady = false }) {
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
  const listRef = useRef(null);
  const nextShownRef = useRef(false);
  const nameRef = useRef(null);
  const nextWordRef = useRef(null);
  const namePendingRef = useRef(false);
  // Proyecto que enseña "Next": va por detrás de openId, solo cambia cuando el
  // nombre anterior ya ha salido (así no se ve el nuevo antes de tiempo).
  const [nextLabelId, setNextLabelId] = useState(null);

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

  // "Next" arranca con las letras ocultas bajo su máscara.
  useLayoutEffect(() => {
    gsap.set(charsOf(nextWordRef.current), { yPercent: ANIM.indexIn.fromYPercent });
  }, []);
  // Nombre nuevo: sus letras nacen ocultas si la fila no está en pantalla o si
  // esperan a la ficha del proyecto nuevo.
  useLayoutEffect(() => {
    if (!nextShownRef.current || namePendingRef.current) {
      gsap.set(charsOf(nameRef.current), { yPercent: ANIM.indexIn.fromYPercent });
    }
  }, [nextLabelId]);

  const charsIn = (els) => {
    gsap.killTweensOf(els);
    gsap.fromTo(els, { yPercent: ANIM.indexIn.fromYPercent }, {
      yPercent: 0,
      duration: ANIM.indexIn.duration,
      ease: ANIM.indexIn.ease,
      stagger: ANIM.indexIn.staggerEach,
      force3D: true,
    });
  };
  const charsOut = (els, onComplete) => {
    gsap.killTweensOf(els);
    gsap.to(els, {
      yPercent: ANIM.indexOut.yPercent,
      duration: ANIM.indexOut.duration,
      ease: ANIM.indexOut.ease,
      stagger: ANIM.indexOut.staggerEach,
      force3D: true,
      onComplete,
    });
  };

  const rowInners = () => Array.from(listRef.current?.querySelectorAll('[data-row-inner]') || []);

  const hideList = () => {
    const list = listRef.current;
    const inners = rowInners();
    if (!list) return;
    gsap.killTweensOf(inners);
    gsap.to(inners, {
      yPercent: ANIM.listOut.yPercent,
      duration: ANIM.listOut.duration,
      ease: ANIM.listOut.ease,
      stagger: ANIM.listOut.stagger,
      force3D: true,
      // Ya fuera: la lista deja de ocupar sitio y "← Index" baja a la última línea
      // (todavía oculto: entra cuando la galería está en pantalla).
      onComplete: () => {
        if (openRef.current) list.style.display = 'none';
      },
    });
  };

  const showList = () => {
    const list = listRef.current;
    const inners = rowInners();
    if (!list) return;
    list.style.display = '';
    gsap.killTweensOf(inners);
    gsap.fromTo(inners, { yPercent: ANIM.listIn.fromYPercent }, {
      yPercent: 0,
      duration: ANIM.listIn.duration,
      ease: ANIM.listIn.ease,
      stagger: ANIM.listIn.stagger,
      force3D: true,
    });
  };

  const showName = useCallback(() => {
    if (!namePendingRef.current) return;
    namePendingRef.current = false;
    charsIn(charsOf(nameRef.current));
  }, []);

  // Cambio de proyecto con "Next": salen las letras del nombre, se cambia ya
  // oculto y espera a que la ficha del proyecto nuevo empiece a entrar.
  const swapName = (toId) => {
    charsOut(charsOf(nameRef.current), () => {
      namePendingRef.current = true;
      setNextLabelId(nextProjectId(toId));
      later(ANIM.nameFallback, showName);
    });
  };

  const showNext = useCallback(() => {
    if (nextShownRef.current) return;
    nextShownRef.current = true;
    // "Next" y el nombre como una sola palabra: el stagger sigue de una a otra.
    charsIn([...charsOf(nextWordRef.current), ...charsOf(nameRef.current)]);
  }, []);

  const hideNext = () => {
    nextShownRef.current = false;
    charsOut([...charsOf(nextWordRef.current), ...charsOf(nameRef.current)]);
  };

  // "← Index" entra cuando la galería está entera en pantalla (igual que el
  // antiguo "back menu"): no compite con la carga de texturas.
  useEffect(() => {
    backReadyRef.current = backReady;
    if (backReady && openDoneRef.current) {
      showIndex();
      showNext();
    }
  }, [backReady, showIndex, showNext]);

  // La ficha del proyecto nuevo empieza a entrar: el nombre de "Next" la sigue.
  useEffect(() => {
    const onInfoIn = () => {
      if (namePendingRef.current) later(ANIM.nameAfterTitle, showName);
    };
    window.addEventListener('kc:detail-info-in', onInfoIn);
    return () => window.removeEventListener('kc:detail-info-in', onInfoIn);
  }, [showName]);

  const open = (id) => {
    if (busyRef.current || openRef.current || !id) return;
    busyRef.current = true;
    openRef.current = id;
    openDoneRef.current = false;
    setOpenId(id);
    setNextLabelId(nextProjectId(id));
    namePendingRef.current = false;
    setHoveredId(null);
    onProjectClick?.(id);
    hideList();
    later(ANIM.openDone, () => {
      busyRef.current = false;
      openDoneRef.current = true;
      window.__footerAnimationComplete?.();
      if (backReadyRef.current) {
        showIndex();
        showNext();
      }
    });
  };

  const back = () => {
    if (busyRef.current || !openRef.current) return;
    busyRef.current = true;
    openDoneRef.current = false;
    window.__footerBackStarted?.();
    hideIndex();
    hideNext();
    later(ANIM.backDone, () => {
      openRef.current = null;
      setOpenId(null);
      onProjectClick?.(null);
      busyRef.current = false;
      showList();
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
      // "Next" se queda; solo cambia el nombre (ver swapName).
      swapName(id);
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
  // Etiqueta de sección ("Projects"): el mismo gris claro que en el índice móvil.
  const label = isDarkMode ? '#5c5c5c' : '#b3b3b3';
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
        {/* Fila de la galería: "← Index" (cols 7–8) y "Next" (desde la col 9). */}
        <div className="grid" style={{ gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', columnGap: PAGE.gap }}>
          <button
            type="button"
            onClick={back}
            className="flex cursor-pointer justify-between text-left"
            style={{
              gridColumn: '1 / 3',
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
          <span className="block" style={{ gridColumn: '3 / 7' }}>
            <button
              type="button"
              onClick={() => openId && handleRowClick(nextProjectId(openId))}
              className="flex cursor-pointer text-left transition-opacity hover:opacity-70"
              style={{
                color: full,
                pointerEvents: openId ? 'auto' : 'none',
                background: 'none',
                border: 0,
                padding: 0,
                font: 'inherit',
                gap: '0.75em',
              }}
              aria-hidden={!openId}
              tabIndex={openId ? 0 : -1}
            >
              <span ref={nextWordRef} className="flex" style={{ color: muted }}>{maskedChars('Next')}</span>
              {/* Solo el nombre rueda al cambiar de proyecto. */}
              <span ref={nameRef} key={nextLabelId || 'none'} className="flex">
                {nextLabelId ? maskedChars(`${ITEMS.find((it) => it.id === nextLabelId)?.title} \u2192`) : null}
              </span>
            </button>
          </span>
        </div>

        <div ref={listRef} className="flex flex-col">
        {/* Encabezado de la lista, como en el índice móvil. Sale y entra con ella. */}
        <div
          aria-hidden="true"
          style={{ color: label, overflowX: 'visible', overflowY: 'clip', paddingBottom: MASK_CUSHION, marginBottom: `-${MASK_CUSHION}` }}
        >
          <div data-row-inner>Projects</div>
        </div>
        {ITEMS.map(({ title, number, id }) => (
          <div
            key={number}
            role="button"
            tabIndex={0}
            className="cursor-pointer"
            style={{
              color: lit && lit !== id ? muted : full,
              transition: 'color 150ms linear',
              // Máscara solo en vertical (la de la animación): en horizontal
              // no recorta, así los números no se cortan por la derecha.
              overflowX: 'visible',
              overflowY: 'clip',
              paddingBottom: MASK_CUSHION,
              marginBottom: `-${MASK_CUSHION}`,
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
            <div data-row-inner className="flex justify-between">
              <h1 className="flex">{title}</h1>
              <p className="flex text-right tabular-nums">{number}</p>
            </div>
          </div>
        ))}
        </div>
      </nav>
    </div>
  );
}
