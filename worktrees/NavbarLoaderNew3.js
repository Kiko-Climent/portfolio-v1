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
  // Entrada de "Kiko Climent", "Creative Frontend Developer" y "Portfolio 2026"
  titleIn: {
    duration: 0.9,
    ease: 'power4.out',
    staggerEach: 0.03,
    fromYPercent: 140,
  },
  // Salida de los tres títulos antes de que los cuadrados viajen a la esquina
  titleOut: {
    duration: 0.5,
    ease: 'power3.in',
    staggerEach: 0.015,
    yPercent: -140,
  },
};

const NavbarLoaderNew3 = ({ onLoadingComplete }) => {
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const [showLoader, setShowLoader] = useState(true);
  const [showNavbarContent, setShowNavbarContent] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const loaderRef = useRef(null);
  const titleRef = useRef(null);
  const subtitleRef = useRef(null);
  const subtitle2Ref = useRef(null);
  const squareRef = useRef(null);
  const squareAnchorRef = useRef(null);
  const square2Ref = useRef(null);
  const square2AnchorRef = useRef(null);
  const navbarRef = useRef(null);

  useEffect(() => {
    if (!titleRef.current || !subtitleRef.current || !subtitle2Ref.current) return;

    let rotationAnim = null;
    let rotationAnim2 = null;

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
    const subtitle2Split = splitTitle(subtitle2Ref.current);

    gsap.set(titleSplit.chars, { yPercent: ANIM.titleIn.fromYPercent });
    gsap.set(subtitleSplit.chars, { yPercent: ANIM.titleIn.fromYPercent });
    gsap.set(subtitle2Split.chars, { yPercent: ANIM.titleIn.fromYPercent });

    // El cuadrado principal vive fuera del grid (para poder viajar libremente
    // a la esquina más tarde), así que lo anclamos a la posición real de su
    // celda desde el primer frame, pero invisible: aparece con un fade como
    // primer paso de la secuencia.
    const anchorTo = (anchorEl, squareEl) => {
      if (!anchorEl || !squareEl) return null;
      const anchorRect = anchorEl.getBoundingClientRect();
      const centerX = anchorRect.left + anchorRect.width / 2;
      const centerY = anchorRect.top + anchorRect.height / 2;
      squareEl.style.top = `${centerY}px`;
      squareEl.style.left = `${centerX}px`;
      squareEl.style.transform = 'translate(-50%, -50%)';
      return { centerX, centerY };
    };
    anchorTo(squareAnchorRef.current, squareRef.current);
    gsap.set(squareRef.current, { opacity: 0 });

    // El segundo cuadrado entra deslizándose desde fuera del lado izquierdo
    // de la pantalla hasta su posición real (bajo la "C" de "Creative"), así
    // que solo fijamos su Y de destino ahora; la X arranca fuera de pantalla
    // y se anima más abajo en el timeline.
    let square2Target = null;
    if (square2AnchorRef.current && square2Ref.current) {
      const anchorRect = square2AnchorRef.current.getBoundingClientRect();
      square2Target = {
        x: anchorRect.left + anchorRect.width / 2,
        y: anchorRect.top + anchorRect.height / 2,
      };
      square2Ref.current.style.top = `${square2Target.y}px`;
      square2Ref.current.style.left = '-100px';
      square2Ref.current.style.transform = 'translate(-50%, -50%)';
    }

    // Rotación continua de un cuadrado (misma lógica que NavbarLoader.js)
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

    // Ambos cuadrados viajan juntos hasta la esquina superior derecha del
    // navbar; el segundo se desvanece justo al llegar y solo queda el
    // primero, como toggle final (idéntico a NavbarLoader.js original).
    const moveSquaresToNavbar = () => {
      setIsTransitioning(true);

      setTimeout(() => {
        if (squareRef.current) {
          squareRef.current.style.transition = 'all 0.8s cubic-bezier(0.9, 0, 0.1, 1)';
          squareRef.current.style.top = '1.7rem';
        }
        if (square2Ref.current) {
          square2Ref.current.style.transition = 'top 0.8s cubic-bezier(0.9, 0, 0.1, 1), left 0.8s cubic-bezier(0.9, 0, 0.1, 1)';
          square2Ref.current.style.top = '1.7rem';
        }
      }, 100);

      setTimeout(() => {
        if (squareRef.current) {
          squareRef.current.style.left = 'calc(100% - 1.5rem)';
          squareRef.current.style.transform = 'translate(-50%, -50%)';
        }
        if (square2Ref.current) {
          square2Ref.current.style.left = 'calc(100% - 1.5rem)';
          square2Ref.current.style.transform = 'translate(-50%, -50%)';
        }
      }, 900);

      // El segundo cuadrado se desvanece justo al llegar a la esquina.
      setTimeout(() => {
        if (square2Ref.current) {
          square2Ref.current.style.transition = 'opacity 0.3s ease-out';
          square2Ref.current.style.opacity = '0';
        }
      }, 1700);

      setTimeout(() => {
        setShowLoader(false);
        setShowNavbarContent(true);
        if (onLoadingComplete) {
          onLoadingComplete();
        }
      }, 2000);
    };

    const tl = gsap.timeline();

    // 1) Aparece el primer cuadrado
    tl.to(squareRef.current, {
      opacity: 1,
      duration: 0.35,
      ease: 'power2.out',
    });

    // 2) Entrada de "Kiko Climent"
    tl.to(
      titleSplit.chars,
      {
        yPercent: 0,
        duration: ANIM.titleIn.duration,
        ease: ANIM.titleIn.ease,
        stagger: ANIM.titleIn.staggerEach,
        force3D: true,
      },
      '+=0.1'
    );

    // 3) Entrada de "Creative Frontend Developer"
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

    // 4) El segundo cuadrado entra deslizándose desde fuera de la pantalla
    //    (izquierda) hasta su sitio, bajo la "C" de "Creative"
    if (square2Target) {
      tl.to(
        square2Ref.current,
        {
          left: square2Target.x,
          duration: 0.8,
          ease: 'power3.out',
        },
        '+=0.2'
      );
    }

    // 5) Entrada de "Portfolio 2026", justo cuando llega el segundo cuadrado
    tl.to(
      subtitle2Split.chars,
      {
        yPercent: 0,
        duration: ANIM.titleIn.duration,
        ease: ANIM.titleIn.ease,
        stagger: ANIM.titleIn.staggerEach,
        force3D: true,
      },
      '-=0.3'
    );

    // 6) Tras una pausa, ambos cuadrados empiezan a girar sobre su eje
    tl.call(() => {
      rotationAnim = animateRotation(squareRef.current, 8);
      rotationAnim2 = animateRotation(square2Ref.current, 8);
    }, [], '+=0.6');

    // 7) Los tres títulos desaparecen
    tl.to(
      [...titleSplit.chars, ...subtitleSplit.chars, ...subtitle2Split.chars],
      {
        yPercent: ANIM.titleOut.yPercent,
        duration: ANIM.titleOut.duration,
        ease: ANIM.titleOut.ease,
        stagger: ANIM.titleOut.staggerEach,
        force3D: true,
      },
      '+=0.8'
    );

    // 8) Solo quedan los dos cuadrados: paran de girar y viajan juntos a la esquina
    tl.call(() => {
      if (rotationAnim) rotationAnim.stop();
      if (rotationAnim2) rotationAnim2.stop();
      moveSquaresToNavbar();
    }, [], '+=0.3');

    return () => {
      tl.kill();
      if (rotationAnim) rotationAnim.stop();
      if (rotationAnim2) rotationAnim2.stop();
      if (titleSplit && titleSplit.revert) titleSplit.revert();
      if (subtitleSplit && subtitleSplit.revert) subtitleSplit.revert();
      if (subtitle2Split && subtitle2Split.revert) subtitle2Split.revert();
    };
  }, [onLoadingComplete, isDarkMode]);

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-black text-white' : 'bg-white text-black'} transition-colors duration-300`}>
      {/* Loader */}
      {showLoader && (
        <div
          ref={loaderRef}
          className="fixed top-0 left-0 w-full h-screen flex items-center justify-center z-50"
          style={{
            opacity: isTransitioning ? 0 : 1,
            transition: 'opacity 0.5s ease-out',
            pointerEvents: isTransitioning ? 'none' : 'auto',
          }}
        >
          {/*
            Mismo layout que BrainStorm.js: grid de 3 columnas (auto) x 2 filas.
            Fila 1: nombre | cuadrado (anchor) | título.
            Fila 2: vacío | vacío | [cuadrado (anchor) + "Portfolio 2026"] juntos,
            así el segundo cuadrado queda pegado a la "C" de "Creative".
            Los cuadrados reales son overlays fixed anclados a estas celdas
            (ver anchorTo / square2Target en el efecto): el primero aparece
            con un fade en su sitio, el segundo entra deslizándose desde
            fuera de la pantalla por la izquierda.
          */}
          <div className="grid grid-cols-[auto_auto_auto] items-center gap-x-1 gap-y-0 text-[clamp(1.0625rem,1.75vw,1.3125rem)] leading-[1]">
            <h1 ref={titleRef} className="flex whitespace-nowrap">
              Kiko Climent
            </h1>
            <div ref={squareAnchorRef} className="w-4 h-4" style={{ visibility: 'hidden' }} />
            <h2 ref={subtitleRef} className="flex whitespace-nowrap">
              Creative Frontend Developer
            </h2>

            <div />
            <div />
            <div className="flex items-center gap-1">
              <div ref={square2AnchorRef} className="w-4 h-4" style={{ visibility: 'hidden' }} />
              <h3 ref={subtitle2Ref} className="flex whitespace-nowrap">
                Portfolio 2026
              </h3>
            </div>
          </div>
        </div>
      )}

      {/* Cuadrado principal: visible desde el inicio, termina como toggle en el navbar */}
      <div
        ref={squareRef}
        onClick={!showLoader ? toggleDarkMode : undefined}
        onMouseEnter={() => !showLoader && setIsHovered(true)}
        onMouseLeave={() => !showLoader && setIsHovered(false)}
        className={`fixed w-4 h-4 border-2 ${isDarkMode ? 'border-white' : 'border-black'} bg-transparent z-[60]`}
        style={{
          transform: `translate(-50%, -50%) rotate(${isHovered ? '180deg' : '0deg'})`,
          cursor: !showLoader ? 'pointer' : 'default',
          backgroundColor: isHovered
            ? (isDarkMode ? 'white' : 'black')
            : 'transparent',
          transition: 'background-color 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
        aria-label={isDarkMode ? 'Activar modo claro' : 'Activar modo oscuro'}
      />

      {/* Segundo cuadrado: entra deslizándose desde fuera de pantalla, viaja junto al principal y se desvanece al llegar */}
      <div
        ref={square2Ref}
        className={`fixed w-4 h-4 border-2 ${isDarkMode ? 'border-white' : 'border-black'} bg-transparent z-[60] pointer-events-none`}
        style={{ transform: 'translate(-50%, -50%)' }}
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

export default NavbarLoaderNew3;
