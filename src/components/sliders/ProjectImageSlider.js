'use client';

import { useEffect, useState, useRef } from 'react';
import gsap from 'gsap';
import { useDarkMode } from '@/contexts/DarkModeContext';

export default function ProjectImageSlider({ project }) {
    const { isDarkMode } = useDarkMode();
    if (!project || !project.slider) return null;

    const { images = [], text } = project.slider;
    
    // Si no hay imágenes, no mostrar el slider
    if (!images.length) return null;
    const [navbarHeight, setNavbarHeight] = useState(0);
    const [isManualMode, setIsManualMode] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });
    const [isHovering, setIsHovering] = useState(false);

    const imagesRef = useRef([]);
    const timelineRef = useRef(null);
    const interactiveAreaRef = useRef(null);

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

    /* ---------------- GSAP TIMELINE ---------------- */

    const startTimeline = () => {
        const imgs = imagesRef.current.filter(Boolean);
        if (!imgs.length) return;
    
        gsap.set(imgs, { opacity: 0 });
    
        const tl = gsap.timeline({ repeat: -1 });
    
        imgs.forEach((img) => {
            tl.set(img, { opacity: 1 })
              .set(img, { opacity: 0 }, '+=0.1');
        });
    
        timelineRef.current = tl;
    };
    

    useEffect(() => {
        let timeoutId;

        const init = () => {
            if (imagesRef.current.filter(Boolean).length !== images.length) {
                timeoutId = setTimeout(init, 50);
                return;
            }
            startTimeline();
        };

        init();

        return () => {
            clearTimeout(timeoutId);
            timelineRef.current?.kill();
        };
    }, [images.length]);

    /* ---------------- INTERACTIONS ---------------- */

    const handleMouseEnter = () => {
        setIsHovering(true);
        if (!timelineRef.current) return;

        timelineRef.current.pause();

        const index = Math.floor(
            timelineRef.current.progress() * images.length
        );

        setCurrentIndex(index);

        const imgs = imagesRef.current.filter(Boolean);
        gsap.set(imgs, { opacity: 0 });
        gsap.set(imgs[index], { opacity: 1 });
    };

    const handleMouseMove = (e) => {
        if (interactiveAreaRef.current) {
            const rect = interactiveAreaRef.current.getBoundingClientRect();
            setCursorPosition({
                x: e.clientX,
                y: e.clientY
            });
        }
    };

    const handleClick = () => {
        setIsManualMode(true);

        const next = (currentIndex + 1) % images.length;
        setCurrentIndex(next);

        const imgs = imagesRef.current.filter(Boolean);
        gsap.set(imgs, { opacity: 0 });
        gsap.set(imgs[next], { opacity: 1 });
    };

    const handleMouseLeave = () => {
        setIsHovering(false);
        setIsManualMode(false);

        if (timelineRef.current) {
            timelineRef.current.kill();
            timelineRef.current = null;
        }

        startTimeline();
    };

    /* ---------------- POSITION HELPERS ---------------- */

    const calculateTop = (topPercent) => {
        if (!navbarHeight) return topPercent;
        const offset = (navbarHeight / window.innerHeight) * 100;
        return `${parseFloat(topPercent) + offset}%`;
    };

    /* ---------------- RENDER ---------------- */

    return (
        <div className="flex absolute w-full h-screen">
            <div className='w-1/2'>
                <div className="absolute bottom-4 left-4 max-w-[42vw] pr-12 text-[clamp(1.25rem,2vw,1.5rem)] leading-[0.95]">
                    <span style={{ color: isDarkMode ? 'white' : 'black' }}>{text.title}</span>{' '}
                    <span style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }} className="lowercase">
                        {text.description}
                    </span>
                </div>
            </div>
            

            <div className="relative w-1/2">
                {/* Área interactiva solo en el 70% superior */}
                <div
                    ref={interactiveAreaRef}
                    className="absolute top-0 left-0 w-full"
                    style={{ height: '70%', cursor: 'none' }}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                    onMouseMove={handleMouseMove}
                    onClick={handleClick}
                />
                
                {/* Contenedor de imágenes que ocupa todo el espacio */}
                <div className="relative w-full h-full pointer-events-none">
                    {images.map((img, i) => (
                        <img
                            key={img.id}
                            ref={(el) => (imagesRef.current[i] = el)}
                            src={`${project.imagesPath}/${project.id}${img.id}.png`}
                            alt={`${project.id} ${img.id}`}
                            className="absolute object-contain will-change-opacity"
                            style={{
                                top: calculateTop(img.top),
                                left: img.left,
                                width: img.width,
                                opacity: 0
                            }}
                        />
                    ))}
                </div>
            </div>
            
            {/* Cursor personalizado "next" */}
            {isHovering && (
                <div
                    className="fixed pointer-events-none z-50 text-white dark:text-white mix-blend-difference text-xl uppercase font-medium"
                    style={{
                        left: `${cursorPosition.x + 15}px`,
                        top: `${cursorPosition.y - 15}px`,
                        transform: 'translate(0, 0)',
                    }}
                >
                    next
                </div>
            )}
        </div>
    );
}

