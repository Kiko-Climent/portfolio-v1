'use client';

import { useState, useEffect } from 'react';
import Navbar from "@/components/navbar";
import NavbarMobile from "@/components/navbar/NavbarMobile";
import Footer3 from '@/components/footer/index3';
import FooterMobile from '@/components/footer/FooterMobile';
import BackgroundMobile from '@/components/backgroundMobile/index';
import PortfolioGridThree from '@/components/grids/index3';
import { projects } from '@/components/data/projects';
import ProjectImageSliderThree from '@/components/sliders/ProjectImageSliderThree';
import ProjectImageSliderMobile from '@/components/sliders/ProjectImageSliderMobile';
import HoverImageSlider from '@/components/sliders/index';


export default function Home() {
  const [activeProject, setActiveProject] = useState(null);
  const [clickedProject, setClickedProject] = useState(null);
  const [isMobile, setIsMobile] = useState(false);

  // Detectar si es móvil o desktop
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const selectedProject = clickedProject ? projects[clickedProject] : null;
  const hoveredProject = activeProject && !clickedProject ? projects[activeProject] : null;

  // Cuando se hace click en un proyecto, primero ocultar el grid y luego mostrar el slider
  const handleProjectClick = (projectId) => {
    if (projectId === null) {
      setClickedProject(null);
      setActiveProject(null);
      return;
    }
    
    setActiveProject(null);
    
    setTimeout(() => {
      setClickedProject(projectId);
    }, 600);
  };

  return (
    <div className="h-screen w-screen relative overflow-hidden">
      {/* Navbar condicional */}
      {isMobile ? <NavbarMobile /> : <Navbar />}
      
      {/* Background/Grid condicional por dispositivo */}
      {isMobile ? (
        <BackgroundMobile />
      ) : (
        <PortfolioGridThree activeProject={activeProject} clickedProject={clickedProject} />
      )}
      
      {/* Slider cuando se hace click en un proyecto - condicional por dispositivo */}
      {selectedProject && (
        isMobile ? (
          <ProjectImageSliderMobile project={selectedProject} />
        ) : (
          <ProjectImageSliderThree project={selectedProject} />
        )
      )}
      
      {/* Slider cuando se hace hover sobre un título del footer (solo desktop) */}
      {!isMobile && hoveredProject && <HoverImageSlider project={hoveredProject} />}
      
      {/* Footer condicional */}
      {isMobile ? (
        <FooterMobile onProjectClick={handleProjectClick} />
      ) : (
        <Footer3 
          onHover={setActiveProject} 
          onProjectClick={handleProjectClick} 
        />
      )}
    </div>
  );
}