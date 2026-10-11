'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useDarkMode } from '@/contexts/DarkModeContext';
import { gridImages, PROJECT_NAME, pad2 } from '@/components/data/grid';
import { mediaAspect, mediaSrc } from '@/lib/media';
import { PAGE, columnLeft, columnsWidth, columnsWidthPx } from '@/lib/pageGrid';

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
 * Montar con key={projectId}: al cambiar de proyecto se reinicia desde cero.
 * onImageChange(key | null) → para mover el cuadradito de la miniatura en la grid.
 */
export default function SpeedSlider({ projectId, onImageChange }) {
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
