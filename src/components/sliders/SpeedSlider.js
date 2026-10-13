'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { useDarkMode } from '@/contexts/DarkModeContext';
import { gridImages, PROJECT_NAME, pad2 } from '@/components/data/grid';
import { projects } from '@/components/data/projects';
import { mediaAspect, mediaKey, mediaSrc } from '@/lib/media';
import { PAGE, columnLeft, columnsWidth, columnsWidthPx } from '@/lib/pageGrid';
import { CURTAIN } from '@/components/SliderThree/index5';
import { INFO_ANIM, Line } from '@/components/about/useLineReveal';

/**
 * ───────────────────────────────────────────────────────────────
 *  Speed-slider — hover sobre un título del footer.
 *  "Caos controlado": parece tirado a lo loco, pero cada regla es suiza.
 *   - x siempre cae en una de las 6 líneas de columna (cols 7–12)
 *   - ancho = columnas enteras (desktop 2–4, mobile 1–2)
 *   - y libre, ajustada a pasos de 8px
 *   - semilla fija por imagen → la misma imagen cae siempre en el mismo sitio
 *   - las 3 últimas se quedan apiladas, cortes secos, sin fundidos
 * ───────────────────────────────────────────────────────────────
 */
const SPEED = {
  interval: 150,     // ms por imagen (120–180)
  depth: 3,          // imágenes apiladas a la vez
  baseline: 8,       // paso vertical en px
  captionSpace: 16,  // hueco bajo cada imagen para el nombre de archivo
  antiRepeat: 64,    // si cae en la misma columna y a menos de esto en vertical, salta 2 columnas
};

// Pesos: el valor repetido sale el doble de veces.
const SPANS = {
  desktop: [2, 3, 3, 4],
  mobile: [1, 1, 2],
};

const COLS = 6;
const PROJECT_ORDER = Object.keys(PROJECT_NAME);

const speedSrc = (image) => mediaSrc(image.key, 'md');
const imagesOf = (projectId) => gridImages.filter((image) => image.project === projectId);

/** Hash determinista 0–1: misma entrada → misma salida. */
function rnd(n) {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function placeRaw(projectIndex, imageIndex, ratio, stage) {
  const colW = (stage.width - (COLS - 1) * PAGE.gap) / COLS;
  const seed = projectIndex * 97 + imageIndex * 13 + 1;
  const spans = ratio >= 1 ? SPANS.desktop : SPANS.mobile;
  const span = Math.min(COLS, spans[Math.floor(rnd(seed) * spans.length)]);

  let w = colW * span + PAGE.gap * (span - 1);
  let h = w / ratio;
  if (h > stage.height) {
    h = stage.height;
    w = h * ratio;
  }

  const col = Math.floor(rnd(seed + 7) * (COLS - span + 1));
  const y = Math.floor((rnd(seed + 19) * Math.max(0, stage.height - h)) / SPEED.baseline) * SPEED.baseline;
  return { x: col * (colW + PAGE.gap), y, w, h, col, span };
}

function place(projectIndex, imageIndex, ratio, stage, prev) {
  const p = placeRaw(projectIndex, imageIndex, ratio, stage);
  if (!prev) return p;
  const q = placeRaw(projectIndex, prev.imageIndex, prev.ratio, stage);
  if (p.col !== q.col || Math.abs(p.y - q.y) >= SPEED.antiRepeat) return p;

  const colW = (stage.width - (COLS - 1) * PAGE.gap) / COLS;
  const maxCol = COLS - p.span;
  const col = maxCol === 0 ? 0 : (p.col + 2) % (maxCol + 1);
  return { ...p, col, x: col * (colW + PAGE.gap) };
}

const ratioOf = (image) => 1 / (mediaAspect(image.key) || 1);

/** Precarga en reposo las "md" de todas las galerías: el primer hover nunca deja huecos. */
let warmed = false;
export function warmSpeedImages() {
  if (warmed || typeof window === 'undefined') return;
  warmed = true;
  const run = () => {
    gridImages.forEach((image) => {
      const el = new Image();
      el.decoding = 'async';
      el.src = speedSrc(image);
    });
  };
  if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 4000 });
  else window.setTimeout(run, 1500);
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return reduced;
}

/**
 * About solo tiene una foto: en vez del bucle de imágenes, la foto hace una
 * tira de prueba de cuarto oscuro en bucle. Va por pasos de exposición con el
 * ritmo y los cortes secos del speed-slider: cuadrado negro → foto → cuadrado
 * blanco (se funde con el fondo) → foto → negro…, quedándose un poco en la foto
 * real. La foto ocupa 2 columnas (lo que una captura vertical de un proyecto)
 * y cae con la misma regla que el resto de imágenes (x en una línea de
 * columna, y en pasos de 8 px): el protagonismo es de los trabajos.
 * En modo oscuro es el cuadrado negro el que desaparece en el fondo.
 */
// Pasos de exposición (stops); 'black' / 'white' son los cuadrados de los extremos.
const ABOUT_STOPS = ['black', -4, -3, -2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2, 3, 4, 'white'];
const ABOUT_HOLD = 3;       // pasos que se queda en la foto real (0 EV) cada vez que pasa
const ABOUT_PHOTO_SPAN = 2; // columnas de la foto

// Ida y vuelta por los pasos, con la pausa en el 0.
const ABOUT_SEQUENCE = (() => {
  const seq = [];
  [...ABOUT_STOPS, ...ABOUT_STOPS.slice(1, -1).reverse()].forEach((stop) => {
    seq.push(stop);
    if (stop === 0) for (let h = 1; h < ABOUT_HOLD; h += 1) seq.push(0);
  });
  return seq;
})();

/** Exposición con filtros CSS: oscurecer = multiplicar; aclarar = lo mismo sobre el negativo. */
function exposureFilter(stop) {
  if (stop === 'black') return 'brightness(0)';
  if (stop === 'white') return 'invert(1) brightness(0) invert(1)';
  if (stop < 0) return `brightness(${(2 ** stop).toFixed(4)})`;
  if (stop > 0) return `invert(1) brightness(${(2 ** -stop).toFixed(4)}) invert(1)`;
  return 'none';
}

function exposureLabel(stop) {
  if (stop === 'black') return '−∞ EV';
  if (stop === 'white') return '+∞ EV';
  if (stop === 0) return '0 EV';
  const a = Math.abs(stop);
  const whole = Math.floor(a);
  const value = `${whole || ''}${a - whole >= 0.5 ? '½' : ''}`;
  return `${stop < 0 ? '−' : '+'}${value} EV`;
}

function AboutExposurePreview({ onImageChange }) {
  const { isDarkMode } = useDarkMode();
  const reduced = usePrefersReducedMotion();
  const [frame, setFrame] = useState(null);
  const [tick, setTick] = useState(0);

  const project = projects.about;
  const image = imagesOf('about')[0];
  const src = mediaSrc(mediaKey(project, 1), 'md');

  /* Misma caja que el speed-slider de los proyectos (cols 7–12). */
  useEffect(() => {
    const measure = () => {
      const navbar = document.querySelector('[data-navbar]');
      const footer = document.querySelector('[data-footer]');
      if (!navbar || !footer) return;
      const nav = navbar.getBoundingClientRect();
      const foot = footer.getBoundingClientRect();
      const top = nav.bottom + PAGE.rowGap;
      const contentHeight = Math.max(0, foot.bottom - top - foot.height - PAGE.rowGap);
      setFrame({ top, contentHeight, width: columnsWidthPx(6, window.innerWidth) });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  useEffect(() => {
    if (reduced) return undefined;
    const id = window.setInterval(() => setTick((t) => t + 1), SPEED.interval);
    return () => window.clearInterval(id);
  }, [reduced]);

  useEffect(() => {
    onImageChange?.(image ? image.key : null);
    return () => onImageChange?.(null);
  }, [image, onImageChange]);

  if (!frame || !image) return null;

  // Con "reducir movimiento", la foto quieta en 0 EV.
  const stop = reduced ? 0 : ABOUT_SEQUENCE[tick % ABOUT_SEQUENCE.length];
  const ink = isDarkMode ? '#ffffff' : '#000000';
  const colW = (frame.width - (COLS - 1) * PAGE.gap) / COLS;
  const colStep = colW + PAGE.gap;
  const metaH = 29;
  const stageH = Math.max(40, frame.contentHeight - metaH - 8 - SPEED.captionSpace);

  // Sin los puntitos del carrusel de Instagram de abajo (gridCut.crop, como en la página).
  const crop = project.gridCut?.crop || [0, 0, 1, 1];
  const photoW = colW * ABOUT_PHOTO_SPAN + PAGE.gap * (ABOUT_PHOTO_SPAN - 1);
  const photoH = photoW * mediaAspect(image.key) * (crop[3] - crop[1]);
  const pSeed = 5 * 97 + 99 * 13 + 1;
  const photoCol = Math.floor(rnd(pSeed + 7) * (COLS - ABOUT_PHOTO_SPAN + 1));
  const photoY = Math.floor((rnd(pSeed + 19) * Math.max(0, stageH - photoH)) / SPEED.baseline) * SPEED.baseline;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute"
      style={{ top: frame.top, left: columnLeft(7), width: columnsWidth(6), height: frame.contentHeight, zIndex: 30, color: ink }}
    >
      <figure
        className="absolute left-0 top-0 m-0"
        style={{ transform: `translate3d(${Math.round(photoCol * colStep)}px, ${photoY}px, 0)`, width: Math.round(photoW) }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          width={Math.round(photoW)}
          height={Math.round(photoH)}
          decoding="async"
          draggable={false}
          className="block w-full object-cover object-top"
          style={{ height: Math.round(photoH), filter: exposureFilter(stop) }}
        />
        <figcaption className="whitespace-nowrap" style={{ marginTop: 3, fontSize: 10, lineHeight: '12px' }}>
          {image.fileName}
        </figcaption>
      </figure>

      {/* Misma línea que el speed-slider de los proyectos; a la derecha, la exposición. */}
      <div
        className="absolute left-0 flex w-full items-baseline justify-between gap-4 text-[length:var(--kc-type)]"
        style={{ lineHeight: 1, top: frame.contentHeight - metaH }}
      >
        <span className="min-w-0 truncate" style={{ paddingBottom: '0.32em' }}>
          {PROJECT_NAME.about} — {image.fileName}
        </span>
        <span className="shrink-0 tabular-nums" style={{ paddingBottom: '0.32em' }}>
          {exposureLabel(stop)}
        </span>
      </div>
    </div>
  );
}

/**
 * About en la home (versión activa): ficha sobria. La foto a 2 columnas,
 * anclada arriba en la col 7 (la misma que "Creative Frontend Developer" del
 * header), y los servicios al lado en la col 9, al cuerpo del footer: los 44 px
 * se reservan para la página About. Entra con la cortina de las galerías y el
 * reveal por líneas de los textos. El bucle de exposición sigue abajo
 * (ABOUT_PREVIEW = 'exposure').
 */
const ABOUT_PREVIEW = 'card'; // 'card' | 'exposure'
const ABOUT_CARD = {
  photoSpan: 2,   // columnas de la foto
  textColumn: 2,  // columna de los servicios dentro de la caja (0 = col 7 → 2 = col 9)
};

function AboutCardPreview({ onImageChange }) {
  const { isDarkMode } = useDarkMode();
  const reduced = usePrefersReducedMotion();
  const [frame, setFrame] = useState(null);
  const sheetRef = useRef(null);
  const imgRef = useRef(null);
  const linesRef = useRef([]);

  const project = projects.about;
  const image = imagesOf('about')[0];
  const src = mediaSrc(mediaKey(project, 1), 'md');
  const services = project.services || [];

  /* Misma caja que el speed-slider de los proyectos (cols 7–12). */
  useEffect(() => {
    const measure = () => {
      const navbar = document.querySelector('[data-navbar]');
      const footer = document.querySelector('[data-footer]');
      if (!navbar || !footer) return;
      const nav = navbar.getBoundingClientRect();
      const foot = footer.getBoundingClientRect();
      const top = nav.bottom + PAGE.rowGap;
      const contentHeight = Math.max(0, foot.bottom - top - foot.height - PAGE.rowGap);
      setFrame({ top, contentHeight, width: columnsWidthPx(6, window.innerWidth) });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  useEffect(() => {
    onImageChange?.(image ? image.key : null);
    return () => onImageChange?.(null);
  }, [image, onImageChange]);

  const ready = frame !== null;

  /* Entrada: cortina + asiento de la foto, y las líneas subiendo de una en una. */
  useLayoutEffect(() => {
    if (!ready) return undefined;
    const sheet = sheetRef.current;
    const img = imgRef.current;
    const lines = linesRef.current.filter(Boolean);
    if (!sheet || !img) return undefined;
    const ctx = gsap.context(() => {
      if (reduced) {
        gsap.set(sheet, { clipPath: 'inset(0% 0% 0% 0%)' });
        gsap.set(img, { scale: 1 });
        gsap.set(lines, { yPercent: 0 });
        return;
      }
      gsap.fromTo(sheet, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: CURTAIN.duration, ease: CURTAIN.ease });
      gsap.fromTo(img, { scale: CURTAIN.zoomFrom }, { scale: 1, duration: CURTAIN.duration, ease: CURTAIN.ease });
      gsap.fromTo(
        lines,
        { yPercent: INFO_ANIM.fromYPercent },
        { yPercent: 0, duration: INFO_ANIM.duration, ease: INFO_ANIM.ease, stagger: INFO_ANIM.stagger, delay: INFO_ANIM.delay },
      );
    });
    return () => ctx.revert();
  }, [ready, reduced]);

  if (!frame || !image) return null;

  const ink = isDarkMode ? '#ffffff' : '#000000';
  const colW = (frame.width - (COLS - 1) * PAGE.gap) / COLS;
  const colStep = colW + PAGE.gap;
  const metaH = 29;

  // Sin los puntitos del carrusel de Instagram de abajo (gridCut.crop, como en la página).
  const crop = project.gridCut?.crop || [0, 0, 1, 1];
  const photoW = colW * ABOUT_CARD.photoSpan + PAGE.gap * (ABOUT_CARD.photoSpan - 1);
  const photoH = photoW * mediaAspect(image.key) * (crop[3] - crop[1]);
  const lineRef = (i) => (el) => {
    linesRef.current[i] = el;
  };

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute"
      style={{ top: frame.top, left: columnLeft(7), width: columnsWidth(6), height: frame.contentHeight, zIndex: 30, color: ink }}
    >
      <figure className="absolute left-0 top-0 m-0" style={{ width: Math.round(photoW) }}>
        <div ref={sheetRef} className="overflow-hidden" style={{ height: Math.round(photoH), clipPath: 'inset(100% 0% 0% 0%)' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={src}
            alt=""
            width={Math.round(photoW)}
            height={Math.round(photoH)}
            decoding="async"
            draggable={false}
            className="block h-full w-full object-cover object-top"
            style={{ transformOrigin: '50% 100%' }}
          />
        </div>
        <figcaption className="whitespace-nowrap" style={{ marginTop: 3, fontSize: 10, lineHeight: '12px' }}>
          <Line lineRef={lineRef(services.length)}>{image.fileName}</Line>
        </figcaption>
      </figure>

      <ul
        className="absolute top-0 m-0 list-none p-0 text-[length:var(--kc-type)] leading-[1]"
        style={{ left: Math.round(ABOUT_CARD.textColumn * colStep) }}
      >
        {services.map((service, i) => (
          <li key={service}>
            <Line lineRef={lineRef(i)}>{service}</Line>
          </li>
        ))}
      </ul>

      {/* Misma línea que el speed-slider de los proyectos. */}
      <div
        className="absolute left-0 flex w-full items-baseline justify-between gap-4 text-[length:var(--kc-type)]"
        style={{ lineHeight: 1, top: frame.contentHeight - metaH }}
      >
        <span className="min-w-0 truncate" style={{ paddingBottom: '0.32em' }}>
          {PROJECT_NAME.about} — {image.fileName}
        </span>
        <span className="shrink-0 tabular-nums" style={{ paddingBottom: '0.32em' }}>
          {pad2(1)} / {pad2(1)}
        </span>
      </div>
    </div>
  );
}

/**
 * Montar con key={projectId}: al cambiar de proyecto se reinicia desde cero.
 * onImageChange(key | null) → para mover el cuadradito de la miniatura en la grid.
 */
export default function SpeedSlider({ projectId, onImageChange }) {
  if (projectId === 'about') {
    const AboutPreview = ABOUT_PREVIEW === 'exposure' ? AboutExposurePreview : AboutCardPreview;
    return <AboutPreview onImageChange={onImageChange} />;
  }
  return <ProjectSpeedSlider projectId={projectId} onImageChange={onImageChange} />;
}

function ProjectSpeedSlider({ projectId, onImageChange }) {
  const { isDarkMode } = useDarkMode();
  const reduced = usePrefersReducedMotion();
  const [frame, setFrame] = useState(null);
  const [tick, setTick] = useState(0); // pasos desde el hover, nunca vuelve a 0
  const [metaHeight, setMetaHeight] = useState(29);
  const metaRef = useRef(null);

  const images = imagesOf(projectId);
  const n = images.length;
  const projectIndex = Math.max(0, PROJECT_ORDER.indexOf(projectId));

  /* ---------- Medida: la misma caja que la foto del hover en la grid ---------- */
  useEffect(() => {
    const measure = () => {
      const navbar = document.querySelector('[data-navbar]');
      const footer = document.querySelector('[data-footer]');
      if (!navbar || !footer) return;
      const nav = navbar.getBoundingClientRect();
      const foot = footer.getBoundingClientRect();
      const top = nav.bottom + PAGE.rowGap;
      const height = foot.bottom - top;
      const contentHeight = Math.max(0, height - foot.height - PAGE.rowGap);
      const width = columnsWidthPx(6, window.innerWidth);
      setFrame((prev) => (
        prev && prev.top === top && prev.contentHeight === contentHeight && prev.width === width
          ? prev
          : { top, contentHeight, width }
      ));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  useLayoutEffect(() => {
    const meta = metaRef.current;
    if (!meta) return undefined;
    const update = () => {
      const next = meta.offsetHeight;
      if (next) setMetaHeight((prev) => (prev === next ? prev : next));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(meta);
    return () => observer.disconnect();
  }, [frame]);

  /* ---------- Bucle: la primera imagen sale ya, sin esperar al intervalo ---------- */
  useEffect(() => {
    if (reduced || n < 2) return undefined;
    const id = window.setInterval(() => setTick((t) => t + 1), SPEED.interval);
    return () => window.clearInterval(id);
  }, [reduced, n]);

  const current = n ? images[tick % n] : null;

  useEffect(() => {
    onImageChange?.(current ? current.key : null);
  }, [current, onImageChange]);

  useEffect(() => () => onImageChange?.(null), [onImageChange]);

  if (!frame || !n) return null;

  const ink = isDarkMode ? '#ffffff' : '#000000';
  const stage = {
    width: frame.width,
    height: Math.max(40, frame.contentHeight - metaHeight - 8 - SPEED.captionSpace),
  };

  // Las últimas `depth` imágenes, la más vieja primero (la nueva queda encima).
  // La pila no se reinicia cuando el bucle vuelve a la primera.
  const stack = [];
  for (let d = Math.min(SPEED.depth, n) - 1; d >= 0; d -= 1) {
    if (tick - d < 0) continue;
    const step = tick - d;
    const imageIndex = step % n;
    const prevIndex = (imageIndex - 1 + n) % n;
    stack.push({
      step,
      image: images[imageIndex],
      p: place(
        projectIndex,
        imageIndex,
        ratioOf(images[imageIndex]),
        stage,
        n > 1 ? { imageIndex: prevIndex, ratio: ratioOf(images[prevIndex]) } : undefined
      ),
    });
  }

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute"
      style={{
        top: frame.top,
        left: columnLeft(7),
        width: columnsWidth(6),
        height: frame.contentHeight,
        zIndex: 30,
        color: ink,
      }}
    >
      {stack.map(({ step, image, p }, i) => (
        <figure
          key={`${projectId}-${step}`}
          className="absolute left-0 top-0 m-0"
          style={{
            transform: `translate3d(${Math.round(p.x)}px, ${p.y}px, 0)`,
            width: Math.round(p.w),
            zIndex: 10 + i,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={speedSrc(image)}
            alt=""
            width={Math.round(p.w)}
            height={Math.round(p.h)}
            decoding="async"
            draggable={false}
            className="block h-auto w-full"
          />
          <figcaption
            className="whitespace-nowrap"
            style={{ marginTop: 3, fontSize: 10, lineHeight: '12px' }}
          >
            {image.fileName}
          </figcaption>
        </figure>
      ))}

      {current ? (
        <div
          ref={metaRef}
          className="absolute left-0 flex w-full items-baseline justify-between gap-4 text-[length:var(--kc-type)]"
          style={{ lineHeight: 1, top: frame.contentHeight - metaHeight }}
        >
          <span className="min-w-0 truncate" style={{ paddingBottom: '0.32em' }}>
            {PROJECT_NAME[projectId]} — {current.fileName}
          </span>
          <span className="shrink-0 tabular-nums" style={{ paddingBottom: '0.32em' }}>
            {pad2(current.indexInProject)} / {pad2(current.totalInProject)}
          </span>
        </div>
      ) : null}
    </div>
  );
}
