'use client';

import { useEffect, useLayoutEffect, useState, useRef, useCallback } from 'react';
import gsap from 'gsap';
import { projects } from '@/components/data/projects';
import { GRID_COLUMNS, gridImages as images } from '@/components/data/grid';
import { getOptimizedImageUrl } from '@/lib/optimizedImage';
import { getMedia, mediaAspect, mediaSrc } from '@/lib/media';
import { LazyComponent, loadWaveImage } from '@/lib/lazyComponents';

/**
 * ───────────────────────────────────────────────────────────────
 *  Reveal editorial del grid — mismo lenguaje que los textos:
 *  cada imagen se descubre dentro de su propio marco con una
 *  cortina vertical de abajo arriba (clip-path) y un leve
 *  asentamiento de escala. Sin viajes por la pantalla: solo
 *  cortina + stagger por la retícula + easing.
 *  Al asentarse, cada imagen coge el blur/opacidad de reposo.
 *
 *  Al entrar en una galería la cortina sigue subiendo y tapa cada
 *  imagen hacia arriba (como los caracteres del menú al irse); al
 *  volver a home, el reveal se repite.
 * ───────────────────────────────────────────────────────────────
 */
const REVEAL = {
  delay: 0.2,            // tras el loader
  returnDelay: 0.4,      // al volver de una galería: deja salir antes su título y su texto
  duration: 1.1,
  ease: 'expo.out',      // mismo easing que el roll de letras del loader
  scaleFrom: 1.12,       // la imagen se asienta dentro de su marco mientras sube la cortina
  wave: {
    each: 0.15,          // separación de la ola por la retícula (s por celda de distancia)
    from: 'start',       // origen: 'start' (arriba izq.), 'center', 'end', 'edges', 'random'
  },
  settleAt: 0.5,         // fracción de la cortina en la que la imagen empieza a coger el blur
  settleDuration: 0.8,   // s del fundido al blur/opacidad de reposo
  out: {
    duration: 0.6,
    ease: 'power3.in',   // mismo easing que la salida del menú
    scaleTo: 1.06,
    each: 0.06,          // la ola de salida recorre la retícula más rápido que la de entrada
  },
};

const HIDDEN = { clipPath: 'inset(100% 0% 0% 0%)', scale: REVEAL.scaleFrom, transformOrigin: '50% 100%' };
const SHOWN = { clipPath: 'inset(0% 0% 0% 0%)', scale: 1 };
const COVERED = { clipPath: 'inset(0% 0% 100% 0%)', scale: REVEAL.out.scaleTo, transformOrigin: '50% 0%' };

// Johnny 1-13, Salon 1-11, Alt 9-15, MM Discos 1-9 y About (ver data/grid.js).
const GRID_ROWS = Math.ceil(images.length / GRID_COLUMNS);

// Rendition optimizada del tamaño de la celda (con margen para el asentamiento
// de escala y pantallas retina) en lugar del PNG original a tamaño completo.
const getGridImageWidth = () => {
  const cellWidth = window.innerWidth / (GRID_COLUMNS * 2);
  return Math.min(1200, cellWidth * REVEAL.scaleFrom * 1.1 * Math.min(window.devicePixelRatio || 1, 2));
};

// URLs de las miniaturas. La intro las precarga (src/lib/preload.js) y los
// cuadrados del loader no dejan entrar hasta que están listas: así la cortina
// descubre imágenes completas desde el primer frame.
export const getGridSources = () => {
  const width = getGridImageWidth();
  return images.map((image) => getOptimizedImageUrl(image.src, { width }));
};

export default function PortfolioGridFive({
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
  // 'covered' → 'revealing' → 'shown' → 'hiding' → 'covered'…
  const [phase, setPhase] = useState('covered');
  const [settled, setSettled] = useState(() => images.map(() => false));
  const imageRefs = useRef([]);
  const coveredRef = useRef(true);
  const hasRevealedRef = useRef(false);

  // Mismas URLs que precarga la intro (getGridSources), ya en caché al montarse.
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

  // Estado inicial: cada imagen tapada por su cortina antes del primer pintado.
  const gridMounted = availableHeight !== null;
  useLayoutEffect(() => {
    if (!gridMounted) return;
    gsap.set(imageRefs.current.filter(Boolean), HIDDEN);
  }, [gridMounted]);

  // Esperamos a que las imágenes estén decodificadas para que la cortina
  // no descubra celdas vacías.
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

  // Oculto mientras hay una galería abierta; al pulsar "back menu" (isReturning)
  // vuelve sin esperar a que el menú termine de recomponerse.
  const galleryOpen = clickedProject !== null && !isReturning;
  const isHidden = galleryOpen;
  const shouldShow = !isHidden;

  // Cada cortina arranca según su distancia en la retícula al origen de la ola
  // (stagger en grid de GSAP). La salida recorre la misma ola, más rápida.
  useEffect(() => {
    if (!isVisible || !layoutReady) return undefined;

    const imgs = imageRefs.current;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const grid = [GRID_ROWS, GRID_COLUMNS];
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
      // Tras una salida completa la cortina vuelve a su sitio: siempre sube desde abajo.
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
          // Tapadas, vuelven a estar nítidas para el próximo reveal.
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

  const calculateTop = (topPercent) => {
    if (!navbarHeight || !availableHeight) return topPercent;

    const navbarOffset = (navbarHeight / window.innerHeight) * 100;
    const verticalScale = Math.min(1, availableHeight / 900);
    const scaledTop = parseFloat(topPercent) * verticalScale;

    return `${scaledTop + navbarOffset}%`;
  };

  // ⭐ MODIFICADO: Ahora usa project.hover en lugar de project.slider
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

  // Detalle del hover: variante "md" y su proporción real (sin medir la imagen).
  const waveSrc = hoveredImageConfig && imageDimensions ? mediaSrc(hoveredImage.key, 'md') : null;
  const waveWidth = imageDimensions?.width || 0;
  const waveHeight = hoveredImageConfig ? waveWidth * mediaAspect(hoveredImage.key) : 0;

  const waveImagePosition = {
    position: 'fixed',
    top: `${navbarHeight + 16}px`,
    right: '1rem',
    transform: 'none'
  };

  // El grid ya no se desliza al abrir una galería: cada imagen se tapa con su cortina.
  const finalOpacity = isVisible ? 1 : 0;

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
          className="
            w-[calc(50%-1rem)]
            h-full
            grid
            grid-cols-6
            gap-4
            content-start
          "
        >
          {images.map((image, index) => {
            const isProjectActive = activeProject === image.project ||
                                    (hoveredImage && hoveredImage.project === image.project);
            const opacity = isProjectActive ? 1 : 0.6;
            const blur = isProjectActive ? 0 : '4px';

            // Mientras sube su cortina la imagen está nítida; al asentarse pasa
            // a su estado de reposo (blur + opacidad) y así se va al taparse,
            // salvo la galería que se abre: sigue activa y sale sin blur.
            const isShown = phase === 'shown';
            const isSettled = isShown || phase === 'hiding' || settled[index];
            const isInteractive = isShown || (phase === 'revealing' && settled[index]);
            const media = getMedia(image.key);

            return (
              <div
                key={index}
                className={`
                  w-full
                  h-auto
                  overflow-hidden
                  flex
                  justify-center
                  items-start
                  ${isShown ? 'transition-all duration-300' : ''}
                `}
                style={{
                  opacity: isSettled ? opacity : 1,
                  filter: `blur(${isSettled ? blur : 0})`,
                  pointerEvents: isInteractive ? undefined : 'none',
                  ...(!isShown && {
                    // Tapadas vuelven a nítido al instante: animar el filter de
                    // 41 celdas invisibles solo costaría frames.
                    transition: phase === 'covered'
                      ? 'none'
                      : `opacity ${REVEAL.settleDuration}s ease-out, filter ${REVEAL.settleDuration}s ease-out`
                  })
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
                {/* width/height reservan el hueco de la celda aunque la imagen
                    todavía no haya llegado. */}
                <img
                  ref={(el) => {
                    imageRefs.current[index] = el;
                  }}
                  src={sources[index]}
                  width={media?.w}
                  height={media?.h}
                  decoding="async"
                  alt={`Portfolio image ${index + 1}`}
                  className="max-w-full max-h-full object-contain block"
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Siempre montado mientras la grid es visible: reutiliza un único
          contexto WebGL en todos los hovers (src = null → oculto). */}
      {isVisible && (
        // WaveImage: Three.js en su propio chunk (lo precarga la intro).
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
