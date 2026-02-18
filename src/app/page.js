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
  const [isMobileReady, setIsMobileReady] = useState(false);
  const [showSlider, setShowSlider] = useState(false);
  const [hideSlider, setHideSlider] = useState(false); // ⭐ NUEVO ESTADO

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setIsLoadingComplete(true);
      } else {
        setIsMobileReady(false);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const root = document.documentElement;

    const updateBottomOverlay = () => {
      if (window.innerWidth >= 768) {
        root.style.setProperty('--mobile-bottom-overlay', '0px');
        return;
      }

      const viewport = window.visualViewport;
      const occludedBottom = viewport
        ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
        : 0;

      root.style.setProperty('--mobile-bottom-overlay', `${Math.round(occludedBottom)}px`);
    };

    const viewport = window.visualViewport;
    updateBottomOverlay();
    window.addEventListener('resize', updateBottomOverlay);
    window.addEventListener('orientationchange', updateBottomOverlay);
    viewport?.addEventListener('resize', updateBottomOverlay);
    viewport?.addEventListener('scroll', updateBottomOverlay);

    return () => {
      window.removeEventListener('resize', updateBottomOverlay);
      window.removeEventListener('orientationchange', updateBottomOverlay);
      viewport?.removeEventListener('resize', updateBottomOverlay);
      viewport?.removeEventListener('scroll', updateBottomOverlay);
      root.style.setProperty('--mobile-bottom-overlay', '0px');
    };
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
  const shouldShowMobileBackground = isMobile && isMobileReady && clickedProject === null;

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
    <div
      className="relative overflow-hidden"
      style={{
        width: '100vw',
        height: '100dvh',
        minHeight: '100vh',
      }}
    >
      {isMobile ? (
        <NavbarMobile onReady={() => setIsMobileReady(true)} />
      ) : (
        <NavbarLoader onLoadingComplete={handleLoadingComplete} />
      )}
      
      {shouldShowMobileBackground ? (
        <BackgroundMobile />
      ) : !isMobile ? (
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
      ) : null}
      
      {/* ⭐ PASAR hideSlider AL SLIDER */}
      {selectedProject && isLoadingComplete && showSlider && (
        <>
          {isMobile ? (
            !hideSlider && <ProjectImageSliderMobile project={selectedProject} />
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
      
      {isMobile && isMobileReady ? (
        <FooterMobile onProjectClick={handleProjectClick} />
      ) : !isMobile ? (
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
      ) : null}
    </div>
  );
}