'use client';

import { useRef, useEffect, useState } from 'react';
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { useDarkMode } from '@/contexts/DarkModeContext';

gsap.registerPlugin(SplitText);

// SVG glow filter inyectado una sola vez en el DOM
function GlowFilter() {
  return (
    <svg
      style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
      aria-hidden="true"
    >
      <defs>
        <filter id="text-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="1 0 0 0 1
                    0 1 0 0 1
                    0 0 1 0 1
                    0 0 0 22 -7"
            result="glow"
          />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
    </svg>
  );
}

export default function Footer4({ activeProject, onHover, onProjectClick, isVisible = true }) {
  const { isDarkMode } = useDarkMode();

  const items = [
    { title: 'Johnny Carretes', number: '01', id: 'johnny' },
    { title: 'Salon Vilarnau',  number: '02', id: 'salon'  },
    { title: 'Against Low Trends', number: '03', id: 'alt'  },
    { title: 'Acid Discos',     number: '04', id: 'acid'   },
    { title: 'About',           number: 'Me', id: 'about'  },
  ];

  const rowRefs        = useRef({});   // el wrapper clippeado de cada row
  const titleRefs      = useRef({});
  const numberRefs     = useRef({});
  const clickedBoxRef  = useRef(null);
  const backBtnRef     = useRef(null);
  const splitRefs      = useRef({});

  const [clickedNumber, setClickedNumber] = useState(null);
  const [hoveredId,     setHoveredId]     = useState(null);
  const effectiveActiveId = hoveredId || activeProject;

  // ─── helpers ────────────────────────────────────────────────────────────────

  const color = () => (isDarkMode ? 'white' : 'black');

  /** Revela un elemento con mask bottom-to-top + glow burst */
  function revealRow(el, delay = 0, onComplete) {
    if (!el) return;

    // wrapper ya tiene overflow:hidden; animar clipPath
    gsap.set(el, { clipPath: 'inset(100% 0% 0% 0%)' });

    const tl = gsap.timeline({ delay });

    // 1. Glow burst al inicio del reveal
    tl.to(el, {
      filter: 'url(#text-glow)',
      duration: 0,
    });

    // 2. Mask sube
    tl.to(el, {
      clipPath: 'inset(0% 0% 0% 0%)',
      duration: 0.65,
      ease: 'power3.out',
    });

    // 3. Glow se disipa
    tl.to(el, {
      filter: 'none',
      duration: 0.45,
      ease: 'power2.out',
      onComplete,
    }, '-=0.2');

    return tl;
  }

  /** Oculta un elemento con mask top-to-bottom + glow burst */
  function hideRow(el, delay = 0, onComplete) {
    if (!el) return;

    const tl = gsap.timeline({ delay });

    tl.to(el, { filter: 'url(#text-glow)', duration: 0 });

    tl.to(el, {
      clipPath: 'inset(0% 0% 100% 0%)',
      duration: 0.55,
      ease: 'power3.in',
    });

    tl.to(el, {
      filter: 'none',
      duration: 0,
      onComplete: () => {
        gsap.set(el, { display: 'none' });
        onComplete?.();
      },
    });

    return tl;
  }

  // ─── init: asegurar clip inicial visible ────────────────────────────────────
  useEffect(() => {
    items.forEach(({ number }) => {
      const row = rowRefs.current[number];
      if (row) gsap.set(row, { clipPath: 'inset(0% 0% 0% 0%)' });
    });
  }, []);

  // ─── handle click ───────────────────────────────────────────────────────────
  const handleClick = (number, id) => {
    if (clickedNumber) return;
    setClickedNumber(number);
    onProjectClick?.(id);

    const clickedItem = items.find(i => i.number === number);
    const STAGGER_STEP = 0.12;

    // 1. Ocultar todas las rows con stagger
    items.forEach(({ number: n }, i) => {
      const row = rowRefs.current[n];
      const isLast = i === items.length - 1;

      hideRow(row, i * STAGGER_STEP, isLast ? afterAllHidden : undefined);
    });

    function afterAllHidden() {
      // 2. Mostrar la clicked box
      const box = clickedBoxRef.current;
      if (!box || !clickedItem) return;

      box.innerHTML = '';

      // back button
      const back = document.createElement('div');
      back.style.cssText = `
        position: absolute;
        top: -1.5rem;
        right: 0;
        cursor: pointer;
        color: ${color()};
        font-size: inherit;
        line-height: inherit;
        clip-path: inset(100% 0% 0% 0%);
        overflow: hidden;
      `;
      back.textContent = 'back menu';
      back.addEventListener('click', handleBack);
      backBtnRef.current = back;
      box.appendChild(back);

      // title
      const h1 = document.createElement('h1');
      h1.className = 'flex';
      h1.style.cssText = `color: ${color()}; overflow: hidden; clip-path: inset(100% 0% 0% 0%);`;
      h1.textContent = clickedItem.title;
      box.appendChild(h1);

      gsap.set(box, { display: 'block' });

      // reveal title
      revealRow(h1, 0, () => {
        // reveal back button after title
        revealRow(back, 0.05, () => {
          if (window.__footerAnimationComplete) window.__footerAnimationComplete();
        });
      });
    }
  };

  // ─── handle back ────────────────────────────────────────────────────────────
  const handleBack = () => {
    window.__footerBackStarted?.();

    const box  = clickedBoxRef.current;
    const back = backBtnRef.current;
    const h1   = box?.querySelector('h1');

    const STAGGER_STEP = 0.1;

    // Ocultar back + title
    hideRow(back, 0);
    hideRow(h1, 0.08, () => {
      gsap.set(box, { display: 'none' });

      // Re-revelar rows en orden inverso
      const reversed = [...items].reverse();
      reversed.forEach(({ number: n }, i) => {
        const row = rowRefs.current[n];
        if (row) {
          gsap.set(row, { display: 'flex' });
          revealRow(row, i * STAGGER_STEP);
        }
      });

      setTimeout(() => {
        setClickedNumber(null);
        onProjectClick?.(null);
      }, (reversed.length * STAGGER_STEP + 0.8) * 1000);
    });
  };

  // ─── render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <GlowFilter />

      <div
        className="flex bottom-4 right-4 z-50 text-[clamp(1.25rem,2vw,1.5rem)] leading-[0.95] absolute transition-opacity duration-700"
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

          {/* Box para el título clicado */}
          <div
            ref={clickedBoxRef}
            className="absolute bottom-0 right-0 whitespace-nowrap"
            style={{ display: 'none' }}
          />

          {/* Lista de items */}
          {items.map(({ title, number, id }) => (
            <div
              key={number}
              /* Row wrapper: overflow hidden para el clip */
              ref={el => rowRefs.current[number] = el}
              className="flex justify-between cursor-pointer"
              style={{
                overflow: 'hidden',
                opacity: effectiveActiveId && effectiveActiveId !== id ? 0.5 : 1,
                transition: 'opacity 0.3s ease',
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
                ref={el => titleRefs.current[number] = el}
                className="flex"
                style={{ color: color() }}
              >
                {title}
              </h1>
              <p
                ref={el => numberRefs.current[number] = el}
                className="flex text-right w-[2ch]"
                style={{ color: color() }}
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