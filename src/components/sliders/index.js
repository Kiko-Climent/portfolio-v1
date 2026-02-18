'use client';

import { useEffect, useState, useRef } from 'react';
import gsap from 'gsap';
import { useDarkMode } from '@/contexts/DarkModeContext';

function getImageSrc(project, img) {
    if (project.id === 'about' && img.id === 1) {
        return `${project.imagesPath}/about.png`;
    }
    return `${project.imagesPath}/${project.id}${img.id}.png`;
}

export default function HoverImageSlider({ project }) {
    const { isDarkMode } = useDarkMode();
    
    const [navbarHeight, setNavbarHeight] = useState(0);
    const [isHovering, setIsHovering] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });
    
    const imagesRef = useRef([]);
    const timelineRef = useRef(null);
    const interactiveAreaRef = useRef(null);
    
    if (!project || !project.slider) return null;

    const { images = [], text } = project.slider;
    
    if (!images.length) return null;

    const isSingleImage = project.id === 'about' && images.length === 1;

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

    /* ---------------- GSAP TIMELINE (solo si hay varias imágenes) ---------------- */

    const startTimeline = () => {
        if (isSingleImage) return;
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
        if (isSingleImage) return;
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
    }, [images.length, isSingleImage]);

    /* ---------------- INTERACTIONS ---------------- */

    const handleMouseEnter = () => {
        setIsHovering(true);
        if (isSingleImage || !timelineRef.current) return;

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

    const handleMouseLeave = () => {
        setIsHovering(false);

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
        <div className="flex absolute w-full h-screen top-0 left-0 pointer-events-none">
            <div className='w-1/2'></div>
            
            <div className="relative w-1/2">
                
                <div className="relative w-full h-full">
                    {images.map((img, i) => (
                        <img
                            key={img.id}
                            ref={(el) => (imagesRef.current[i] = el)}
                            src={getImageSrc(project, img)}
                            alt={`${project.id} ${img.id}`}
                            className="absolute object-contain will-change-opacity"
                            style={{
                                top: calculateTop(img.top),
                                left: img.left,
                                width: img.width,
                                opacity: isSingleImage ? 1 : 0
                            }}
                        />
                    ))}
                </div>
            </div>
            
        </div>
    );
}