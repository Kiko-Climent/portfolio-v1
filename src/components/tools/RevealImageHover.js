'use client';

import { useRef, useEffect } from 'react';
import gsap from 'gsap';

export default function RevealImageHover({ src, alt = '', isVisible }) {
  const imgRef = useRef(null);

  useEffect(() => {
    if (!imgRef.current) return;
    const el = imgRef.current;

    // reset inicial con optimizaciones GPU
    gsap.set(el, {
      scale: 0,
      transformOrigin: '0% 100%', // esquina inferior izquierda
      force3D: true, // Forzar aceleración GPU
      transformPerspective: 1000, // Perspectiva para mejor renderizado 3D
    });

    if (isVisible) {
      // Activar willChange solo cuando es necesario para mejor rendimiento
      el.style.willChange = 'transform';
      
      // animación de revelado optimizada - más rápida y fluida
      gsap.to(el, {
        scale: 1,
        duration: 0.7,
        ease: 'power2.out', // Easing más suave y rápido que power3
        force3D: true,
        onComplete: () => {
          // Remover willChange después de la animación para liberar recursos
          if (el) {
            el.style.willChange = 'auto';
          }
        }
      });
    } else {
      // Activar willChange para animación de salida
      el.style.willChange = 'transform';
      
      // animación inversa al dejar hover - más rápida
      gsap.to(el, {
        scale: 0,
        duration: 0.4,
        ease: 'power2.in',
        force3D: true,
        onComplete: () => {
          // Remover willChange después de la animación
          if (el) {
            el.style.willChange = 'auto';
          }
        }
      });
    }
  }, [isVisible]);

  return (
    <div
      ref={imgRef}
      className="relative w-full h-full overflow-hidden"
      style={{ 
        backfaceVisibility: 'hidden', // Optimización para evitar flickering
        perspective: 1000, // Perspectiva 3D
      }}
    >
      <img
        src={src}
        alt={alt}
        className="w-full h-full object-contain p-2"
        style={{
          transform: 'translateZ(0)', // Forzar capa de composición GPU
          backfaceVisibility: 'hidden',
          imageRendering: 'auto',
        }}
        loading="lazy"
      />
    </div>
  );
}
