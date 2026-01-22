'use client';

import { useState } from 'react';
import Loader from '@/components/loader';
import NavbarMobile from '@/components/navbar/NavbarMobile';
import FooterMobile from '@/components/footer/FooterMobile';
import ProjectImageSliderMobile from '@/components/sliders/ProjectImageSliderMobile';
import { projects } from '@/components/data/projects';

export default function Tests() {
    const [clickedProject, setClickedProject] = useState(null);

    const selectedProject = clickedProject ? projects[clickedProject] : null;

    // Cuando se hace click en un proyecto, mostrar el slider
    const handleProjectClick = (projectId) => {
        if (projectId === null) {
            // Si es null, cerrar el slider y resetear todo
            setClickedProject(null);
            return;
        }
        
        setClickedProject(projectId);
    };

    return (
        <div className="h-screen w-screen relative overflow-hidden">
            <NavbarMobile />
            {/* Slider cuando se hace click en un proyecto */}
            {selectedProject && <ProjectImageSliderMobile project={selectedProject} />}
            <FooterMobile onProjectClick={handleProjectClick} />
        </div>
    )
}  
