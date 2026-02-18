'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useDarkMode } from '@/contexts/DarkModeContext';

const NavbarLoader = ({ onLoadingComplete }) => {
  const { isDarkMode, toggleDarkMode } = useDarkMode(); // ⭐ USAR EL CONTEXTO
  const [showLoader, setShowLoader] = useState(true);
  const [showNavbarContent, setShowNavbarContent] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  
  const loaderRef = useRef(null);
  const squareRef = useRef(null);
  const navbarRef = useRef(null);

  useEffect(() => {
    // Configuración inicial
    const textPaths = loaderRef.current?.querySelectorAll('.orbit-text textPath');
    if (!textPaths) return;

    const startTextLengths = Array.from(textPaths).map((tp) =>
      parseFloat(tp.getAttribute('textLength'))
    );

    const startTextOffsets = Array.from(textPaths).map((tp) =>
      parseFloat(tp.getAttribute('startOffset'))
    );

    const targetTextLengths = [2500, 2300, 2000, 1800, 1200, 700];
    const squareSizes = [600, 525, 450, 375, 300, 225];

    const maxSquareSize = squareSizes[0];
    const maxAnimDuration = 1.5;
    const minAnimDuration = 0.8;

    let textAnimations = [];
    let squareRotation = null;

    // Animar textPaths
    textPaths.forEach((textPath, index) => {
      const animationDelay = (textPaths.length - 1 - index) * 0.12;
      const currentSquareSize = squareSizes[index];
      
      const currentDuration =
        minAnimDuration +
        (currentSquareSize / maxSquareSize) * (maxAnimDuration - minAnimDuration);

      const pathLength = currentSquareSize * 8;
      const textLengthIncrease = targetTextLengths[index] - startTextLengths[index];
      const offsetAdjustment = (textLengthIncrease / 2 / pathLength) * 100;
      const targetOffset = startTextOffsets[index] - offsetAdjustment;

      const anim = animateElement(textPath, {
        textLength: targetTextLengths[index],
        startOffset: targetOffset + '%',
      }, currentDuration, animationDelay, true);
      
      textAnimations.push(anim);
    });

    // Animar cuadrado central - rotación
    squareRotation = animateRotation(squareRef.current, 8);

    // Animar aparición de textos
    const orbitTextElements = loaderRef.current.querySelectorAll('.orbit-text');
    const orbitTextsReversed = Array.from(orbitTextElements).reverse();

    setTimeout(() => {
      orbitTextsReversed.forEach((el, i) => {
        setTimeout(() => {
          el.style.opacity = '1';
        }, i * 125);
      });
    }, 0);

    // Desaparición de textos y parada del cuadrado
    setTimeout(() => {
      orbitTextsReversed.forEach((el, i) => {
        setTimeout(() => {
          el.style.opacity = '0';
        }, i * 100);
      });

      // Parar rotación del cuadrado
      setTimeout(() => {
        if (squareRotation) {
          squareRotation.stop();
        }
        
        // Iniciar transición del cuadrado al navbar
        setIsTransitioning(true);
        
        // Movimiento vertical primero
        setTimeout(() => {
          if (squareRef.current) {
            squareRef.current.style.transition = 'all 0.8s cubic-bezier(0.9, 0, 0.1, 1)';
            squareRef.current.style.top = '1.7rem';
          }
        }, 100);
        
        // Luego movimiento horizontal
        setTimeout(() => {
          if (squareRef.current) {
            squareRef.current.style.left = 'calc(100% - 1.5rem)';
            squareRef.current.style.transform = 'translate(-50%, -50%)';
          }
        }, 900);
        
        // Ocultar loader y mostrar navbar
        setTimeout(() => {
          setShowLoader(false);
          setShowNavbarContent(true);
          if (onLoadingComplete) {
            onLoadingComplete();
          }
        }, 1700);
        
      }, 750);
    }, 7500);

    // Cleanup
    return () => {
      textAnimations.forEach(anim => anim && anim.stop && anim.stop());
      if (squareRotation) squareRotation.stop();
    };
  }, [onLoadingComplete]);

  // Función auxiliar para animar atributos
  const animateElement = (element, targetAttrs, duration, delay, yoyo) => {
    let startTime = null;
    let animationId = null;
    let isReverse = false;
    
    const initialAttrs = {};
    Object.keys(targetAttrs).forEach(key => {
      const currentValue = element.getAttribute(key);
      initialAttrs[key] = key === 'startOffset' 
        ? parseFloat(currentValue) 
        : parseFloat(currentValue);
    });

    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp - (delay * 1000);
      const elapsed = timestamp - startTime - (delay * 1000);
      
      if (elapsed < 0) {
        animationId = requestAnimationFrame(animate);
        return;
      }

      const progress = Math.min(elapsed / (duration * 1000), 1);
      const easeProgress = easeInOutQuad(progress);

      Object.keys(targetAttrs).forEach(key => {
        const start = isReverse ? parseFloat(targetAttrs[key]) : initialAttrs[key];
        const end = isReverse ? initialAttrs[key] : parseFloat(targetAttrs[key]);
        const current = start + (end - start) * easeProgress;
        
        element.setAttribute(key, key === 'startOffset' ? `${current}%` : current);
      });

      if (progress < 1) {
        animationId = requestAnimationFrame(animate);
      } else if (yoyo) {
        isReverse = !isReverse;
        startTime = timestamp;
        animationId = requestAnimationFrame(animate);
      }
    };

    animationId = requestAnimationFrame(animate);
    
    return {
      stop: () => {
        if (animationId) cancelAnimationFrame(animationId);
      }
    };
  };

  // Función auxiliar para rotación
  const animateRotation = (element, duration) => {
    if (!element) return { stop: () => {} };
    
    let startTime = null;
    let animationId = null;

    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      
      const rotation = (elapsed / (duration * 1000)) * 360;
      if (element && element.style) {
        element.style.transform = `translate(-50%, -50%) rotate(${rotation}deg)`;
      }

      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);
    
    return {
      stop: () => {
        if (animationId) cancelAnimationFrame(animationId);
      }
    };
  };

  const easeInOutQuad = (t) => {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  };

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-black text-white' : 'bg-white text-black'} transition-colors duration-300`}>
      {/* Loader */}
      {showLoader && (
        <div
          ref={loaderRef}
          className="fixed top-0 left-0 w-full h-screen flex justify-center items-center z-50"
          style={{ 
            opacity: isTransitioning ? 0 : 1,
            transition: 'opacity 0.5s ease-out',
            pointerEvents: isTransitioning ? 'none' : 'auto'
          }}
        >
          <svg
            viewBox="-50 -50 1100 1100"
            xmlns="http://www.w3.org/2000/svg"
            className="w-[85%] h-[85%] md:w-[85%] md:h-[85%]"
          >
            <path id="loader-square-1" d="M 50,500 L 50,50 L 950,50 L 950,950 L 50,950 L 50,500" fill="none" />
            <path id="loader-square-2" d="M 120,500 L 120,120 L 880,120 L 880,880 L 120,880 L 120,500" fill="none" />
            <path id="loader-square-3" d="M 190,500 L 190,190 L 810,190 L 810,810 L 190,810 L 190,500" fill="none" />
            <path id="loader-square-4" d="M 260,500 L 260,260 L 740,260 L 740,740 L 260,740 L 260,500" fill="none" />
            <path id="loader-square-5" d="M 330,500 L 330,330 L 670,330 L 670,670 L 330,670 L 330,500" fill="none" />
            <path id="loader-square-6" d="M 400,500 L 400,400 L 600,400 L 600,600 L 400,600 L 400,500" fill="none" />

            <text className="orbit-text uppercase text-[clamp(1.25rem,2vw,1.5rem)] transition-opacity duration-700" style={{ opacity: 0 }}>
              <textPath href="#loader-square-1" startOffset="25%" textLength="300">Kiko Climent</textPath>
            </text>
            <text className="orbit-text uppercase text-[clamp(1.25rem,2vw,1.5rem)] transition-opacity duration-700" style={{ opacity: 0 }}>
              <textPath href="#loader-square-2" startOffset="26%" textLength="280">Fullstack</textPath>
            </text>
            <text className="orbit-text uppercase text-[clamp(1.25rem,2vw,1.5rem)] transition-opacity duration-700" style={{ opacity: 0 }}>
              <textPath href="#loader-square-3" startOffset="28%" textLength="240">Web Developer</textPath>
            </text>
            <text className="orbit-text uppercase text-[clamp(1.25rem,2vw,1.5rem)] transition-opacity duration-700" style={{ opacity: 0 }}>
              <textPath href="#loader-square-4" startOffset="27%" textLength="260">Creative Code</textPath>
            </text>
            <text className="orbit-text uppercase text-[clamp(1.25rem,2vw,1.5rem)] transition-opacity duration-700" style={{ opacity: 0 }}>
              <textPath href="#loader-square-5" startOffset="25%" textLength="290">Portfolio</textPath>
            </text>
            <text className="orbit-text uppercase text-[clamp(1.25rem,2vw,1.5rem)] transition-opacity duration-700" style={{ opacity: 0 }}>
              <textPath href="#loader-square-6" startOffset="26%" textLength="200">2026</textPath>
            </text>
          </svg>
        </div>
      )}

      {/* Cuadrado que transiciona */}
      <div 
        ref={squareRef}
        onClick={!showLoader ? toggleDarkMode : undefined}
        onMouseEnter={() => !showLoader && setIsHovered(true)}
        onMouseLeave={() => !showLoader && setIsHovered(false)}
        className={`fixed w-4 h-4 border-2 ${isDarkMode ? 'border-white' : 'border-black'} bg-transparent z-[60]`}
        style={{
          top: '50%',
          left: '50%',
          transform: `translate(-50%, -50%) rotate(${isHovered ? '180deg' : '0deg'})`,
          cursor: !showLoader ? 'pointer' : 'default',
          backgroundColor: isHovered 
            ? (isDarkMode ? 'white' : 'black') 
            : 'transparent',
          transition: 'background-color 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)'
        }}
        aria-label={isDarkMode ? 'Activar modo claro' : 'Activar modo oscuro'}
      />

      {/* Navbar */}
      <div 
        ref={navbarRef}
        data-navbar
        className="flex top-4 left-4 right-4 leading-none z-50 text-[clamp(1.25rem,2vw,1.5rem)] leading-[0.95] absolute transition-opacity duration-500"
        style={{ opacity: showNavbarContent ? 1 : 0 }}
      >
        <div className="w-1/2 flex flex-col">
          <h1>Kiko Climent</h1>
          <h2>Portfolio 2026</h2>
        </div>
        <div className="w-1/2 flex flex-col">
          <p>Fullstack Web Developer</p>
          <p>climent.kiko@gmail.com</p>
          <p>(+49) 176 58260660</p>
        </div>
      </div>
    </div>
  );
};

export default NavbarLoader;