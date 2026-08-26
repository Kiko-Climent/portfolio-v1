'use client';

import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { useDarkMode } from '@/contexts/DarkModeContext';

gsap.registerPlugin(SplitText);

// Colchón vertical de la máscara para no recortar ascendentes/descendentes
// (se compensa con margin negativo, así no altera el interlineado).
const MASK_CUSHION = '0.25em';

const ANIM = {
  // Entrada de "Kiko Climent" y "Creative Frontend Developer"
  titleIn: {
    duration: 0.9,
    ease: 'power4.out',
    staggerEach: 0.03,
    fromYPercent: 140,
  },
  // Salida de ambos títulos una vez formado el cuadrado
  titleOut: {
    duration: 0.5,
    ease: 'power3.in',
    staggerEach: 0.015,
    yPercent: -140,
  },
};

const NavbarLoaderNew = ({ onLoadingComplete }) => {
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const [showLoader, setShowLoader] = useState(true);
  const [showNavbarContent, setShowNavbarContent] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const loaderRef = useRef(null);
  const titleRef = useRef(null);
  const subtitleRef = useRef(null);
  const squareRef = useRef(null);
  const navbarRef = useRef(null);

  useEffect(() => {
    if (!titleRef.current || !subtitleRef.current) return;

    let rotationAnim = null;

    const applyColor = (chars) => {
      chars.forEach((char) => {
        char.style.color = isDarkMode ? 'white' : 'black';
      });
    };

    // Agranda la caja de recorte de cada máscara para que ascendentes y
    // descendentes no se corten con el interlineado apretado.
    const cushionMask = (chars) => {
      chars.forEach((char) => {
        const wrap = char.parentElement;
        if (!wrap) return;
        wrap.style.paddingTop = MASK_CUSHION;
        wrap.style.paddingBottom = MASK_CUSHION;
        wrap.style.marginTop = `-${MASK_CUSHION}`;
        wrap.style.marginBottom = `-${MASK_CUSHION}`;
      });
    };

    const splitTitle = (el) => {
      const split = new SplitText(el, {
        type: 'words,chars',
        mask: 'chars',
        wordsClass: 'word',
        charsClass: 'char',
      });
      const words = el.querySelectorAll('.word');
      words.forEach((word, index) => {
        if (index < words.length - 1) word.style.marginRight = '0.25em';
      });
      applyColor(split.chars);
      cushionMask(split.chars);
      return split;
    };

    const titleSplit = splitTitle(titleRef.current);
    const subtitleSplit = splitTitle(subtitleRef.current);

    gsap.set(titleSplit.chars, { yPercent: ANIM.titleIn.fromYPercent });
    gsap.set(subtitleSplit.chars, { yPercent: ANIM.titleIn.fromYPercent });

    // Rotación continua del cuadrado (misma lógica que NavbarLoader.js)
    const animateRotation = (element, duration) => {
      if (!element) return { stop: () => {} };

      let startTime = null;
      let animationId = null;

      const animate = (timestamp) => {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;

        const rotation = (elapsed / (duration * 1000)) * 360;
        if (element && element.style) {
          element.style.transform = `translate(-50%, -50%) rotate(${rotation}deg)`;
        }

        animationId = requestAnimationFrame(animate);
      };

      animationId = requestAnimationFrame(animate);

      return {
        stop: () => {
          if (animationId) cancelAnimationFrame(animationId);
        },
      };
    };

    // Movimiento del cuadrado hasta la esquina superior derecha del navbar
    // (idéntico a la transición final de NavbarLoader.js)
    const moveSquareToNavbar = () => {
      setIsTransitioning(true);

      setTimeout(() => {
        if (squareRef.current) {
          squareRef.current.style.transition = 'all 0.8s cubic-bezier(0.9, 0, 0.1, 1)';
          squareRef.current.style.top = '1.7rem';
        }
      }, 100);

      setTimeout(() => {
        if (squareRef.current) {
          squareRef.current.style.left = 'calc(100% - 1.5rem)';
          squareRef.current.style.transform = 'translate(-50%, -50%)';
        }
      }, 900);

      setTimeout(() => {
        setShowLoader(false);
        setShowNavbarContent(true);
        if (onLoadingComplete) {
          onLoadingComplete();
        }
      }, 1700);
    };

    const tl = gsap.timeline();

    // 1) Entrada de "Kiko Climent"
    tl.to(titleSplit.chars, {
      yPercent: 0,
      duration: ANIM.titleIn.duration,
      ease: ANIM.titleIn.ease,
      stagger: ANIM.titleIn.staggerEach,
      force3D: true,
    });

    // 2) Entrada de "Creative Frontend Developer"
    tl.to(
      subtitleSplit.chars,
      {
        yPercent: 0,
        duration: ANIM.titleIn.duration,
        ease: ANIM.titleIn.ease,
        stagger: ANIM.titleIn.staggerEach,
        force3D: true,
      },
      '-=0.5'
    );

    // 3) La línea baja se alarga y forma el cuadrado
    tl.to(
      squareRef.current,
      {
        height: '1rem',
        duration: 0.6,
        ease: 'power3.inOut',
      },
      '+=0.6'
    );

    // 4) El cuadrado ya formado empieza a girar
    tl.call(() => {
      rotationAnim = animateRotation(squareRef.current, 8);
    });

    // 5) Ambos títulos desaparecen con la misma máscara de texto
    tl.to(
      [...titleSplit.chars, ...subtitleSplit.chars],
      {
        yPercent: ANIM.titleOut.yPercent,
        duration: ANIM.titleOut.duration,
        ease: ANIM.titleOut.ease,
        stagger: ANIM.titleOut.staggerEach,
        force3D: true,
      },
      '+=1'
    );

    // 6) Solo queda el cuadrado: para de girar y viaja a la esquina del navbar
    tl.call(() => {
      if (rotationAnim) rotationAnim.stop();
      moveSquareToNavbar();
    }, [], '+=0.3');

    return () => {
      tl.kill();
      if (rotationAnim) rotationAnim.stop();
      if (titleSplit && titleSplit.revert) titleSplit.revert();
      if (subtitleSplit && subtitleSplit.revert) subtitleSplit.revert();
    };
  }, [onLoadingComplete, isDarkMode]);

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-black text-white' : 'bg-white text-black'} transition-colors duration-300`}>
      {/* Loader */}
      {showLoader && (
        <div
          ref={loaderRef}
          className="fixed top-0 left-0 w-full h-screen flex justify-center items-center z-50"
          style={{
            opacity: isTransitioning ? 0 : 1,
            transition: 'opacity 0.5s ease-out',
            pointerEvents: isTransitioning ? 'none' : 'auto',
          }}
        >
          <div
            className="grid items-center w-[90%] md:w-[85%] text-[clamp(1.0625rem,1.75vw,1.3125rem)] leading-[1]"
            style={{ gridTemplateColumns: '1fr 1rem 1fr', columnGap: '0.6rem' }}
          >
            <h1 ref={titleRef} className="flex justify-self-end whitespace-nowrap">
              Kiko Climent
            </h1>
            <div />
            <h2 ref={subtitleRef} className="flex justify-self-start whitespace-nowrap">
              Creative Frontend Developer
            </h2>
          </div>
        </div>
      )}

      {/* Cuadrado: nace como una línea baja y termina en la esquina del navbar */}
      <div
        ref={squareRef}
        onClick={!showLoader ? toggleDarkMode : undefined}
        onMouseEnter={() => !showLoader && setIsHovered(true)}
        onMouseLeave={() => !showLoader && setIsHovered(false)}
        className={`fixed w-4 border-2 ${isDarkMode ? 'border-white' : 'border-black'} bg-transparent z-[60]`}
        style={{
          top: '50%',
          left: '50%',
          height: 0,
          transform: `translate(-50%, -50%) rotate(${isHovered ? '180deg' : '0deg'})`,
          cursor: !showLoader ? 'pointer' : 'default',
          backgroundColor: isHovered
            ? (isDarkMode ? 'white' : 'black')
            : 'transparent',
          transition: 'background-color 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
        aria-label={isDarkMode ? 'Activar modo claro' : 'Activar modo oscuro'}
      />

      {/* Navbar */}
      <div
        ref={navbarRef}
        data-navbar
        className="flex top-4 left-4 right-4  z-50 text-[clamp(1.0625rem,1.75vw,1.3125rem)] leading-[1] absolute transition-opacity duration-500"
        style={{ opacity: showNavbarContent ? 1 : 0 }}
      >
        <div className="w-1/2 flex flex-col">
          <h1>Kiko Climent</h1>
          <h2>Portfolio 2026</h2>
        </div>
        <div className="w-1/2 flex flex-col">
          <p>Creative Frontend Developer</p>
          <p>climent.kiko@gmail.com</p>
          <p>(+49) 176 58260660</p>
        </div>
      </div>
    </div>
  );
};

export default NavbarLoaderNew;
