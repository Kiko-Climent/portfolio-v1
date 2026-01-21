'use client';

import { projects } from '@/components/data/projects';
import RevealImageHover from '../tools/RevealImageHover';
import RevealVideoHover from '../tools/RevealVideoHover';

export default function ProjectGrid({ activeProject }) {
  const project = projects[activeProject];
  if (!project) return null;

  return (
    <div className="absolute left-4 right-4 top-28 bottom-32 flex items-center pointer-events-none">
      <div className="grid grid-cols-6 gap-4 w-full h-[70vh]">
        {project.gridLayout.map((item, index) => (
          <div key={index} className="relative overflow-hidden">
            {item && (
              typeof item === 'object' && item.type === 'video' ? (
                <RevealVideoHover
                  src={item.src}
                  isVisible={Boolean(activeProject)}
                />
              ) : (
                <RevealImageHover
                  src={`${project.imagesPath}/${project.id}${item}.png`}
                  isVisible={Boolean(activeProject)}
                />
              )
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
