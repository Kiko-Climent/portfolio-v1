'use client';

import { useRef, useEffect, useState } from 'react';
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { useDarkMode } from '@/contexts/DarkModeContext';

// Registrar el plugin SplitText
gsap.registerPlugin(SplitText);

/**
 * ───────────────────────────────────────────────────────────────
 *  Tuning editorial — todo lo "afinable" en un solo sitio.
 *  Mask reveal: cada carácter entra/sale desde su propio eje
 *  vertical dentro de una máscara (overflow:clip). Sin viajes
 *  por la pantalla, solo cortina vertical + stagger + easing.
 * ───────────────────────────────────────────────────────────────
 */
// Colchón vertical de la máscara para no recortar ascendentes/descendentes
// (se compensa con margin negativo, así no altera el interlineado).
const MASK_CUSHION = '0.25em';

const ANIM = {
  // Salida del menú al hacer click (los chars suben y se ocultan)
  menuOut: {
    duration: 0.5,
    ease: 'power3.in',
    staggerEach: 0.012,   // entre caracteres de una misma línea
    rowCascade: 0.05,     // desfase extra entre líneas del menú
    yPercent: -140,       // > altura char + colchón, para ocultar del todo
  },
  // Entrada del título seleccionado (abajo-derecha)
  titleIn: {
    at: 0.45,             // momento (s) en el timeline donde arranca
    duration: 0.9,
    ease: 'power4.out',
    staggerEach: 0.03,
    fromYPercent: 140,
  },
  // Botón "back menu"
  backIn: {
    duration: 0.6,
    ease: 'power4.out',
    staggerEach: 0.022,
    fromYPercent: 140,
  },
  // Salida al volver (título + back menu suben y se ocultan)
  backOut: {
    duration: 0.45,
    ease: 'power3.in',
    staggerEach: 0.018,
    yPercent: -140,
  },
  // Reaparición del menú al volver
  menuRestore: {
    duration: 0.8,
    ease: 'power4.out',
    staggerEach: 0.016,
    rowCascade: 0.06,
    fromYPercent: 140,
  },
};

export default function Footer3({ activeProject, onHover, onProjectClick, isVisible = true }) {
  const { isDarkMode } = useDarkMode();
  const items = [
    { title: "Johnny Carretes", number: "01", id: "johnny" },
    { title: "Salon Vilarnau", number: "02", id: "salon" },
    { title: "Against Low Trends", number: "03", id: "alt" },
    { title: "MM Discos", number: "04", id: "mmdiscos" },
    { title: "About", number: "Me", id: "about" },
  ];

  const titleRefs = useRef({});
  const numberRefs = useRef({});
  const splitInstances = useRef({});
  const backButtonRef = useRef(null);
  const clickedTitleContainerRef = useRef(null);
  const [clickedNumber, setClickedNumber] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  const effectiveActiveId = hoveredId || activeProject;

  // ── Helpers ────────────────────────────────────────────────
  const applyColor = (chars) => {
    chars.forEach((char) => {
      char.style.color = isDarkMode ? 'white' : 'black';
    });
  };

  // Agranda la caja de recorte de cada máscara para que ascendentes y
  // descendentes (g, y, j...) no se corten con el interlineado apretado.
  // El padding amplía la zona visible y el margin negativo idéntico deja
  // el aporte al layout neto en 0, así el ritmo vertical no cambia.
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
    const split = new SplitText(el, {
      type: 'words,chars',
      mask: 'chars',
      wordsClass: 'word',
      charsClass: 'char',
    });
    const words = el.querySelectorAll('.word');
    words.forEach((word, index) => {
      if (index < words.length - 1) word.style.marginRight = '0.25em';
    });
    applyColor(split.chars);
    cushionMask(split.chars);
    return split;
  };

  const splitPlain = (el) => {
    const split = new SplitText(el, { type: 'chars', mask: 'chars', charsClass: 'char' });
    applyColor(split.chars);
    cushionMask(split.chars);
    return split;
  };

  // Inicializar SplitText cuando el componente se monta
  useEffect(() => {
    let isMounted = true;

    const timer = setTimeout(() => {
      if (!isMounted) return;

      items.forEach(({ number }) => {
        if (titleRefs.current[number]) {
          splitInstances.current[`title-${number}`] = splitTitle(titleRefs.current[number]);
        }
        if (numberRefs.current[number]) {
          splitInstances.current[`number-${number}`] = splitPlain(numberRefs.current[number]);
        }
      });
    }, 0);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      Object.values(splitInstances.current).forEach((split) => {
        if (split && split.revert) split.revert();
      });
      splitInstances.current = {};
    };
  }, [isDarkMode]);

  useEffect(() => {
    if (backButtonRef.current) {
      backButtonRef.current.style.color = isDarkMode ? 'white' : 'black';
    }
    if (clickedTitleContainerRef.current) {
      const titleEl = clickedTitleContainerRef.current.querySelector('h1');
      if (titleEl) titleEl.style.color = isDarkMode ? 'white' : 'black';
    }
  }, [isDarkMode]);

  // ── Click sobre un proyecto ────────────────────────────────
  const handleClick = (number, id) => {
    if (clickedNumber || !id) return;

    setClickedNumber(number);
    if (onProjectClick) onProjectClick(id);

    const clickedItem = items.find((item) => item.number === number);
    if (!clickedItem || !clickedTitleContainerRef.current) return;

    // 1) Construir el título seleccionado (abajo-derecha) + botón back, ocultos.
    clickedTitleContainerRef.current.innerHTML = '';

    const backButtonEl = document.createElement('div');
    backButtonEl.className = 'cursor-pointer text-right';
    backButtonEl.style.color = isDarkMode ? 'white' : 'black';
    backButtonEl.textContent = 'back menu';
    backButtonEl.style.display = 'none';
    backButtonEl.addEventListener('click', handleBack);
    clickedTitleContainerRef.current.appendChild(backButtonEl);
    backButtonRef.current = backButtonEl;

    const newTitleEl = document.createElement('h1');
    newTitleEl.style.color = isDarkMode ? 'white' : 'black';
    newTitleEl.textContent = clickedItem.title;
    clickedTitleContainerRef.current.appendChild(newTitleEl);

    const newTitleSplit = splitTitle(newTitleEl);
    splitInstances.current['clicked-title'] = newTitleSplit;

    gsap.set(newTitleSplit.chars, { yPercent: ANIM.titleIn.fromYPercent });
    gsap.set(clickedTitleContainerRef.current, { display: 'flex' });

    // 2) Timeline: el menú se va con cortina vertical, entra el título.
    const tl = gsap.timeline();

    items.forEach(({ number: itemNumber }, index) => {
      const titleSplit = splitInstances.current[`title-${itemNumber}`];
      const numberSplit = splitInstances.current[`number-${itemNumber}`];
      const containerEl = titleRefs.current[itemNumber]?.parentElement;
      if (!titleSplit || !numberSplit || !containerEl) return;

      const allChars = [...titleSplit.chars, ...numberSplit.chars];
      tl.to(
        allChars,
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

    // 3) Entrada del título seleccionado.
    tl.to(
      newTitleSplit.chars,
      {
        yPercent: 0,
        duration: ANIM.titleIn.duration,
        ease: ANIM.titleIn.ease,
        stagger: ANIM.titleIn.staggerEach,
        force3D: true,
        onComplete: () => {
          if (window.__footerAnimationComplete) window.__footerAnimationComplete();
          revealBackButton();
        },
      },
      ANIM.titleIn.at
    );
  };

  // ── Mostrar el botón "back menu" con el mismo mask reveal ───
  const revealBackButton = () => {
    const el = backButtonRef.current;
    if (!el) return;

    gsap.set(el, { display: 'block', opacity: 1 });

    const backSplit = splitPlain(el);
    splitInstances.current['back-button'] = backSplit;
    if (!backSplit.chars || backSplit.chars.length === 0) return;

    gsap.fromTo(
      backSplit.chars,
      { yPercent: ANIM.backIn.fromYPercent },
      {
        yPercent: 0,
        duration: ANIM.backIn.duration,
        ease: ANIM.backIn.ease,
        stagger: ANIM.backIn.staggerEach,
        force3D: true,
      }
    );
  };

  // ── Volver al menú ─────────────────────────────────────────
  const handleBack = () => {
    if (window.__footerBackStarted) window.__footerBackStarted();

    const backSplit = splitInstances.current['back-button'];
    const titleSplit = splitInstances.current['clicked-title'];

    const tl = gsap.timeline({
      onComplete: () => {
        if (clickedTitleContainerRef.current) {
          gsap.set(clickedTitleContainerRef.current, { display: 'none' });
        }
        if (titleSplit && titleSplit.revert) titleSplit.revert();
        if (backSplit && backSplit.revert) backSplit.revert();
        delete splitInstances.current['clicked-title'];
        delete splitInstances.current['back-button'];

        restoreMenu();
      },
    });

    if (backSplit && backButtonRef.current) {
      tl.to(
        backSplit.chars,
        {
          yPercent: ANIM.backOut.yPercent,
          duration: ANIM.backOut.duration,
          ease: ANIM.backOut.ease,
          stagger: ANIM.backOut.staggerEach,
          force3D: true,
        },
        0
      );
    }

    if (titleSplit && clickedTitleContainerRef.current) {
      tl.to(
        titleSplit.chars,
        {
          yPercent: ANIM.backOut.yPercent,
          duration: ANIM.backOut.duration,
          ease: ANIM.backOut.ease,
          stagger: ANIM.backOut.staggerEach,
          force3D: true,
        },
        0
      );
    }

    // Si no había nada que sacar, ir directo al menú.
    if (!backSplit && !titleSplit) {
      tl.kill();
      restoreMenu();
    }
  };

  const restoreMenu = () => {
    const tl = gsap.timeline({
      onComplete: () => {
        setClickedNumber(null);
        if (onProjectClick) onProjectClick(null);
      },
    });

    items.forEach(({ number: itemNumber }, index) => {
      const titleSplit = splitInstances.current[`title-${itemNumber}`];
      const numberSplit = splitInstances.current[`number-${itemNumber}`];
      const containerEl = titleRefs.current[itemNumber]?.parentElement;
      if (!titleSplit || !numberSplit || !containerEl) return;

      gsap.set(containerEl, { display: 'flex' });
      const allChars = [...titleSplit.chars, ...numberSplit.chars];

      tl.fromTo(
        allChars,
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

  return (
    <div
      className="flex bottom-4 right-4 z-50 text-[clamp(1.0625rem,1.75vw,1.3125rem)] leading-[1] absolute transition-opacity duration-700"
      style={{
        left: '50%',
        width: 'calc(50% - 1rem)',
        opacity: isVisible ? 1 : 0,
        pointerEvents: isVisible ? 'auto' : 'none',
      }}
      onMouseLeave={() => {
        if (!clickedNumber) {
          setHoveredId(null);
          onHover(null);
        }
      }}
    >
      <div className="flex w-full flex-col whitespace-nowrap relative">
        <div
          ref={clickedTitleContainerRef}
          className="absolute bottom-0 right-0 whitespace-nowrap flex flex-col items-end"
          style={{ display: 'none' }}
        ></div>

        {items.map(({ title, number, id }) => (
          <div
            key={number}
            className="flex justify-between cursor-pointer transition-colors duration-300 ease-in-out"
            style={{
              opacity: effectiveActiveId && effectiveActiveId !== id ? 0.5 : 1,
            }}
            onMouseEnter={() => {
              if (id && !clickedNumber) {
                setHoveredId(id);
                onHover(id);
              }
            }}
            onMouseLeave={() => {
              if (!clickedNumber) setHoveredId(null);
            }}
            onClick={() => handleClick(number, id || number)}
          >
            <h1
              ref={(el) => (titleRefs.current[number] = el)}
              className="flex"
              style={{ color: isDarkMode ? 'white' : 'black' }}
            >
              {title}
            </h1>
            <p
              ref={(el) => (numberRefs.current[number] = el)}
              className="flex text-right w-[2ch]"
              style={{ color: isDarkMode ? 'white' : 'black' }}
            >
              {number}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
