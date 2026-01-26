'use client';

import { useState, useEffect } from 'react';
import NavbarMobile from "@/components/navbar/NavbarMobile";
import Footer3 from '@/components/footer/index3';
import FooterMobile from '@/components/footer/FooterMobile';
import BackgroundMobile from '@/components/backgroundMobile/index';
import PortfolioGridThree from '@/components/grids/index3';
import { projects } from '@/components/data/projects';
import ProjectImageSliderThree from '@/components/sliders/ProjectImageSliderThree';
import ProjectImageSliderMobile from '@/components/sliders/ProjectImageSliderMobile';
import HoverImageSlider from '@/components/sliders/index';
import NavbarLoader from '@/components/navbar/NavbarLoader';


export default function Home() {
  const [activeProject, setActiveProject] = useState(null);
  const [clickedProject, setClickedProject] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isLoadingComplete, setIsLoadingComplete] = useState(false);
  const [showSlider, setShowSlider] = useState(false);
  const [hideSlider, setHideSlider] = useState(false); // ⭐ NUEVO ESTADO

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setIsLoadingComplete(true);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (clickedProject === null) {
      setShowSlider(false);
      setHideSlider(false); // ⭐ RESETEAR
    }
  }, [clickedProject]);

  // ⭐ CALLBACK PARA CUANDO TERMINA LA ANIMACIÓN DEL FOOTER (mostrar slider)
  useEffect(() => {
    window.__footerAnimationComplete = () => {
      setShowSlider(true);
      setHideSlider(false);
    };

    // ⭐ CALLBACK PARA CUANDO EMPIEZA EL BACK (ocultar slider)
    window.__footerBackStarted = () => {
      setHideSlider(true);
    };

    return () => {
      delete window.__footerAnimationComplete;
      delete window.__footerBackStarted;
    };
  }, []);

  const selectedProject = clickedProject ? projects[clickedProject] : null;
  const hoveredProject = activeProject && !clickedProject ? projects[activeProject] : null;

  const handleProjectClick = (projectId) => {
    if (projectId === null) {
      setClickedProject(null);
      setActiveProject(null);
      setShowSlider(false);
      setHideSlider(false); // ⭐ RESETEAR
      return;
    }

    setActiveProject(null);
    
    setTimeout(() => {
      setClickedProject(projectId);
    }, 600);
  };

  const handleLoadingComplete = () => {
    setIsLoadingComplete(true);
  };

  const handleHover = (projectId) => {
    setActiveProject(projectId);
  };

  
  return (
    <div className="h-screen w-screen relative overflow-hidden">
      {isMobile ? (
        <NavbarMobile />
      ) : (
        <NavbarLoader onLoadingComplete={handleLoadingComplete} />
      )}
      
      {isMobile ? (
        <BackgroundMobile />
      ) : (
        <div 
          style={{ 
            pointerEvents: isLoadingComplete ? 'auto' : 'none'
          }}
        >
          <PortfolioGridThree 
            activeProject={activeProject} 
            clickedProject={clickedProject}
            isVisible={isLoadingComplete}
          />
        </div>
      )}
      
      {/* ⭐ PASAR hideSlider AL SLIDER */}
      {selectedProject && isLoadingComplete && showSlider && (
        <>
          {isMobile ? (
            <ProjectImageSliderMobile project={selectedProject} />
          ) : (
            <ProjectImageSliderThree 
              project={selectedProject} 
              shouldHide={hideSlider} 
            />
          )}
        </>
      )}
      
      {!isMobile && hoveredProject && isLoadingComplete && (
        <>
          <HoverImageSlider project={hoveredProject} />
        </>
      )}
      
      {isMobile ? (
        <FooterMobile onProjectClick={handleProjectClick} />
      ) : (
        <div 
          style={{ 
            pointerEvents: isLoadingComplete ? 'auto' : 'none'
          }}
        >
          <Footer3 
            onHover={handleHover}
            onProjectClick={handleProjectClick}
            isVisible={isLoadingComplete}
          />
        </div>
      )}
    </div>
  );
}