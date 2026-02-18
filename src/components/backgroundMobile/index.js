'use client';

import { useMemo } from 'react';
import SliderThree2Mobile from '@/components/SliderThree/SliderThree2Mobile';
import { projects } from '@/components/data/projects';
import { useDarkMode } from '@/contexts/DarkModeContext';

const shuffleArray = (array) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
};

const buildMashedImages = () => {
    const perProject = Object.values(projects)
        .filter((project) => project.id !== 'about' && project.slider?.images?.length)
        .map((project) => ({
            projectId: project.id,
            images: shuffleArray(
                project.slider.images.map((image) => ({
                    id: image.id,
                    src: `${project.imagesPath}/${project.id}${image.id}.png`,
                }))
            ),
        }));

    const mashed = [];
    let previousProjectId = null;

    while (perProject.some((group) => group.images.length)) {
        const candidates = perProject.filter(
            (group) => group.images.length && group.projectId !== previousProjectId
        );
        const available = candidates.length
            ? candidates
            : perProject.filter((group) => group.images.length);
        const selected = available[Math.floor(Math.random() * available.length)];

        mashed.push(selected.images.pop());
        previousProjectId = selected.projectId;
    }

    return mashed;
};

export default function BackgroundMobile() {
    const { isDarkMode } = useDarkMode();
    const mashedImages = useMemo(() => buildMashedImages(), []);
    const mashProject = useMemo(() => ({ id: 'mobile-mash', imagesPath: '' }), []);
    const backgroundClass = isDarkMode ? 'bg-black' : 'bg-white';

    if (!mashedImages.length) {
        return <div className={`absolute inset-0 w-full h-screen z-0 ${backgroundClass}`} />;
    }

    return (
        <div className={`absolute inset-0 w-full h-screen z-0 ${backgroundClass}`}>
            <SliderThree2Mobile
                images={mashedImages}
                project={mashProject}
                navbarHeight={0}
            />
        </div>
    );
}