'use client';

import { useEffect, useState } from "react";
import { useDarkMode } from '@/contexts/DarkModeContext';
import SliderThree2Mobile from '@/components/SliderThree/SliderThree2Mobile';

export default function ProjectImageSliderMobile({ project }) {
    const { isDarkMode } = useDarkMode();
    
    if (!project || !project.slider) return null;

    const { images = [], text } = project.slider;
    
    if (!images.length) return null;

    const [navbarHeight, setNavbarHeight] = useState(0);

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

    const isAbout = project.id === 'about';

    return (
        <div className="absolute inset-0 w-full h-full" style={{ zIndex: 20 }}>
            {/* SLIDER THREE.JS - Oculto para About Me (solo 1 foto) */}
            {!isAbout && (
                <div className="absolute inset-0 w-full h-full" style={{ zIndex: 25 }}>
                    <SliderThree2Mobile 
                        images={images}
                        project={project}
                        navbarHeight={navbarHeight}
                    />
                </div>
            )}

            {/* INFO DEL PROYECTO - BOTTOM (encima del slider, debajo del footer) */}
            <div 
                className="absolute left-4 right-4"
                style={{ 
                    zIndex: 30,
                    pointerEvents: 'none',
                    bottom: 'calc(1rem + max(var(--mobile-bottom-inset, 0px), env(safe-area-inset-bottom, 0px)))',
                }}
            >
                <div className="text-[clamp(1.2rem,1.75vw,1.75rem)] font-semibold leading-[1.1]">
                    {text.url ? (
                        <a
                            href={text.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: isDarkMode ? 'white' : 'black', pointerEvents: 'auto' }}
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
        </div>
    );
}