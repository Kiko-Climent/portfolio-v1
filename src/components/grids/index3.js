'use client';

import { useEffect, useState } from 'react';
import { projects } from '@/components/data/projects';
import WaveImage from '@/components/tools/WaveImage';

export default function PortfolioGridThree({ activeProject, clickedProject }) {
  const images = [];
  const FIXED_WAVE_POSITION = {
    top: '40%',
    left: '80%',
    transform: 'translate(-50%, -50%)'
  };

  

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

  const [hoveredImage, setHoveredImage] = useState(null);
  const [navbarHeight, setNavbarHeight] = useState(0);
  const [availableHeight, setAvailableHeight] = useState(null);
  const [viewportWidth, setViewportWidth] = useState(0);

  useEffect(() => {
    const updateHeight = () => {
      const navbar = document.querySelector('[data-navbar]');
      if (!navbar) return;

      const navbarHeightValue = navbar.offsetHeight;
      const topOffset = 16;
      const bottomOffset = 16;

      const height =
        window.innerHeight - navbarHeightValue - topOffset - bottomOffset;

      setAvailableHeight(height);
      setNavbarHeight(navbarHeightValue);
      setViewportWidth(window.innerWidth);
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);

    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  // ✅ CAMBIO 1: Añadir escala vertical
  const calculateTop = (topPercent) => {
    if (!navbarHeight || !availableHeight) return topPercent;
    
    // Offset del navbar
    const navbarOffset = (navbarHeight / window.innerHeight) * 100;
    
    // Escala vertical basada en altura disponible (asumiendo 900px como referencia)
    const verticalScale = Math.min(1, availableHeight / 900);
    
    // Ajustar el top porcentual con la escala
    const scaledTop = parseFloat(topPercent) * verticalScale;
    
    return `${scaledTop + navbarOffset}%`;
  };

  const getHoveredImageConfig = () => {
    if (!hoveredImage) return null;
    const project = projects[hoveredImage.project];
    if (!project || !project.slider || !project.slider.images) return null;
    
    const imageConfig = project.slider.images.find(img => img.id === hoveredImage.id);
    return imageConfig ? { ...imageConfig, project } : null;
  };

  // ✅ CAMBIO 2: Escalar dimensiones según altura y ancho
  const getImageDimensions = (config) => {
    if (!config || !viewportWidth || !availableHeight) return { width: 0, height: 0 };
    
    // El contenedor derecho es el 50% del viewport
    const containerWidth = viewportWidth * 0.5;
    
    // Calcular escala basada en altura (asumiendo 900px como altura de referencia)
    const heightScale = Math.min(1, availableHeight / 900);
    
    // Calcular el ancho real basado en el porcentaje y la escala
    const widthPercent = parseFloat(config.width) / 100;
    const imageWidth = containerWidth * widthPercent * heightScale;
    
    return {
      width: imageWidth,
      height: 'auto'
    };
  };

  const hoveredImageConfig = getHoveredImageConfig();
  const imageDimensions = hoveredImageConfig ? getImageDimensions(hoveredImageConfig) : null;

  if (availableHeight === null) return null;

  const isHidden = clickedProject !== null;

  return (
    <div
      className="absolute left-4 right-12 box-border transition-all duration-700 ease-in-out"
      style={{
        top: `${document.querySelector('[data-navbar]')?.offsetHeight + 16}px`,
        height: `${availableHeight}px`,
        opacity: isHidden ? 0 : 1,
        transform: isHidden ? 'translateX(100%)' : 'translateX(0)',
        pointerEvents: isHidden ? 'none' : 'auto',
      }}
    >
      <div
        className="
          max-w-[50%]
          h-full
          grid
          grid-cols-6
          gap-2
          content-start
        "
      >
        {images.map((image, index) => {
          const isProjectActive = activeProject === image.project || 
                                  (hoveredImage && hoveredImage.project === image.project);
          const opacity = isProjectActive ? 1 : 0.6;
          const blur = isProjectActive ? 0 : '4px';
          
          return (
            <div
              key={index}
              className="w-full overflow-hidden flex justify-center transition-all duration-300 ease-in-out"
              style={{ opacity, filter: `blur(${blur})` }}
              onMouseEnter={() => setHoveredImage(image)}
              onMouseLeave={() => setHoveredImage(null)}
            >
              <img
                src={image.src}
                alt={`Portfolio image ${index + 1}`}
                className="w-full h-auto object-contain block"
              />
            </div>
          );
        })}
      </div>

      {/* ✅ CAMBIO 3: Añadir maxHeight para limitar altura */}
      {hoveredImageConfig && imageDimensions && (
        <WaveImage
          src={`${hoveredImageConfig.project.imagesPath}/${hoveredImageConfig.project.id}${hoveredImageConfig.id}.png`}
          alt={`Preview ${hoveredImageConfig.project.id} ${hoveredImageConfig.id}`}
          className="will-change-transform fixed z-40"
          isVisible={true}
          style={{
            ...FIXED_WAVE_POSITION,
            width: imageDimensions.width,
            height: imageDimensions.height,
            maxHeight: `${availableHeight * 0.8}px`, // Limitar al 80% de la altura disponible
            objectFit: 'contain',
            pointerEvents: 'none'
          }}
        />
      )}
    </div>
  );
}