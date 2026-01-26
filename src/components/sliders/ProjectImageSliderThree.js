'use client';

import { useEffect, useState } from 'react';
import { useDarkMode } from '@/contexts/DarkModeContext';
import SliderThree from '@/components/SliderThree/index';

export default function ProjectImageSliderThree({ project, shouldHide = false }) {
    const { isDarkMode } = useDarkMode();
    const [isVisible, setIsVisible] = useState(false);
    
    if (!project || !project.slider) return null;

    const { images = [], text } = project.slider;
    
    if (!images.length) return null;

    const [navbarHeight, setNavbarHeight] = useState(0);

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