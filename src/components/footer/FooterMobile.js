'use client';

import { useRef, useEffect, useState } from 'react';
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { useDarkMode } from '@/contexts/DarkModeContext';

gsap.registerPlugin(SplitText);

export default function FooterMobile({ onProjectClick }) {
  const { isDarkMode } = useDarkMode();

  const items = [
    { title: "Johnny Carretes", number: "01", id: "johnny" },
    { title: "Salon Vilarnau", number: "02", id: "salon" },
    { title: "Against Low Trends", number: "03", id: "alt" },
    { title: "Acid Discos", number: "04", id: "acid" },
    { title: "About", number: "Me", id: "about" },
  ];

  const titleRefs = useRef({});
  const numberRefs = useRef({});
  const splitInstances = useRef({});
  const backButtonRef = useRef(null);
  const clickedTitleContainerRef = useRef(null);

  const [clickedNumber, setClickedNumber] = useState(null);

  // Inicializar SplitText
  useEffect(() => {
    let isMounted = true;

    const timer = setTimeout(() => {
      if (!isMounted) return;

      items.forEach(({ number }) => {
        if (titleRefs.current[number]) {
          const titleEl = titleRefs.current[number];
          const split = new SplitText(titleEl, {
            type: 'words,chars',
            wordsClass: 'word',
            charsClass: 'char',
          });

          titleEl.querySelectorAll('.word').forEach((word, i, arr) => {
            if (i < arr.length - 1) {
              word.style.marginRight = '0.45em';
            }
          });

          splitInstances.current[`title-${number}`] = split;
        }

        if (numberRefs.current[number]) {
          splitInstances.current[`number-${number}`] = new SplitText(
            numberRefs.current[number],
            { type: 'chars', charsClass: 'char' }
          );
        }
      });
    }, 0);

    return () => {
      isMounted = false;
      clearTimeout(timer);

      Object.values(splitInstances.current).forEach(split => {
        split?.revert?.();
      });

      splitInstances.current = {};
    };
  }, []);

  // Dark mode sync
  useEffect(() => {
    if (backButtonRef.current) {
      backButtonRef.current.style.color = isDarkMode ? 'white' : 'black';
    }

    if (clickedTitleContainerRef.current) {
      const h1 = clickedTitleContainerRef.current.querySelector('h1');
      if (h1) h1.style.color = isDarkMode ? 'white' : 'black';
    }
  }, [isDarkMode]);

  // Función para volver al menú inicial
  const handleBack = () => {
    // ⭐ NOTIFICAR QUE EMPIEZA EL BACK (ocultar slider)
    if (window.__footerBackStarted) {
      window.__footerBackStarted();
    }

    // Ocultar el botón de back letra por letra
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
            gsap.set(backButtonRef.current, { display: 'none' });
          }
        }
      });
    }

    // Ocultar el título clickeado
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
          
          // Revertir SplitText del título clickeado
          if (clickedTitleSplit && clickedTitleSplit.revert) {
            clickedTitleSplit.revert();
          }
          delete splitInstances.current[`clicked-title`];
          
          // Revertir SplitText del botón back
          if (backButtonSplit && backButtonSplit.revert) {
            backButtonSplit.revert();
          }
          delete splitInstances.current[`back-button`];
          
          // ⭐ ESPERAR A QUE EL SLIDER DESAPAREZCA (800ms) ANTES DE MOSTRAR LOS TÍTULOS
          setTimeout(() => {
            // Restaurar el menú
            items.forEach(({ number: itemNumber }, index) => {
              const titleSplit = splitInstances.current[`title-${itemNumber}`];
              const numberSplit = splitInstances.current[`number-${itemNumber}`];
              const titleEl = titleRefs.current[itemNumber];
              const numberEl = numberRefs.current[itemNumber];
              const containerEl = titleEl?.parentElement;

              if (titleSplit && numberSplit && containerEl) {
                // Mostrar el contenedor
                gsap.set(containerEl, { display: 'flex' });

                // Animar chars del título y caracteres del número de vuelta
                const allChars = [...titleSplit.chars, ...numberSplit.chars];
                
                // Delay inverso para que aparezcan en orden inverso
                const reverseDelay = (items.length - 1 - index) * 0.3;
                
                gsap.fromTo(allChars,
                  { x: '100vw' },
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

            // Resetear el estado después de un delay
            setTimeout(() => {
              setClickedNumber(null);
              
              // Notificar al componente padre que se cerró el proyecto
              if (onProjectClick) {
                onProjectClick(null);
              }
            }, 2000);
          }, 800); // ⭐ Esperar 800ms (duración del fade out del slider)
        }
      });
    }
  };

  // Función para animar la salida de los elementos no seleccionados
  const handleClick = (number, id) => {
    // No hacer nada si ya hay uno clickeado o si no hay id (About Me)
    if (clickedNumber || !id) return;
    
    setClickedNumber(number);
    
    // Notificar al componente padre sobre el proyecto seleccionado
    if (onProjectClick) {
      onProjectClick(id);
    }

    const clickedTitleSplit = splitInstances.current[`title-${number}`];
    const clickedTitleEl = titleRefs.current[number];
    const clickedItem = items.find(item => item.number === number);

    // Calcular el delay total necesario para que todos los títulos salgan
    let totalDelay = 0;
    const delayBetweenItems = 0.4; // Delay entre cada título

    // Primero: animar TODOS los títulos hacia la derecha con delays progresivos
    items.forEach(({ number: itemNumber }, index) => {
      const titleSplit = splitInstances.current[`title-${itemNumber}`];
      const numberSplit = splitInstances.current[`number-${itemNumber}`];
      const titleEl = titleRefs.current[itemNumber];
      const numberEl = numberRefs.current[itemNumber];
      const containerEl = titleEl?.parentElement;

      if (titleSplit && numberSplit && containerEl) {
        // Delay progresivo para cada título
        const itemDelay = index * delayBetweenItems;
        
        // Animar chars del título y caracteres del número hacia la derecha
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
            // Ocultar contenedores de items no clickeados
            if (itemNumber !== number) {
              gsap.set(containerEl, { display: 'none' });
            } else {
              // Para el título clickeado, ocultar el contenedor después de la animación
              gsap.set(containerEl, { display: 'none' });
            }
          },
        });

        // Actualizar el delay total (incluyendo el título clickeado)
        totalDelay = Math.max(totalDelay, itemDelay + 2.5 + 1.2);
      }
    });

    // Segundo: después de que todos salgan, mostrar el título clickeado en el centro, pegado a la izquierda
    if (clickedTitleSplit && clickedTitleEl && clickedItem) {
      // Crear o mostrar el contenedor del título clickeado en el centro, pegado a la izquierda
      if (clickedTitleContainerRef.current) {
        // Limpiar el contenido anterior
        clickedTitleContainerRef.current.innerHTML = '';
        
        // Crear contenedor para el botón back home
        const backButtonContainer = document.createElement('div');
        backButtonContainer.className = 'absolute -top-6 left-0 cursor-pointer';
        backButtonContainer.style.color = isDarkMode ? 'white' : 'black';
        backButtonContainer.textContent = 'back home';
        backButtonContainer.style.display = 'none';
        backButtonContainer.style.opacity = '0';
        backButtonContainer.addEventListener('click', handleBack);
        clickedTitleContainerRef.current.appendChild(backButtonContainer);
        
        // Actualizar la referencia del botón
        backButtonRef.current = backButtonContainer;
        
        // Crear un nuevo elemento para el título clickeado
        const newTitleEl = document.createElement('h1');
        newTitleEl.className = 'flex';
        newTitleEl.style.color = isDarkMode ? 'white' : 'black';
        newTitleEl.textContent = clickedItem.title;
        clickedTitleContainerRef.current.appendChild(newTitleEl);

        // Inicializar SplitText para el nuevo título
        const newTitleSplit = new SplitText(newTitleEl, {
          opacity: 1,
          type: 'words,chars',
          wordsClass: 'word',
          charsClass: 'char'
        });

        // Añadir espacios entre palabras
        const words = newTitleEl.querySelectorAll('.word');
        words.forEach((word, index) => {
          if (index < words.length - 1) {
            word.style.marginRight = '0.45em';
          }
        });

        // Posicionar el título fuera de pantalla inicialmente
        gsap.set(newTitleSplit.chars, { 
          x: '100vw',
          opacity: 1,
        });

        // Mostrar el contenedor
        gsap.set(clickedTitleContainerRef.current, { display: 'block' });

        // Calcular el delay reducido
        const clickedIndex = items.findIndex(item => item.number === number);
        const clickedItemDelay = clickedIndex * delayBetweenItems;
        const reducedDelay = clickedItemDelay + 2.0;

        // Función para stagger progresivo
        const getStaggerDelay = (index, total) => {
          const progress = index / total;
          const easedProgress = progress * progress;
          return easedProgress * 0.6;
        };

        // Animar entrada del título clickeado desde la derecha con easing progresivo
        const chars = newTitleSplit.chars;
        chars.forEach((char, index) => {
          gsap.to(char, {
            x: 0,
            opacity: 1,
            duration: 0.8,
            ease: 'power1.inOut',
            delay: reducedDelay + getStaggerDelay(index, chars.length),
            onComplete: () => {
              // ⭐ CUANDO TERMINA LA ÚLTIMA LETRA, NOTIFICAR QUE LA ANIMACIÓN COMPLETÓ
              if (index === chars.length - 1) {
                // Notificar al padre que la animación del título terminó
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
                    
                    // Inicializar SplitText para el botón back home
                    const backButtonSplit = new SplitText(backButtonRef.current, {
                      type: 'chars',
                      charsClass: 'char'
                    });
                    
                    splitInstances.current[`back-button`] = backButtonSplit;
                    
                    if (!backButtonSplit.chars || backButtonSplit.chars.length === 0) {
                      console.warn('No se pudieron crear chars para back home');
                      return;
                    }
                    
                    // Posicionar los chars fuera de pantalla inicialmente
                    gsap.set(backButtonSplit.chars, {
                      x: '100vw',
                    });
                    
                    // Función para stagger progresivo del botón
                    const getBackStaggerDelay = (charIndex, total) => {
                      const progress = charIndex / total;
                      const easedProgress = progress * progress;
                      return easedProgress * 0.5;
                    };
                    
                    // Animar entrada del botón letra por letra desde la derecha
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

        // Guardar la instancia para poder revertirla después
        splitInstances.current[`clicked-title`] = newTitleSplit;
      }
    }
  };

  // ⬇️ JSX
  return (
    <>
      {/* Contenedor para el título clickeado (centro de la interfaz, pegado a la izquierda) */}
      <div
        ref={clickedTitleContainerRef}
        className="absolute top-1/2 left-4 -translate-y-1/2 z-50 text-[clamp(1rem,1.5vw,1.5rem)] leading-[0.95] whitespace-nowrap"
        style={{ display: 'none' }}
      />

      <div
        className="absolute left-4 right-4 z-50 text-[clamp(1rem,1.5vw,1.5rem)] leading-[0.95]"
        style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="flex flex-col whitespace-nowrap relative w-full">
          {items.map(({ title, number, id }) => (
            <div
              key={number}
              className="flex w-full justify-between cursor-pointer"
              onClick={() => handleClick(number, id || number)}
            >
              <h1
                ref={el => (titleRefs.current[number] = el)}
                className="flex text-left"
                style={{ color: isDarkMode ? 'white' : 'black' }}
              >
                {title}
              </h1>

              <p
                ref={el => (numberRefs.current[number] = el)}
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