'use client';

import { useEffect, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { projects } from '@/components/data/projects';
import { gridImages as images } from '@/components/data/grid';
import { getMedia, mediaAspect, mediaSrc } from '@/lib/media';

// Three.js en su propio chunk (lo precarga la intro, ver src/lib/preload.js).
const WaveImage = dynamic(() => import('@/components/tools/WaveImage'), { ssr: false });

export default function PortfolioGridThree({ activeProject, clickedProject, isVisible = true, onHover }) {
  const [hoveredImage, setHoveredImage] = useState(null);
  const [navbarHeight, setNavbarHeight] = useState(0);
  const [availableHeight, setAvailableHeight] = useState(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [startAnimation, setStartAnimation] = useState(false);
  const [animationComplete, setAnimationComplete] = useState(false);

  const randomDelays = useMemo(() => {
    const indices = Array.from({ length: images.length }, (_, i) => i);
    
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    
    const delays = new Array(images.length);
    indices.forEach((originalIndex, newPosition) => {
      delays[originalIndex] = newPosition * (100 + Math.random() * 100);
    });
    
    return delays;
  }, []);

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

  useEffect(() => {
    if (isVisible && !startAnimation) {
      const timer = setTimeout(() => {
        setStartAnimation(true);
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [isVisible, startAnimation]);

  useEffect(() => {
    if (startAnimation && !animationComplete) {
      const maxDelay = Math.max(...randomDelays);
      const timer = setTimeout(() => {
        setAnimationComplete(true);
      }, maxDelay + 700);
      
      return () => clearTimeout(timer);
    }
  }, [startAnimation, animationComplete, randomDelays]);

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

  const isHidden = clickedProject !== null;

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

  const finalOpacity = isVisible ? (isHidden ? 0 : 1) : 0;

  return (
    <>
      <div
        className="absolute left-4 right-4 box-border transition-all duration-700 ease-in-out"
        style={{
          top: `${navbarHeight + 16}px`,
          height: `${availableHeight}px`,
          opacity: finalOpacity,
          transform: isHidden ? 'translateX(100%)' : 'translateX(0)',
          pointerEvents: (isHidden || !isVisible) ? 'none' : 'auto',
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
            const media = getMedia(image.key);

            const animationDelay = randomDelays[index];

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
                  ${animationComplete ? 'transition-[opacity,filter] duration-300' : ''}
                `}
                style={{ 
                  opacity: startAnimation ? opacity : 0,
                  filter: `blur(${blur})`,
                  ...(!animationComplete && {
                    transition: `opacity 0.7s ease-in ${animationDelay}ms`
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
                {/* Miniatura de 384px precargada durante la intro; width/height
                    reservan su hueco aunque todavía no haya llegado. */}
                <img
                  src={mediaSrc(image.key, 'thumb')}
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
        <WaveImage
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