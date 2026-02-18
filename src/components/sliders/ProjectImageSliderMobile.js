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

    return (
        <div className="absolute inset-0 w-full h-full" style={{ zIndex: 20 }}>
            {/* SLIDER THREE.JS - Ocupa toda la pantalla */}
            <div className="absolute inset-0 w-full h-full" style={{ zIndex: 25 }}>
                <SliderThree2Mobile 
                    images={images}
                    project={project}
                    navbarHeight={navbarHeight}
                />
            </div>

            {/* INFO DEL PROYECTO - BOTTOM (encima del slider, debajo del footer) */}
            <div 
                className="absolute left-4 right-4"
                style={{ 
                    zIndex: 30,
                    pointerEvents: 'none',
                    bottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)',
                }}
            >
                <div className="text-[clamp(1.25rem,2vw,1.5rem)] leading-[0.95]">
                    <span style={{ color: isDarkMode ? 'white' : 'black' }}>
                        {text.title}
                    </span>{' '}
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