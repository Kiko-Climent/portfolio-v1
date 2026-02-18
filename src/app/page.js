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
  const [footerHoveredProject, setFooterHoveredProject] = useState(null);
  const [clickedProject, setClickedProject] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isLoadingComplete, setIsLoadingComplete] = useState(false);
  const [isMobileReady, setIsMobileReady] = useState(false);
  const [showSlider, setShowSlider] = useState(false);
  const [hideSlider, setHideSlider] = useState(false); // ⭐ NUEVO ESTADO
  const [viewportHeight, setViewportHeight] = useState(null);

  useEffect(() => {
    if (!isMobile) return;

    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => setViewportHeight(vv.height);

    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);

    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, [isMobile]);

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
    if (!isMobile) return undefined;

    const html = document.documentElement;
    const body = document.body;

    const previous = {
      htmlOverflow: html.style.overflow,
      htmlOverscrollBehaviorY: html.style.overscrollBehaviorY,
      bodyOverflow: body.style.overflow,
      bodyOverscrollBehaviorY: body.style.overscrollBehaviorY,
      bodyHeight: body.style.height,
    };

    // Evita scroll nativo en móvil para mantener estable la UI del navegador.
    html.style.overflow = 'hidden';
    html.style.overscrollBehaviorY = 'none';
    body.style.overflow = 'hidden';
    body.style.overscrollBehaviorY = 'none';
    body.style.height = '100%';

    return () => {
      html.style.overflow = previous.htmlOverflow;
      html.style.overscrollBehaviorY = previous.htmlOverscrollBehaviorY;
      body.style.overflow = previous.bodyOverflow;
      body.style.overscrollBehaviorY = previous.bodyOverscrollBehaviorY;
      body.style.height = previous.bodyHeight;
    };
  }, [isMobile]);

  

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
  const hoveredProject = footerHoveredProject && !clickedProject ? projects[footerHoveredProject] : null;
  const shouldShowMobileBackground = isMobile && isMobileReady && clickedProject === null;

  const handleProjectClick = (projectId) => {
    if (projectId === null) {
      setClickedProject(null);
      setActiveProject(null);
      setFooterHoveredProject(null);
      setShowSlider(false);
      setHideSlider(false); // ⭐ RESETEAR
      return;
    }

    setActiveProject(null);
    setFooterHoveredProject(null);
    
    setTimeout(() => {
      setClickedProject(projectId);
    }, 600);
  };

  const handleLoadingComplete = () => {
    setIsLoadingComplete(true);
  };

  const handleFooterHover = (projectId) => {
    setActiveProject(projectId);
    setFooterHoveredProject(projectId);
  };

  const handleGridHover = (projectId) => {
    setActiveProject(projectId);
  };

  
  return (
    <div
      className="relative overflow-hidden"
      style={{
        width: '100vw',
        height: isMobile && viewportHeight ? `${viewportHeight}px` : '100dvh',
        ...(isMobile ? {} : { minHeight: '100vh' }),
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
            onHover={handleGridHover}
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
            activeProject={activeProject}
            onHover={handleFooterHover}
            onProjectClick={handleProjectClick}
            isVisible={isLoadingComplete}
          />
        </div>
      ) : null}
    </div>
  );
}