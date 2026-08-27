'use client';

import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { useDarkMode } from '@/contexts/DarkModeContext';

gsap.registerPlugin(SplitText);

// Mismo efecto "roll" que la versión de escritorio (johnnycarretes.com):
// cada carácter tiene una fila apilada por etapa (color === null -> oculto;
// color === string -> visible con ese color) dentro de una máscara de una
// línea. Avanzar de una etapa a la siguiente es mover el stack "-1em".
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

// Contacto: entra/sale con la MISMA animación de máscara por caracteres que
// el título del proyecto al abrir su detalle (FooterMobile.js -> ANIM.titleIn
// / ANIM.backOut) — yPercent 140 -> 0 al entrar, power4.out con stagger por
// carácter; al salir, yPercent 0 -> -140 con power3.in.
const CONTACT_ANIM = {
  in: { duration: 0.9, ease: 'power4.out', staggerEach: 0.03, fromYPercent: 140 },
  out: { duration: 0.45, ease: 'power3.in', staggerEach: 0.018, yPercent: -140 },
};
const MASK_CUSHION = '0.25em';

const renderRollStages = (text, charsRef, stages) => {
  charsRef.current = [];
  return text.split('').map((ch, i) => {
    // Un espacio " " como ÚNICO contenido de un inline-block colapsa a
    // ancho 0 (la máscara crea su propio "line box" interno, y ese espacio
    // queda a la vez al principio y al final de esa línea, así que el
    // motor de render lo recorta). Un NBSP no es un espacio "colapsable",
    // así que conserva su ancho — de ahí "KikoCliment" sin hueco entre
    // palabras.
    const glyph = ch === ' ' ? ' ' : ch;
    return (
      <span
        key={i}
        className="inline-block overflow-hidden"
        style={{ height: '1em', lineHeight: '1em', verticalAlign: 'bottom' }}
      >
        <span
          ref={(el) => {
            if (el) charsRef.current[i] = el;
          }}
          className="flex flex-col"
          style={{ lineHeight: '1em' }}
        >
          {stages.map((color, si) => (
            <span
              key={si}
              aria-hidden={si < stages.length - 1 ? 'true' : undefined}
              style={{ color: color === null ? 'transparent' : color, height: '1em', lineHeight: '1em' }}
            >
              {glyph}
            </span>
          ))}
        </span>
      </span>
    );
  });
};

// "Kiko Climent": K(0) i(1) k(2) o(3) " "(4) C(5) l(6) i(7) m(8) e(9) n(10) t(11)
// — la palabra "Climent" ocupa los índices 5 a 11.
const CLIMENT_START_INDEX = 5;
const CLIMENT_END_INDEX = 11;

const CONTACT_EMAIL = 'climent.kiko@gmail.com';

// showContact: true cuando la sección activa en móvil es "About" — la única
// vez que este email debe aparecer (en desktop ya vive siempre en la 2ª
// columna del navbar; aquí solo tiene sentido dentro de About, si no,
// quedaría redundante con el navbar fijo).
const NavbarLoaderMobNew = ({ onReady, showContact = false }) => {
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const [showLoader, setShowLoader] = useState(true);
  const [showNavbarContent, setShowNavbarContent] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const loaderRef = useRef(null);
  const titleRef = useRef(null); // <h1> "Kiko Climent" — para consultar sus hijos en vivo
  const titleCharsRef = useRef([]); // "Kiko Climent"
  const subtitleCharsRef = useRef([]); // "Portfolio 2026"
  const subtitle2CharsRef = useRef([]); // "Creative Frontend Developer"
  const squareRef = useRef(null);
  const squareAnchorRef = useRef(null);
  const square2Ref = useRef(null);
  const row2Ref = useRef(null);
  const row2SpacerRef = useRef(null);
  const navbarRef = useRef(null);
  const contactRef = useRef(null); // fila "contact climent.kiko@gmail.com" en el navbar final
  const contactLabelRef = useRef(null); // "contact"
  const contactEmailRef = useRef(null); // "climent.kiko@gmail.com"
  const contactSplitRef = useRef(null);
  const prevShowContactRef = useRef(false);

  // Editorial brutalista: un único acento activo (negro/blanco) a la vez,
  // el resto en gris — el color depende del modo claro/oscuro.
  const ACTIVE = isDarkMode ? '#ffffff' : '#000000';
  const INACTIVE = isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)';

  // "Kiko Climent": oculto -> negro -> gris -> negro (vuelve al final)
  const titleStages = [null, ACTIVE, INACTIVE, ACTIVE];
  // "Portfolio 2026": oculto -> negro -> gris (se queda en gris)
  const subtitleStages = [null, ACTIVE, INACTIVE];
  // "Creative Frontend Developer": oculto -> negro (se queda en negro, es la última)
  const subtitle2Stages = [null, ACTIVE];

  useEffect(() => {
    if (!titleCharsRef.current.length || !subtitleCharsRef.current.length || !subtitle2CharsRef.current.length) return;

    let rotationAnim = null;
    let rotationAnim2 = null;

    const allChars = [...titleCharsRef.current, ...subtitleCharsRef.current, ...subtitle2CharsRef.current];
    gsap.set(allChars, { y: '0em' });

    // 1) Medimos la palabra "Climent" (no solo la "C") en su posición
    // natural, ANTES de tocar nada más, y desplazamos la fila 2 con un
    // padding-left real para que el segundo cuadrado quede centrado bajo
    // esa palabra, con aire de sobra antes de "Creative Frontend
    // Developer". Un padding-left ensancha la fila 2 y, como el bloque
    // entero está centrado con flexbox, eso re-centra TODO el bloque
    // (incluida "Kiko Climent") — y es justo lo que queremos: el conjunto
    // debe quedar centrado en pantalla con la fila 2 ya indentada. Por eso
    // todas las medidas de anclaje (más abajo) se hacen DESPUÉS de este
    // paso, para reflejar la posición final ya recentrada.
    const climentStart = titleRef.current?.children[CLIMENT_START_INDEX];
    const climentEnd = titleRef.current?.children[CLIMENT_END_INDEX];
    if (climentStart && climentEnd && row2Ref.current && row2SpacerRef.current) {
      const startRect = climentStart.getBoundingClientRect();
      const endRect = climentEnd.getBoundingClientRect();
      const climentCenter = (startRect.left + endRect.right) / 2;

      const spacerRect = row2SpacerRef.current.getBoundingClientRect();
      const spacerCenter = spacerRect.left + spacerRect.width / 2;
      const shift = climentCenter - spacerCenter;
      row2Ref.current.style.paddingLeft = `${Math.max(shift, 0)}px`;
    }

    // 2) El cuadrado principal vive fuera del flujo (para poder viajar
    // libremente a la esquina más tarde), así que lo anclamos a la
    // posición real de su celda (entre "Kiko Climent" y "Portfolio 2026")
    // ya con el bloque recentrado, pero invisible: aparece con un fade
    // como primer paso de la secuencia.
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

    // 3) El segundo cuadrado: su destino final es sencillamente donde ha
    // quedado el hueco reservado (row2SpacerRef) tras el recentrado de
    // arriba — ya no depende de volver a medir la "C". Arranca fuera de
    // pantalla por la izquierda y se anima hacia ese punto más abajo en
    // el timeline.
    let square2Target = null;
    if (row2SpacerRef.current) {
      const finalSpacerRect = row2SpacerRef.current.getBoundingClientRect();
      square2Target = {
        x: finalSpacerRect.left + finalSpacerRect.width / 2,
        y: finalSpacerRect.top + finalSpacerRect.height / 2,
      };
      square2Ref.current.style.top = `${square2Target.y}px`;
    }
    square2Ref.current.style.left = '-100px';
    square2Ref.current.style.transform = 'translate(-50%, -50%)';
    // Ya está fuera de pantalla (left: -100px) antes de este punto, así que
    // es seguro devolverle su opacidad — el JSX lo arranca en 0 solo para
    // cubrir el instante entre el primer pintado y este useEffect.
    gsap.set(square2Ref.current, { opacity: 1 });

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
    // navbar móvil — mismo tamaño y posición que en NavbarMobile.js. El
    // segundo se desvanece justo al llegar y solo queda el primero, como
    // toggle final.
    const moveSquaresToNavbar = () => {
      setIsTransitioning(true);

      setTimeout(() => {
        if (squareRef.current) {
          squareRef.current.style.transition = 'all 0.8s cubic-bezier(0.9, 0, 0.1, 1)';
          squareRef.current.style.top = 'calc(1.7rem - 2px)';
        }
        if (square2Ref.current) {
          square2Ref.current.style.transition = 'top 0.8s cubic-bezier(0.9, 0, 0.1, 1), left 0.8s cubic-bezier(0.9, 0, 0.1, 1)';
          square2Ref.current.style.top = 'calc(1.7rem - 2px)';
        }
      }, 100);

      setTimeout(() => {
        if (squareRef.current) {
          squareRef.current.style.left = 'calc(100% - 1.4rem)';
          squareRef.current.style.transform = 'translate(-50%, -50%)';
        }
        if (square2Ref.current) {
          square2Ref.current.style.left = 'calc(100% - 1.4rem)';
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
        if (onReady) {
          onReady();
        }
      }, 2000);
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

    // 3) "Kiko Climent" rueda a gris MIENTRAS "Portfolio 2026" entra en
    //    negro — con un poco de retraso entre ambos.
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

    // 4) "Creative Frontend Developer" entra rodando en negro, solapándose
    //    con la cola del roll anterior (el segundo cuadrado llega más
    //    tarde, junto al cambio de color de "Portfolio 2026").
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

    // 5) "Kiko Climent" vuelve a negro MIENTRAS "Portfolio 2026" rueda a
    //    gris — simultáneo pero con un poco de retraso entre ambos. El
    //    segundo cuadrado entra deslizándose desde fuera de la pantalla a
    //    la vez que "Portfolio 2026" rueda a gris.
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
    // El segundo cuadrado entra deslizándose desde fuera de la pantalla
    // hasta el hueco reservado en la fila 2 (ya calculado arriba, en el
    // paso 3), a la vez que "Portfolio 2026" rueda a gris.
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

    // 7) Las tres líneas desaparecen (siguen rodando hacia arriba y salen)
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
  }, [onReady, isDarkMode]);

  // Máscara para que la animación por caracteres no recorte ascendentes ni
  // descendentes (misma técnica que FooterMobile.js -> cushionMask).
  const cushionMaskChars = (chars) => {
    chars.forEach((char) => {
      const wrap = char.parentElement;
      if (!wrap) return;
      wrap.style.paddingTop = MASK_CUSHION;
      wrap.style.paddingBottom = MASK_CUSHION;
      wrap.style.marginTop = `-${MASK_CUSHION}`;
      wrap.style.marginBottom = `-${MASK_CUSHION}`;
    });
  };

  // Entrada/salida del email de contacto — solo visible en la sección About
  // (showContact llega del padre). Misma animación de máscara por caracteres
  // que el título del proyecto al entrar en su detalle: "contact" en negro/
  // blanco (como el resto del navbar) y el email en el mismo gris apagado
  // que la descripción de About, pero ambos ruedan juntos como una sola línea.
  useEffect(() => {
    if (!showNavbarContent) return;
    if (showContact === prevShowContactRef.current) return;
    prevShowContactRef.current = showContact;

    const labelEl = contactLabelRef.current;
    const emailEl = contactEmailRef.current;
    const rowEl = contactRef.current;
    if (!labelEl || !emailEl || !rowEl) return;

    if (showContact) {
      gsap.set(rowEl, { display: 'block' });
      const labelSplit = new SplitText(labelEl, { type: 'chars', mask: 'chars', charsClass: 'char' });
      const emailSplit = new SplitText(emailEl, { type: 'chars', mask: 'chars', charsClass: 'char' });
      contactSplitRef.current = { label: labelSplit, email: emailSplit };

      labelSplit.chars.forEach((char) => {
        char.style.color = isDarkMode ? '#ffffff' : '#000000';
      });
      emailSplit.chars.forEach((char) => {
        char.style.color = isDarkMode ? '#9ca3af' : '#6b7280';
      });
      const allChars = [...labelSplit.chars, ...emailSplit.chars];
      cushionMaskChars(allChars);

      gsap.fromTo(
        allChars,
        { yPercent: CONTACT_ANIM.in.fromYPercent },
        {
          yPercent: 0,
          duration: CONTACT_ANIM.in.duration,
          ease: CONTACT_ANIM.in.ease,
          stagger: CONTACT_ANIM.in.staggerEach,
          force3D: true,
        }
      );
    } else {
      const split = contactSplitRef.current;
      if (!split) {
        gsap.set(rowEl, { display: 'none' });
        return;
      }
      const allChars = [...split.label.chars, ...split.email.chars];
      gsap.to(allChars, {
        yPercent: CONTACT_ANIM.out.yPercent,
        duration: CONTACT_ANIM.out.duration,
        ease: CONTACT_ANIM.out.ease,
        stagger: CONTACT_ANIM.out.staggerEach,
        force3D: true,
        onComplete: () => {
          gsap.set(rowEl, { display: 'none' });
          split.label.revert();
          split.email.revert();
          contactSplitRef.current = null;
        },
      });
    }
  }, [showContact, showNavbarContent, isDarkMode]);

  // Si cambia el modo claro/oscuro mientras el contacto ya está visible,
  // recolorea sus caracteres sin relanzar la animación de entrada.
  useEffect(() => {
    const split = contactSplitRef.current;
    if (!split) return;
    split.label.chars?.forEach((char) => {
      char.style.color = isDarkMode ? '#ffffff' : '#000000';
    });
    split.email.chars?.forEach((char) => {
      char.style.color = isDarkMode ? '#9ca3af' : '#6b7280';
    });
  }, [isDarkMode]);

  return (
    <div
      className={`${isDarkMode ? 'text-white' : 'text-black'} transition-colors duration-300`}
      style={{ height: '100svh' }}
    >
      {/* Loader */}
      {showLoader && (
        <div
          ref={loaderRef}
          className="fixed top-0 left-0 w-full flex items-center justify-center z-50"
          style={{
            height: '100svh',
            opacity: isTransitioning ? 0 : 1,
            transition: 'opacity 0.5s ease-out',
            pointerEvents: isTransitioning ? 'none' : 'auto',
            backgroundColor: isDarkMode ? 'black' : 'white',
          }}
        >
          {/*
            Fila 1: "Kiko Climent" [cuadrado 1] "Portfolio 2026", todo en
            una línea (como NavbarLoaderNew5.js pero con los textos en este
            orden). Fila 2: [cuadrado 2] "Creative Frontend Developer",
            desplazada con un padding-left real (no transform) para que el
            cuadrado 2 quede centrado bajo la palabra "Climent" — al
            ensanchar la fila 2, el bloque entero (centrado con flexbox) se
            re-centra en pantalla, que es justo el efecto buscado. Por eso
            las posiciones de ambos cuadrados se calculan DESPUÉS de fijar
            ese padding (ver el efecto: primero el padding, luego
            anchorTo/square2Target). Los cuadrados reales son overlays
            fixed anclados por medición para poder viajar libres después.
            leading-[1] durante la carga (no 1.1) para que la máscara de
            una línea no deje asomar la fila de al lado; gap-y-2 (en vez de
            gap-y-1) para que el cuadrado de la fila 2, al girar, no invada
            visualmente la fila 1.
          */}
          <div className="flex flex-col items-start gap-y-2 text-[clamp(1.0625rem,1.75vw,1.3125rem)] font-semibold leading-[1]">
            <div className="flex items-center whitespace-nowrap py-1.5">
              <h1 ref={titleRef} className="flex" aria-label="Kiko Climent">
                {renderRollStages('Kiko Climent', titleCharsRef, titleStages)}
              </h1>
              <div ref={squareAnchorRef} className="w-3 h-3" style={{ visibility: 'hidden', marginLeft: '1.25rem', marginRight: '1.25rem' }} />
              <h2 className="flex" aria-label="Portfolio 2026">
                {renderRollStages('Portfolio 2026', subtitleCharsRef, subtitleStages)}
              </h2>
            </div>

            <div ref={row2Ref} className="flex items-center whitespace-nowrap py-1.5">
              <div ref={row2SpacerRef} className="w-3 h-3" style={{ visibility: 'hidden', marginRight: '1rem' }} />
              <h3 className="flex" aria-label="Creative Frontend Developer">
                {renderRollStages('Creative Frontend Developer', subtitle2CharsRef, subtitle2Stages)}
              </h3>
            </div>
          </div>
        </div>
      )}

      {/* Cuadrado principal: mismo tamaño y posición final que NavbarMobile.js */}
      <div
        ref={squareRef}
        onClick={!showLoader ? toggleDarkMode : undefined}
        onMouseEnter={() => !showLoader && setIsHovered(true)}
        onMouseLeave={() => !showLoader && setIsHovered(false)}
        className={`fixed w-3 h-3 border-[1.5px] ${isDarkMode ? 'border-white' : 'border-black'} bg-transparent z-[60] font-bold`}
        style={{
          // opacity: 0 desde el primer render — hasta que el useEffect mide
          // y ancla su posición (anchorTo), este div "fixed" no tiene
          // top/left propios, así que el navegador lo coloca en su posición
          // estática por defecto (esquina superior izquierda) durante el
          // primer pintado. Sin este opacity inicial se ve ese flash antes
          // de que el cuadrado salte a su sitio real.
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

      {/* Segundo cuadrado: entra deslizándose desde fuera de pantalla, viaja junto al principal y se desvanece al llegar.
          Mismo motivo que el cuadrado principal: opacity 0 desde el primer render para evitar el flash en la esquina
          antes de que el useEffect le fije top/left. */}
      <div
        ref={square2Ref}
        className={`fixed w-3 h-3 border-[1.5px] ${isDarkMode ? 'border-white' : 'border-black'} bg-transparent z-[60] pointer-events-none`}
        style={{ opacity: 0, transform: 'translate(-50%, -50%)' }}
      />

      {/* Navbar: layout final idéntico a NavbarMobile.js + 4ª línea de contacto (solo About) */}
      <div
        ref={navbarRef}
        className="flex top-4 left-4 right-4 z-50 text-[clamp(1.0625rem,1.75vw,1.3125rem)] font-semibold leading-[1.1] absolute transition-opacity duration-500"
        style={{ opacity: showNavbarContent ? 1 : 0 }}
      >
        <div className="flex flex-col gap-y-1">
          <h1 className="py-1.5">Kiko Climent</h1>
          <h2 className="py-1.5">Portfolio 2026</h2>
          <h2 className="py-1.5">Creative Frontend Developer</h2>
          <div ref={contactRef} className="py-1.5" style={{ display: 'none' }}>
            <span ref={contactLabelRef} style={{ color: isDarkMode ? 'white' : 'black' }}>
              contact
            </span>{' '}
            <a
              ref={contactEmailRef}
              href={`mailto:${CONTACT_EMAIL}`}
              className="lowercase hover:opacity-80 transition-opacity"
              style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}
            >
              {CONTACT_EMAIL}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NavbarLoaderMobNew;
