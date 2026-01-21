'use client';

import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { CustomEase } from 'gsap/CustomEase';

// Registrar plugins de GSAP
if (typeof window !== 'undefined') {
  gsap.registerPlugin(SplitText, CustomEase);
  CustomEase.create('hop', '0.9, 0, 0.1, 1');
}

const TextLoader = ({ onComplete }) => {
  const loaderRef = useRef(null);
  const svgRef = useRef(null);
  const squareRef = useRef(null);

  useEffect(() => {
    // Datos de configuración
    const textPaths = loaderRef.current.querySelectorAll('.orbit-text textPath');
    
    const startTextLengths = Array.from(textPaths).map((tp) =>
      parseFloat(tp.getAttribute('textLength'))
    );

    const startTextOffsets = Array.from(textPaths).map((tp) =>
      parseFloat(tp.getAttribute('startOffset'))
    );

    // Ajustamos los valores - más conservadores para evitar que desaparezcan
    const targetTextLengths = [2500, 2300, 2000, 1800, 1200, 700, 500];
    
    // Tamaños de los cuadrados (mitad del lado)
    const squareSizes = [600, 525, 450, 375, 300, 225, 150];

    const maxSquareSize = squareSizes[0];
    const maxAnimDuration = 2.5; // Más lento
    const minAnimDuration = 1.8; // Más lento

    // Animar textPaths con diferentes velocidades
    textPaths.forEach((textPath, index) => {
      const animationDelay = (textPaths.length - 1 - index) * 0.15;
      const currentSquareSize = squareSizes[index];
      
      // Cuadrados más grandes se mueven más lento
      const currentDuration =
        minAnimDuration +
        (currentSquareSize / maxSquareSize) * (maxAnimDuration - minAnimDuration);

      // Perímetro del cuadrado
      const pathLength = currentSquareSize * 8;
      const textLengthIncrease = targetTextLengths[index] - startTextLengths[index];
      const offsetAdjustment = (textLengthIncrease / 2 / pathLength) * 100;
      const targetOffset = startTextOffsets[index] - offsetAdjustment;

      gsap.to(textPath, {
        attr: {
          textLength: targetTextLengths[index],
          startOffset: targetOffset + '%',
        },
        duration: currentDuration,
        delay: animationDelay,
        ease: 'power2.inOut',
        yoyo: true,
        repeat: -1,
        repeatDelay: 0,
      });
    });

    // Animar cuadrado central - rotación completa en 8 segundos
    gsap.to(squareRef.current, {
      rotation: 360,
      duration: 8,
      ease: 'none',
      transformOrigin: 'center center',
    });

    // Animar textos de órbita
    const orbitTextElements = loaderRef.current.querySelectorAll('.orbit-text');
    gsap.set(orbitTextElements, { opacity: 0 });

    const orbitTextsReversed = Array.from(orbitTextElements).reverse();

    gsap.to(orbitTextsReversed, {
      opacity: 1,
      duration: 0.75,
      stagger: 0.125,
      ease: 'power1.out',
    });

    gsap.to(orbitTextsReversed, {
      opacity: 0,
      duration: 0.75,
      stagger: 0.1,
      delay: 7.5,
      ease: 'power1.out',
      onComplete: function () {
        gsap.to(loaderRef.current, {
          opacity: 0,
          duration: 1,
          onComplete: () => {
            if (onComplete) onComplete();
          },
        });
      },
    });

    // Cleanup
    return () => {
      gsap.killTweensOf('*');
    };
  }, [onComplete]);

  return (
    <div
      ref={loaderRef}
      className="fixed top-0 left-0 w-full h-screen flex justify-center items-center bg-white text-black z-50"
    >
      <svg
        ref={svgRef}
        viewBox="-50 -50 1100 1100"
        xmlns="http://www.w3.org/2000/svg"
        className="w-[85%] h-[85%] md:w-[85%] md:h-[85%]"
      >
        {/* Cuadrados más juntos - separación de 50px */}
        <path
          id="loader-square-1"
          d="M 225,500 L 225,225 L 775,225 L 775,775 L 225,775 L 225,500"
          fill="none"
        />
        <path
          id="loader-square-2"
          d="M 275,500 L 275,275 L 725,275 L 725,725 L 275,725 L 275,500"
          fill="none"
        />
        <path
          id="loader-square-3"
          d="M 325,500 L 325,325 L 675,325 L 675,675 L 325,675 L 325,500"
          fill="none"
        />
        <path
          id="loader-square-4"
          d="M 375,500 L 375,375 L 625,375 L 625,625 L 375,625 L 375,500"
          fill="none"
        />
        <path
          id="loader-square-5"
          d="M 425,500 L 425,425 L 575,425 L 575,575 L 425,575 L 425,500"
          fill="none"
        />
        <path
          id="loader-square-6"
          d="M 475,500 L 475,475 L 525,475 L 525,525 L 475,525 L 475,500"
          fill="none"
        />

        {/* Textos en los cuadrados */}
        <text className="orbit-text fill-black uppercase text-[clamp(1.25rem,2vw,1.5rem)]">
          <textPath href="#loader-square-1" startOffset="25%" textLength="300">
            Kiko
          </textPath>
        </text>
        <text className="orbit-text fill-black uppercase text-[clamp(1.25rem,2vw,1.5rem)]">
          <textPath href="#loader-square-2" startOffset="26%" textLength="280">
            Climent
          </textPath>
        </text>
        <text className="orbit-text fill-black uppercase text-[clamp(1.25rem,2vw,1.5rem)]">
          <textPath href="#loader-square-3" startOffset="28%" textLength="240">
            Fullstack
          </textPath>
        </text>
        <text className="orbit-text fill-black uppercase text-[clamp(1.25rem,2vw,1.5rem)]">
          <textPath href="#loader-square-4" startOffset="27%" textLength="260">
            Web Developer
          </textPath>
        </text>
        <text className="orbit-text fill-black uppercase text-[clamp(1.25rem,2vw,1.5rem)]">
          <textPath href="#loader-square-5" startOffset="25%" textLength="290">
            Creative Code
          </textPath>
        </text>
        <text className="orbit-text fill-black uppercase text-[clamp(1.25rem,2vw,1.5rem)]">
          <textPath href="#loader-square-6" startOffset="26%" textLength="200">
           Kiko
          </textPath>
        </text>
        <text className="orbit-text fill-black uppercase text-[clamp(1.25rem,2vw,1.5rem)] opacity-0">
          <textPath href="#loader-square-7" startOffset="28%" textLength="190">
            
          </textPath>
        </text>
        <text className="orbit-text fill-black uppercase text-[clamp(1.25rem,2vw,1.5rem)] opacity-0">
          <textPath href="#loader-square-7" startOffset="28%" textLength="190">
            
          </textPath>
        </text>
        <text className="orbit-text fill-black uppercase text-[clamp(1.25rem,2vw,1.5rem)] opacity-0">
          <textPath href="#loader-square-7" startOffset="28%" textLength="190">
            
          </textPath>
        </text>
      </svg>
      
      {/* Cuadrado central giratorio */}
      <div 
        ref={squareRef}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 border-2 border-black"
      />
    </div>
  );
};

// Componente de demostración
export default function Loader2() {
  const [showLoader, setShowLoader] = React.useState(true);

  const handleLoaderComplete = () => {
    setShowLoader(false);
  };

  return (
    <div className="min-h-screen">
      {showLoader && <TextLoader onComplete={handleLoaderComplete} />}
    </div>
  );
}