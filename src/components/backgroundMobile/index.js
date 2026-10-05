'use client';

import { useMemo } from 'react';
import SliderThree3Mobile from '@/components/SliderThree/SliderThree3Mobile';
import { getMobileMash } from '@/components/data/mobileMash';
import { useDarkMode } from '@/contexts/DarkModeContext';

export default function BackgroundMobile() {
    const { isDarkMode } = useDarkMode();
    // Mismo orden que ha precargado la intro (src/lib/preload.js).
    const mashedImages = useMemo(() => getMobileMash(), []);
    const mashProject = useMemo(() => ({ id: 'mobile-mash', imagesPath: '' }), []);
    const backgroundClass = isDarkMode ? 'bg-black' : 'bg-white';

    if (!mashedImages.length) {
        return <div className={`absolute inset-0 w-full h-full z-0 ${backgroundClass}`} />;
    }

    return (
        <div className={`absolute inset-0 w-full h-full z-0 ${backgroundClass}`}>
            <SliderThree3Mobile
                images={mashedImages}
                project={mashProject}
                navbarHeight={0}
                variant="mash"
            />
        </div>
    );
}
