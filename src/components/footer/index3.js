'use client';

import { useRef, useEffect, useState } from 'react';
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { useDarkMode } from '@/contexts/DarkModeContext';

// Registrar el plugin SplitText
gsap.registerPlugin(SplitText);

export default function Footer3({ onHover, onProjectClick, isVisible = true }) {
    const { isDarkMode } = useDarkMode();
    const items = [
      { title: "Johnny Carretes", number: "01", id: "johnny" },
      { title: "Salon Vilarnau", number: "02", id: "salon" },
      { title: "Against Low Trends", number: "03", id: "alt" },
      { title: "Acid Discos", number: "04", id: "acid" },
      { title: "About", number: "Me", id: null },
    ];

    const titleRefs = useRef({});
    const numberRefs = useRef({});
    const splitInstances = useRef({});
    const backButtonRef = useRef(null);
    const clickedTitleContainerRef = useRef(null);
    const [clickedNumber, setClickedNumber] = useState(null);
    const [hoveredId, setHoveredId] = useState(null);

    // Inicializar SplitText cuando el componente se monta
    useEffect(() => {
      let isMounted = true;
      
      const timer = setTimeout(() => {
        if (!isMounted) return;
        
        items.forEach(({ number }) => {
          if (titleRefs.current[number]) {
            const titleEl = titleRefs.current[number];
            const titleSplit = new SplitText(titleEl, { 
              type: 'words,chars',
              wordsClass: 'word',
              charsClass: 'char'
            });
            
            const words = titleEl.querySelectorAll('.word');
            words.forEach((word, index) => {
              if (index < words.length - 1) {
                word.style.marginRight = '0.45em';
              }
            });
            
            splitInstances.current[`title-${number}`] = titleSplit;
          }
          
          if (numberRefs.current[number]) {
            const numberSplit = new SplitText(numberRefs.current[number], { 
              type: 'chars',
              charsClass: 'char'
            });
            splitInstances.current[`number-${number}`] = numberSplit;
          }
        });
      }, 0);

      return () => {
        isMounted = false;
        clearTimeout(timer);
        Object.values(splitInstances.current).forEach(split => {
          if (split && split.revert) {
            split.revert();
          }
        });
        splitInstances.current = {};
      };
    }, []);

    useEffect(() => {
      if (backButtonRef.current) {
        backButtonRef.current.style.color = isDarkMode ? 'white' : 'black';
      }
      if (clickedTitleContainerRef.current) {
        const titleEl = clickedTitleContainerRef.current.querySelector('h1');
        if (titleEl) {
          titleEl.style.color = isDarkMode ? 'white' : 'black';
        }
      }
    }, [isDarkMode]);

    const handleClick = (number, id) => {
      if (clickedNumber || !id) return;
      
      setClickedNumber(number);
      
      if (onProjectClick) {
        onProjectClick(id);
      }

      const clickedTitleSplit = splitInstances.current[`title-${number}`];
      const clickedTitleEl = titleRefs.current[number];
      const clickedItem = items.find(item => item.number === number);

      let totalDelay = 0;
      const delayBetweenItems = 0.4;

      items.forEach(({ number: itemNumber }, index) => {
        const titleSplit = splitInstances.current[`title-${itemNumber}`];
        const numberSplit = splitInstances.current[`number-${itemNumber}`];
        const titleEl = titleRefs.current[itemNumber];
        const numberEl = numberRefs.current[itemNumber];
        const containerEl = titleEl?.parentElement;

        if (titleSplit && numberSplit && containerEl) {
          const itemDelay = index * delayBetweenItems;
          const allChars = [...titleSplit.chars, ...numberSplit.chars];

          gsap.to(allChars, {
            x: '100vw',
            duration: 2.5,
            ease: 'power1.out',
            stagger: {
              amount: 1.2,
              from: 'start',
            },
            delay: itemDelay,
            onComplete: () => {
              if (itemNumber !== number) {
                gsap.set(containerEl, { display: 'none' });
              } else {
                gsap.set(containerEl, { display: 'none' });
              }
            },
          });

          totalDelay = Math.max(totalDelay, itemDelay + 2.5 + 1.2);
        }
      });

      if (clickedTitleSplit && clickedTitleEl && clickedItem) {
        if (clickedTitleContainerRef.current) {
          clickedTitleContainerRef.current.innerHTML = '';
          
          const backButtonContainer = document.createElement('div');
          backButtonContainer.className = 'absolute -top-6 right-0 cursor-pointer';
          backButtonContainer.style.color = isDarkMode ? 'white' : 'black';
          backButtonContainer.textContent = 'back menu';
          backButtonContainer.style.display = 'none';
          backButtonContainer.style.opacity = '0';
          backButtonContainer.addEventListener('click', handleBack);
          clickedTitleContainerRef.current.appendChild(backButtonContainer);
          
          backButtonRef.current = backButtonContainer;
          
          const newTitleEl = document.createElement('h1');
          newTitleEl.className = 'flex';
          newTitleEl.style.color = isDarkMode ? 'white' : 'black';
          newTitleEl.textContent = clickedItem.title;
          clickedTitleContainerRef.current.appendChild(newTitleEl);

          const newTitleSplit = new SplitText(newTitleEl, {
            opacity: 1,
            type: 'words,chars',
            wordsClass: 'word',
            charsClass: 'char'
          });

          const words = newTitleEl.querySelectorAll('.word');
          words.forEach((word, index) => {
            if (index < words.length - 1) {
              word.style.marginRight = '0.45em';
            }
          });

          gsap.set(newTitleSplit.chars, { 
            x: '100vw',
            opacity: 1,
          });

          gsap.set(clickedTitleContainerRef.current, { display: 'block' });

          const clickedIndex = items.findIndex(item => item.number === number);
          const clickedItemDelay = clickedIndex * delayBetweenItems;
          const reducedDelay = clickedItemDelay + 2.0;

          const getStaggerDelay = (index, total) => {
            const progress = index / total;
            const easedProgress = progress * progress;
            return easedProgress * 0.6;
          };

          const chars = newTitleSplit.chars;
          chars.forEach((char, index) => {
            gsap.to(char, {
              x: 0,
              opacity: 1,
              duration: 0.8,
              ease: 'power1.inOut',
              delay: reducedDelay + getStaggerDelay(index, chars.length),
              onComplete: () => {
                // ⭐⭐⭐ AQUÍ VA EL CALLBACK - CUANDO TERMINA LA ÚLTIMA LETRA ⭐⭐⭐
                if (index === chars.length - 1) {
                  // Notificar que la animación del título terminó
                  setTimeout(() => {
                    if (window.__footerAnimationComplete) {
                      window.__footerAnimationComplete();
                    }
                  }, 200);
                  
                  // Mostrar el botón de back cuando termine la última letra del título
                  if (backButtonRef.current) {
                    setTimeout(() => {
                      if (!backButtonRef.current) return;
                      
                      gsap.set(backButtonRef.current, { 
                        display: 'block',
                        opacity: 1 
                      });
                      
                      const backButtonSplit = new SplitText(backButtonRef.current, {
                        type: 'chars',
                        charsClass: 'char'
                      });
                      
                      splitInstances.current[`back-button`] = backButtonSplit;
                      
                      if (!backButtonSplit.chars || backButtonSplit.chars.length === 0) {
                        console.warn('No se pudieron crear chars para back menu');
                        return;
                      }
                      
                      gsap.set(backButtonSplit.chars, {
                        x: '100vw',
                      });
                      
                      const getBackStaggerDelay = (charIndex, total) => {
                        const progress = charIndex / total;
                        const easedProgress = progress * progress;
                        return easedProgress * 0.5;
                      };
                      
                      const backChars = backButtonSplit.chars;
                      
                      backChars.forEach((char, charIndex) => {
                        gsap.to(char, {
                          x: 0,
                          opacity: 1,
                          duration: 0.8,
                          ease: 'power1.inOut',
                          delay: getBackStaggerDelay(charIndex, backChars.length),
                        });
                      });
                    }, 50);
                  }
                }
              }
            });
          });

          splitInstances.current[`clicked-title`] = newTitleSplit;
        }
      }
    };

    const handleBack = () => {
      // ⭐ NOTIFICAR QUE EMPIEZA EL BACK (ocultar slider inmediatamente)
      if (window.__footerBackStarted) {
        window.__footerBackStarted();
      }
    
      const backButtonSplit = splitInstances.current[`back-button`];
      if (backButtonSplit && backButtonRef.current) {
        gsap.to(backButtonSplit.chars, {
          x: '100vw',
          duration: 0.8,
          ease: 'power2.in',
          stagger: {
            amount: 0.4,
            from: 'start',
          },
          onComplete: () => {
            if (backButtonRef.current) {
              gsap.set(backButtonRef.current, { display: 'none', });
            }
          }
        });
      }
    
      const clickedTitleSplit = splitInstances.current[`clicked-title`];
      if (clickedTitleSplit && clickedTitleContainerRef.current) {
        gsap.to(clickedTitleSplit.chars, {
          x: '100vw',
          duration: 0.8,
          ease: 'power2.in',
          stagger: {
            amount: 0.4,
            from: 'end',
          },
          onComplete: () => {
            gsap.set(clickedTitleContainerRef.current, { display: 'none' });
            
            if (clickedTitleSplit && clickedTitleSplit.revert) {
              clickedTitleSplit.revert();
            }
            delete splitInstances.current[`clicked-title`];
            
            if (backButtonSplit && backButtonSplit.revert) {
              backButtonSplit.revert();
            }
            delete splitInstances.current[`back-button`];
            
            // ⭐ ESPERAR A QUE EL SLIDER DESAPAREZCA (800ms) ANTES DE MOSTRAR LOS TÍTULOS
            setTimeout(() => {
              items.forEach(({ number: itemNumber }, index) => {
                const titleSplit = splitInstances.current[`title-${itemNumber}`];
                const numberSplit = splitInstances.current[`number-${itemNumber}`];
                const titleEl = titleRefs.current[itemNumber];
                const numberEl = numberRefs.current[itemNumber];
                const containerEl = titleEl?.parentElement;
    
                if (titleSplit && numberSplit && containerEl) {
                  gsap.set(containerEl, { display: 'flex' });
    
                  const allChars = [...titleSplit.chars, ...numberSplit.chars];
                  const reverseDelay = (items.length - 1 - index) * 0.3;
                  
                  gsap.fromTo(allChars,
                    { x: '100vw', },
                    {
                      x: 0,
                      opacity: 1,
                      duration: 1.5,
                      ease: 'power2.out',
                      stagger: {
                        amount: 0.8,
                        from: 'end',
                      },
                      delay: reverseDelay
                    }
                  );
                }
              });
    
              setTimeout(() => {
                setClickedNumber(null);
                
                if (onProjectClick) {
                  onProjectClick(null);
                }
              }, 2000);
            }, 800); // ⭐ Esperar 800ms (duración del fade out del slider)
          }
        });
      }
    };
  
    return (
      <div
        className="flex bottom-4 left-4 right-4 z-50 text-[clamp(1.25rem,2vw,1.5rem)] leading-[0.95] absolute transition-opacity duration-700"
        style={{
          opacity: isVisible ? 1 : 0,
          pointerEvents: isVisible ? 'auto' : 'none'
        }}
        onMouseLeave={() => {
          if (!clickedNumber) {
            setHoveredId(null);
            onHover(null);
          }
        }}
      >
        <div className="flex w-1/2" />
  
        <div className="flex w-1/2 flex-col whitespace-nowrap relative">
          <div
            ref={clickedTitleContainerRef}
            className="absolute bottom-0 right-0 whitespace-nowrap"
            style={{ display: 'none' }}
          >
          </div>

          {items.map(({ title, number, id }) => (
            <div
              key={number}
              className="flex justify-between cursor-pointer transition-colors duration-300 ease-in-out"
              style={{
                color: hoveredId && hoveredId !== id 
                  ? (isDarkMode ? '#9ca3af' : '#6b7280')
                  : (isDarkMode ? 'white' : 'black')
              }}
              onMouseEnter={() => {
                if (id && !clickedNumber) {
                  setHoveredId(id);
                  onHover(id);
                }
              }}
              onMouseLeave={() => {
                if (!clickedNumber) {
                  setHoveredId(null);
                }
              }}
              onClick={() => handleClick(number, id || number)}
            >
              <h1 
                ref={el => titleRefs.current[number] = el}
                className="flex"
                style={{ color: isDarkMode ? 'white' : 'black' }}
              >
                {title}
              </h1>
              <p 
                ref={el => numberRefs.current[number] = el}
                className="flex text-right w-[2ch]"
                style={{ color: isDarkMode ? 'white' : 'black' }}
              >
                {number}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }