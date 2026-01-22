'use client';

import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';

const TextLoader = ({ onComplete }) => {
  const loaderRef = useRef(null);
  const svgRef = useRef(null);
  const squareRef = useRef(null);

  useEffect(() => {
    const textPaths = loaderRef.current.querySelectorAll('.orbit-text textPath');
    
    const startTextLengths = Array.from(textPaths).map((tp) =>
      parseFloat(tp.getAttribute('textLength'))
    );

    const startTextOffsets = Array.from(textPaths).map((tp) =>
      parseFloat(tp.getAttribute('startOffset'))
    );

    const targetTextLengths = [2500, 2300, 2000, 1800, 1200, 700, 500];
    const squareSizes = [600, 525, 450, 375, 300, 225, 150];

    const maxSquareSize = squareSizes[0];
    const maxAnimDuration = 1.5;
    const minAnimDuration = 0.8;

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

    // Animar cuadrado central - rotación
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

    // Timeline para la secuencia de salida
    const exitTimeline = gsap.timeline({ delay: 7.5 });

    // 1. Fade out de los textos
    exitTimeline.to(orbitTextsReversed, {
      opacity: 0,
      duration: 0.75,
      stagger: 0.1,
      ease: 'power1.out',
    });

    // 2. El cuadrado sube hacia arriba
    exitTimeline.to(squareRef.current, {
      top: 'calc(5% - 1rem)',
      duration: 1.2,
      ease: 'power2.inOut',
    }, '-=0.2'); // Empieza un poco antes de que terminen los textos

    // 3. El cuadrado se desplaza a la derecha
    exitTimeline.to(squareRef.current, {
      left: 'calc(100% - 2rem)', // Ajusta según tu navbar
      duration: 1,
      ease: 'power2.inOut',
    });

    // 4. Fade out del fondo
    exitTimeline.to(loaderRef.current, {
      opacity: 0,
      duration: 0.8,
      ease: 'power1.out',
      onComplete: () => {
        if (onComplete) onComplete();
      },
    }, '-=0.3'); // Se solapa un poco con el movimiento

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

export default function Loader1_1() {
  const [showLoader, setShowLoader] = React.useState(true);

  const handleLoaderComplete = () => {
    setShowLoader(false);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {showLoader && <TextLoader onComplete={handleLoaderComplete} />}
      
      {!showLoader && (
        <div className="p-8">
          <h1 className="text-4xl font-bold">Contenido del Portfolio</h1>
          <p className="mt-4">El loader ha terminado y el cuadrado viajó a su posición final</p>
        </div>
      )}
    </div>
  );
}