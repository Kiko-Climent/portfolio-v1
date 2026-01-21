'use client';

import { useState, useEffect } from 'react';
import Navbar from "@/components/navbar";

import PortfolioGridThree from '@/components/grids/index3';
import Footer3 from '@/components/footer/index3';
import ProjectImageSlider from '@/components/sliders/ProjectImageSlider';
import { projects } from '@/components/data/projects';
import ProjectGrid from '@/components/grids';
import ProjectImageSliderThree from '@/components/sliders/ProjectImageSliderThree';


export default function Home() {
  const [activeProject, setActiveProject] = useState(null);
  const [clickedProject, setClickedProject] = useState(null);

  const selectedProject = clickedProject ? projects[clickedProject] : null;

  // Cuando se hace click en un proyecto, primero ocultar el grid y luego mostrar el slider
  const handleProjectClick = (projectId) => {
    if (projectId === null) {
      // Si es null, cerrar el slider y resetear todo
      setClickedProject(null);
      setActiveProject(null);
      return;
    }
    
    // Primero ocultar el grid (esto activará la animación de salida)
    setActiveProject(null);
    
    // Luego, después del tiempo de animación de salida del grid, mostrar el slider
    setTimeout(() => {
      setClickedProject(projectId);
    }, 600); // Tiempo que tarda la animación de salida en RevealImageHover (0.6s)
  };

  return (
    <div className="h-screen w-screen relative overflow-hidden">
      <Navbar />
      {/* Grid del portfolio con todas las imágenes */}
      <PortfolioGridThree activeProject={activeProject} clickedProject={clickedProject} />
      {selectedProject && <ProjectImageSliderThree project={selectedProject} />}
      <Footer3 
        onHover={setActiveProject} 
        onProjectClick={handleProjectClick} 
      />
    </div>
  );
}
