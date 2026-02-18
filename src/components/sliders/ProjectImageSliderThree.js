'use client';

import { useEffect, useState } from 'react';
import { useDarkMode } from '@/contexts/DarkModeContext';
import SliderThree from '@/components/SliderThree/index';
import SliderThree2 from '../SliderThree/index2';

export default function ProjectImageSliderThree({ project, shouldHide = false }) {
    const { isDarkMode } = useDarkMode();
    const [isVisible, setIsVisible] = useState(false);
    
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
                <div className="absolute bottom-4 left-4 max-w-[42vw] pr-12 text-[clamp(1.25rem,2vw,1.5rem)] leading-[0.95]">
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
                    <SliderThree2 
                        images={images}
                        project={project}
                        navbarHeight={navbarHeight}
                    />
                )}
            </div>
        </div>
    );
}