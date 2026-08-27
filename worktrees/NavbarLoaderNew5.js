'use client';

import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { useDarkMode } from '@/contexts/DarkModeContext';

// Efecto "roll" tipo johnnycarretes.com, generalizado a N etapas por
// carácter: cada carácter tiene una fila apilada por etapa (color === null
// -> invisible/oculto; color === string -> visible con ese color), dentro
// de una máscara de una línea (overflow hidden). Avanzar de una etapa a la
// siguiente es simplemente mover el stack "-1em" hacia arriba — por eso el
// timeline solo usa valores relativos (y: '-=1em'), nunca absolutos.
const ROLL = {
  inDuration: 0.85,
  inEase: 'expo.out',
  inStagger: 0.035,
  colorDuration: 0.7,
  colorEase: 'power3.inOut',
  colorStagger: 0.02,
  outDuration: 0.5,
  outEase: 'power3.in',
  outStagger: 0.018,
};

// Renderiza un texto como spans "roll" con una etapa de color por fila.
// `stages` es un array de colores (o null para la etapa invisible inicial),
// en el orden en el que el texto debe pasar por ellas.
const renderRollStages = (text, charsRef, stages) => {
  charsRef.current = [];
  return text.split('').map((ch, i) => {
    const glyph = ch === ' ' ? ' ' : ch;
    return (
      <span
        key={i}
        className="inline-block overflow-hidden"
        style={{ height: '1em', verticalAlign: 'bottom' }}
      >
        <span
          ref={(el) => {
            if (el) charsRef.current[i] = el;
          }}
          className="flex flex-col"
        >
          {stages.map((color, si) => (
            <span
              key={si}
              aria-hidden={si < stages.length - 1 ? 'true' : undefined}
              style={{ color: color === null ? 'transparent' : color }}
            >
              {glyph}
            </span>
          ))}
        </span>
      </span>
    );
  });
};

const NavbarLoaderNew5 = ({ onLoadingComplete }) => {
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const [showLoader, setShowLoader] = useState(true);
  const [showNavbarContent, setShowNavbarContent] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const loaderRef = useRef(null);
  const titleCharsRef = useRef([]);
  const subtitleCharsRef = useRef([]);
  const subtitle2CharsRef = useRef([]);
  const squareRef = useRef(null);
  const squareAnchorRef = useRef(null);
  const square2Ref = useRef(null);
  const square2AnchorRef = useRef(null);
  const navbarRef = useRef(null);

  // Editorial brutalista: un único acento activo (negro/blanco) a la vez,
  // el resto en gris — el color depende del modo claro/oscuro.
  const ACTIVE = isDarkMode ? '#ffffff' : '#000000';
  const INACTIVE = isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)';

  // "Kiko Climent": oculto -> negro -> gris -> negro (vuelve al final)
  const titleStages = [null, ACTIVE, INACTIVE, ACTIVE];
  // "Creative Frontend Developer": oculto -> negro -> gris (se queda en gris)
  const subtitleStages = [null, ACTIVE, INACTIVE];
  // "Portfolio 2026": oculto -> negro (se queda en negro)
  const subtitle2Stages = [null, ACTIVE];

  useEffect(() => {
    if (!titleCharsRef.current.length || !subtitleCharsRef.current.length || !subtitle2CharsRef.current.length) return;

    let rotationAnim = null;
    let rotationAnim2 = null;

    const allChars = [...titleCharsRef.current, ...subtitleCharsRef.current, ...subtitle2CharsRef.current];
    gsap.set(allChars, { y: '0em' });

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
      // Ya está fuera de pantalla (left: -100px) antes de este punto, así
      // que es seguro devolverle su opacidad — el JSX lo arranca en 0 solo
      // para cubrir el instante entre el primer pintado y este useEffect.
      gsap.set(square2Ref.current, { opacity: 1 });
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
    // navbar. El segundo va relleno (ver JSX) — al llegar y solaparse con el
    // primero, la unión se ve como un único cuadrado negro, insinuando que
    // ese es el "botón" de modo oscuro. Se queda así hasta que aparece el
    // navbar final: en ese instante se vacía de color (misma transición que
    // el hover del toggle) y justo después se desvanece, dejando al primer
    // cuadrado — ahora sí, el toggle real — en su estado normal.
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

      setTimeout(() => {
        setShowLoader(false);
        setShowNavbarContent(true);
        // Se vacía de color justo cuando aparece el navbar — misma curva que
        // el fill al pasar el ratón por encima del toggle antes de esto.
        if (square2Ref.current) {
          square2Ref.current.style.transition = 'background-color 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
          square2Ref.current.style.backgroundColor = 'transparent';
        }
        if (onLoadingComplete) {
          onLoadingComplete();
        }
      }, 2000);

      // Una vez ya se vació de color (300ms), el segundo cuadrado desaparece
      // del todo — solo queda el primero como toggle real.
      setTimeout(() => {
        if (square2Ref.current) {
          square2Ref.current.style.transition = 'opacity 0.3s ease-out';
          square2Ref.current.style.opacity = '0';
        }
      }, 2350);
    };

    const tl = gsap.timeline();

    // 1) Aparece el primer cuadrado
    tl.to(squareRef.current, {
      opacity: 1,
      duration: 0.45,
      ease: 'power2.out',
    });

    // 2) "Kiko Climent" entra rodando: oculto -> negro
    tl.to(
      titleCharsRef.current,
      {
        y: '-=1em',
        duration: ROLL.inDuration,
        ease: ROLL.inEase,
        stagger: ROLL.inStagger,
      },
      '+=0.15'
    );

    // 3) "Kiko Climent" rueda a gris MIENTRAS "Creative Frontend Developer"
    //    entra rodando en negro — con un poco de retraso entre ambos.
    tl.addLabel('dim1', '+=0.35');
    tl.to(
      titleCharsRef.current,
      {
        y: '-=1em',
        duration: ROLL.colorDuration,
        ease: ROLL.colorEase,
        stagger: ROLL.colorStagger,
      },
      'dim1'
    );
    tl.to(
      subtitleCharsRef.current,
      {
        y: '-=1em',
        duration: ROLL.inDuration,
        ease: ROLL.inEase,
        stagger: ROLL.inStagger,
      },
      'dim1+=0.18'
    );

    // 4) "Portfolio 2026" entra rodando en negro, solapándose con la cola
    //    de los rolls anteriores (el segundo cuadrado llega más tarde,
    //    junto al cambio de color de "Creative Frontend Developer").
    tl.to(
      subtitle2CharsRef.current,
      {
        y: '-=1em',
        duration: ROLL.inDuration,
        ease: ROLL.inEase,
        stagger: ROLL.inStagger,
      },
      '-=1.2'
    );

    // 5) "Kiko Climent" vuelve a negro MIENTRAS "Creative Frontend Developer"
    //    rueda a gris — simultáneo pero con un poco de retraso entre ambos.
    //    El segundo cuadrado entra deslizándose desde fuera de la pantalla
    //    a la vez que "Creative Frontend Developer" rueda a gris.
    tl.addLabel('dim2', '+=0.5');
    tl.to(
      titleCharsRef.current,
      {
        y: '-=1em',
        duration: ROLL.colorDuration,
        ease: ROLL.colorEase,
        stagger: ROLL.colorStagger,
      },
      'dim2'
    );
    tl.to(
      subtitleCharsRef.current,
      {
        y: '-=1em',
        duration: ROLL.colorDuration,
        ease: ROLL.colorEase,
        stagger: ROLL.colorStagger,
      },
      'dim2+=0.18'
    );
    if (square2Target) {
      tl.to(
        square2Ref.current,
        {
          left: square2Target.x,
          duration: 0.85,
          ease: 'expo.out',
        },
        'dim2+=0.18'
      );
    }

    // 6) Tras una pausa, ambos cuadrados empiezan a girar sobre su eje
    tl.call(() => {
      rotationAnim = animateRotation(squareRef.current, 8);
      rotationAnim2 = animateRotation(square2Ref.current, 8);
    }, [], '+=0.7');

    // 7) Los tres títulos desaparecen (siguen rodando hacia arriba y salen)
    tl.to(
      allChars,
      {
        y: '-=1em',
        duration: ROLL.outDuration,
        ease: ROLL.outEase,
        stagger: ROLL.outStagger,
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
    };
    // Ojo: NO añadir isDarkMode aquí. Este efecto no lo usa en ningún punto
    // de su cuerpo (los colores de titleStages/subtitleStages ya se
    // recalculan en cada render normal), pero si se incluye como
    // dependencia, cada vez que se pulsa el cuadrado para cambiar de modo
    // claro/oscuro (ya con el navbar terminado) este efecto se relanza
    // entero — reconstruyendo y disparando otra vez la timeline completa,
    // incluido el segundo cuadrado viajando desde fuera de pantalla hasta
    // la esquina, por encima del navbar ya en su sitio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onLoadingComplete]);

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

            Cada texto rueda por varias etapas de color (ver titleStages /
            subtitleStages / subtitle2Stages): null = oculto, luego negro,
            luego gris — un único acento activo a la vez, estética editorial.
          */}
          <div className="grid grid-cols-[auto_auto_auto] items-center gap-x-1 gap-y-0 text-[clamp(1.0625rem,1.75vw,1.3125rem)] leading-[1]">
            <h1 className="flex whitespace-nowrap" aria-label="Kiko Climent">
              {renderRollStages('Kiko Climent', titleCharsRef, titleStages)}
            </h1>
            <div ref={squareAnchorRef} className="w-4 h-4" style={{ visibility: 'hidden' }} />
            <h2 className="flex whitespace-nowrap" aria-label="Creative Frontend Developer">
              {renderRollStages('Creative Frontend Developer', subtitleCharsRef, subtitleStages)}
            </h2>

            <div />
            <div />
            <div className="flex items-center gap-1">
              <div ref={square2AnchorRef} className="w-4 h-4" style={{ visibility: 'hidden' }} />
              <h3 className="flex whitespace-nowrap" aria-label="Portfolio 2026">
                {renderRollStages('Portfolio 2026', subtitle2CharsRef, subtitle2Stages)}
              </h3>
            </div>
          </div>
        </div>
      )}

      {/* Cuadrado principal: visible desde el inicio, termina como toggle en el navbar.
          opacity: 0 desde el primer render — hasta que el useEffect mide y ancla su
          posición (anchorTo), este div "fixed" no tiene top/left propios, así que el
          navegador lo coloca en su posición estática por defecto (esquina superior
          izquierda) durante el primer pintado. Sin este opacity inicial se ve ese
          flash antes de que el cuadrado salte a su sitio real. */}
      <div
        ref={squareRef}
        onClick={!showLoader ? toggleDarkMode : undefined}
        onMouseEnter={() => !showLoader && setIsHovered(true)}
        onMouseLeave={() => !showLoader && setIsHovered(false)}
        className={`fixed w-4 h-4 border-2 ${isDarkMode ? 'border-white' : 'border-black'} bg-transparent z-[60]`}
        style={{
          opacity: 0,
          transform: `translate(-50%, -50%) rotate(${isHovered ? '180deg' : '0deg'})`,
          cursor: !showLoader ? 'pointer' : 'default',
          backgroundColor: isHovered
            ? (isDarkMode ? 'white' : 'black')
            : 'transparent',
          transition: 'background-color 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
        aria-label={isDarkMode ? 'Activar modo claro' : 'Activar modo oscuro'}
      />

      {/* Segundo cuadrado: entra deslizándose desde fuera de pantalla ya relleno (conceptualmente es el
          toggle "en negro"), viaja junto al principal y al llegar la unión de ambos se ve como un único
          cuadrado negro. opacity 0 desde el primer render por el mismo motivo que el cuadrado principal:
          evitar el flash en la esquina antes de que el useEffect le fije top/left. */}
      <div
        ref={square2Ref}
        className={`fixed w-4 h-4 border-2 ${isDarkMode ? 'border-white' : 'border-black'} z-[60] pointer-events-none`}
        style={{ opacity: 0, backgroundColor: isDarkMode ? 'white' : 'black', transform: 'translate(-50%, -50%)' }}
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

export default NavbarLoaderNew5;
