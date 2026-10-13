'use client';

import { gridExit } from '@/lib/aboutHandoff';
import { useEffect, useLayoutEffect, useState, useRef, useCallback } from 'react';
import gsap from 'gsap';
import {
  GRID_COLUMNS,
  PROJECT_NAME,
  gridImages as images,
  pad2,
} from '@/components/data/grid';
import { getGridSources } from '@/components/grids/index5';
import { getMedia, mediaAspect, mediaSrc, preloadTextureSources } from '@/lib/media';
import { PAGE, columnLeft, columnsWidth, columnsWidthPx } from '@/lib/pageGrid';
import { useDarkMode } from '@/contexts/DarkModeContext';
import { LazyComponent, loadWaveImage } from '@/lib/lazyComponents';

/**
 * Home de escritorio. Misma cortina que index5/index6.
 *
 * La página es una rejilla de 12 columnas (src/lib/pageGrid.js):
 * las miniaturas son 6, pegadas abajo de su celda para que los
 * nombres de una fila compartan línea. La foto grande no se centra:
 * su borde izquierdo es el de la columna 7 (la de "Creative Frontend
 * Developer" y la lista) y su borde de arriba, el de la primera fila.
 * Debajo, la línea de datos. El cambio de foto es instantáneo.
 * La foto de detalle es el canvas WebGL de WaveImage: la misma
 * ondulación de antes, anclada a esta columna.
 */
const COLUMNS = GRID_COLUMNS;
const GRID_ROWS = Math.ceil(images.length / COLUMNS);

const REVEAL = {
  delay: 0.2,
  returnDelay: 0.4,
  duration: 1.1,
  ease: 'expo.out',
  scaleFrom: 1.12,
  wave: {
    each: 0.15,
    from: 'start',
  },
  settleAt: 0.5,
  settleDuration: 0.8,
  out: {
    duration: 0.6,
    ease: 'power3.in',
    scaleTo: 1.06,
    each: 0.06,
  },
};

const HIDDEN = { clipPath: 'inset(100% 0% 0% 0%)', scale: REVEAL.scaleFrom, transformOrigin: '50% 100%' };
const SHOWN = { clipPath: 'inset(0% 0% 0% 0%)', scale: 1 };
const COVERED = { clipPath: 'inset(0% 0% 100% 0%)', scale: REVEAL.out.scaleTo, transformOrigin: '50% 0%' };

const previewSrc = (image) => mediaSrc(image.key, 'lg');

const fitWave = (aspect, maxW, maxH) => {
  if (!maxW || !maxH || !aspect) return { width: 0, height: 0 };
  let width = maxW;
  let height = width * aspect;
  if (height > maxH) {
    height = maxH;
    width = height / aspect;
  }
  return {
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
  };
};

// La foto de About usa la misma proporción que el resto, a una escala menor:
// en la miniatura, respecto a su celda; en el detalle, el 40% de la columna
// (el ancho que ya tenía en el hover de projects.js).
const ABOUT_THUMB_SCALE = '64%';
const ABOUT_DETAIL_SCALE = 0.4;

export default function PortfolioGridSeven({
  activeProject,
  clickedProject,
  isReturning = false,
  isVisible = true,
  onHover,
  speedKey = null,
}) {
  const { isDarkMode } = useDarkMode();
  const [cursor, setCursor] = useState(null);
  const [frame, setFrame] = useState(null);
  const [metaHeight, setMetaHeight] = useState(29);
  const [layoutReady, setLayoutReady] = useState(false);
  const [phase, setPhase] = useState('covered');
  const [settled, setSettled] = useState(() => images.map(() => false));
  const imageRefs = useRef([]);
  const metaRef = useRef(null);
  const coveredRef = useRef(true);
  const hasRevealedRef = useRef(false);

  const [sources] = useState(() => (typeof window === 'undefined' ? [] : getGridSources()));

  const previewImage = cursor;
  const litProject = activeProject;

  useEffect(() => {
    if (!litProject) return undefined;
    preloadTextureSources(
      images.filter((image) => image.project === litProject).map(previewSrc)
    );
    return undefined;
  }, [litProject]);

  useEffect(() => {
    const measure = () => {
      const navbar = document.querySelector('[data-navbar]');
      const footer = document.querySelector('[data-footer]');
      if (!navbar || !footer) return false;

      const nav = navbar.getBoundingClientRect();
      const foot = footer.getBoundingClientRect();
      const top = nav.bottom + PAGE.rowGap;
      const height = foot.bottom - top;
      if (height < 80 || foot.height < 8) return false;

      const columnWidth = columnsWidthPx(6, window.innerWidth);
      setFrame((prev) => {
        if (
          prev
          && prev.top === top
          && prev.height === height
          && prev.footerHeight === foot.height
          && prev.columnWidth === columnWidth
        ) return prev;
        return { top, height, footerHeight: foot.height, columnWidth };
      });
      return true;
    };

    let retryCount = 0;
    let retryTimer = 0;
    const maxRetries = 20;

    const tryMeasure = () => {
      if (measure()) return;
      if (retryCount >= maxRetries) return;
      retryCount += 1;
      retryTimer = window.setTimeout(tryMeasure, 100);
    };

    if (isVisible) tryMeasure();

    const observer = new ResizeObserver(() => measure());
    const watch = () => {
      const navbar = document.querySelector('[data-navbar]');
      const footer = document.querySelector('[data-footer]');
      if (navbar) observer.observe(navbar);
      if (footer) observer.observe(footer);
    };
    watch();
    window.addEventListener('resize', measure);

    return () => {
      window.clearTimeout(retryTimer);
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [isVisible]);

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
  }, [frame, previewImage]);

  const gridMounted = frame !== null;
  useLayoutEffect(() => {
    if (!gridMounted) return;
    gsap.set(imageRefs.current.filter(Boolean), HIDDEN);
  }, [gridMounted]);

  useEffect(() => {
    if (!gridMounted || layoutReady) return undefined;

    let cancelled = false;
    const decoded = Promise.all(
      imageRefs.current
        .filter(Boolean)
        .map((img) => (img.decode ? img.decode().catch(() => {}) : Promise.resolve()))
    );
    const timeout = new Promise((resolve) => setTimeout(resolve, 4000));

    Promise.race([decoded, timeout]).then(() => {
      if (!cancelled) requestAnimationFrame(() => !cancelled && setLayoutReady(true));
    });

    return () => {
      cancelled = true;
    };
  }, [gridMounted, layoutReady]);

  const settle = useCallback((index) => {
    setSettled((prev) => {
      if (prev[index]) return prev;
      const next = prev.slice();
      next[index] = true;
      return next;
    });
  }, []);

  const galleryOpen = clickedProject !== null && !isReturning;
  const shouldShow = !galleryOpen;

  useEffect(() => {
    if (!isVisible || !layoutReady) return undefined;

    const imgs = imageRefs.current;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const grid = [GRID_ROWS, COLUMNS];
    let tl;

    if (shouldShow) {
      const delayOf = gsap.utils.distribute({ each: REVEAL.wave.each, from: REVEAL.wave.from, grid });
      tl = gsap.timeline({
        delay: reduceMotion ? 0 : hasRevealedRef.current ? REVEAL.returnDelay : REVEAL.delay,
        onStart: () => {
          coveredRef.current = false;
          hasRevealedRef.current = true;
          setPhase('revealing');
        },
        onComplete: () => setPhase('shown'),
      });
      if (coveredRef.current) tl.set(imgs.filter(Boolean), HIDDEN, 0);

      imgs.forEach((img, index) => {
        if (!img) return;
        if (reduceMotion) {
          tl.set(img, SHOWN, 0);
          tl.call(settle, [index], 0);
          return;
        }
        const at = delayOf(index, img, imgs);
        tl.to(img, { ...SHOWN, duration: REVEAL.duration, ease: REVEAL.ease }, at);
        tl.call(settle, [index], at + REVEAL.duration * REVEAL.settleAt);
      });
    } else {
      const delayOf = gsap.utils.distribute({ each: REVEAL.out.each, from: REVEAL.wave.from, grid });
      // El About espera a que el grid acabe de taparse (src/lib/aboutHandoff.js).
      gridExit.start();
      tl = gsap.timeline({
        onStart: () => setPhase('hiding'),
        onComplete: () => {
          gridExit.end();
          coveredRef.current = true;
          setSettled(images.map(() => false));
          setPhase('covered');
        },
      });

      imgs.forEach((img, index) => {
        if (!img) return;
        if (reduceMotion) {
          tl.set(img, COVERED, 0);
          return;
        }
        tl.to(
          img,
          { ...COVERED, duration: REVEAL.out.duration, ease: REVEAL.out.ease },
          delayOf(index, img, imgs)
        );
      });
    }

    return () => {
      tl.kill();
      gridExit.end();
    };
  }, [shouldShow, isVisible, layoutReady, settle]);

  if (frame === null) {
    return <div className="fixed inset-0" />;
  }

  const ink = isDarkMode ? '#ffffff' : '#000000';
  const contentHeight = Math.max(0, frame.height - frame.footerHeight - PAGE.rowGap);
  const imageMaxHeight = Math.max(32, contentHeight - metaHeight - 8);
  const showPreview = isVisible && !galleryOpen && previewImage !== null;
  const showWave = isVisible && !galleryOpen;
  const waveFit = showPreview
    ? fitWave(
      mediaAspect(previewImage.key),
      frame.columnWidth * (previewImage.project === 'about' ? ABOUT_DETAIL_SCALE : 1),
      imageMaxHeight
    )
    : { width: 0, height: 0 };
  const waveSrc = waveFit.width > 0 ? previewSrc(previewImage) : null;

  return (
    <>
      <div
        className="absolute box-border overflow-hidden"
        style={{
          top: frame.top,
          left: columnLeft(1),
          width: columnsWidth(6),
          height: frame.height,
          opacity: isVisible ? 1 : 0,
          pointerEvents: galleryOpen || !isVisible ? 'none' : 'auto',
        }}
        onMouseLeave={() => {
          setCursor(null);
          onHover?.(null);
        }}
      >
        <div
          className="h-full w-full"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${COLUMNS}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${GRID_ROWS}, minmax(0, 1fr))`,
            gap: PAGE.gap,
          }}
        >
          {images.map((image, index) => {
            // En reposo todo el grid va atenuado. Al hover de una miniatura,
            // las de su galería pasan a opacidad plena y el resto sigue atenuado.
            const isProjectActive = litProject === image.project;
            const opacity = isProjectActive ? 1 : PAGE.dim;
            const isShown = phase === 'shown';
            const isSettled = isShown || phase === 'hiding' || settled[index];
            const isInteractive = isShown || (phase === 'revealing' && settled[index]);
            const isCurrent = (previewImage?.key === image.key || speedKey === image.key) && phase !== 'hiding' && phase !== 'covered';
            const thumbMedia = getMedia(image.key);

            return (
              <div
                key={image.key}
                className="flex h-full min-h-0 min-w-0 flex-col justify-end"
                style={{
                  gap: 4,
                  color: ink,
                  opacity: isSettled ? opacity : 1,
                  pointerEvents: isInteractive ? undefined : 'none',
                  transition: phase === 'covered'
                    ? 'none'
                    : isShown
                      ? 'opacity 150ms linear'
                      : `opacity ${REVEAL.settleDuration}s ease-out`,
                }}
                onMouseEnter={() => {
                  setCursor(image);
                  onHover?.(image.project);
                }}
              >
                <div className="flex min-h-0 w-full flex-1 items-end overflow-hidden">
                  <img
                    ref={(el) => {
                      imageRefs.current[index] = el;
                    }}
                    src={sources[index]}
                    width={thumbMedia?.w}
                    height={thumbMedia?.h}
                    decoding="async"
                    draggable={false}
                    alt={image.fileName}
                    className="block object-contain object-left-bottom"
                    style={image.project === 'about'
                      ? { width: 'auto', height: 'auto', maxWidth: ABOUT_THUMB_SCALE, maxHeight: ABOUT_THUMB_SCALE }
                      : { width: 'auto', height: 'auto', maxWidth: '100%', maxHeight: '100%' }}
                  />
                </div>
                <span
                  className="flex max-w-full items-center overflow-hidden whitespace-nowrap leading-[12px]"
                  style={{
                    gap: 4,
                    fontSize: 10,
                    opacity: isSettled ? 1 : 0,
                    transition: phase === 'covered' ? 'none' : 'opacity 0.35s ease-out',
                  }}
                >
                  {isCurrent ? (
                    <i aria-hidden="true" className="block h-1.5 w-1.5 shrink-0 bg-current" />
                  ) : null}
                  {image.fileName}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {showWave ? (
        <div
          className="absolute"
          style={{
            top: frame.top,
            left: columnLeft(7),
            width: columnsWidth(6),
            height: contentHeight,
            zIndex: 30,
            color: ink,
            pointerEvents: 'none',
          }}
        >
          <LazyComponent
            loader={loadWaveImage}
            src={waveSrc}
            width={waveFit.width}
            height={waveFit.height}
            className="will-change-transform"
            style={{ top: 0, left: 0 }}
          />
          {showPreview ? (
            <div
              ref={metaRef}
              className="flex w-full items-baseline justify-between gap-4 text-[length:var(--kc-type)]"
              style={{ lineHeight: 1, marginTop: waveFit.height + 8 }}
            >
              <span
                className="min-w-0 truncate"
                style={{ paddingBottom: '0.32em' }}
              >
                {PROJECT_NAME[previewImage.project]} — {previewImage.fileName}
              </span>
              <span className="shrink-0 tabular-nums" style={{ paddingBottom: '0.32em' }}>
                {pad2(previewImage.indexInProject)} / {pad2(previewImage.totalInProject)}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
