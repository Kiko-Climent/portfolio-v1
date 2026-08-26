'use client';

import { useRef, useEffect, useState } from 'react';
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { useDarkMode } from '@/contexts/DarkModeContext';

gsap.registerPlugin(SplitText);

const MASK_CUSHION = '0.25em';

const ANIM = {
  menuOut: {
    duration: 0.5,
    ease: 'power3.in',
    staggerEach: 0.012,
    rowCascade: 0.05,
    yPercent: -140,
  },
  titleIn: {
    at: 0.45,
    duration: 0.9,
    ease: 'power4.out',
    staggerEach: 0.03,
    fromYPercent: 140,
  },
  backIn: {
    duration: 0.6,
    ease: 'power4.out',
    staggerEach: 0.022,
    fromYPercent: 140,
  },
  backOut: {
    duration: 0.45,
    ease: 'power3.in',
    staggerEach: 0.018,
    yPercent: -140,
  },
  menuRestore: {
    duration: 0.8,
    ease: 'power4.out',
    staggerEach: 0.016,
    rowCascade: 0.06,
    fromYPercent: 140,
  },
};

export default function FooterMobile({ onProjectClick }) {
  const { isDarkMode } = useDarkMode();

  const items = [
    { title: 'Johnny Carretes', number: '01', id: 'johnny' },
    { title: 'Salon Vilarnau', number: '02', id: 'salon' },
    { title: 'Against Low Trends', number: '03', id: 'alt' },
    { title: 'MM Discos', number: '04', id: 'mmdiscos' },
    { title: 'About', number: 'Me', id: 'about' },
  ];

  const titleRefs = useRef({});
  const numberRefs = useRef({});
  const splitInstances = useRef({});
  const backButtonRef = useRef(null);
  const clickedTitleContainerRef = useRef(null);
  const isDarkModeRef = useRef(isDarkMode);
  isDarkModeRef.current = isDarkMode;

  const [clickedNumber, setClickedNumber] = useState(null);

  const applyColor = (chars) => {
    chars.forEach((char) => {
      char.style.color = isDarkModeRef.current ? 'white' : 'black';
    });
  };

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
      if (index < words.length - 1) word.style.marginRight = '0.45em';
    });
    applyColor(split.chars);
    cushionMask(split.chars);
    return split;
  };

  const splitPlain = (el) => {
    const split = new SplitText(el, { type: 'chars', mask: 'chars', charsClass: 'char' });
    applyColor(split.chars);
    cushionMask(split.chars);
    return split;
  };

  useEffect(() => {
    let isMounted = true;

    const timer = setTimeout(() => {
      if (!isMounted) return;

      items.forEach(({ number }) => {
        if (titleRefs.current[number]) {
          splitInstances.current[`title-${number}`] = splitTitle(titleRefs.current[number]);
        }
        if (numberRefs.current[number]) {
          splitInstances.current[`number-${number}`] = splitPlain(numberRefs.current[number]);
        }
      });
    }, 0);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      Object.values(splitInstances.current).forEach((split) => {
        split?.revert?.();
      });
      splitInstances.current = {};
    };
  }, []);

  useEffect(() => {
    const color = isDarkMode ? 'white' : 'black';

    Object.values(splitInstances.current).forEach((split) => {
      if (!split?.chars) return;
      split.chars.forEach((char) => {
        char.style.color = color;
      });
    });

    if (backButtonRef.current) {
      backButtonRef.current.style.color = color;
    }
    if (clickedTitleContainerRef.current) {
      const h1 = clickedTitleContainerRef.current.querySelector('h1');
      if (h1) h1.style.color = color;
    }
  }, [isDarkMode]);

  const animateMenuOut = (tl) => {
    items.forEach(({ number: itemNumber }, index) => {
      const titleSplit = splitInstances.current[`title-${itemNumber}`];
      const numberSplit = splitInstances.current[`number-${itemNumber}`];
      const containerEl = titleRefs.current[itemNumber]?.parentElement;
      if (!titleSplit || !numberSplit || !containerEl) return;

      const allChars = [...titleSplit.chars, ...numberSplit.chars];
      tl.to(
        allChars,
        {
          yPercent: ANIM.menuOut.yPercent,
          duration: ANIM.menuOut.duration,
          ease: ANIM.menuOut.ease,
          stagger: ANIM.menuOut.staggerEach,
          force3D: true,
          onComplete: () => gsap.set(containerEl, { display: 'none' }),
        },
        index * ANIM.menuOut.rowCascade
      );
    });
  };

  const restoreMenu = () => {
    const tl = gsap.timeline({
      onComplete: () => {
        setClickedNumber(null);
        if (onProjectClick) onProjectClick(null);
      },
    });

    items.forEach(({ number: itemNumber }, index) => {
      const titleSplit = splitInstances.current[`title-${itemNumber}`];
      const numberSplit = splitInstances.current[`number-${itemNumber}`];
      const containerEl = titleRefs.current[itemNumber]?.parentElement;
      if (!titleSplit || !numberSplit || !containerEl) return;

      gsap.set(containerEl, { display: 'flex' });
      const allChars = [...titleSplit.chars, ...numberSplit.chars];

      tl.fromTo(
        allChars,
        { yPercent: ANIM.menuRestore.fromYPercent },
        {
          yPercent: 0,
          duration: ANIM.menuRestore.duration,
          ease: ANIM.menuRestore.ease,
          stagger: ANIM.menuRestore.staggerEach,
          force3D: true,
        },
        index * ANIM.menuRestore.rowCascade
      );
    });
  };

  const revealBackButton = () => {
    const el = backButtonRef.current;
    if (!el) return;

    gsap.set(el, { display: 'block', opacity: 1 });

    const backSplit = splitPlain(el);
    splitInstances.current['back-button'] = backSplit;
    if (!backSplit.chars || backSplit.chars.length === 0) return;

    gsap.fromTo(
      backSplit.chars,
      { yPercent: ANIM.backIn.fromYPercent },
      {
        yPercent: 0,
        duration: ANIM.backIn.duration,
        ease: ANIM.backIn.ease,
        stagger: ANIM.backIn.staggerEach,
        force3D: true,
      }
    );
  };

  const handleBack = () => {
    if (window.__footerBackStarted) window.__footerBackStarted();

    const backSplit = splitInstances.current['back-button'];
    const titleSplit = splitInstances.current['clicked-title'];

    const hideCenterUi = () => {
      if (clickedTitleContainerRef.current) {
        gsap.set(clickedTitleContainerRef.current, { display: 'none' });
        clickedTitleContainerRef.current.innerHTML = '';
      }
      backButtonRef.current = null;
      if (titleSplit?.revert) titleSplit.revert();
      if (backSplit?.revert) backSplit.revert();
      delete splitInstances.current['clicked-title'];
      delete splitInstances.current['back-button'];
    };

    // About: no hay título ni "back home" en el centro; solo restaurar menú
    if (!titleSplit && !backSplit) {
      hideCenterUi();
      restoreMenu();
      return;
    }

    const tl = gsap.timeline({
      onComplete: () => {
        hideCenterUi();
        restoreMenu();
      },
    });

    if (backSplit && backButtonRef.current) {
      tl.to(
        backSplit.chars,
        {
          yPercent: ANIM.backOut.yPercent,
          duration: ANIM.backOut.duration,
          ease: ANIM.backOut.ease,
          stagger: ANIM.backOut.staggerEach,
          force3D: true,
        },
        0
      );
    }

    if (titleSplit && clickedTitleContainerRef.current) {
      tl.to(
        titleSplit.chars,
        {
          yPercent: ANIM.backOut.yPercent,
          duration: ANIM.backOut.duration,
          ease: ANIM.backOut.ease,
          stagger: ANIM.backOut.staggerEach,
          force3D: true,
        },
        0
      );
    }
  };

  const handleBackRef = useRef(handleBack);
  handleBackRef.current = handleBack;

  useEffect(() => {
    window.__footerMobileRequestBack = () => handleBackRef.current?.();
    return () => {
      delete window.__footerMobileRequestBack;
    };
  }, []);

  const handleClick = (number, id) => {
    if (clickedNumber || !id) return;

    setClickedNumber(number);
    if (onProjectClick) onProjectClick(id);

    const clickedItem = items.find((item) => item.number === number);
    const isAbout = id === 'about';
    let newTitleSplit = null;

    if (!isAbout && clickedItem && clickedTitleContainerRef.current) {
      clickedTitleContainerRef.current.innerHTML = '';

      const backButtonEl = document.createElement('div');
      backButtonEl.className = 'absolute -top-6 left-0 cursor-pointer';
      backButtonEl.style.color = isDarkMode ? 'white' : 'black';
      backButtonEl.textContent = 'back home';
      backButtonEl.style.display = 'none';
      backButtonEl.addEventListener('click', () => handleBackRef.current?.());
      clickedTitleContainerRef.current.appendChild(backButtonEl);
      backButtonRef.current = backButtonEl;

      const newTitleEl = document.createElement('h1');
      newTitleEl.className = 'flex';
      newTitleEl.style.color = isDarkMode ? 'white' : 'black';
      newTitleEl.textContent = clickedItem.title;
      clickedTitleContainerRef.current.appendChild(newTitleEl);

      newTitleSplit = splitTitle(newTitleEl);
      splitInstances.current['clicked-title'] = newTitleSplit;

      gsap.set(newTitleSplit.chars, { yPercent: ANIM.titleIn.fromYPercent });
      gsap.set(clickedTitleContainerRef.current, { display: 'block' });
    }

    const tl = gsap.timeline();
    animateMenuOut(tl);

    if (isAbout) {
      tl.eventCallback('onComplete', () => {
        window.__footerAnimationComplete?.();
      });
      return;
    }

    if (!newTitleSplit) return;

    tl.to(
      newTitleSplit.chars,
      {
        yPercent: 0,
        duration: ANIM.titleIn.duration,
        ease: ANIM.titleIn.ease,
        stagger: ANIM.titleIn.staggerEach,
        force3D: true,
        onComplete: () => {
          window.__footerAnimationComplete?.();
          revealBackButton();
        },
      },
      ANIM.titleIn.at
    );
  };

  return (
    <>
      <div
        ref={clickedTitleContainerRef}
        className="absolute top-1/2 left-4 -translate-y-1/2 z-50 text-[clamp(1.0625rem,1.75vw,1.3125rem)] font-semibold leading-[1.1] whitespace-nowrap"
        style={{ display: 'none' }}
      />

      <div
        className="absolute left-4 right-4 z-50 text-[clamp(1.0625rem,1.75vw,1.3125rem)] font-semibold leading-[1.1]"
        style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="flex flex-col gap-y-1 whitespace-nowrap relative w-full">
          {items.map(({ title, number, id }) => (
            <div
              key={number}
              className="flex w-full justify-between cursor-pointer py-1.5"
              onClick={() => handleClick(number, id || number)}
            >
              <h1
                ref={(el) => (titleRefs.current[number] = el)}
                className="flex text-left"
                style={{ color: isDarkMode ? 'white' : 'black' }}
              >
                {title}
              </h1>

              <p
                ref={(el) => (numberRefs.current[number] = el)}
                className="flex justify-end w-[2ch] tabular-nums"
                style={{ color: isDarkMode ? 'white' : 'black' }}
              >
                {number}
              </p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
