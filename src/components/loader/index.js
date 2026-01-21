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

    // Ajustamos los valores para los cuadrados (perímetros más largos)
    const targetTextLengths = [2500, 2300, 2000, 1800, 1200, 700, 500];
    
    // Tamaños de los cuadrados (mitad del lado)
    const squareSizes = [600, 525, 450, 375, 300, 225, 150];

    const maxSquareSize = squareSizes[0];
    const maxAnimDuration = 1.5;
    const minAnimDuration = 0.8;

    // Animar textPaths con diferentes velocidades
    textPaths.forEach((textPath, index) => {
      const animationDelay = (textPaths.length - 1 - index) * 0.12;
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
      delay: 7.5, // Extendido de 6 a 7.5 para que termine con el cuadrado
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
        {/* Cuadrados como paths - más pequeños y centrados */}
        <path
          id="loader-square-1"
          d="M 50,500 L 50,50 L 950,50 L 950,950 L 50,950 L 50,500"
          fill="none"
        />
        <path
          id="loader-square-2"
          d="M 120,500 L 120,120 L 880,120 L 880,880 L 120,880 L 120,500"
          fill="none"
        />
        <path
          id="loader-square-3"
          d="M 190,500 L 190,190 L 810,190 L 810,810 L 190,810 L 190,500"
          fill="none"
        />
        <path
          id="loader-square-4"
          d="M 260,500 L 260,260 L 740,260 L 740,740 L 260,740 L 260,500"
          fill="none"
        />
        <path
          id="loader-square-5"
          d="M 330,500 L 330,330 L 670,330 L 670,670 L 330,670 L 330,500"
          fill="none"
        />
        <path
          id="loader-square-6"
          d="M 400,500 L 400,400 L 600,400 L 600,600 L 400,600 L 400,500"
          fill="none"
        />
        <path
          id="loader-square-7"
          d="M 470,500 L 470,470 L 530,470 L 530,530 L 470,530 L 470,500"
          fill="none"
        />

        {/* Textos en los cuadrados */}
        <text className="orbit-text fill-black uppercase text-[clamp(1.25rem,2vw,1.5rem)]">
          <textPath href="#loader-square-1" startOffset="25%" textLength="300">
            Kiko Climent
          </textPath>
        </text>
        <text className="orbit-text fill-black uppercase text-[clamp(1.25rem,2vw,1.5rem)]">
          <textPath href="#loader-square-2" startOffset="26%" textLength="280">
            Fullstack
          </textPath>
        </text>
        <text className="orbit-text fill-black uppercase text-[clamp(1.25rem,2vw,1.5rem)]">
          <textPath href="#loader-square-3" startOffset="28%" textLength="240">
            Web Developer
          </textPath>
        </text>
        <text className="orbit-text fill-black uppercase text-[clamp(1.25rem,2vw,1.5rem)]">
          <textPath href="#loader-square-4" startOffset="27%" textLength="260">
            Creative Code
          </textPath>
        </text>
        <text className="orbit-text fill-black uppercase text-[clamp(1.25rem,2vw,1.5rem)]">
          <textPath href="#loader-square-5" startOffset="25%" textLength="290">
            Portfolio
          </textPath>
        </text>
        <text className="orbit-text fill-black uppercase text-[clamp(1.25rem,2vw,1.5rem)]">
          <textPath href="#loader-square-6" startOffset="26%" textLength="200">
            2026
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
export default function Loader() {
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