'use client';

import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { useDarkMode } from '@/contexts/DarkModeContext';
import RollingCounter from '@/components/mobile/RollingCounter';
import { PROJECT_NAME } from '@/components/data/grid';
import { sliderBus } from '@/lib/sliderBus';
import { indexHandoff } from '@/lib/indexHandoff';

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
  // Cuando el Index se abre encima del About: salida corta (las filas de contacto
  // quedan justo donde entran los títulos del Index) y, al cerrarlo, entrada
  // con retraso para que no se cruce con la salida del Index.
  outForIndex: { duration: 0.28, ease: 'power3.in', staggerAmount: 0.1, yPercent: -140 },
  inAfterIndexDelay: 0.5,
};
const MASK_CUSHION = '0.25em';
// Cambio de cabecera Home ↔ proyecto: roll simultáneo por carácter.
const HEADER_ROLL = { duration: 0.7, ease: 'power3.inOut', stagger: 0.018 };

const HOME_LINE2 = 'Portfolio 2026';
const HOME_LINE3 = 'Creative Frontend Developer';
const ROLL_LH = 1.08; // em, el interlineado del navbar
const pad2 = (n) => String(n).padStart(2, '0');

/**
 * Rodillo por carácter (v3, más limpio): cada línea es UNA máscara de una
 * línea de alto. El texto viejo y el nuevo se pintan en su sitio natural (sin
 * huecos ni anchos animados, que es lo que hacía "succionarse" las letras).
 * La letra i del viejo sube exactamente una línea y sale mientras la letra i
 * del nuevo sube una línea y entra: mismo instante, misma curva, cascada de
 * izquierda a derecha. Al terminar, la línea vuelve a ser texto normal.
 */
const rollText = (el, from, to, reduce, fromColor = '', toColor = '', fromTab = false, toTab = false) => {
  const makeRow = (text) => {
    const row = document.createElement('span');
    row.style.cssText = 'display:block;white-space:pre;';
    const chars = [];
    for (const ch of text) {
      const c = document.createElement('span');
      c.style.cssText = 'display:inline-block;will-change:transform;';
      c.textContent = ch === ' ' ? ' ' : ch;
      row.appendChild(c);
      chars.push(c);
    }
    return { row, chars };
  };
  el.textContent = '';
  const mask = document.createElement('span');
  mask.style.cssText = `display:inline-block;vertical-align:top;position:relative;overflow:hidden;height:${ROLL_LH}em;line-height:${ROLL_LH}em;`;
  const prev = makeRow(from);
  const next = makeRow(to);
  // v3: cada texto con su color (p. ej. "Portfolio 2026" gris → "Index" negro).
  if (fromColor) prev.row.style.color = fromColor;
  if (toColor) next.row.style.color = toColor;
  // Cifras tabulares solo en el contador ("01 / 13"); "2026" en texto va normal.
  prev.row.style.fontVariantNumeric = fromTab ? 'tabular-nums' : 'normal';
  next.row.style.fontVariantNumeric = toTab ? 'tabular-nums' : 'normal';
  next.row.style.cssText += 'position:absolute;left:0;top:0;';
  mask.appendChild(prev.row);
  mask.appendChild(next.row);
  el.appendChild(mask);
  mask.style.width = `${Math.max(prev.row.getBoundingClientRect().width, next.row.getBoundingClientRect().width)}px`;
  gsap.set(next.chars, { yPercent: 100 });

  const duration = reduce ? 0 : HEADER_ROLL.duration;
  const tl = gsap.timeline({
    onComplete: () => {
      el.textContent = to;
      el.style.fontVariantNumeric = toTab ? 'tabular-nums' : 'normal';
    },
  });
  const n = Math.max(prev.chars.length, next.chars.length);
  for (let i = 0; i < n; i++) {
    const at = reduce ? 0 : i * HEADER_ROLL.stagger;
    if (prev.chars[i]) tl.to(prev.chars[i], { yPercent: -100, duration, ease: HEADER_ROLL.ease, force3D: true }, at);
    if (next.chars[i]) tl.to(next.chars[i], { yPercent: 0, duration, ease: HEADER_ROLL.ease, force3D: true }, at);
  }
  return tl;
};

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

// v2: en About el navbar muestra tres filas de contacto (etiqueta en negro,
// valor en gris), con la misma entrada por caracteres que tenía "contact".
const CONTACT_ROWS = [
  { label: 'mail', value: CONTACT_EMAIL, href: `mailto:${CONTACT_EMAIL}` },
  { label: 'phone', value: '(+49) 176 58260660', href: 'tel:+4917658260660' },
  { label: 'instagram', value: 'kiko.clmnt', href: 'https://instagram.com/kiko.clmnt' },
];

// Si la red va muy lenta, como mucho se espera esto (con los cuadrados girando)
// antes de entrar igualmente; lo que falte aparece en cuanto llega.
const MAX_ASSET_WAIT_MS = 8000;

// showContact: true cuando la sección activa en móvil es "About" — la única
// vez que este email debe aparecer (en desktop ya vive siempre en la 2ª
// columna del navbar; aquí solo tiene sentido dentro de About, si no,
// quedaría redundante con el navbar fijo).
// isReady: true cuando lo imprescindible para la home ya está descargado
// (src/lib/preload.js). Por defecto true para usos sin precarga (/tests).
/**
 * v2 (rejilla de 4 columnas): mismo loader que NavbarLoaderMobNew.js. Cambia el
 * navbar final:
 *   - data-navbar: difference sobre las hojas (globals.css) y referencia del
 *     ancla del slider (lib/mobileGrid → mobileAnchorPx)
 *   - tipo --kc-type-mobile-2 con interlineado pegado
 *   - en el detalle de un proyecto, "Portfolio 2026" y "Creative Frontend
 *     Developer" salen con la máscara por caracteres y entran el nombre del
 *     proyecto y el contador rodante (RollingCounter); al volver, al revés
 *   - en About, tres filas de contacto (mail, phone, instagram)
 *
 * v3 (sistema de cabecera): la línea 1 siempre es "Kiko Climent" y la línea 2
 * dice dónde estás — "Portfolio 2026" en la Home, el nombre del proyecto en el
 * detalle, "Index" con el índice abierto (sobre la Home o sobre un proyecto).
 * En el Index la línea 3 es "Selected work, 2026" en gris; en la Home
 * "Portfolio 2026" va en gris. Prioridad: Index > proyecto > Home.
 * La versión anterior sigue en NavbarLoaderMobNew2.js.
 */
const INDEX_LINE2 = 'Index';
const INDEX_LINE3 = 'Selected work, 2026';
// Color de cada línea según dónde estás: 'active' (negro/blanco) o 'inactive' (gris,
// el mismo en el que termina "Portfolio 2026" tras la animación de entrada).
const HEADER_ROLES = {
  home: { l2: 'inactive', l3: 'active' },
  index: { l2: 'active', l3: 'inactive' },
  project: { l2: 'active', l3: 'active' },
};

const NavbarLoaderMobNew3 = ({ onReady, showContact = false, isReady = true, project = null, indexOpen = false }) => {
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const [showLoader, setShowLoader] = useState(true);
  const [showNavbarContent, setShowNavbarContent] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // La timeline se crea una sola vez; estas refs le dan los valores actuales
  // sin tener que relanzarla.
  const onReadyRef = useRef(onReady);
  const isReadyRef = useRef(isReady);
  const leaveIntroRef = useRef(null);

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
  const contactSplitRef = useRef(null);
  const prevShowContactRef = useRef(false);
  // El contacto se escondió porque se abrió el Index encima del About.
  const contactHiddenByIndexRef = useRef(false);
  const indexOpenRef = useRef(indexOpen);
  useEffect(() => {
    indexOpenRef.current = indexOpen;
  }, [indexOpen]);

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
    onReadyRef.current = onReady;
  }, [onReady]);

  // Si la timeline ya llegó al final y estaba esperando a la precarga, este es
  // el momento de dejar que los cuadrados viajen a la esquina.
  useEffect(() => {
    isReadyRef.current = isReady;
    if (isReady) leaveIntroRef.current?.();
  }, [isReady]);

  useEffect(() => {
    if (!titleCharsRef.current.length || !subtitleCharsRef.current.length || !subtitle2CharsRef.current.length) return;

    let rotationAnim = null;
    let rotationAnim2 = null;
    const timers = [];
    const later = (fn, ms) => timers.push(setTimeout(fn, ms));

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
      // Se suma al padding que ya tenga: en desarrollo React monta los efectos
      // dos veces y la segunda medida, ya alineada, daba 0 (la fila 2 perdía el
      // desplazamiento bajo "Climent").
      const currentPadding = parseFloat(row2Ref.current.style.paddingLeft) || 0;
      row2Ref.current.style.paddingLeft = `${Math.max(currentPadding + shift, 0)}px`;
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
    // segundo va relleno (ver JSX) — al llegar y solaparse con el primero,
    // la unión se ve como un único cuadrado negro, insinuando que ese es el
    // "botón" de modo oscuro. Se queda así hasta que aparece el navbar
    // final: en ese instante se vacía de color (misma transición que el
    // hover del toggle) y justo después se desvanece, dejando al primer
    // cuadrado — ahora sí, el toggle real — en su estado normal.
    const moveSquaresToNavbar = () => {
      setIsTransitioning(true);

      later(() => {
        if (squareRef.current) {
          squareRef.current.style.transition = 'all 0.8s cubic-bezier(0.9, 0, 0.1, 1)';
          squareRef.current.style.top = 'calc(1.7rem - 2px)';
        }
        if (square2Ref.current) {
          square2Ref.current.style.transition = 'top 0.8s cubic-bezier(0.9, 0, 0.1, 1), left 0.8s cubic-bezier(0.9, 0, 0.1, 1)';
          square2Ref.current.style.top = 'calc(1.7rem - 2px)';
        }
      }, 100);

      later(() => {
        if (squareRef.current) {
          squareRef.current.style.left = 'calc(100% - 1.4rem)';
          squareRef.current.style.transform = 'translate(-50%, -50%)';
        }
        if (square2Ref.current) {
          square2Ref.current.style.left = 'calc(100% - 1.4rem)';
          square2Ref.current.style.transform = 'translate(-50%, -50%)';
        }
      }, 900);

      later(() => {
        setShowLoader(false);
        setShowNavbarContent(true);
        // Se vacía de color justo cuando aparece el navbar — misma curva que
        // el fill al pasar el ratón por encima del toggle antes de esto.
        if (square2Ref.current) {
          square2Ref.current.style.transition = 'background-color 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
          square2Ref.current.style.backgroundColor = 'transparent';
        }
        onReadyRef.current?.();
      }, 2000);

      // Una vez ya se vació de color (300ms), el segundo cuadrado desaparece
      // del todo — solo queda el primero como toggle real.
      later(() => {
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

    // 8) Solo quedan los dos cuadrados: paran de girar y viajan juntos a la
    //    esquina. Si lo imprescindible de la home aún no ha llegado, siguen
    //    girando —ese es el estado de carga— hasta que llegue (o hasta el tope).
    tl.call(() => {
      let hasLeft = false;
      const leave = () => {
        if (hasLeft) return;
        hasLeft = true;
        leaveIntroRef.current = null;
        if (rotationAnim) rotationAnim.stop();
        if (rotationAnim2) rotationAnim2.stop();
        moveSquaresToNavbar();
      };

      if (isReadyRef.current) {
        leave();
      } else {
        leaveIntroRef.current = leave;
        later(leave, MAX_ASSET_WAIT_MS);
      }
    }, [], '+=0.3');

    return () => {
      tl.kill();
      timers.forEach(clearTimeout);
      leaveIntroRef.current = null;
      if (rotationAnim) rotationAnim.stop();
      if (rotationAnim2) rotationAnim2.stop();
    };
    // Se crea una sola vez. Ojo: NO añadir dependencias (ni isDarkMode ni el
    // callback): si este efecto se relanza con el navbar ya terminado,
    // reconstruye y dispara otra vez la timeline completa — el cuadrado del
    // toggle parpadea, se pone a girar y el segundo cuadrado vuelve a cruzar
    // la pantalla hasta la esquina. Los valores que cambian llegan por refs
    // (onReadyRef, isReadyRef).
  }, []);

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

    const rowEl = contactRef.current;
    if (!rowEl) return;
    const labelEl = rowEl.querySelectorAll('[data-contact-label]');
    const emailEl = rowEl.querySelectorAll('[data-contact-value]');
    if (!labelEl.length || !emailEl.length) return;

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

      const delay = contactHiddenByIndexRef.current ? CONTACT_ANIM.inAfterIndexDelay : 0;
      contactHiddenByIndexRef.current = false;
      gsap.fromTo(
        allChars,
        { yPercent: CONTACT_ANIM.in.fromYPercent },
        {
          yPercent: 0,
          duration: CONTACT_ANIM.in.duration,
          ease: CONTACT_ANIM.in.ease,
          stagger: CONTACT_ANIM.in.staggerEach,
          delay,
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
      const forIndex = indexOpenRef.current;
      contactHiddenByIndexRef.current = forIndex;
      gsap.to(allChars, {
        yPercent: forIndex ? CONTACT_ANIM.outForIndex.yPercent : CONTACT_ANIM.out.yPercent,
        duration: forIndex ? CONTACT_ANIM.outForIndex.duration : CONTACT_ANIM.out.duration,
        ease: forIndex ? CONTACT_ANIM.outForIndex.ease : CONTACT_ANIM.out.ease,
        stagger: forIndex ? { amount: CONTACT_ANIM.outForIndex.staggerAmount } : CONTACT_ANIM.out.staggerEach,
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

  // ── v3: cabecera — rodillos de tragaperras (rollText) ────────────────
  const line2Ref = useRef(null);
  const line3Ref = useRef(null);
  const counterWrapRef = useRef(null);
  const headerTlRef = useRef(null);
  // Estado que enseña la cabecera: 'home' | 'index' | 'p:<id>'.
  const headerKeyRef = useRef('home');
  // Proyecto que había debajo al abrir el Index (para volver a él con su contador).
  const underIndexRef = useRef(null);
  // Texto que tiene (o va a tener) cada línea: de aquí salen los rodillos,
  // aunque una animación anterior se corte a medias.
  const line2TextRef = useRef(HOME_LINE2);
  const line3TextRef = useRef(HOME_LINE3);
  const lastCounterRef = useRef('01 / 01');
  // Colores de las líneas 2 y 3 una vez terminado el rodillo (los pinta React).
  const [headerRoles, setHeaderRoles] = useState(HEADER_ROLES.home);
  const headerRolesRef = useRef(HEADER_ROLES.home);
  // El proyecto se queda montado mientras la cabecera vuelve a la Home.
  const [shownProject, setShownProject] = useState(null);
  // Ajuste de estado al cambiar la prop (patrón de React, sin efecto).
  if (project && project.id !== 'about' && project !== shownProject) setShownProject(project);

  // Número que enseña el contador, para que al volver los rodillos salgan de él.
  useEffect(
    () =>
      sliderBus.on('progress', ({ value, count }) => {
        if (!count) return;
        lastCounterRef.current = `${pad2((Math.round(value) % count) + 1)} / ${pad2(count)}`;
      }),
    []
  );

  // Texto inicial de las líneas 2 y 3 (el DOM de esas líneas lo gestionan los rodillos).
  useEffect(() => {
    if (line2Ref.current && !line2Ref.current.textContent) line2Ref.current.textContent = HOME_LINE2;
    if (line3Ref.current && !line3Ref.current.textContent) line3Ref.current.textContent = HOME_LINE3;
  }, []);

  useEffect(() => {
    if (!showNavbarContent) return;
    const entering = !!(project && project.id !== 'about');
    if (!indexOpen && entering && shownProject?.id !== project.id) return;
    const target = indexOpen ? 'index' : entering ? `p:${project.id}` : 'home';
    const from = headerKeyRef.current;
    if (target === from) return;
    headerKeyRef.current = target;
    if (target === 'index') underIndexRef.current = from.startsWith('p:') ? from : null;

    const l2 = line2Ref.current;
    const l3 = line3Ref.current;
    const counterWrap = counterWrapRef.current;
    if (!l2 || !l3 || !counterWrap) return;

    headerTlRef.current?.kill();
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const tl = gsap.timeline();
    headerTlRef.current = tl;

    // Si se ve el contador vivo, los rodillos salen de su número actual.
    const from2 = line2TextRef.current;
    let from3 = line3TextRef.current;
    if (counterWrap.style.visibility !== 'hidden') {
      from3 = lastCounterRef.current;
      gsap.set(counterWrap, { visibility: 'hidden' });
    }

    let to2;
    let to3;
    if (target === 'index') {
      to2 = INDEX_LINE2;
      to3 = INDEX_LINE3;
    } else if (target === 'home') {
      to2 = HOME_LINE2;
      to3 = HOME_LINE3;
    } else {
      to2 = PROJECT_NAME[project.id] ?? project.id;
      if (from === 'index' && underIndexRef.current === target) {
        // Cerrar el Index encima del mismo proyecto: vuelve a la misma imagen.
        to3 = lastCounterRef.current;
      } else {
        // Desde el póster/miniatura del Index la galería arranca en esa imagen: el contador también.
        const images = project.slider?.images ?? [];
        const armed = indexHandoff.armedImage(project.id);
        const startAt = armed != null ? Math.max(0, images.findIndex((img) => img.id === armed)) : 0;
        to3 = `${pad2(startAt + 1)} / ${pad2(images.length)}`;
      }
    }
    line2TextRef.current = to2;
    line3TextRef.current = to3;

    const roleColor = (role) => (role === 'inactive' ? INACTIVE : ACTIVE);
    const fromRoles = headerRolesRef.current;
    const toRoles = HEADER_ROLES[target.startsWith('p:') ? 'project' : target];
    headerRolesRef.current = toRoles;

    tl.add(rollText(l2, from2, to2, reduce, roleColor(fromRoles.l2), roleColor(toRoles.l2)), 0);
    const isCounter = (text) => /^\d+ \/ \d+$/.test(text);
    tl.add(
      rollText(l3, from3, to3, reduce, roleColor(fromRoles.l3), roleColor(toRoles.l3), isCounter(from3), isCounter(to3)),
      0.05
    );
    tl.call(() => setHeaderRoles(toRoles), null, 0.05);
    if (target.startsWith('p:')) {
      // Cuando el rodillo termina en "01 / 10", el contador vivo ocupa su sitio.
      tl.call(() => {
        l3.textContent = '';
        gsap.set(counterWrap, { visibility: 'visible' });
      });
    } else if (target === 'home') {
      tl.call(() => setShownProject(null));
    }
  }, [project, shownProject, showNavbarContent, indexOpen, ACTIVE, INACTIVE]);

  useEffect(() => () => headerTlRef.current?.kill(), []);

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
          <div className="flex flex-col items-start gap-y-0 text-[length:var(--kc-type-mobile-2)] font-semibold" style={{ lineHeight: 'var(--kc-leading-mobile-2)' }}>
            <div className="flex items-center whitespace-nowrap">
              <h1 ref={titleRef} className="flex" aria-label="Kiko Climent">
                {renderRollStages('Kiko Climent', titleCharsRef, titleStages)}
              </h1>
              <div ref={squareAnchorRef} className="w-[clamp(0.65rem,2.72vw,0.7rem)] h-[clamp(0.65rem,2.72vw,0.7rem)]" style={{ visibility: 'hidden', marginLeft: '0.25rem', marginRight: '0.25rem' }} />
              <h2 className="flex" aria-label="Portfolio 2026">
                {renderRollStages('Portfolio 2026', subtitleCharsRef, subtitleStages)}
              </h2>
            </div>

            <div ref={row2Ref} className="flex items-center whitespace-nowrap">
              <div ref={row2SpacerRef} className="w-[clamp(0.65rem,2.72vw,0.7rem)] h-[clamp(0.65rem,2.72vw,0.7rem)]" style={{ visibility: 'hidden', marginRight: '0.25rem' }} />
              <h3 className="flex" aria-label="Creative Frontend Developer">
                {renderRollStages('Creative Frontend Developer', subtitle2CharsRef, subtitle2Stages)}
              </h3>
            </div>
          </div>
        </div>
      )}

      {/* Cuadrado principal: posición final como NavbarMobile.js; tamaño en
          proporción al texto móvil: 0,8 × texto, como en escritorio (13–14 px → 10,4–11,2 px;
          antes 12 px fijos). El ::before amplía
          la zona táctil 16 px por lado (≈ 43 px) sin cambiar lo que se ve. */}
      <div
        ref={squareRef}
        onClick={!showLoader ? toggleDarkMode : undefined}
        onMouseEnter={() => !showLoader && setIsHovered(true)}
        onMouseLeave={() => !showLoader && setIsHovered(false)}
        className={`fixed w-[clamp(0.65rem,2.72vw,0.7rem)] h-[clamp(0.65rem,2.72vw,0.7rem)] border-[1.5px] ${isDarkMode ? 'border-white' : 'border-black'} bg-transparent z-[60] font-bold before:absolute before:-inset-4 before:content-['']`}
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

      {/* Segundo cuadrado: entra deslizándose desde fuera de pantalla ya relleno (conceptualmente es el
          toggle "en negro"), viaja junto al principal y al llegar la unión de ambos se ve como un único
          cuadrado negro. opacity 0 desde el primer render por el mismo motivo que el cuadrado principal:
          evitar el flash en la esquina antes de que el useEffect le fije top/left. */}
      <div
        ref={square2Ref}
        className={`fixed w-[clamp(0.65rem,2.72vw,0.7rem)] h-[clamp(0.65rem,2.72vw,0.7rem)] border-[1.5px] ${isDarkMode ? 'border-white' : 'border-black'} z-[60] pointer-events-none`}
        style={{ opacity: 0, backgroundColor: isDarkMode ? 'white' : 'black', transform: 'translate(-50%, -50%)' }}
      />

      {/* Navbar v2: data-navbar → difference (globals.css) + ancla del slider. */}
      <div
        ref={navbarRef}
        data-navbar
        className="flex top-4 left-4 right-4 z-50 text-[length:var(--kc-type-mobile-2)] font-semibold absolute transition-opacity duration-500"
        style={{ opacity: showNavbarContent ? 1 : 0, lineHeight: 'var(--kc-leading-mobile-2)' }}
      >
        <div className="flex flex-col">
          {/* Dentro de un proyecto o del About, el nombre lleva a la Home con la
              misma salida que "← Index" / "back home" (FooterMobile2). */}
          {shownProject || showContact ? (
            <h1>
              <button
                type="button"
                className="cursor-pointer text-left"
                onClick={() => window.__footerMobileRequestBack?.()}
                aria-label="Kiko Climent, back to index"
              >
                Kiko Climent
              </button>
            </h1>
          ) : (
            <h1>Kiko Climent</h1>
          )}
          {/* Líneas 2 y 3: rodillos de tragaperras carácter a carácter (rollText).
              Los spans van vacíos a propósito: su contenido lo pone el efecto. */}
          <h2 style={{ color: headerRoles.l2 === 'inactive' ? INACTIVE : ACTIVE }}>
            <span ref={line2Ref} />
          </h2>
          {/* data-navbar-head: última línea de la cabecera (sin el contacto del About). */}
          <h2 data-navbar-head className="relative" style={{ color: headerRoles.l3 === 'inactive' ? INACTIVE : ACTIVE }}>
            <span ref={line3Ref} />
            <span ref={counterWrapRef} className="absolute left-0 top-0" style={{ visibility: 'hidden' }}>
              {shownProject ? (
                <RollingCounter key={shownProject.id} total={shownProject.slider?.images?.length ?? 0} />
              ) : null}
            </span>
          </h2>
          <div ref={contactRef} style={{ display: 'none', marginTop: '1em' }}>
            {CONTACT_ROWS.map(({ label, value, href }) => (
              <div key={label} className="grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', columnGap: 12 }}>
                <span data-contact-label style={{ gridColumn: '1 / span 1', color: isDarkMode ? 'white' : 'black' }}>
                  {label}
                </span>
                <a
                  data-contact-value
                  href={href}
                  target={href.startsWith('http') ? '_blank' : undefined}
                  rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
                  className="lowercase hover:opacity-80 transition-opacity"
                  style={{ gridColumn: '2 / span 3', justifySelf: 'start', color: isDarkMode ? '#9ca3af' : '#6b7280' }}
                >
                  {value}
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NavbarLoaderMobNew3;
