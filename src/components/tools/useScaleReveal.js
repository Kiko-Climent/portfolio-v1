'use client';

import { useEffect } from 'react';
import gsap from 'gsap';

export function useScaleReveal({
  isVisible,
  elementsRef,
  origin = 'left',
}) {
  useEffect(() => {
    const elements = elementsRef.current.filter(Boolean);
    if (!elements.length) return;

    gsap.killTweensOf(elements);

    // estado inicial
    gsap.set(elements, {
      scale: isVisible ? 1 : 0,
      transformOrigin: origin === 'left' ? '0% 50%' : '100% 50%',
      willChange: 'transform',
    });

    if (isVisible) {
      gsap.to(elements, {
        scale: 1,
        duration: 1,
        ease: 'power3.out',
        stagger: 0.06,
      });
    } else {
      gsap.to(elements, {
        scale: 0,
        duration: 0.6,
        ease: 'power3.in',
        stagger: {
          each: 0.04,
          from: 'end',
        },
      });
    }
  }, [isVisible, origin]);
}
