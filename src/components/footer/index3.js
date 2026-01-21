'use client';

import { useRef, useEffect, useState } from 'react';
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { useDarkMode } from '@/contexts/DarkModeContext';

// Registrar el plugin SplitText
gsap.registerPlugin(SplitText);

export default function Footer3({ onHover, onProjectClick }) {
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
      
      // Pequeño delay para asegurar que los refs estén listos
      const timer = setTimeout(() => {
        if (!isMounted) return;
        
        items.forEach(({ number }) => {
          // Inicializar SplitText para títulos (words y chars)
          if (titleRefs.current[number]) {
            const titleEl = titleRefs.current[number];
            const titleSplit = new SplitText(titleEl, { 
              type: 'words,chars',
              wordsClass: 'word',
              charsClass: 'char'
            });
            
            // Añadir espacios entre palabras
            const words = titleEl.querySelectorAll('.word');
            words.forEach((word, index) => {
              if (index < words.length - 1) {
                word.style.marginRight = '0.45em';
              }
            });
            
            splitInstances.current[`title-${number}`] = titleSplit;
          }
          
          // Inicializar SplitText para números
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
        // Limpiar instancias de SplitText al desmontar
        Object.values(splitInstances.current).forEach(split => {
          if (split && split.revert) {
            split.revert();
          }
        });
        splitInstances.current = {};
      };
    }, []);

    // Actualizar elementos dinámicos cuando cambia el dark mode
    useEffect(() => {
      if (backButtonRef.current) {
        backButtonRef.current.style.color = isDarkMode ? 'white' : 'black';
      }
      // Actualizar el título clickeado si existe
      if (clickedTitleContainerRef.current) {
        const titleEl = clickedTitleContainerRef.current.querySelector('h1');
        if (titleEl) {
          titleEl.style.color = isDarkMode ? 'white' : 'black';
        }
      }
    }, [isDarkMode]);

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
            
            duration: 2.5, // Duración mucho más lenta
            ease: 'power1.out',
            stagger: {
              amount: 1.2, // Stagger más largo para que las letras salgan poco a poco
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

      // Segundo: después de que todos salgan, mostrar el título clickeado en la parte derecha
      if (clickedTitleSplit && clickedTitleEl && clickedItem) {
        // Crear o mostrar el contenedor del título clickeado en la parte derecha
        if (clickedTitleContainerRef.current) {
          // Limpiar el contenido anterior
          clickedTitleContainerRef.current.innerHTML = '';
          
          // Crear contenedor para el botón back menu
          const backButtonContainer = document.createElement('div');
          backButtonContainer.className = 'absolute -top-6 right-0 cursor-pointer';
          backButtonContainer.style.color = isDarkMode ? 'white' : 'black';
          backButtonContainer.textContent = 'back menu';
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

          // Calcular el delay reducido (menos tiempo de espera)
          const clickedIndex = items.findIndex(item => item.number === number);
          const clickedItemDelay = clickedIndex * delayBetweenItems;
          // Reducir el delay - empezar antes de que termine completamente la salida
          const reducedDelay = clickedItemDelay + 2.0; // Empezar antes de que termine completamente

          // Función para stagger progresivo (empieza lento y se acelera)
          const getStaggerDelay = (index, total) => {
            // Los primeros caracteres tienen más delay, luego se acelera
            const progress = index / total;
            // Curva que empieza lento y se acelera: progresión cuadrática
            const easedProgress = progress * progress;
            return easedProgress * 0.6; // Total de 0.6 segundos de stagger
          };

          // Animar entrada del título clickeado desde la derecha con easing progresivo
          const chars = newTitleSplit.chars;
          chars.forEach((char, index) => {
            gsap.to(char, {
              x: 0,
              opacity: 1,
              duration: 0.8,
              ease: 'power1.inOut', // Easing que empieza lento y se acelera
              delay: reducedDelay + getStaggerDelay(index, chars.length),
              onComplete: () => {
                // Mostrar el botón de back cuando termine la última letra del título
                if (index === chars.length - 1 && backButtonRef.current) {
                  // Pequeño delay para asegurar que el DOM esté listo
                  setTimeout(() => {
                    if (!backButtonRef.current) return;
                    
                    // Asegurar que el botón sea visible antes de inicializar SplitText
                    gsap.set(backButtonRef.current, { 
                      display: 'block',
                      opacity: 1 
                    });
                    
                    // Inicializar SplitText para el botón back menu
                    const backButtonSplit = new SplitText(backButtonRef.current, {
                      type: 'chars',
                      charsClass: 'char'
                    });
                    
                    // Guardar la instancia
                    splitInstances.current[`back-button`] = backButtonSplit;
                    
                    // Verificar que se crearon los chars
                    if (!backButtonSplit.chars || backButtonSplit.chars.length === 0) {
                      console.warn('No se pudieron crear chars para back menu');
                      return;
                    }
                    
                    // Posicionar los chars fuera de pantalla inicialmente
                    gsap.set(backButtonSplit.chars, {
                      x: '100vw',
                                          });
                    
                    // Función para stagger progresivo del botón (igual que el título)
                    const getBackStaggerDelay = (charIndex, total) => {
                      const progress = charIndex / total;
                      const easedProgress = progress * progress;
                      return easedProgress * 0.5; // Total de 0.5 segundos de stagger
                    };
                    
                    // Animar entrada del botón letra por letra desde la derecha
                    const backChars = backButtonSplit.chars;
                    const totalDelay = getBackStaggerDelay(backChars.length - 1, backChars.length);
                    
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
            });
          });

          // Guardar la instancia para poder revertirla después
          splitInstances.current[`clicked-title`] = newTitleSplit;
        }
      }
    };

    // Función para volver al menú inicial
    const handleBack = () => {
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
            // Ocultar el botón completamente después de la animación
            if (backButtonRef.current) {
              gsap.set(backButtonRef.current, { display: 'none', });
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

            // Resetear el estado después de un delay
            setTimeout(() => {
              setClickedNumber(null);
              
              // Notificar al componente padre que se cerró el proyecto
              if (onProjectClick) {
                onProjectClick(null);
              }
            }, 2000);
          }
        });
      }
    };
  
    return (
      <div
        className="flex bottom-4 left-4 right-4 z-50 text-[clamp(1.25rem,2vw,1.5rem)] leading-[0.95] absolute"
        onMouseLeave={() => {
          setHoveredId(null);
          onHover(null);
        }}
      >
        <div className="flex w-1/2" />
  
        <div className="flex w-1/2 flex-col whitespace-nowrap relative">
          {/* Contenedor para el título clickeado (parte derecha, bottom) */}
          <div
            ref={clickedTitleContainerRef}
            className="absolute bottom-0 right-0 whitespace-nowrap"
            style={{ display: 'none' }}
          >
            {/* El contenido se añadirá dinámicamente */}
          </div>

          {/* Botón de back - se creará dinámicamente dentro del contenedor del título clickeado */}

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
                if (id) {
                  setHoveredId(id);
                  onHover(id);
                }
              }}
              onMouseLeave={() => {
                setHoveredId(null);
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