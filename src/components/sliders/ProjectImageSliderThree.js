'use client';

import { useEffect, useState, useRef } from 'react';
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { useDarkMode } from '@/contexts/DarkModeContext';
import SliderThree2 from '../SliderThree/index2';
import SliderThree4 from '../SliderThree/index4';
import SliderThree3 from '../SliderThree/index3';

gsap.registerPlugin(SplitText);

/**
 * Reveal editorial por líneas (mismo lenguaje que el footer):
 * cada línea del bloque de info sube desde su propia máscara
 * (overflow:clip) con stagger + easing. En body copy multilínea
 * el mask por líneas es más limpio que char a char.
 */
const INFO_ANIM = {
  cushion: '0.2em',   // colchón inferior para no cortar descendentes (g, y, j)
  fromYPercent: 130,  // > (lineHeight + cushion) / lineHeight, para ocultar del todo
  duration: 0.9,
  ease: 'power4.out',
  stagger: 0.09,
  delay: 0.12,
  out: {
    yPercent: -130,
    duration: 0.5,
    ease: 'power3.in',
    stagger: 0.05,
  },
};

export default function ProjectImageSliderThree({ project, shouldHide = false }) {
    const { isDarkMode } = useDarkMode();
    const [isVisible, setIsVisible] = useState(false);
    const textRef = useRef(null);
    const splitRef = useRef(null);

    if (!project || !project.slider) return null;

    const { images = [], text } = project.slider;

    if (!images.length) return null;

    const [navbarHeight, setNavbarHeight] = useState(0);
    const isAbout = project.id === 'about';

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsVisible(true);
        }, 50);

        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (shouldHide) {
            setIsVisible(false);
        }
    }, [shouldHide]);

    useEffect(() => {
        const updateNavbarHeight = () => {
            const navbar = document.querySelector('[data-navbar]');
            if (navbar) {
                setNavbarHeight(navbar.getBoundingClientRect().height + 16);
            }
        };

        updateNavbarHeight();
        window.addEventListener('resize', updateNavbarHeight);
        return () => window.removeEventListener('resize', updateNavbarHeight);
    }, []);

    // Reveal por líneas del bloque de info
    useEffect(() => {
        if (!textRef.current) return undefined;

        let split;
        const timer = setTimeout(() => {
            split = new SplitText(textRef.current, {
                type: 'lines',
                mask: 'lines',
                linesClass: 'info-line',
            });
            splitRef.current = split;

            // Colchón inferior en la máscara: el descendente entra en la zona
            // visible y el margin negativo idéntico mantiene el interlineado.
            split.lines.forEach((line) => {
                const wrap = line.parentElement;
                if (!wrap) return;
                wrap.style.paddingBottom = INFO_ANIM.cushion;
                wrap.style.marginBottom = `-${INFO_ANIM.cushion}`;
            });

            gsap.set(split.lines, { yPercent: INFO_ANIM.fromYPercent });
            gsap.to(split.lines, {
                yPercent: 0,
                duration: INFO_ANIM.duration,
                ease: INFO_ANIM.ease,
                stagger: INFO_ANIM.stagger,
                delay: INFO_ANIM.delay,
                force3D: true,
            });
        }, 60);

        return () => {
            clearTimeout(timer);
            if (split && split.revert) split.revert();
        };
    }, [project?.id]);

    // Salida por líneas al volver al menú
    useEffect(() => {
        if (!shouldHide || !splitRef.current) return;
        gsap.to(splitRef.current.lines, {
            yPercent: INFO_ANIM.out.yPercent,
            duration: INFO_ANIM.out.duration,
            ease: INFO_ANIM.out.ease,
            stagger: INFO_ANIM.out.stagger,
            force3D: true,
        });
    }, [shouldHide]);

    // Función para obtener la ruta de la imagen de about
    const getAboutImageSrc = () => {
        if (isAbout && images[0]) {
            return `${project.imagesPath}/about.png`;
        }
        return null;
    };

    return (
        <div
            className="fixed top-0 left-0 w-full h-screen flex z-10 transition-opacity"
            style={{
              opacity: isVisible ? 1 : 0,
              transitionDuration: '0.8s' // ⭐ MISMO TIMING QUE LA ANIMACIÓN DEL FOOTER
            }}
        >
            <div className='w-1/2'>
                <div
                    ref={textRef}
                    className="absolute bottom-4 left-4 max-w-[42vw] pr-12 text-[clamp(1.0625rem,1.75vw,1.3125rem)] leading-[1]"
                >
                    {text.url ? (
                        <a
                            href={text.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: isDarkMode ? 'white' : 'black' }}
                            className="hover:opacity-80 transition-opacity"
                        >
                            {text.title}
                        </a>
                    ) : (
                        <span style={{ color: isDarkMode ? 'white' : 'black' }}>
                            {text.title}
                        </span>
                    )}{' '}
                    <span
                        style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}
                        className="lowercase"
                    >
                        {text.description}
                    </span>
                </div>
            </div>

            <div className="relative w-1/2 h-screen" style={{ minHeight: '100vh' }}>
                {isAbout ? (
                    // Vista estática para About: imagen repetida 2-3 veces en columna
                    <div
                        className="flex flex-col items-center justify-center h-full gap-8 px-8"
                        style={{ paddingTop: `${navbarHeight}px` }}
                    >
                        {[1, 2, 3].map((index) => (
                            <img
                                key={index}
                                src={getAboutImageSrc()}
                                alt="About"
                                className="object-contain"
                                style={{
                                    width: images[0]?.width || '40%',
                                    maxHeight: 'calc((100vh - 200px) / 3)',
                                }}
                            />
                        ))}
                    </div>
                ) : (
                    // SliderThree para los demás proyectos
                    <SliderThree4
                        images={images}
                        project={project}
                        navbarHeight={navbarHeight}
                    />
                )}
            </div>
        </div>
    );
}
