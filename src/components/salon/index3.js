import { useEffect, useRef } from 'react';

export default function SalonGrid3({ isHovered }) {
  const gridRef = useRef(null);
  const imagesRef = useRef([]);
  const curtainsRef = useRef([]);

  // Layout del grid asimétrico con números de imagen
  const gridLayout = [
    // Fila 1: 4 fotos (posiciones 1, 2, 4, 5 - vacíos en 3 y 6)
    1, 2, null, 3, 4, null,
    // Fila 2: 4 fotos (posiciones 1, 3, 5, 6 - vacíos en 2 y 4)
    5, null, 6, null, 7, 8,
    // Fila 3: 3 fotos (posiciones 2, 3, 5 - vacíos en 1, 4 y 6)
    null, 9, 10, null, 11, null
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
          amount: 0.4,
          from: 'random',
        },
        ease: 'power2.inOut',
      });

      // Paso 2: Mostrar imagen y cortina sale (continúa hacia la derecha)
      tl.to(images, {
        opacity: 1,
        duration: 0.1,
        stagger: {
          amount: 0.4,
          from: 'random',
        },
      }, '-=0.3');

      tl.to(curtains, {
        x: '110%',
        duration: 0.5,
        stagger: {
          amount: 0.4,
          from: 'random',
        },
        ease: 'power2.inOut',
      }, '-=0.3');

    } else {
      // Animación de salida inversa
      const tlOut = window.gsap.timeline();

      // Cortina entra desde la derecha
      tlOut.set(curtains, { x: '110%' });
      
      tlOut.to(curtains, {
        x: '0%',
        duration: 0.5,
        stagger: {
          amount: 0.4,
          from: 'random',
        },
        ease: 'power2.inOut',
      });

      // Ocultar imagen
      tlOut.to(images, {
        opacity: 0,
        duration: 0.1,
        stagger: {
          amount: 0.4,
          from: 'random',
        },
      }, '-=0.3');

      // Cortina sale por la izquierda
      tlOut.to(curtains, {
        x: '-100%',
        duration: 0.5,
        stagger: {
          amount: 0.4,
          from: 'random',
        },
        ease: 'power2.inOut',
      }, '-=0.3');
    }
  }, [isHovered]);

  if (!isHovered) return null;

  return (
    <div className="absolute left-4 right-4 top-28 bottom-32 flex items-center pointer-events-none">
      <div ref={gridRef} className="grid grid-cols-6 gap-4 w-full h-[70vh]">
        {gridLayout.map((imageNum, index) => (
          <div
            key={index}
            className="relative  overflow-hidden"
          >
            {imageNum && (
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
            )}
          </div>
        ))}
      </div>
    </div>
  );
}