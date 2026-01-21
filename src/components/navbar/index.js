'use client';

import { useDarkMode } from '@/contexts/DarkModeContext';

export default function Navbar() {
    const { isDarkMode, toggleDarkMode } = useDarkMode();

    return (
        <div data-navbar className="flex top-4 left-4 right-4 leading-none z-50 text-[clamp(1.25rem,2vw,1.5rem)] leading-[0.95] absolute">
            <div className="w-1/2 flex flex-col">
                <h1>Kiko Climent</h1>
                <h2>Portfolio 2026</h2>
            </div>
            <div className="w-1/2 flex flex-col">
                <p>Fullstack Web Developer</p>
                <p>climent.kiko@gmail.com</p>
                <p>(+49) 176 58260660</p>
            </div>
            {/* Botón Dark Mode */}
            <button
                onClick={toggleDarkMode}
                className="absolute top-0 right-0 w-4 h-4 border-2 border-current bg-transparent hover:bg-black dark:hover:bg-white transition-colors duration-200"
                aria-label={isDarkMode ? 'Activar modo claro' : 'Activar modo oscuro'}
            />
        </div>
    )
}