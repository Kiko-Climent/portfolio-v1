'use client';

/**
 * Footer móvil v2.
 *   Home: la lista de proyectos (filas de 22 px, tipo 13–14 px) en difference
 *   (.kc-blend) sobre las hojas. Sigue al slider: el proyecto de la hoja que
 *   está en el ancla va en negro, el resto en gris (sliderBus 'active').
 *   Tocar un título abre ese proyecto, como siempre.
 *   Detalle: la lista sale con la misma máscara por caracteres y entra una
 *   barra de una línea, "← Index" a la izquierda e "Info +" a la derecha.
 *   (El nombre del proyecto ya no entra aquí: va en el navbar.)
 *   About: igual que la v1 (sin barra; "back home" está en el texto).
 * Versión anterior: FooterMobile.js.
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { useDarkMode } from '@/contexts/DarkModeContext';
import { sliderBus } from '@/lib/sliderBus';
import { MOBILE_GRID } from '@/lib/mobileGrid';

gsap.registerPlugin(SplitText);

const MASK_CUSHION = '0.25em';

// Puente con ProjectImageSliderMobile2 (About): fuera del componente, como
// el resto de callbacks window.__* de la web.
const setInfoHiddenCallback = (fn) => {
  if (fn) window.__mobileInfoHidden = fn;
  else delete window.__mobileInfoHidden;
};
const getInfoHiddenCallback = () => window.__mobileInfoHidden;
const ROW_H = 22;

const ANIM = {
  menuOut: { duration: 0.5, ease: 'power3.in', staggerEach: 0.012, rowCascade: 0.05, yPercent: -140 },
  // La barra entra donde antes entraba el título: mismo momento y misma curva.
  barIn: { at: 0.45, duration: 0.9, ease: 'power4.out', staggerEach: 0.03, fromYPercent: 140 },
  backOut: { duration: 0.45, ease: 'power3.in', staggerEach: 0.018, yPercent: -140 },
  menuRestore: { duration: 0.8, ease: 'power4.out', staggerEach: 0.016, rowCascade: 0.06, fromYPercent: 140 },
};

const items = [
  { title: 'Johnny Carretes', number: '01', id: 'johnny' },
  { title: 'Salon Vilarnau', number: '02', id: 'salon' },
  { title: 'Against Low Trends', number: '03', id: 'alt' },
  { title: 'MM Discos', number: '04', id: 'mmdiscos' },
  { title: 'About', number: '05', id: 'about' },
];

export default function FooterMobile2({ onProjectClick, infoOpen = false, onInfoToggle }) {
  const { isDarkMode } = useDarkMode();

  const titleRefs = useRef({});
  const numberRefs = useRef({});
  const splitInstances = useRef({});
  const barRef = useRef(null);
  const indexLabelRef = useRef(null);
  const infoLabelRef = useRef(null);
  const infoSignRef = useRef(null);
  const isDarkModeRef = useRef(isDarkMode);
  useEffect(() => {
    isDarkModeRef.current = isDarkMode;
  }, [isDarkMode]);
  const activeRef = useRef(null);
  const clickedRef = useRef(null);

  const [clickedNumber, setClickedNumber] = useState(null);

  const ink = () => (isDarkModeRef.current ? 'white' : 'black');
  const mutedInk = () => (isDarkModeRef.current ? MOBILE_GRID.mutedDark : MOBILE_GRID.muted);

  const cushionMask = (chars) => {
    chars.forEach((char) => {
      const wrap = char.parentElement;
      if (!wrap) return;
      wrap.style.paddingTop = MASK_CUSHION;
      wrap.style.paddingBottom = MASK_CUSHION;
      wrap.style.marginTop = `-${MASK_CUSHION}`;
      wrap.style.marginBottom = `-${MASK_CUSHION}`;
    });
  };

  const splitTitle = (el) => {
    const split = new SplitText(el, { type: 'words,chars', mask: 'chars', wordsClass: 'word', charsClass: 'char' });
    const words = el.querySelectorAll('.word');
    words.forEach((word, index) => {
      if (index < words.length - 1) word.style.marginRight = '0.45em';
    });
    cushionMask(split.chars);
    return split;
  };

  const splitPlain = (el) => {
    const split = new SplitText(el, { type: 'chars', mask: 'chars', charsClass: 'char' });
    cushionMask(split.chars);
    return split;
  };

  // Lista: activo en negro (o blanco), el resto en gris. Sin dato del slider, todo en negro.
  const paintList = useCallback(() => {
    const active = activeRef.current;
    items.forEach(({ number, id }) => {
      const color = !active || id === active ? ink() : mutedInk();
      [splitInstances.current[`title-${number}`], splitInstances.current[`number-${number}`]].forEach((split) => {
        split?.chars?.forEach((char) => {
          char.style.color = color;
        });
      });
    });
  }, []);

  const paintBar = () => {
    ['bar-index', 'bar-info'].forEach((k) => {
      splitInstances.current[k]?.chars?.forEach((char) => {
        char.style.color = ink();
      });
    });
    if (infoSignRef.current) infoSignRef.current.style.color = ink();
  };

  useEffect(() => {
    let isMounted = true;
    const timer = setTimeout(() => {
      if (!isMounted) return;
      items.forEach(({ number }) => {
        if (titleRefs.current[number]) splitInstances.current[`title-${number}`] = splitTitle(titleRefs.current[number]);
        if (numberRefs.current[number]) splitInstances.current[`number-${number}`] = splitPlain(numberRefs.current[number]);
      });
      paintList();
    }, 0);
    const off = sliderBus.on('active', ({ projectId }) => {
      if (activeRef.current === projectId) return;
      activeRef.current = projectId;
      if (!clickedRef.current) paintList();
    });
    return () => {
      isMounted = false;
      clearTimeout(timer);
      off();
      Object.values(splitInstances.current).forEach((split) => split?.revert?.());
      splitInstances.current = {};
    };
  }, [paintList]);

  useEffect(() => {
    paintList();
    paintBar();
  }, [isDarkMode, paintList]);

  const animateMenuOut = (tl) => {
    items.forEach(({ number }, index) => {
      const titleSplit = splitInstances.current[`title-${number}`];
      const numberSplit = splitInstances.current[`number-${number}`];
      const containerEl = titleRefs.current[number]?.parentElement;
      if (!titleSplit || !numberSplit || !containerEl) return;
      tl.to(
        [...titleSplit.chars, ...numberSplit.chars],
        {
          yPercent: ANIM.menuOut.yPercent,
          duration: ANIM.menuOut.duration,
          ease: ANIM.menuOut.ease,
          stagger: ANIM.menuOut.staggerEach,
          force3D: true,
          onComplete: () => gsap.set(containerEl, { display: 'none' }),
        },
        index * ANIM.menuOut.rowCascade
      );
    });
  };

  const restoreMenu = () => {
    clickedRef.current = null;
    paintList();
    const tl = gsap.timeline({
      onComplete: () => {
        setClickedNumber(null);
        if (onProjectClick) onProjectClick(null);
      },
    });
    items.forEach(({ number }, index) => {
      const titleSplit = splitInstances.current[`title-${number}`];
      const numberSplit = splitInstances.current[`number-${number}`];
      const containerEl = titleRefs.current[number]?.parentElement;
      if (!titleSplit || !numberSplit || !containerEl) return;
      gsap.set(containerEl, { display: 'flex' });
      tl.fromTo(
        [...titleSplit.chars, ...numberSplit.chars],
        { yPercent: ANIM.menuRestore.fromYPercent },
        {
          yPercent: 0,
          duration: ANIM.menuRestore.duration,
          ease: ANIM.menuRestore.ease,
          stagger: ANIM.menuRestore.staggerEach,
          force3D: true,
        },
        index * ANIM.menuRestore.rowCascade
      );
    });
  };

  // Barra "← Index · Info +": se trocea al entrar y se recompone al salir.
  const prepareBar = () => {
    if (!barRef.current || !indexLabelRef.current || !infoLabelRef.current) return [];
    gsap.set(barRef.current, { display: 'flex' });
    const indexSplit = splitPlain(indexLabelRef.current);
    const infoSplit = splitPlain(infoLabelRef.current);
    splitInstances.current['bar-index'] = indexSplit;
    splitInstances.current['bar-info'] = infoSplit;
    paintBar();
    const chars = [...indexSplit.chars, ...infoSplit.chars];
    gsap.set(chars, { yPercent: ANIM.barIn.fromYPercent });
    if (infoSignRef.current) gsap.set(infoSignRef.current, { yPercent: ANIM.barIn.fromYPercent });
    return chars;
  };

  const hideBar = () => {
    ['bar-index', 'bar-info'].forEach((k) => {
      splitInstances.current[k]?.revert?.();
      delete splitInstances.current[k];
    });
    if (barRef.current) gsap.set(barRef.current, { display: 'none' });
  };

  const handleBack = () => {
    if (window.__footerBackStarted) window.__footerBackStarted();

    const barChars = [
      ...(splitInstances.current['bar-index']?.chars ?? []),
      ...(splitInstances.current['bar-info']?.chars ?? []),
    ];

    // About: el texto descriptivo ocupa el sitio del menú. El menú entra cuando
    // esas líneas ya han salido (ProjectImageSliderMobile2 avisa con __mobileInfoHidden).
    if (!barChars.length) {
      let restored = false;
      const restore = () => {
        if (restored) return;
        restored = true;
        window.clearTimeout(fallback);
        if (getInfoHiddenCallback() === restore) setInfoHiddenCallback(null);
        restoreMenu();
      };
      setInfoHiddenCallback(restore);
      const fallback = window.setTimeout(restore, 4000);
      return;
    }

    const tl = gsap.timeline({
      onComplete: () => {
        hideBar();
        restoreMenu();
      },
    });
    const out = {
      yPercent: ANIM.backOut.yPercent,
      duration: ANIM.backOut.duration,
      ease: ANIM.backOut.ease,
      stagger: ANIM.backOut.staggerEach,
      force3D: true,
    };
    tl.to(barChars, out, 0);
    if (infoSignRef.current) tl.to(infoSignRef.current, { ...out, stagger: 0 }, 0);
  };

  const handleBackRef = useRef(null);
  useEffect(() => {
    handleBackRef.current = handleBack;
  });

  useEffect(() => {
    window.__footerMobileRequestBack = () => handleBackRef.current?.();
    return () => {
      delete window.__footerMobileRequestBack;
    };
  }, []);

  const handleClick = (number, id) => {
    if (clickedNumber || !id) return;
    setClickedNumber(number);
    clickedRef.current = id;
    if (onProjectClick) onProjectClick(id);

    const isAbout = id === 'about';
    const tl = gsap.timeline();
    animateMenuOut(tl);

    if (isAbout) {
      tl.eventCallback('onComplete', () => window.__footerAnimationComplete?.());
      return;
    }

    const barChars = prepareBar();
    if (!barChars.length) {
      tl.eventCallback('onComplete', () => window.__footerAnimationComplete?.());
      return;
    }
    const barIn = {
      yPercent: 0,
      duration: ANIM.barIn.duration,
      ease: ANIM.barIn.ease,
      stagger: ANIM.barIn.staggerEach,
      force3D: true,
    };
    tl.to(barChars, { ...barIn, onComplete: () => window.__footerAnimationComplete?.() }, ANIM.barIn.at);
    if (infoSignRef.current) tl.to(infoSignRef.current, { ...barIn, stagger: 0 }, ANIM.barIn.at + 0.1);
  };

  const textClass = 'text-[length:var(--kc-type-mobile-2)] font-semibold';
  const bottom = 'calc(1rem + env(safe-area-inset-bottom, 0px))';

  return (
    <>
      {/* Barra del detalle. kc-blend: difference sobre las hojas (y negra sobre la hoja Info). */}
      <div
        ref={barRef}
        className={`kc-blend absolute left-4 right-4 z-50 justify-between items-center whitespace-nowrap ${textClass}`}
        style={{ display: 'none', bottom, height: ROW_H, lineHeight: 'var(--kc-leading-mobile-2)' }}
      >
        <button type="button" className="flex items-center h-full cursor-pointer" onClick={() => handleBackRef.current?.()}>
          <span ref={indexLabelRef}>← Index</span>
        </button>
        <button
          type="button"
          className="flex items-center h-full cursor-pointer"
          onClick={() => onInfoToggle?.()}
          aria-expanded={infoOpen}
        >
          <span ref={infoLabelRef}>Info</span>
          <span className="inline-block overflow-hidden" style={{ marginLeft: '0.3em', paddingTop: MASK_CUSHION, paddingBottom: MASK_CUSHION, marginTop: `-${MASK_CUSHION}`, marginBottom: `-${MASK_CUSHION}` }}>
            <span ref={infoSignRef} className="inline-block tabular-nums" style={{ width: '0.6em', textAlign: 'center' }}>
              {infoOpen ? '−' : '+'}
            </span>
          </span>
        </button>
      </div>

      {/* Lista de proyectos */}
      <div
        className={`kc-blend absolute left-4 right-4 z-50 ${textClass}`}
        style={{ bottom, lineHeight: 'var(--kc-leading-mobile-2)' }}
      >
        <div className="flex flex-col whitespace-nowrap relative w-full">
          {items.map(({ title, number, id }) => (
            <div
              key={number}
              className="flex w-full justify-between items-start cursor-pointer"
              style={{ height: 'var(--kc-index-row)' }}
              onClick={() => handleClick(number, id || number)}
            >
              {/* Título a tamaño índice (globals.css → --kc-index-mobile-2), interlineado 1,0. */}
              <h1
                ref={(el) => (titleRefs.current[number] = el)}
                className="flex text-left"
                style={{
                  color: isDarkMode ? 'white' : 'black',
                  fontSize: 'var(--kc-index-mobile-2)',
                  lineHeight: 1,
                  letterSpacing: '-0.025em',
                }}
              >
                {title}
              </h1>
              {/* Número al tamaño de texto, colgado arriba a la derecha. */}
              <p
                ref={(el) => (numberRefs.current[number] = el)}
                className="flex justify-end w-[2ch] tabular-nums"
                style={{ color: isDarkMode ? 'white' : 'black', paddingTop: '0.15em' }}
              >
                {number}
              </p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
