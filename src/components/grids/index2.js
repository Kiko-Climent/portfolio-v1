'use client';

import { useEffect, useState } from 'react';
import { projects } from '@/components/data/projects';

export default function PortfolioGrid({ activeProject, clickedProject }) {
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

  const [hoveredImage, setHoveredImage] = useState(null);
  const [navbarHeight, setNavbarHeight] = useState(0);



  const [availableHeight, setAvailableHeight] = useState(null);

  useEffect(() => {
    const updateHeight = () => {
      const navbar = document.querySelector('[data-navbar]');
      if (!navbar) return;

      const navbarHeightValue = navbar.offsetHeight;
      const topOffset = 16;    // top-4
      const bottomOffset = 16; // bottom-4

      const height =
        window.innerHeight - navbarHeightValue - topOffset - bottomOffset;

      setAvailableHeight(height);
      setNavbarHeight(navbarHeightValue);
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);

    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  // Función para calcular el top con el offset del navbar (igual que en ProjectImageSlider)
  const calculateTop = (topPercent) => {
    if (!navbarHeight) return topPercent;
    const offset = (navbarHeight / window.innerHeight) * 100;
    return `${parseFloat(topPercent) + offset}%`;
  };

  // Obtener la configuración de la imagen hovereada
  const getHoveredImageConfig = () => {
    if (!hoveredImage) return null;
    const project = projects[hoveredImage.project];
    if (!project || !project.slider || !project.slider.images) return null;
    
    const imageConfig = project.slider.images.find(img => img.id === hoveredImage.id);
    return imageConfig ? { ...imageConfig, project } : null;
  };

  const hoveredImageConfig = getHoveredImageConfig();

  if (availableHeight === null) return null;

  // Determinar si el grid debe estar oculto (cuando hay un proyecto clickeado)
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
          // Determinar la opacidad y blur:
          // - Si hay una imagen hovereada del mismo proyecto, todas las imágenes de ese proyecto pierden opacidad y blur
          // - Si es el proyecto activo (del footer), también pierden opacidad y blur
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
                className="
                  w-full
                  h-auto
                  object-contain
                  block
                "
              />
            </div>
          );
        })}
      </div>

      {/* Preview de la imagen hovereada en la parte derecha */}
      {hoveredImageConfig && (
        <div className="fixed top-0 right-0 w-1/2 h-screen pointer-events-none z-40">
          <div className="relative w-full h-full">
            <img
              src={`${hoveredImageConfig.project.imagesPath}/${hoveredImageConfig.project.id}${hoveredImageConfig.id}.png`}
              alt={`Preview ${hoveredImageConfig.project.id} ${hoveredImageConfig.id}`}
              className="absolute object-contain will-change-opacity transition-opacity duration-300"
              style={{
                top: calculateTop(hoveredImageConfig.top),
                left: hoveredImageConfig.left,
                width: hoveredImageConfig.width,
                opacity: 1
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
