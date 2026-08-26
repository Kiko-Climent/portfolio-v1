'use client';

import { useState } from 'react';
import Loader from '@/components/loader';
import NavbarMobile from '@/components/navbar/NavbarMobile';
import FooterMobile from '@/components/footer/FooterMobile';
import ProjectImageSliderMobile from '@/components/sliders/ProjectImageSliderMobile';
import { projects } from '@/components/data/projects';
import NavbarLoaderNew from '../../../worktrees/NavbarLoaderNew';
import BrainStorm from '../../../worktrees/BrainStorm';
import NavbarLoaderNew2 from '../../../worktrees/NavbarLoaderNew2';
import NavbarLoaderNew3 from '../../../worktrees/NavbarLoaderNew3';
import NavbarLoaderNew4 from '../../../worktrees/NavbarLoaderNew4';
import NavbarLoaderNew5 from '../../../worktrees/NavbarLoaderNew5';
import NavbarLoaderMobNew from '../../../worktrees/NavbarLoaderMobNew';

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
            {/* <NavbarMobile /> */}
            {/* Slider cuando se hace click en un proyecto */}
            {/* {selectedProject && <ProjectImageSliderMobile project={selectedProject} />}
            <FooterMobile onProjectClick={handleProjectClick} /> */}
            {/* <NavbarLoaderNew /> */}
            {/* <BrainStorm /> */}
            {/* <NavbarLoaderNew5 /> */}
            <NavbarLoaderMobNew />
        </div>
    )
}  
