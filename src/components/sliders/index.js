'use client';

import { useEffect, useState, useRef } from 'react';
import gsap from 'gsap';

const images = [
    { id: 1, top: '0%', left: '0%', width: '70%' },
    { id: 2, top: '35%', left: '35%', width: '70%' },
    { id: 3, top: '25%', left: '10%', width: '70%' },
    { id: 4, top: '10%', left: '20%', width: '75%' },
    { id: 5, top: '5%', left: '3%', width: '70%' },
    { id: 6, top: '15%', left: '10%', width: '80%' },
    { id: 7, top: '10%', left: '15%', width: '80%' },
    { id: 8, top: '10%', left: '0%', width: '35%' },
    { id: 9, top: '20%', left: '25%', width: '25%' },
    { id: 10, top: '0%', left: '45%', width: '35%' },
    { id: 11, top: '15%', left: '30%', width: '30%' }
];

export default function SalonImageSlider() {
    const [navbarHeight, setNavbarHeight] = useState(0);
    const [isManualMode, setIsManualMode] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);

    const imagesRef = useRef([]);
    const timelineRef = useRef(null);

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
    }, []);

    /* ---------------- INTERACTIONS ---------------- */

    const handleMouseEnter = () => {
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

    const handleClick = () => {
        setIsManualMode(true);

        const next = (currentIndex + 1) % images.length;
        setCurrentIndex(next);

        const imgs = imagesRef.current.filter(Boolean);
        gsap.set(imgs, { opacity: 0 });
        gsap.set(imgs[next], { opacity: 1 });
    };

    const handleMouseLeave = () => {
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
                    <span className="text-black">vilarnau.de</span>{' '}
                    <span className="text-gray-500 lowercase">
                        Hair salon, Web & Interaction, Clean Layout, Fast Motion, Minimal Storytelling,
                        Layered UI, Fluid Scroll, Modern Typography, Headless Tech,
                        Next.js, GSAP, Framer Motion, Vercel, TailwindCSS, Motion UI, Responsive.
                        
                    </span>
                </div>
            </div>
            


            <div
                className="relative w-1/2 cursor-pointer"
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onClick={handleClick}
            >
                {images.map((img, i) => (
                    <img
                        key={img.id}
                        ref={(el) => (imagesRef.current[i] = el)}
                        src={`/salon/salon${img.id}.png`}
                        alt={`Salon ${img.id}`}
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
    );
}
