'use client';

import { useEffect, useState, useMemo } from 'react';
import { projects } from '@/components/data/projects';
import WaveImage from '@/components/tools/WaveImage';

export default function PortfolioGridThree({ activeProject, clickedProject, isVisible = true, onHover }) {
  const images = [];

  // Johnny: índices 0-12 (13 imágenes)
  for (let i = 1; i <= 13; i++) {
    images.push({ src: `/johnny/johnny${i}.png`, project: 'johnny', id: i });
  }

  // Salon: índices 13-23 (11 imágenes)
  for (let i = 1; i <= 11; i++) {
    images.push({ src: `/salon/salon${i}.png`, project: 'salon', id: i });
  }

  // Alt: índices 24-31 (8 imágenes)
  for (let i = 1; i <= 8; i++) {
    images.push({ src: `/alt/alt${i}.png`, project: 'alt', id: i });
  }

  // Acid: índices 32-38 (7 imágenes)
  for (let i = 1; i <= 8; i++) {
    images.push({ src: `/acid/acid${i}.png`, project: 'acid', id: i });
  }

  // About: índice 40 (1 imagen)
  images.push({ src: `/about/about.png`, project: 'about', id: 1 });

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
  }, [images.length]);

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

  const navbar = document.querySelector('[data-navbar]');
  const actualNavbarHeight = navbar?.offsetHeight || 0;

  const waveImagePosition = {
    position: 'fixed',
    top: `${actualNavbarHeight + 16}px`,
    right: '1rem',
    transform: 'none'
  };

  const finalOpacity = isVisible ? (isHidden ? 0 : 1) : 0;

  return (
    <>
      <div
        className="absolute left-4 right-4 box-border transition-all duration-700 ease-in-out"
        style={{
          top: `${actualNavbarHeight + 16}px`,
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
                  ${animationComplete ? 'transition-all duration-300' : ''}
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
                <img
                  src={image.src}
                  alt={`Portfolio image ${index + 1}`}
                  className="max-w-full max-h-full object-contain block"
                />
              </div>
            );
          })}
        </div>
      </div>

      {hoveredImageConfig && imageDimensions && isVisible && (
        <WaveImage
        src={`${hoveredImageConfig.project.imagesPath}/${hoveredImageConfig.project.id === 'about' && hoveredImageConfig.id === 1 ? 'about' : `${hoveredImageConfig.project.id}${hoveredImageConfig.id}`}.png`}
          alt={`Preview ${hoveredImageConfig.project.id} ${hoveredImageConfig.id}`}
          className="will-change-transform z-40"
          isVisible={true}
          style={{
            ...waveImagePosition,
            width: imageDimensions.width,
            height: imageDimensions.height,
            maxHeight: `${availableHeight * 0.8}px`,
            objectFit: 'contain',
            pointerEvents: 'none'
          }}
        />
      )}
    </>
  );
}