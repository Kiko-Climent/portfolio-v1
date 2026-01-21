'use client';

import { useRef, useEffect } from 'react';
import gsap from 'gsap';

export default function RevealVideoHover({ src, alt = '', isVisible }) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;

    // reset inicial con optimizaciones GPU
    gsap.set(el, {
      scale: 0,
      transformOrigin: '0% 100%', // esquina inferior izquierda
      force3D: true, // Forzar aceleración GPU
      transformPerspective: 1000, // Perspectiva para mejor renderizado 3D
    });

    if (isVisible) {
      // Activar willChange solo cuando es necesario
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

  // Controlar la reproducción del video
  useEffect(() => {
    if (!videoRef.current) return;
    
    const video = videoRef.current;
    
    if (isVisible) {
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Silenciar errores de reproducción (especialmente cuando el componente se desmonta)
          // No hacer nada, solo prevenir que el error aparezca en la consola
        });
      }
    } else {
      video.pause();
      video.currentTime = 0;
    }

    return () => {
      if (video) {
        video.pause();
        video.currentTime = 0;
      }
    };
  }, [isVisible]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden"
      style={{ 
        backfaceVisibility: 'hidden', // Optimización para evitar flickering
        perspective: 1000, // Perspectiva 3D
      }}
    >
      <video
        ref={videoRef}
        src={src}
        className="w-full h-full object-contain p-2"
        style={{
          transform: 'translateZ(0)', // Forzar capa de composición GPU
          backfaceVisibility: 'hidden',
        }}
        loop
        muted
        playsInline
        preload="metadata"
      />
    </div>
  );
}

