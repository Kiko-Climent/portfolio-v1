'use client';

/**
 * Footer móvil v3 ("opción 1": un solo tamaño de texto en toda la web).
 *   Home: barra de una línea sobre papel sólido (sin difference).
 *     Izquierda: "01/05 Johnny Carretes ··· Open →", el proyecto de la hoja
 *     que está en el ancla (sliderBus 'active'); cambia con un rodillo por
 *     carácter al deslizar. Toda la franja es zona táctil (44 px).
 *     Derecha: "Index", que abre IndexSheetMobile (tabla de contenidos).
 *   Índice abierto: la barra pasa a "← Close · 05 entries".
 *   Detalle: "Index · Info +". "Index" abre el índice encima del proyecto (con
 *   ese proyecto seleccionado); "← Close" vuelve al mismo proyecto y elegir
 *   otro cambia de proyecto sin pasar por la Home (onProjectSwitch).
 *   Home: siempre "Kiko Climent" en la cabecera (window.__footerMobileRequestBack).
 *   About: sin barra ("back home" está en el texto), como en la v2.
 * Los cambios de barra usan la misma máscara por caracteres que la v2.
 * Versión anterior (lista de 5 títulos a tamaño índice): FooterMobile2.js.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { useDarkMode } from '@/contexts/DarkModeContext';
import { sliderBus } from '@/lib/sliderBus';
import { MOBILE_GRID } from '@/lib/mobileGrid';
import { PROJECT_NAME, pad2 } from '@/components/data/grid';
import IndexSheetMobile, { INDEX_ORDER } from '@/components/mobile/IndexSheetMobile';

gsap.registerPlugin(SplitText);

const MASK_CUSHION = '0.25em';
export const BAR_H = 56;

const ANIM = {
  out: { duration: 0.45, ease: 'power3.in', stagger: 0.012, yPercent: -140 },
  in: { duration: 0.8, ease: 'power4.out', stagger: 0.018, fromYPercent: 140 },
  // Entrada de la barra nueva respecto a la salida de la anterior.
  inAt: 0.35,
  // Rodillo del proyecto activo en la Home.
  roll: { duration: 0.55, ease: 'power3.inOut', stagger: 0.012 },
};

const DEFAULT_ACTIVE = INDEX_ORDER[0];
const counterText = (id) => `${pad2(Math.max(0, INDEX_ORDER.indexOf(id)) + 1)}/${pad2(INDEX_ORDER.length)}`;
const nameText = (id) => PROJECT_NAME[id] ?? PROJECT_NAME[DEFAULT_ACTIVE];

// ── Rodillo por carácter (misma idea que rollText en NavbarLoaderMobNew2) ──
const finishRoll = (el) => {
  if (!el?.__kcRoll) return;
  el.__kcRoll.kill();
  el.__kcRoll = null;
  el.textContent = el.dataset.target ?? el.textContent;
};

const rollTo = (el, to, reduce) => {
  if (!el) return;
  finishRoll(el);
  const from = el.textContent;
  el.dataset.target = to;
  if (from === to) return;
  if (reduce || !from) {
    el.textContent = to;
    return;
  }
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
  mask.style.cssText = `display:inline-block;vertical-align:top;position:relative;overflow:hidden;padding-bottom:0.15em;margin-bottom:-0.15em;`;
  const prev = makeRow(from);
  const next = makeRow(to);
  next.row.style.cssText += 'position:absolute;left:0;top:0;';
  mask.appendChild(prev.row);
  mask.appendChild(next.row);
  el.appendChild(mask);
  mask.style.width = `${Math.max(prev.row.getBoundingClientRect().width, next.row.getBoundingClientRect().width)}px`;
  gsap.set(next.chars, { yPercent: 115 });
  const tl = gsap.timeline({
    onComplete: () => {
      el.__kcRoll = null;
      el.textContent = to;
    },
  });
  const n = Math.max(prev.chars.length, next.chars.length);
  for (let i = 0; i < n; i++) {
    const at = i * ANIM.roll.stagger;
    const t = { duration: ANIM.roll.duration, ease: ANIM.roll.ease, force3D: true };
    if (prev.chars[i]) tl.to(prev.chars[i], { ...t, yPercent: -115 }, at);
    if (next.chars[i]) tl.to(next.chars[i], { ...t, yPercent: 0 }, at);
  }
  el.__kcRoll = tl;
};

// Puente con ProjectImageSliderMobile2 (About), igual que en la v2.
const setInfoHiddenCallback = (fn) => {
  if (fn) window.__mobileInfoHidden = fn;
  else delete window.__mobileInfoHidden;
};
const getInfoHiddenCallback = () => window.__mobileInfoHidden;

export default function FooterMobile3({ onProjectClick, onProjectSwitch, infoOpen = false, onInfoToggle }) {
  const { isDarkMode } = useDarkMode();

  const groupRefs = useRef({});
  const splitsRef = useRef({});
  const stripRef = useRef(null);
  const nameRef = useRef(null);
  const countRef = useRef(null);
  const infoSignRef = useRef(null);

  // 'home' | 'index' (sobre la Home) | 'detail' | 'detailIndex' (sobre un proyecto) | 'about' | 'returning'
  const modeRef = useRef('home');
  // Proyecto abierto ahora (detalle o About).
  const currentRef = useRef(null);
  const [indexStart, setIndexStart] = useState(DEFAULT_ACTIVE);
  const infoOpenRef = useRef(infoOpen);
  useEffect(() => {
    infoOpenRef.current = infoOpen;
  }, [infoOpen]);
  const busyRef = useRef(false);
  const activeRef = useRef(DEFAULT_ACTIVE);
  const [activeId, setActiveId] = useState(DEFAULT_ACTIVE);
  const [indexOpen, setIndexOpen] = useState(false);

  const reduceMotion = () =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── Grupos de la barra: se trocean solo mientras se animan ──────────────
  const revertGroup = (name) => {
    splitsRef.current[name]?.forEach((split) => split.revert());
    delete splitsRef.current[name];
  };

  const splitGroup = (name) => {
    const el = groupRefs.current[name];
    if (!el) return [];
    if (name === 'home') {
      finishRoll(nameRef.current);
      finishRoll(countRef.current);
    }
    revertGroup(name);
    const splits = Array.from(el.querySelectorAll('[data-split]')).map(
      (target) => new SplitText(target, { type: 'chars', mask: 'chars', charsClass: 'char' })
    );
    splitsRef.current[name] = splits;
    const chars = splits.flatMap((split) => split.chars);
    chars.forEach((char) => {
      const wrap = char.parentElement;
      if (!wrap) return;
      wrap.style.paddingTop = MASK_CUSHION;
      wrap.style.paddingBottom = MASK_CUSHION;
      wrap.style.marginTop = `-${MASK_CUSHION}`;
      wrap.style.marginBottom = `-${MASK_CUSHION}`;
    });
    return chars;
  };

  const movers = (name) => Array.from(groupRefs.current[name]?.querySelectorAll('[data-move]') ?? []);

  const setGroupVisible = (name, visible) => {
    const el = groupRefs.current[name];
    if (el) gsap.set(el, { display: visible ? 'flex' : 'none' });
  };

  const hideGroup = (name, tl, at = 0) => {
    const chars = splitGroup(name);
    const moves = movers(name);
    if (reduceMotion()) {
      tl.call(() => {
        revertGroup(name);
        setGroupVisible(name, false);
      }, null, at);
      return;
    }
    const out = { yPercent: ANIM.out.yPercent, duration: ANIM.out.duration, ease: ANIM.out.ease, force3D: true };
    tl.to(chars, { ...out, stagger: ANIM.out.stagger }, at);
    if (moves.length) tl.to(moves, out, at);
    tl.call(() => {
      revertGroup(name);
      gsap.set(moves, { clearProps: 'transform' });
      setGroupVisible(name, false);
    });
  };

  const showGroup = (name, tl, at = 0, onDone) => {
    tl.call(() => {
      setGroupVisible(name, true);
      const chars = splitGroup(name);
      const moves = movers(name);
      if (reduceMotion()) {
        revertGroup(name);
        onDone?.();
        return;
      }
      const inTween = { yPercent: 0, duration: ANIM.in.duration, ease: ANIM.in.ease, force3D: true };
      gsap.set([...chars, ...moves], { yPercent: ANIM.in.fromYPercent });
      if (moves.length) gsap.to(moves, { ...inTween, delay: 0.08 });
      gsap.to(chars, {
        ...inTween,
        stagger: ANIM.in.stagger,
        onComplete: () => {
          revertGroup(name);
          onDone?.();
        },
      });
    }, null, at);
  };

  const setStrip = (visible) => {
    if (stripRef.current) gsap.to(stripRef.current, { autoAlpha: visible ? 1 : 0, duration: 0.35, ease: 'power2.out' });
  };

  // ── Proyecto activo de la Home ───────────────────────────────────────────
  const paintHome = useCallback((animate) => {
    const id = activeRef.current;
    const reduce = !animate || reduceMotion();
    rollTo(nameRef.current, nameText(id), reduce);
    rollTo(countRef.current, counterText(id), reduce);
  }, []);

  useEffect(() => {
    // Texto inicial y entrada de la barra.
    const nameEl = nameRef.current;
    const countEl = countRef.current;
    const splits = splitsRef.current;
    paintHome(false);
    busyRef.current = true;
    const tl = gsap.timeline();
    showGroup('home', tl, 0.1, () => {
      busyRef.current = false;
      paintHome(true); // por si el slider cambió de hoja durante la entrada
    });
    const off = sliderBus.on('active', ({ projectId }) => {
      if (!projectId || activeRef.current === projectId) return;
      activeRef.current = projectId;
      setActiveId(projectId);
      if (modeRef.current === 'home' && !busyRef.current) paintHome(true);
    });
    return () => {
      tl.kill();
      off();
      Object.values(splits).forEach((list) => list.forEach((split) => split.revert()));
      finishRoll(nameEl);
      finishRoll(countEl);
    };
    // Una sola vez: los valores que cambian llegan por refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Transiciones ─────────────────────────────────────────────────────────
  const openProject = (id) => {
    const from = modeRef.current;
    if (!id || busyRef.current) return;
    if (from === 'detailIndex') {
      switchProject(id);
      return;
    }
    if (from !== 'home' && from !== 'index') return;
    busyRef.current = true;
    const isAbout = id === 'about';
    modeRef.current = isAbout ? 'about' : 'detail';
    currentRef.current = id;
    if (from === 'index') setIndexOpen(false);
    onProjectClick?.(id);

    const tl = gsap.timeline();
    hideGroup(from, tl, 0);
    if (isAbout) {
      tl.call(() => setStrip(false), null, 0.2);
      tl.call(() => {
        busyRef.current = false;
        window.__footerAnimationComplete?.();
      });
      return;
    }
    showGroup('detail', tl, ANIM.inAt, () => {
      busyRef.current = false;
      window.__footerAnimationComplete?.();
    });
  };

  const openIndex = () => {
    const from = modeRef.current;
    if (busyRef.current || (from !== 'home' && from !== 'detail')) return;
    busyRef.current = true;
    const overProject = from === 'detail';
    modeRef.current = overProject ? 'detailIndex' : 'index';
    // Encima de un proyecto, el índice arranca en ese proyecto.
    setIndexStart(overProject ? currentRef.current : activeRef.current);
    if (overProject && infoOpenRef.current) onInfoToggle?.();
    setIndexOpen(true);
    const tl = gsap.timeline();
    hideGroup(from, tl, 0);
    showGroup('index', tl, 0.25, () => {
      busyRef.current = false;
    });
  };

  // Desde el índice abierto encima de un proyecto: otro proyecto (o el mismo → cerrar).
  const switchProject = (id) => {
    if (id === currentRef.current) {
      closeIndex();
      return;
    }
    busyRef.current = true;
    const isAbout = id === 'about';
    modeRef.current = isAbout ? 'about' : 'detail';
    currentRef.current = id;
    setIndexOpen(false);
    onProjectSwitch?.(id);
    const tl = gsap.timeline();
    hideGroup('index', tl, 0);
    if (isAbout) {
      tl.call(() => setStrip(false), null, 0.2);
      tl.call(() => {
        busyRef.current = false;
      });
      return;
    }
    showGroup('detail', tl, ANIM.inAt, () => {
      busyRef.current = false;
    });
  };

  const closeIndex = () => {
    const from = modeRef.current;
    if (busyRef.current && from !== 'detailIndex') return;
    if (from === 'detailIndex') {
      // Vuelta al mismo proyecto, en la misma imagen.
      busyRef.current = true;
      modeRef.current = 'detail';
      setIndexOpen(false);
      const tl = gsap.timeline();
      hideGroup('index', tl, 0);
      showGroup('detail', tl, 0.25, () => {
        busyRef.current = false;
      });
      return;
    }
    if (busyRef.current || from !== 'index') return;
    busyRef.current = true;
    modeRef.current = 'home';
    setIndexOpen(false);
    paintHome(false);
    const tl = gsap.timeline();
    hideGroup('index', tl, 0);
    showGroup('home', tl, 0.25, () => {
      busyRef.current = false;
      paintHome(true);
    });
  };

  const restoreHome = () => {
    modeRef.current = 'home';
    currentRef.current = null;
    paintHome(false);
    setStrip(true);
    const tl = gsap.timeline();
    showGroup('home', tl, 0, () => {
      busyRef.current = false;
      onProjectClick?.(null);
      paintHome(true);
    });
  };

  const handleBack = () => {
    const mode = modeRef.current;
    if (mode === 'index') {
      closeIndex();
      return;
    }
    if ((mode !== 'detail' && mode !== 'about' && mode !== 'detailIndex') || busyRef.current) return;
    busyRef.current = true;
    window.__footerBackStarted?.();

    // Índice abierto encima de un proyecto y "Kiko Climent": a la Home directamente.
    if (mode === 'detailIndex') {
      modeRef.current = 'returning';
      setIndexOpen(false);
      const tl = gsap.timeline();
      hideGroup('index', tl, 0);
      tl.call(restoreHome);
      return;
    }

    // About: el texto ocupa el sitio de la barra; la barra vuelve cuando sus
    // líneas ya han salido (ProjectImageSliderMobile2 avisa con __mobileInfoHidden).
    if (mode === 'about') {
      modeRef.current = 'returning';
      let restored = false;
      const restore = () => {
        if (restored) return;
        restored = true;
        window.clearTimeout(fallback);
        if (getInfoHiddenCallback() === restore) setInfoHiddenCallback(null);
        restoreHome();
      };
      setInfoHiddenCallback(restore);
      const fallback = window.setTimeout(restore, 4000);
      return;
    }

    modeRef.current = 'returning';
    const tl = gsap.timeline();
    hideGroup('detail', tl, 0);
    tl.call(restoreHome);
  };

  const handleBackRef = useRef(null);
  useEffect(() => {
    handleBackRef.current = handleBack;
  });

  useEffect(() => {
    window.__footerMobileRequestBack = () => handleBackRef.current?.();
    return () => {
      delete window.__footerMobileRequestBack;
    };
  }, []);

  const ink = isDarkMode ? '#ffffff' : '#000000';
  const muted = isDarkMode ? MOBILE_GRID.mutedDark : MOBILE_GRID.muted;
  const paper = isDarkMode ? '#000000' : '#ffffff';
  const groupClass = 'absolute inset-0 items-center justify-between whitespace-nowrap';
  // Ojo: en globals.css "* { padding: 0 }" va sin capa y pisa las utilidades
  // de Tailwind (px-*), así que el relleno de la zona táctil va en línea.
  const hit = 'flex items-center h-11 cursor-pointer';
  const hitPad = { paddingLeft: 12, paddingRight: 12 };

  return (
    <>
      <IndexSheetMobile
        open={indexOpen}
        activeId={indexStart}
        currentId={modeRef.current === 'detailIndex' ? currentRef.current : null}
        onSelect={openProject}
      />

      <div
        className="absolute left-0 right-0 bottom-0 z-50 text-[length:var(--kc-type-mobile-2)] font-semibold"
        style={{
          height: `calc(${BAR_H}px + env(safe-area-inset-bottom, 0px))`,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          lineHeight: 'var(--kc-leading-mobile-2)',
          letterSpacing: '-0.01em',
          color: ink,
        }}
      >
        <div ref={stripRef} className="absolute inset-0" style={{ backgroundColor: paper }} />

        <div className="relative" style={{ height: BAR_H }}>
          {/* Home: proyecto activo + Index */}
          <div ref={(el) => (groupRefs.current.home = el)} className={groupClass} style={{ display: 'none', left: MOBILE_GRID.pad - 12, right: MOBILE_GRID.pad - 12 }}>
            <button
              type="button"
              className={`${hit} flex-1 min-w-0 text-left`}
              style={hitPad}
              onClick={() => openProject(activeRef.current)}
              aria-label={`Open ${nameText(activeId)}`}
            >
              <span ref={countRef} data-split className="tabular-nums" style={{ color: muted }} />
              <span ref={nameRef} data-split style={{ marginLeft: 10 }} />
              <span data-split style={{ marginLeft: 'auto', paddingLeft: 12 }}>Open →</span>
            </button>
            <button
              type="button"
              className={hit}
              style={{ ...hitPad, color: muted }}
              onClick={openIndex}
              aria-haspopup="dialog"
              aria-expanded={indexOpen}
            >
              <span data-split>Index</span>
            </button>
          </div>

          {/* Índice abierto */}
          <div ref={(el) => (groupRefs.current.index = el)} className={groupClass} style={{ display: 'none', left: MOBILE_GRID.pad - 12, right: MOBILE_GRID.pad - 12 }}>
            <button type="button" className={hit} style={hitPad} onClick={closeIndex}>
              <span data-split>← Close</span>
            </button>
            <span className="flex items-center h-11 tabular-nums" style={{ ...hitPad, color: muted }}>
              <span data-split>{`${pad2(INDEX_ORDER.length)} entries`}</span>
            </span>
          </div>

          {/* Detalle de proyecto */}
          <div ref={(el) => (groupRefs.current.detail = el)} className={groupClass} style={{ display: 'none', left: MOBILE_GRID.pad - 12, right: MOBILE_GRID.pad - 12 }}>
            <button type="button" className={hit} style={hitPad} onClick={openIndex} aria-haspopup="dialog" aria-expanded={indexOpen}>
              <span data-split>Index</span>
            </button>
            <button type="button" className={hit} style={hitPad} onClick={() => onInfoToggle?.()} aria-expanded={infoOpen}>
              <span data-split>Info</span>
              <span className="inline-block overflow-hidden" style={{ marginLeft: '0.3em', paddingTop: MASK_CUSHION, paddingBottom: MASK_CUSHION, marginTop: `-${MASK_CUSHION}`, marginBottom: `-${MASK_CUSHION}` }}>
                <span ref={infoSignRef} data-move className="inline-block tabular-nums" style={{ width: '0.6em', textAlign: 'center' }}>
                  {infoOpen ? '−' : '+'}
                </span>
              </span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
