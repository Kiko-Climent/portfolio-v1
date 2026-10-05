'use client';

import { useEffect, useLayoutEffect, useState, useRef, useCallback } from 'react';
import gsap from 'gsap';
import { projects } from '@/components/data/projects';
import { gridImages as images } from '@/components/data/grid';
import { getGridSources } from '@/components/grids/index5';
import { getMedia, mediaAspect, mediaSrc } from '@/lib/media';
import { LazyComponent, loadWaveImage } from '@/lib/lazyComponents';

/**
 * Grid de escritorio, variante 7 columnas (boceto "grid 7 col").
 * index5.js sigue siendo la versión anterior y no se toca.
 *
 * Misma cortina que index5. Lo que cambia es la retícula: siete
 * columnas, más aire, la foto pequeña y alineada a la izquierda
 * de su casilla, y el nombre de archivo debajo en un tipo mínimo.
 */
const COLUMNS = 7;

const LAYOUT = {
  columnGap: '0.45rem',
  // Alto del caption (tipo + margen) y aire entre filas. Con esto se calcula
  // el ancho para que las fotos más altas quepan en las 6 filas.
  captionBlock: 14,
  rowGap: 16,
  maxImageWidth: 68,
  captionSize: '7px',
};

const MAX_ASPECT = Math.max(...images.map((image) => mediaAspect(image.key)));

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

const GRID_ROWS = Math.ceil(images.length / COLUMNS);

const fileNameOf = (src) => src.split('/').pop();

export default function PortfolioGridSix({
  activeProject,
  clickedProject,
  isReturning = false,
  isVisible = true,
  onHover,
}) {
  const [hoveredImage, setHoveredImage] = useState(null);
  const [navbarHeight, setNavbarHeight] = useState(0);
  const [availableHeight, setAvailableHeight] = useState(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [layoutReady, setLayoutReady] = useState(false);
  const [phase, setPhase] = useState('covered');
  const [settled, setSettled] = useState(() => images.map(() => false));
  const imageRefs = useRef([]);
  const coveredRef = useRef(true);
  const hasRevealedRef = useRef(false);

  const [sources] = useState(() => (typeof window === 'undefined' ? [] : getGridSources()));

  useEffect(() => {
    const updateHeight = () => {
      const navbar = document.querySelector('[data-navbar]');
      if (!navbar) {
        return false;
      }

      const navbarHeightValue = navbar.offsetHeight;
      const topOffset = 16;
      const bottomOffset = 16;

      const height =
        window.innerHeight - navbarHeightValue - topOffset - bottomOffset;

      setAvailableHeight(height);
      setNavbarHeight(navbarHeightValue);
      setViewportWidth(window.innerWidth);
      return true;
    };

    let retryCount = 0;
    const maxRetries = 20;
    const retryInterval = 100;

    const tryUpdate = () => {
      const success = updateHeight();

      if (!success && retryCount < maxRetries) {
        retryCount++;
        setTimeout(tryUpdate, retryInterval);
      }
    };

    if (isVisible) {
      setTimeout(tryUpdate, 0);
    }

    window.addEventListener('resize', updateHeight);

    return () => window.removeEventListener('resize', updateHeight);
  }, [isVisible]);

  const gridMounted = availableHeight !== null;
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
  const isHidden = galleryOpen;
  const shouldShow = !isHidden;

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
      tl = gsap.timeline({
        onStart: () => setPhase('hiding'),
        onComplete: () => {
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

    return () => tl.kill();
  }, [shouldShow, isVisible, layoutReady, settle]);

  const getHoveredImageConfig = () => {
    if (!hoveredImage) return null;
    const project = projects[hoveredImage.project];
    if (!project || !project.hover || !project.hover.images) return null;

    const imageConfig = project.hover.images.find(img => img.id === hoveredImage.id);
    return imageConfig ? { ...imageConfig, project } : null;
  };

  const getImageDimensions = (config) => {
    if (!config || !viewportWidth || !availableHeight) return { width: 0, height: 0 };

    const containerWidth = viewportWidth * 0.5;
    const heightScale = Math.min(1, availableHeight / 900);
    const widthPercent = parseFloat(config.width) / 100;
    const imageWidth = containerWidth * widthPercent * heightScale;

    return {
      width: imageWidth,
      height: 'auto'
    };
  };

  const hoveredImageConfig = getHoveredImageConfig();
  const imageDimensions = hoveredImageConfig ? getImageDimensions(hoveredImageConfig) : null;

  if (availableHeight === null) {
    return (
      <div className="fixed inset-0 flex items-center justify-center text-white">
      </div>
    );
  }

  const waveSrc = hoveredImageConfig && imageDimensions ? mediaSrc(hoveredImage.key, 'md') : null;
  const waveWidth = imageDimensions?.width || 0;
  const waveHeight = hoveredImageConfig ? waveWidth * mediaAspect(hoveredImage.key) : 0;

  const waveImagePosition = {
    position: 'fixed',
    top: `${navbarHeight + 16}px`,
    right: '1rem',
    transform: 'none'
  };

  const finalOpacity = isVisible ? 1 : 0;

  const imageWidth = Math.min(
    LAYOUT.maxImageWidth,
    (availableHeight - LAYOUT.captionBlock * GRID_ROWS - LAYOUT.rowGap * (GRID_ROWS - 1)) /
      GRID_ROWS /
      MAX_ASPECT
  );

  return (
    <>
      <div
        className="absolute left-4 right-4 box-border transition-all duration-700 ease-in-out"
        style={{
          top: `${navbarHeight + 16}px`,
          height: `${availableHeight}px`,
          opacity: finalOpacity,
          pointerEvents: (galleryOpen || !isVisible) ? 'none' : 'auto',
        }}
      >
        <div
          className="h-full content-start"
          style={{
            width: 'calc(50% - 1rem)',
            display: 'grid',
            gridTemplateColumns: `repeat(${COLUMNS}, minmax(0, 1fr))`,
            columnGap: LAYOUT.columnGap,
            rowGap: `${LAYOUT.rowGap}px`,
          }}
        >
          {images.map((image, index) => {
            const isProjectActive = activeProject === image.project ||
                                    (hoveredImage && hoveredImage.project === image.project);
            const opacity = isProjectActive ? 1 : 0.6;
            const blur = isProjectActive ? 0 : '4px';

            const isShown = phase === 'shown';
            const isSettled = isShown || phase === 'hiding' || settled[index];
            const isInteractive = isShown || (phase === 'revealing' && settled[index]);
            const showCaption = isSettled && phase !== 'hiding' && phase !== 'covered';
            const media = getMedia(image.key);
            const fileName = fileNameOf(image.src);

            return (
              <div
                key={index}
                className={`
                  flex
                  w-full
                  flex-col
                  items-start
                  ${isShown ? 'transition-all duration-300' : ''}
                `}
                style={{
                  opacity: isSettled ? opacity : 1,
                  pointerEvents: isInteractive ? undefined : 'none',
                  transition: phase === 'covered'
                    ? 'none'
                    : isShown
                      ? 'opacity 300ms ease-out'
                      : `opacity ${REVEAL.settleDuration}s ease-out`,
                }}
                onMouseEnter={() => {
                  setHoveredImage(image);
                  onHover?.(image.project);
                }}
                onMouseLeave={() => {
                  setHoveredImage(null);
                  onHover?.(null);
                }}
              >
                <img
                  ref={(el) => {
                    imageRefs.current[index] = el;
                  }}
                  src={sources[index]}
                  width={media?.w}
                  height={media?.h}
                  decoding="async"
                  alt={fileName}
                  className="block h-auto max-w-full"
                  style={{
                    width: `${imageWidth}px`,
                    filter: `blur(${isSettled ? blur : 0})`,
                    transition: phase === 'covered'
                      ? 'none'
                      : isShown
                        ? 'filter 300ms ease-out'
                        : `filter ${REVEAL.settleDuration}s ease-out`,
                  }}
                />
                <span
                  className="mt-1 block max-w-full leading-none text-black"
                  style={{
                    fontSize: LAYOUT.captionSize,
                    letterSpacing: '0.01em',
                    opacity: showCaption ? 1 : 0,
                    transition: phase === 'covered' ? 'none' : 'opacity 0.35s ease-out',
                  }}
                >
                  {fileName}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {isVisible && (
        <LazyComponent
          loader={loadWaveImage}
          src={waveSrc}
          width={waveWidth}
          height={waveHeight}
          className="will-change-transform z-40"
          style={{
            ...waveImagePosition,
            maxHeight: `${availableHeight * 0.8}px`,
          }}
        />
      )}
    </>
  );
}
