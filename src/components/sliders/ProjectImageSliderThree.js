'use client';

import { useEffect, useState } from 'react';
import { useDarkMode } from '@/contexts/DarkModeContext';
import SliderThree from '@/components/SliderThree/index';

export default function ProjectImageSliderThree({ project }) {
    const { isDarkMode } = useDarkMode();
    
    if (!project || !project.slider) return null;

    const { images = [], text } = project.slider;
    
    // Si no hay imágenes, no mostrar el slider
    if (!images.length) return null;

    const [navbarHeight, setNavbarHeight] = useState(0);

    /* ---------------- NAVBAR HEIGHT ---------------- */
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

    /* ---------------- RENDER ---------------- */
    return (
        <div className="flex absolute w-full h-screen" style={{ zIndex: 10 }}>
            {/* INFO DEL PROYECTO - IZQUIERDA */}
            <div className='w-1/2'>
                <div className="absolute bottom-4 left-4 max-w-[42vw] pr-12 text-[clamp(1.25rem,2vw,1.5rem)] leading-[0.95]">
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

            {/* SLIDER THREE.JS - DERECHA */}
            <div className="relative w-1/2 h-screen" style={{ minHeight: '100vh' }}>
                <SliderThree 
                    images={images}
                    project={project}
                    navbarHeight={navbarHeight}
                />
            </div>
        </div>
    );
}