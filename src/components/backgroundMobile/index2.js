'use client';

/**
 * Home móvil v2: la misma mezcla aleatoria de imágenes de todos los proyectos
 * (getMobileMash, el mismo orden que ha precargado la intro), ahora en
 * SliderThree4Mobile: rejilla de 4 columnas, captions y ancla bajo el navbar.
 * El slider emite el proyecto de la hoja que está en el ancla (sliderBus 'active')
 * y FooterMobile2 lo marca en la lista.
 * Versión anterior: backgroundMobile/index.js.
 */

import { useMemo, useState } from 'react';
import SliderThree4Mobile from '@/components/SliderThree/SliderThree4Mobile';
import { getMobileMash } from '@/components/data/mobileMash';
import { mobileAnchorPx } from '@/lib/mobileGrid';
import { useDarkMode } from '@/contexts/DarkModeContext';

export default function BackgroundMobile2({ hiding = false }) {
    const { isDarkMode } = useDarkMode();
    const mashedImages = useMemo(() => getMobileMash(), []);
    const mashProject = useMemo(() => ({ id: 'mobile-mash', imagesPath: '' }), []);
    // Se mide una vez al montar (el navbar ya está pintado): si cambiara, la escena se rehace.
    const [anchorPx] = useState(() => mobileAnchorPx());
    const backgroundClass = isDarkMode ? 'bg-black' : 'bg-white';

    if (!mashedImages.length) {
        return <div className={`absolute inset-0 w-full h-full z-0 ${backgroundClass}`} />;
    }

    return (
        <div className={`absolute inset-0 w-full h-full z-0 ${backgroundClass}`}>
            <SliderThree4Mobile images={mashedImages} project={mashProject} anchorPx={anchorPx} variant="mash" hiding={hiding} />
        </div>
    );
}
