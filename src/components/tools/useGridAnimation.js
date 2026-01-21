'use client';

import { useEffect } from 'react';
import gsap from 'gsap';

export function useRevealGridAnimation({
  isVisible,
  imagesRef,
  origin = 'left',
}) {
  useEffect(() => {
    const images = imagesRef.current.filter(Boolean);

    if (!images.length) return;

    gsap.killTweensOf(images);

    if (isVisible) {
      gsap.set(images, {
        scaleX: 0,
        transformOrigin: origin === 'left' ? '0% 50%' : '100% 50%',
      });

      gsap.to(images, {
        scaleX: 1,
        duration: 0.9,
        ease: 'power3.out',
        stagger: 0.05,
      });
    } else {
      gsap.to(images, {
        scaleX: 0,
        duration: 0.5,
        ease: 'power3.in',
        stagger: {
          each: 0.03,
          from: 'end',
        },
      });
    }
  }, [isVisible, origin]);
}
