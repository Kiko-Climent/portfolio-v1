'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { useDarkMode } from '@/contexts/DarkModeContext';
import { CURTAIN } from '@/components/SliderThree/index5';
import { PAGE, columnLeft, columnsWidth, columnsWidthPx } from '@/lib/pageGrid';

gsap.registerPlugin(SplitText);

/**
 * About v2 — "Contact sheet" (oct 2026, boceto 02f del canvas).
 * La ampliada va pegada al borde derecho de la col 12 (como el fotograma 12):
 * si el alto no da para las 3 columnas, se estrecha hacia la izquierda.
 *
 * Una sola foto → 12 recortes del mismo negativo, uno por columna. Al pasar
 * por un fotograma se amplía en las columnas 10–12. La bio va bajo la tira
 * (cols 1–4) y los servicios destacados abajo a la izquierda.
 *
 * Las animaciones son las mismas que el About v1 / las galerías:
 *   - imágenes: cortina (clip-path) con CURTAIN de SliderThree/index5, con la
 *     imagen asentándose dentro de su hoja (zoomFrom → 1). Salida con CURTAIN.out.
 *   - texto: reveal por líneas con máscara (INFO_ANIM, mismos valores que en
 *     ProjectImageSliderThreeGrid), las líneas a la misma altura suben juntas.
 *
 * La v1 sigue en ProjectImageSliderThreeGrid (ABOUT_LAYOUT = 'stack').
 */

// Mismos valores que INFO_ANIM en ProjectImageSliderThreeGrid.
const INFO_ANIM = {
  cushion: '0.2em',
  fromYPercent: 130,
  duration: 0.9,
  ease: 'power4.out',
  stagger: 0.09,
  delay: 0.12,
  out: {
    yPercent: -130,
    duration: 0.5,
    ease: 'power3.in',
    stagger: 0.05,
  },
};

// 12 fotogramas: la cortina va de izquierda a derecha más rápida que entre las
// hojas del slider (0.12 × 12 se haría eterno). La ampliada entra con la tira.
const STRIP_STAGGER = 0.04;
// Cambio de fotograma en la ampliada: la nueva sube con la cortina sobre la anterior.
const SWAP = { duration: 0.8, ease: CURTAIN.ease };

const ACCENT = '#E8000D';
// Única excepción al tipo único: los servicios (~44 px a 1440).
const SERVICES_TYPE = 'clamp(1.75rem, 3.05vw, 3.5rem)';

const HIDDEN = 'inset(100% 0% 0% 0%)';
const SHOWN = 'inset(0% 0% 0% 0%)';
const GONE = 'inset(0% 0% 100% 0%)';

const pad2 = (n) => String(n).padStart(2, '0');

/** Línea suelta con su máscara (mismo colchón que las de SplitText). */
function Line({ lineRef, children, className = '', style }) {
  return (
    <span
      className={`block overflow-clip ${className}`}
      style={{ paddingBottom: INFO_ANIM.cushion, marginBottom: `-${INFO_ANIM.cushion}`, ...style }}
    >
      <span ref={lineRef} className="block">
        {children}
      </span>
    </span>
  );
}

/**
 * Fotogramas ya recortados, enfocados y con grano (scripts/about-sheet.mjs):
 * sm para la tira, lg para la ampliada. Los recortes: data/aboutSheet.json.
 */
const frameSrc = (index, size) => `/about/sheet/frame-${pad2(index + 1)}.${size}.webp`;

function Frame({ src, priority }) {
  if (!src) return null;
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      decoding="async"
      fetchPriority={priority}
      className="absolute inset-0 block h-full w-full select-none object-cover"
    />
  );
}

export default function AboutContactSheet({ project, shouldHide = false, onSceneReady, onTextReady }) {
  const { isDarkMode } = useDarkMode();
  const ink = isDarkMode ? '#ffffff' : '#000000';
  const mutedInk = isDarkMode ? PAGE.mutedDark : PAGE.muted;

  const { sheet, services = [], bio = [] } = project;
  const frames = sheet.frames;

  const [picked, setPicked] = useState((sheet.defaultFrame || 1) - 1);
  // El marco rojo del fotograma elegido solo con la tira ya en pantalla.
  const [live, setLive] = useState(false);
  const [layout, setLayout] = useState({ top: 128, plateW: 0, plateH: 0 });
  // Ampliadas que ya se pueden descargar: la de entrada, y el resto en cuanto
  // la tira está en pantalla (o antes, si se pasa por encima de un fotograma).
  const [requested, setRequested] = useState(() => new Set([(sheet.defaultFrame || 1) - 1]));

  const rootRef = useRef(null);
  const servicesRef = useRef(null);
  const plateColRef = useRef(null);
  const stripRefs = useRef([]);
  const plateRefs = useRef([]);
  const linesRef = useRef(new Set());
  const splitRef = useRef(null);
  const sceneOnScreenRef = useRef(false);
  const pendingRevealRef = useRef(null);
  const introDoneRef = useRef(false);
  const zRef = useRef(1);
  const hiddenRef = useRef(false);

  const addLine = (el) => {
    if (el) linesRef.current.add(el);
  };

  // ── Medidas: arranque de la rejilla bajo el navbar y alto libre de la
  // ampliada hasta el footer (cols 7–12).
  useLayoutEffect(() => {
    const measure = () => {
      const navbar = document.querySelector('[data-navbar]');
      const footer = document.querySelector('[data-footer]');
      const top = navbar ? navbar.getBoundingClientRect().bottom + PAGE.rowGap : 128;
      const vw = window.innerWidth;
      // La ampliada ocupa siempre columnas enteras (10–12, o 11–12 si la
      // pantalla es muy baja): sus dos bordes caen en la rejilla. Si el alto
      // no da para el 3:4, se recorta (cover) en vez de estrecharse.
      let plateW = columnsWidthPx(3, vw);
      let plateH = (plateW * 4) / 3;
      const col = plateColRef.current;
      if (col && footer) {
        const fontSize = parseFloat(getComputedStyle(col).fontSize) || 15;
        const captionH = fontSize + 6;
        const available = footer.getBoundingClientRect().top - PAGE.gap * 2 - captionH - col.getBoundingClientRect().top;
        plateH = Math.max(0, Math.min(plateH, available));
        if (plateH < plateW) {
          plateW = columnsWidthPx(2, vw);
          plateH = Math.max(0, Math.min((plateW * 4) / 3, available));
        }
      }
      setLayout({ top, plateW, plateH });
    };
    measure();
    // Segunda pasada: la columna de la ampliada depende del alto de la tira.
    const raf = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', measure);
    };
  }, []);

  // ── Entrada de las imágenes: la misma cortina que el slider / About v1.
  useLayoutEffect(() => {
    const strip = stripRefs.current.filter(Boolean);
    const plates = plateRefs.current.filter(Boolean);
    const activePlate = plates[picked];
    if (!strip.length || !activePlate) return undefined;

    const sheets = [...strip, activePlate];
    const inners = sheets.map((el) => el.firstElementChild).filter(Boolean);
    gsap.set([...strip, ...plates], { clipPath: HIDDEN });
    gsap.set(inners, { scale: CURTAIN.zoomFrom });
    activePlate.style.zIndex = String(++zRef.current);

    let cancelled = false;
    const mountedAt = performance.now();
    const firstImgs = [strip[0].querySelector('img'), activePlate.querySelector('img')].filter(Boolean);
    const decoded = Promise.all(firstImgs.map((img) => (img.decode ? img.decode().catch(() => {}) : null)));

    decoded.then(() => {
      if (cancelled) return;
      const delay = Math.max(0, CURTAIN.minDelay - (performance.now() - mountedAt) / 1000);
      const stripTo = { clipPath: SHOWN, delay, duration: CURTAIN.duration, ease: CURTAIN.ease, stagger: STRIP_STAGGER };
      gsap.to(strip, stripTo);
      gsap.to(inners.slice(0, strip.length), {
        scale: 1,
        delay,
        duration: CURTAIN.duration,
        ease: CURTAIN.ease,
        stagger: STRIP_STAGGER,
      });
      const plateDelay = delay + CURTAIN.stagger;
      gsap.to(activePlate, { clipPath: SHOWN, delay: plateDelay, duration: CURTAIN.duration, ease: CURTAIN.ease });
      gsap.to(activePlate.firstElementChild, { scale: 1, delay: plateDelay, duration: CURTAIN.duration, ease: CURTAIN.ease });
      gsap.delayedCall(
        delay + (strip.length - 1) * STRIP_STAGGER + CURTAIN.duration * CURTAIN.readyAt,
        () => {
          if (cancelled) return;
          introDoneRef.current = true;
          sceneOnScreenRef.current = true;
          setLive(true);
          setRequested(new Set(frames.map((_, i) => i)));
          onSceneReady?.();
          pendingRevealRef.current?.();
          pendingRevealRef.current = null;
        }
      );
    });

    return () => {
      cancelled = true;
      gsap.killTweensOf([...sheets, ...inners]);
    };
    // Solo al montar: los cambios de fotograma van por su propio efecto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Cambio de fotograma: la nueva ampliada sube con la cortina por encima.
  const firstPickRef = useRef(true);
  useEffect(() => {
    if (firstPickRef.current) {
      firstPickRef.current = false;
      return;
    }
    if (hiddenRef.current) return;
    const plates = plateRefs.current.filter(Boolean);
    const plate = plates[picked];
    if (!plate) return;
    const inner = plate.firstElementChild;
    const img = plate.querySelector('img');
    let cancelled = false;
    const decoded = img && !img.complete && img.decode ? img.decode().catch(() => {}) : Promise.resolve();
    decoded.then(() => {
      if (cancelled || hiddenRef.current) return;
      plate.style.zIndex = String(++zRef.current);
      gsap.killTweensOf([plate, inner]);
      gsap.fromTo(plate, { clipPath: HIDDEN }, {
        clipPath: SHOWN,
        duration: SWAP.duration,
        ease: SWAP.ease,
        onComplete: () => {
          // Las que han quedado tapadas por completo se esconden para la
          // próxima subida (las que están entrando por encima, no).
          const z = Number(plate.style.zIndex);
          plates.forEach((p) => {
            if (Number(p.style.zIndex || 0) < z) gsap.set(p, { clipPath: HIDDEN });
          });
        },
      });
      gsap.fromTo(inner, { scale: CURTAIN.zoomFrom }, { scale: 1, duration: SWAP.duration, ease: SWAP.ease });
    });
    return () => {
      cancelled = true;
    };
  }, [picked]);

  // ── Texto: reveal por líneas, de arriba abajo (filas a la misma altura juntas).
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    let splits = [];

    const timer = setTimeout(() => {
      splits = Array.from(root.querySelectorAll('[data-split]')).map(
        (cell) => new SplitText(cell, { type: 'lines', mask: 'lines', linesClass: 'info-line' })
      );
      splits.forEach((sp) =>
        sp.lines.forEach((line) => {
          const wrap = line.parentElement;
          if (!wrap) return;
          wrap.style.paddingBottom = INFO_ANIM.cushion;
          wrap.style.marginBottom = `-${INFO_ANIM.cushion}`;
        })
      );

      const lines = [...linesRef.current, ...splits.flatMap((sp) => sp.lines)].filter((l) => l.isConnected);
      if (!lines.length) return;
      // Dos bloques que entran a la vez: tira + bio (arriba) y servicios (abajo).
      // Dentro de cada uno, las líneas a la misma altura suben juntas.
      const topOf = (l) => Math.round(l.getBoundingClientRect().top);
      const inServices = (l) => !!servicesRef.current?.contains(l);
      [false, true].forEach((group) => {
        const groupLines = lines.filter((l) => inServices(l) === group);
        const tops = [...new Set(groupLines.map(topOf))].sort((a, b) => a - b);
        groupLines.forEach((l) => {
          l.dataset.row = String(tops.indexOf(topOf(l)));
        });
      });
      lines.sort((a, b) => Number(a.dataset.row) - Number(b.dataset.row));
      splitRef.current = lines;

      gsap.set(lines, { yPercent: INFO_ANIM.fromYPercent });
      const reveal = () => {
        if (hiddenRef.current) return;
        gsap.to(lines, {
          yPercent: 0,
          duration: INFO_ANIM.duration,
          ease: INFO_ANIM.ease,
          stagger: (i, el) => Number(el.dataset.row || i) * INFO_ANIM.stagger,
          delay: INFO_ANIM.delay,
          force3D: true,
          onComplete: () => onTextReady?.(),
        });
      };
      if (sceneOnScreenRef.current) reveal();
      else pendingRevealRef.current = reveal;
    }, 60);

    return () => {
      clearTimeout(timer);
      pendingRevealRef.current = null;
      splits.forEach((sp) => sp.revert());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Salida al volver al menú / cambiar de proyecto.
  useEffect(() => {
    if (!shouldHide) return;
    hiddenRef.current = true;
    setLive(false);
    const lines = splitRef.current;
    if (lines?.length) {
      // Por filas, como la entrada, y sin pasarse del tiempo que el footer deja
      // a la galería para salir (backDone ≈ 1.1 s): con muchas filas se aprieta.
      const maxRow = Math.max(1, ...lines.map((l) => Number(l.dataset.row || 0)));
      const rowStagger = Math.min(INFO_ANIM.out.stagger, 0.45 / maxRow);
      gsap.killTweensOf(lines);
      gsap.to(lines, {
        yPercent: INFO_ANIM.out.yPercent,
        duration: INFO_ANIM.out.duration,
        ease: INFO_ANIM.out.ease,
        stagger: (i, el) => Number(el.dataset.row || 0) * rowStagger,
        force3D: true,
      });
    }
    const strip = stripRefs.current.filter(Boolean);
    const plate = plateRefs.current[picked];
    const sheets = plate ? [...strip, plate] : strip;
    const inners = sheets.map((el) => el.firstElementChild).filter(Boolean);
    gsap.killTweensOf([...sheets, ...inners]);
    gsap.to(sheets, {
      clipPath: GONE,
      duration: CURTAIN.out.duration,
      ease: CURTAIN.out.ease,
      stagger: CURTAIN.out.stagger / 2,
    });
    gsap.to(inners, {
      scale: CURTAIN.out.zoomTo,
      duration: CURTAIN.out.duration,
      ease: CURTAIN.out.ease,
      stagger: CURTAIN.out.stagger / 2,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldHide]);

  const pick = (i) => {
    if (hiddenRef.current || i === picked) return;
    setRequested((prev) => (prev.has(i) ? prev : new Set(prev).add(i)));
    setPicked(i);
  };

  return (
    <div
      ref={rootRef}
      className="absolute inset-0 text-[length:var(--kc-type)] leading-[1] pointer-events-none"
      style={{ color: ink }}
    >
      {/* Tira de contactos + bio + ampliada */}
      <div
        className="absolute flex flex-col"
        style={{ top: layout.top, left: PAGE.pad, right: PAGE.pad, gap: PAGE.rowGap }}
      >
        <div className="flex flex-col">
          <div
            className="grid"
            style={{ gridTemplateColumns: `repeat(${PAGE.columns}, minmax(0, 1fr))`, columnGap: PAGE.gap }}
          >
            {frames.map((frame, i) => {
              const active = i === picked;
              const marked = active && live;
              return (
                <button
                  key={i}
                  type="button"
                  aria-label={`Frame ${pad2(i + 1)}`}
                  aria-pressed={active}
                  onMouseEnter={() => pick(i)}
                  onFocus={() => pick(i)}
                  onClick={() => pick(i)}
                  className="flex cursor-pointer flex-col text-left pointer-events-auto"
                  style={{ gap: 8, padding: 0, border: 0, background: 'none', font: 'inherit', color: 'inherit' }}
                >
                  <span
                    className="block w-full"
                    style={{
                      outline: marked ? `2px solid ${ACCENT}` : '2px solid transparent',
                      outlineOffset: 3,
                      transition: 'outline-color 150ms linear',
                    }}
                  >
                    <span
                      ref={(el) => {
                        stripRefs.current[i] = el;
                      }}
                      className="relative block w-full overflow-hidden"
                      style={{ aspectRatio: '3 / 4' }}
                    >
                      <span className="absolute inset-0 block">
                        <Frame src={frameSrc(i, 'sm')} priority="high" />
                      </span>
                    </span>
                  </span>
                  {/* Mismo cuerpo que los nombres de archivo del grid de la home. */}
                  <Line
                    lineRef={addLine}
                    style={{ fontSize: 10, lineHeight: '12px', color: marked ? ACCENT : mutedInk, transition: 'color 150ms linear' }}
                  >
                    {pad2(i + 1)}
                  </Line>
                </button>
              );
            })}
          </div>
        </div>

        <div
          className="grid items-start"
          style={{ gridTemplateColumns: `repeat(${PAGE.columns}, minmax(0, 1fr))`, columnGap: PAGE.gap }}
        >
          <div className="flex flex-col pointer-events-auto" style={{ gridColumn: '1 / span 4', gap: '1em' }}>
            <Line lineRef={addLine}>About</Line>
            {bio.map((paragraph, i) => (
              <p
                key={i}
                data-split
                className="m-0"
                style={{ color: i === bio.length - 1 ? mutedInk : ink }}
              >
                {paragraph}
              </p>
            ))}
          </div>

          <figure
            ref={plateColRef}
            className="m-0 flex flex-col items-end"
            style={{ gridColumn: '10 / span 3', gap: 6 }}
          >
            <div
              className="relative"
              style={layout.plateH ? { width: layout.plateW, height: layout.plateH } : { width: '100%', aspectRatio: '3 / 4' }}
            >
              {frames.map((frame, i) => (
                <div
                  key={i}
                  ref={(el) => {
                    plateRefs.current[i] = el;
                  }}
                  className="absolute inset-0 overflow-hidden"
                  style={{ clipPath: HIDDEN }}
                  aria-hidden={i !== picked}
                >
                  <div className="absolute inset-0">
                    <Frame src={requested.has(i) ? frameSrc(i, 'lg') : null} priority={i === picked ? 'high' : 'low'} />
                  </div>
                </div>
              ))}
              <span className="sr-only">Portrait of Kiko Climent, frame {pad2(picked + 1)} of {frames.length}</span>
            </div>
            <figcaption className="flex justify-between" style={{ width: layout.plateW || '100%', color: mutedInk }}>
              <Line lineRef={addLine} className="tabular-nums">
                Frame <span style={{ color: ACCENT }}>{pad2(picked + 1)}</span> / {pad2(frames.length)}
              </Line>
              <Line lineRef={addLine}>{sheet.caption}</Line>
            </figcaption>
          </figure>
        </div>
      </div>

      {/* Servicios destacados, abajo a la izquierda */}
      <div
        ref={servicesRef}
        className="absolute flex flex-col pointer-events-auto"
        style={{ left: columnLeft(1), width: columnsWidth(6), bottom: PAGE.pad, gap: '1em' }}
      >
        <Line lineRef={addLine} style={{ color: mutedInk }}>
          Services
        </Line>
        <ul className="m-0 list-none p-0" style={{ fontSize: SERVICES_TYPE, lineHeight: 0.98, letterSpacing: '-0.035em' }}>
          {services.map((service) => (
            <li key={service}>
              <Line lineRef={addLine}>{service}</Line>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
