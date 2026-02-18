'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { projects } from '@/components/data/projects';
import { useDarkMode } from '@/contexts/DarkModeContext';

gsap.registerPlugin(SplitText);

export default function AboutText({ isVisible = true }) {
  const { isDarkMode } = useDarkMode();
  const textRef = useRef(null);
  const splitInstanceRef = useRef(null);

  useEffect(() => {
    if (!textRef.current || !isVisible) return;

    const timer = setTimeout(() => {
      if (!textRef.current) return;

      // Crear SplitText
      const split = new SplitText(textRef.current, {
        type: 'lines,words',
        linesClass: 'line',
        wordsClass: 'word'
      });

      splitInstanceRef.current = split;

      // Aplicar color a las palabras
      split.words.forEach(word => {
        word.style.color = isDarkMode ? 'white' : 'black';
      });

      // Animar desde abajo con fade in
      gsap.fromTo(
        split.lines,
        {
          y: 50,
          opacity: 0
        },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          stagger: 0.05,
          ease: 'power2.out',
          delay: 0.3
        }
      );
    }, 100);

    return () => {
      clearTimeout(timer);
      if (splitInstanceRef.current) {
        splitInstanceRef.current.revert();
        splitInstanceRef.current = null;
      }
    };
  }, [isVisible, isDarkMode]);

  // Actualizar color cuando cambia el dark mode
  useEffect(() => {
    if (splitInstanceRef.current && textRef.current) {
      splitInstanceRef.current.words.forEach(word => {
        word.style.color = isDarkMode ? 'white' : 'black';
      });
    }
  }, [isDarkMode]);

  const aboutProject = projects.about;
  const description = aboutProject.slider.text.description;

  return (
    <div
      className="fixed bottom-4 left-4 z-40 transition-opacity duration-700"
      style={{
        width: 'calc(50% - 2rem)',
        opacity: isVisible ? 1 : 0,
        pointerEvents: isVisible ? 'auto' : 'none'
      }}
    >
      <p
        ref={textRef}
        className="text-[clamp(0.9rem,1.2vw,1.1rem)] leading-relaxed"
        style={{
          color: isDarkMode ? 'white' : 'black',
          maxWidth: '90%'
        }}
      >
        {description}
      </p>
    </div>
  );
}