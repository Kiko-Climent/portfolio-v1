'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
// Footer anterior (el menú sale y entran título + "back menu"): index3.
// import Footer3 from '@/components/footer/index3';
import Footer5 from '@/components/footer/index5';
// Móvil v1 (lista + título centrado + texto abajo): FooterMobile.
// import FooterMobile from '@/components/footer/FooterMobile';
import FooterMobile2 from '@/components/footer/FooterMobile2';
import PortfolioGridSeven from '@/components/grids/index7';
import { projects } from '@/components/data/projects';
import SpeedSlider, { warmSpeedImages } from '@/components/sliders/SpeedSlider';
import NavbarLoaderNew5 from '../../worktrees/NavbarLoaderNew5';
// Móvil v1: NavbarLoaderMobNew.
// import NavbarLoaderMobNew from '../../worktrees/NavbarLoaderMobNew';
import NavbarLoaderMobNew2 from '../../worktrees/NavbarLoaderMobNew2';
import { preloadForIntro, prefetchProject } from '@/lib/preload';
import {
  LazyComponent,
  loadBackgroundMobile,
  loadDesktopSlider,
  loadMobileSlider,
} from '@/lib/lazyComponents';


export default function Home() {
  const [activeProject, setActiveProject] = useState(null);
  const [footerHoveredProject, setFooterHoveredProject] = useState(null);
  const footerHoveredRef = useRef(null);
  // Imagen que enseña el speed-slider ahora mismo: la grid mueve su cuadradito a ella.
  const [speedKey, setSpeedKey] = useState(null);
  // Cambio directo de proyecto desde el footer: la galería actual sale con su
  // cortina (sin que el grid de la home vuelva a aparecer) y entra la nueva.
  const [switchingProject, setSwitchingProject] = useState(false);
  const switchTimerRef = useRef(null);
  const [clickedProject, setClickedProject] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  // El SSR no conoce el ancho real de la pantalla, así que "isMobile" arranca
  // en false SIEMPRE — hasta que este flag pasa a true (justo después de
  // checkMobile, en el mismo tick), NO se pinta ningún navbar. Sin esto, todo
  // visitante — móvil incluido — recibe primero el HTML del navbar de
  // ESCRITORIO (con sus propias medidas/cuadrados calculados para un ancho
  // que no es el suyo) durante uno o dos frames, hasta que React lo desmonta
  // y monta el navbar correcto: eso es lo que se veía como "el cuadrado salta
  // de la esquina al centro" tanto en móvil como en desktop.
  const [hasMounted, setHasMounted] = useState(false);
  const [isLoadingComplete, setIsLoadingComplete] = useState(false);
  const [isMobileReady, setIsMobileReady] = useState(false);
  const [showSlider, setShowSlider] = useState(false);
  const [hideSlider, setHideSlider] = useState(false); // ⭐ NUEVO ESTADO
  // La galería ya está entera en pantalla (texturas del slider + texto):
  // "back menu" espera a esto para no animarse mientras el hilo va cargado.
  const [sliderReady, setSliderReady] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(null);
  // Se activa en el mismo instante que window.__footerBackStarted (antes de
  // que clickedProject llegue a null, que tarda lo que dure restoreMenu en
  // FooterMobile.js) para que el contacto del navbar salga a la vez que
  // saldría el título de un proyecto, no ~1s más tarde.
  const [aboutExiting, setAboutExiting] = useState(false);
  // Móvil v2: hoja "Info" del detalle (la abre/cierra la barra del footer).
  const [infoOpen, setInfoOpen] = useState(false);
  // Móvil v2: la Home cierra sus hojas con la cortina mientras sale el menú.
  const [mobileLeavingHome, setMobileLeavingHome] = useState(false);
  // Lo imprescindible para que la home aparezca completa (ver preloadForIntro).
  // Mientras sea false, los cuadrados del loader siguen girando en vez de viajar
  // a la esquina.
  const [assetsReady, setAssetsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    preloadForIntro(window.innerWidth < 768).then(() => {
      if (!cancelled) setAssetsReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
    setHasMounted(true);
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
      setAboutExiting(false);
      setSliderReady(false);
      setInfoOpen(false);
      setMobileLeavingHome(false);
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
      setAboutExiting(true);
      setInfoOpen(false);
    };

    return () => {
      delete window.__footerAnimationComplete;
      delete window.__footerBackStarted;
    };
  }, []);

  // Speed-slider: precarga en reposo las "md" de todas las galerías.
  useEffect(() => {
    if (isLoadingComplete && !isMobile) warmSpeedImages();
  }, [isLoadingComplete, isMobile]);

  const selectedProject = clickedProject ? projects[clickedProject] : null;
  const hoveredProject = footerHoveredProject && !clickedProject ? projects[footerHoveredProject] : null;
  const shouldShowMobileBackground = isMobile && isMobileReady && clickedProject === null;
  const isAboutSelected = selectedProject?.id === 'about' && !aboutExiting;
  // Móvil v2: el navbar cambia "Portfolio 2026 / Creative Frontend Developer"
  // por el nombre del proyecto y el contador mientras se ve su detalle.
  const mobileHeaderProject =
    isMobile && selectedProject && selectedProject.id !== 'about' && !hideSlider ? selectedProject : null;

  const handleProjectClick = (projectId) => {
    if (projectId === null) {
      setClickedProject(null);
      setShowSlider(false);
      setHideSlider(false); // ⭐ RESETEAR
      return;
    }

    // Sus texturas (normalmente ya precargadas en el hover del footer) se piden
    // decodificadas antes de que el slider se monte.
    if (projectId !== 'about') {
      prefetchProject(projectId, { size: isMobile ? 'sm' : 'slider', as: 'texture' });
    }

    // La galería elegida sigue activa: sus imágenes salen del grid sin blur.
    // El speed slider del hover se apaga: la galería ocupa ese sitio.
    setActiveProject(projectId);
    footerHoveredRef.current = null;
    setFooterHoveredProject(null);

    // Escritorio: la galería se abre ya, en paralelo a la salida del menú (el
    // espejo de la vuelta): el grid empieza a taparse y el slider se monta
    // con texturas ligeras, así su cortina entra cruzándose con la del grid.
    if (!isMobile) {
      setClickedProject(projectId);
      setShowSlider(true);
      return;
    }

    setMobileLeavingHome(true);
    setTimeout(() => {
      setClickedProject(projectId);
    }, 600);
  };

  // Tiempo para la cortina de salida de la galería (CURTAIN.out en index5:
  // 0.6 s + stagger) y la salida por líneas del texto, antes de montar la nueva.
  const SWITCH_OUT_MS = 950;
  const handleProjectSwitch = (projectId) => {
    if (!clickedProject || !projectId || projectId === clickedProject) return;
    if (projectId !== 'about') prefetchProject(projectId, { size: 'slider', as: 'texture' });
    setActiveProject(projectId);
    setSwitchingProject(true);
    clearTimeout(switchTimerRef.current);
    switchTimerRef.current = setTimeout(() => {
      setSliderReady(false);
      setClickedProject(projectId);
      setSwitchingProject(false);
    }, SWITCH_OUT_MS);
  };

  useEffect(() => () => clearTimeout(switchTimerRef.current), []);

  // Callbacks estables: los loaders no deben recibir una función nueva en cada
  // render (antes eso relanzaba su timeline entera con cada hover).
  const handleLoadingComplete = useCallback(() => {
    setIsLoadingComplete(true);
  }, []);

  const handleMobileReady = useCallback(() => {
    setIsMobileReady(true);
  }, []);

  const handleFooterHover = (projectId) => {
    footerHoveredRef.current = projectId;
    if (projectId) {
      // El speed slider pide las "md"; el click, las texturas de la galería.
      prefetchProject(projectId, { size: 'md', as: 'image' });
      if (projectId !== 'about') prefetchProject(projectId, { size: 'slider', as: 'texture' });
    }
    setFooterHoveredProject(projectId);
    setActiveProject(projectId);
  };

  const handleGridHover = (projectId) => {
    if (projectId) setActiveProject(projectId);
    else setActiveProject(footerHoveredRef.current);
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
      {hasMounted ? (
        isMobile ? (
          <NavbarLoaderMobNew2
            onReady={handleMobileReady}
            showContact={isAboutSelected}
            isReady={assetsReady}
            project={mobileHeaderProject}
          />
        ) : (
          <NavbarLoaderNew5 onLoadingComplete={handleLoadingComplete} isReady={assetsReady} />
        )
      ) : null}

      {/* Lo que usa Three.js va en chunks aparte (src/lib/lazyComponents.js): la
          intro arranca sin esperar a Three.js y preloadForIntro los descarga
          mientras se reproduce. */}
      {shouldShowMobileBackground ? (
        <LazyComponent loader={loadBackgroundMobile} hiding={mobileLeavingHome} />
      ) : !isMobile ? (
        <div
          style={{
            pointerEvents: isLoadingComplete ? 'auto' : 'none'
          }}
        >
          <PortfolioGridSeven
            activeProject={activeProject}
            clickedProject={clickedProject}
            isReturning={hideSlider}
            isVisible={isLoadingComplete}
            onHover={handleGridHover}
            speedKey={speedKey}
          />
        </div>
      ) : null}

      {/* ⭐ PASAR hideSlider AL SLIDER */}
      {selectedProject && isLoadingComplete && showSlider && (
        <>
          {isMobile ? (
            <LazyComponent
              loader={loadMobileSlider}
              project={selectedProject}
              shouldHide={hideSlider}
              infoOpen={infoOpen}
              onInfoClose={() => setInfoOpen(false)}
            />
          ) : (
            <LazyComponent
              key={selectedProject.id}
              loader={loadDesktopSlider}
              project={selectedProject}
              shouldHide={hideSlider || switchingProject}
              onReady={() => setSliderReady(true)}
            />
          )}
        </>
      )}

      {!isMobile && hoveredProject && isLoadingComplete && (
        <SpeedSlider
          key={hoveredProject.id}
          projectId={hoveredProject.id}
          onImageChange={setSpeedKey}
        />
      )}

      {isMobile && isMobileReady ? (
        <FooterMobile2
          onProjectClick={handleProjectClick}
          infoOpen={infoOpen}
          onInfoToggle={() => setInfoOpen((open) => !open)}
        />
      ) : !isMobile ? (
        <div
          style={{
            pointerEvents: isLoadingComplete ? 'auto' : 'none'
          }}
        >
          <Footer5
            activeProject={activeProject}
            onHover={handleFooterHover}
            onProjectClick={handleProjectClick}
            onProjectSwitch={handleProjectSwitch}
            isVisible={isLoadingComplete}
            backReady={sliderReady}
          />
        </div>
      ) : null}
    </div>
  );
}
