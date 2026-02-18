'use client';

import { useEffect, useState } from 'react';

export default function ProjectImageSliderStatic({ project }) {
    if (!project || !project.slider) return null;

    const { images = [], text } = project.slider;
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

    /* ---------------- POSITION HELPERS ---------------- */

    const calculateTop = (topPercent) => {
        if (!navbarHeight) return topPercent;
        const offset = (navbarHeight / window.innerHeight) * 100;
        return `${parseFloat(topPercent) + offset}%`;
    };

    /* ---------------- RENDER ---------------- */

    return (
        <div className="flex absolute w-full h-screen">
            {/* Texto izquierda */}
            <div className="w-1/2">
                <div className="absolute bottom-4 left-4 max-w-[42vw] pr-12 text-[clamp(1.25rem,2vw,1.5rem)] leading-[0.95]">
                    {text.url ? (
                        <a
                            href={text.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-black dark:text-white hover:opacity-80 transition-opacity"
                        >
                            {text.title}
                        </a>
                    ) : (
                        <span className="text-black dark:text-white">
                            {text.title}
                        </span>
                    )}{' '}
                    <span className="text-gray-500 dark:text-gray-400 lowercase">
                        {text.description}
                    </span>
                </div>
            </div>

            {/* Zona imágenes */}
            <div className="relative w-1/2">
                <div className="relative w-full h-full">
                    {images.map((img) => (
                        <img
                            key={img.id}
                            src={`${project.imagesPath}/${project.id}${img.id}.png`}
                            alt={`${project.id} ${img.id}`}
                            className="absolute object-contain"
                            style={{
                                top: calculateTop(img.top),
                                left: img.left,
                                width: img.width,
                                opacity: 1
                            }}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
