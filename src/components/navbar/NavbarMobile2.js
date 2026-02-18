'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useDarkMode } from '@/contexts/DarkModeContext';

const NavbarMobile2 = () => {
  const { isDarkMode, toggleDarkMode } = useDarkMode();

  const [showLoader, setShowLoader] = useState(true);
  const [showNavbarContent, setShowNavbarContent] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const loaderRef = useRef(null);
  const squareRef = useRef(null);

  useEffect(() => {
    const textPaths = loaderRef.current?.querySelectorAll('.orbit-text textPath');
    if (!textPaths) return;

    const baseOffsets = Array.from(textPaths).map(tp =>
      parseFloat(tp.getAttribute('startOffset'))
    );

    const squareSizes = [700, 620, 540, 460, 380, 300]; // ⬅️ más grandes
    const maxSquare = squareSizes[0];

    let animations = [];
    let squareRotation = null;

    textPaths.forEach((textPath, index) => {
      const delay = index * 0.14;

      const travel = 22 + index * 5;
      const targetOffset = Math.max(18, baseOffsets[index] - travel);

      const duration =
        1.4 + (squareSizes[index] / maxSquare) * 1.2;

      const anim = animateElement(
        textPath,
        { startOffset: `${targetOffset}%` },
        duration,
        delay,
        true
      );

      animations.push(anim);
    });

    squareRotation = animateRotation(squareRef.current, 9.5);

    const orbitTexts = Array.from(
      loaderRef.current.querySelectorAll('.orbit-text')
    ).reverse();

    orbitTexts.forEach((el, i) => {
      setTimeout(() => (el.style.opacity = '1'), i * 130);
    });

    setTimeout(() => {
      orbitTexts.forEach((el, i) => {
        setTimeout(() => (el.style.opacity = '0'), i * 110);
      });

      setTimeout(() => {
        squareRotation?.stop();
        setIsTransitioning(true);

        setTimeout(() => {
          squareRef.current.style.transition =
            'all 0.9s cubic-bezier(0.77, 0, 0.175, 1)';
          squareRef.current.style.top = '1.7rem';
        }, 120);

        setTimeout(() => {
          squareRef.current.style.left = 'calc(100% - 1.5rem)';
          squareRef.current.style.transform = 'translate(-50%, -50%)';
        }, 950);

        setTimeout(() => {
          setShowLoader(false);
          setShowNavbarContent(true);
        }, 1800);
      }, 900);
    }, 8000);

    return () => {
      animations.forEach(a => a?.stop());
      squareRotation?.stop();
    };
  }, []);

  // 🌀 easing más elegante
  const easeInOutExpo = t =>
    t === 0
      ? 0
      : t === 1
      ? 1
      : t < 0.5
      ? Math.pow(2, 20 * t - 10) / 2
      : (2 - Math.pow(2, -20 * t + 10)) / 2;

  const animateElement = (element, targetAttrs, duration, delay, yoyo) => {
    let startTime = null;
    let raf = null;
    let reverse = false;

    const initial = {};
    Object.keys(targetAttrs).forEach(
      k => (initial[k] = parseFloat(element.getAttribute(k)))
    );

    const animate = time => {
      if (!startTime) startTime = time - delay * 1000;
      const elapsed = time - startTime - delay * 1000;

      if (elapsed < 0) {
        raf = requestAnimationFrame(animate);
        return;
      }

      const t = Math.min(elapsed / (duration * 1000), 1);
      const e = easeInOutExpo(t);

      Object.keys(targetAttrs).forEach(key => {
        const from = reverse ? parseFloat(targetAttrs[key]) : initial[key];
        const to = reverse ? initial[key] : parseFloat(targetAttrs[key]);
        const value = from + (to - from) * e;
        element.setAttribute(key, `${value}%`);
      });

      if (t < 1) {
        raf = requestAnimationFrame(animate);
      } else if (yoyo) {
        reverse = !reverse;
        startTime = time;
        raf = requestAnimationFrame(animate);
      }
    };

    raf = requestAnimationFrame(animate);
    return { stop: () => raf && cancelAnimationFrame(raf) };
  };

  const animateRotation = (el, duration) => {
    if (!el) return { stop: () => {} };
    let start = null;
    let raf = null;

    const loop = time => {
      if (!start) start = time;
      const rot = ((time - start) / (duration * 1000)) * 360;
      el.style.transform = `translate(-50%, -50%) rotate(${rot}deg)`;
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return { stop: () => cancelAnimationFrame(raf) };
  };

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-black text-white' : 'bg-white text-black'}`}>
      {showLoader && (
        <div ref={loaderRef} className="fixed inset-0 flex items-center justify-center z-50">
          <svg viewBox="-50 -50 1100 1100" className="w-[85%] h-[85%]">
            {[
              [30, 970],
              [110, 890],
              [190, 810],
              [270, 730],
              [350, 650],
              [430, 570],
            ].map((v, i) => (
              <path
                key={i}
                id={`loader-square-${i + 1}`}
                d={`M ${v[0]},500 L ${v[0]},${v[0]} L ${v[1]},${v[0]} L ${v[1]},${v[1]} L ${v[0]},${v[1]} Z`}
                fill="none"
              />
            ))}

            {[
              ['KIKO CLIMENT', 760],
              ['FULLSTACK', 720],
              ['WEB DEVELOPER', 780],
              ['CREATIVE CODE', 760],
              ['PORTFOLIO', 700],
              ['2026', 620],
            ].map((txt, i) => (
              <text
                key={i}
                className="orbit-text uppercase transition-opacity duration-700"
                style={{
                  opacity: 0,
                  fontSize: '3rem',
                  fontWeight: 400,
                  letterSpacing: '0.22em',
                  textRendering: 'geometricPrecision',
                }}
              >
                <textPath
                  href={`#loader-square-${i + 1}`}
                  startOffset="32%"
                  textLength={txt[1]}
                  lengthAdjust="spacing"
                >
                  {txt[0]}
                </textPath>
              </text>
            ))}
          </svg>
        </div>
      )}

      <div
        ref={squareRef}
        onClick={!showLoader ? toggleDarkMode : undefined}
        onMouseEnter={() => !showLoader && setIsHovered(true)}
        onMouseLeave={() => !showLoader && setIsHovered(false)}
        className={`fixed w-4 h-4 border-2 ${isDarkMode ? 'border-white' : 'border-black'} z-[60]`}
        style={{
          top: '50%',
          left: '50%',
          transform: `translate(-50%, -50%) rotate(${isHovered ? '180deg' : '0deg'})`,
          background: isHovered ? (isDarkMode ? '#fff' : '#000') : 'transparent',
          transition: 'all 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      />

      <div
        className="absolute top-4 left-4 z-50 text-[clamp(1.25rem,2vw,1.5rem)] leading-[0.95]"
        style={{ opacity: showNavbarContent ? 1 : 0 }}
      >
        <h1>Kiko Climent</h1>
        <h2>Portfolio 2026</h2>
        <h2>Fullstack Web Developer</h2>
      </div>
    </div>
  );
};

export default NavbarMobile2;
