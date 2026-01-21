// Fibonacci grid layout
// [imageNum, colStart, colSpan, rowStart, rowSpan]
// [1, 1, 3, 1, 2],    // Grande
// [2, 4, 2, 1, 1],    // Mediano
// [3, 6, 2, 1, 2],    // Mediano vertical
// [4, 4, 2, 2, 1],    // Mediano
// [5, 1, 2, 3, 2],    // Mediano vertical
// [6, 3, 3, 3, 1],    // Grande horizontal
// [7, 6, 2, 3, 1],    // Mediano
// [8, 3, 2, 4, 1],    // Mediano
// [9, 5, 3, 4, 2],    // Grande
// [10, 1, 2, 5, 1],   // Mediano
// [11, 3, 2, 5, 1],   // Mediano

'use client';

import { useEffect, useRef } from 'react';

export default function SalonGrid4({ isHovered }) {
  const gridRef = useRef(null);
  const imagesRef = useRef([]);
  const curtainsRef = useRef([]);

  // Fibonacci grid layout - cada item tiene posición y tamaño basado en Fibonacci
  // [imageNum, colStart, colSpan, rowStart, rowSpan]
  const fibonacciLayout = [
    [1, 1, 3, 1, 2],    // Grande
    [2, 4, 2, 1, 1],    // Mediano
    [3, 6, 2, 1, 2],    // Mediano vertical
    [4, 4, 2, 2, 1],    // Mediano
    [5, 1, 2, 3, 2],    // Mediano vertical
    [6, 3, 3, 3, 1],    // Grande horizontal
    [7, 6, 2, 3, 1],    // Mediano
    [8, 3, 2, 4, 1],    // Mediano
    [9, 5, 3, 4, 2],    // Grande
    [10, 1, 2, 5, 1],   // Mediano
    [11, 3, 2, 5, 1],   // Mediano
  ];

  useEffect(() => {
    // Cargar GSAP
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  useEffect(() => {
    if (!window.gsap) return;

    const images = imagesRef.current.filter(Boolean);
    const curtains = curtainsRef.current.filter(Boolean);
    
    if (isHovered) {
      // Timeline de entrada
      const tl = window.gsap.timeline();

      // Inicializar estado
      window.gsap.set(images, { opacity: 0 });
      window.gsap.set(curtains, { x: '-100%' });

      // Paso 1: Cortina negra entra (de izquierda a derecha)
      tl.to(curtains, {
        x: '0%',
        duration: 0.5,
        stagger: {
          amount: 1.2,
          from: 'random',
        },
        ease: 'power2.inOut',
      });

      // Paso 2: Mostrar imagen y cortina sale (continúa hacia la derecha)
      tl.to(images, {
        opacity: 1,
        duration: 0.1,
        stagger: {
          amount: 1.2,
          from: 'random',
        },
      }, '-=0.9');

      tl.to(curtains, {
        x: '110%',
        duration: 0.5,
        stagger: {
          amount: 1.2,
          from: 'random',
        },
        ease: 'power2.inOut',
      }, '-=0.9');

    } else {
      // Animación de salida inversa
      const tlOut = window.gsap.timeline();

      // Cortina entra desde la derecha
      tlOut.set(curtains, { x: '110%' });
      
      tlOut.to(curtains, {
        x: '0%',
        duration: 0.5,
        stagger: {
          amount: 1.2,
          from: 'random',
        },
        ease: 'power2.inOut',
      });

      // Ocultar imagen
      tlOut.to(images, {
        opacity: 0,
        duration: 0.1,
        stagger: {
          amount: 1.2,
          from: 'random',
        },
      }, '-=0.9');

      // Cortina sale por la izquierda
      tlOut.to(curtains, {
        x: '-100%',
        duration: 0.5,
        stagger: {
          amount: 1.2,
          from: 'random',
        },
        ease: 'power2.inOut',
      }, '-=0.9');
    }
  }, [isHovered]);

  if (!isHovered) return null;

  return (
    <div className="absolute left-4 right-4 top-28 bottom-32 flex items-center pointer-events-none">
      <div 
        ref={gridRef} 
        className="grid gap-4 w-full h-full"
        style={{
          gridTemplateColumns: 'repeat(7, 1fr)',
          gridTemplateRows: 'repeat(5, 1fr)',
        }}
      >
        {fibonacciLayout.map(([imageNum, colStart, colSpan, rowStart, rowSpan]) => (
          <div
            key={imageNum}
            className="relative bg-gray-100/50 overflow-hidden"
            style={{
              gridColumn: `${colStart} / span ${colSpan}`,
              gridRow: `${rowStart} / span ${rowSpan}`,
            }}
          >
            <div className="relative w-full h-full">
              {/* Imagen */}
              <div
                ref={(el) => (imagesRef.current[imageNum - 1] = el)}
                className="w-full h-full"
                style={{ willChange: 'opacity' }}
              >
                <img
                  src={`/salon/salon${imageNum}.png`}
                  alt={`Salon ${imageNum}`}
                  className="w-full h-full object-contain p-2"
                />
              </div>

              {/* Cortina negra */}
              <div
                ref={(el) => (curtainsRef.current[imageNum - 1] = el)}
                className="absolute inset-0 bg-black"
                style={{ 
                  willChange: 'transform',
                  transform: 'translateX(-100%)',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}