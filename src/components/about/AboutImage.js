'use client';

import { useEffect, useState } from 'react';
import { projects } from '@/components/data/projects';

export default function AboutImage({ isVisible = true }) {
  const [navbarHeight, setNavbarHeight] = useState(0);
  const [availableHeight, setAvailableHeight] = useState(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    const updateHeight = () => {
      const navbar = document.querySelector('[data-navbar]');
      if (!navbar) {
        return false;
      }

      const navbarHeightValue = navbar.offsetHeight;
      const topOffset = 16;
      const bottomOffset = 16;

      const height =
        window.innerHeight - navbarHeightValue - topOffset - bottomOffset;

      setAvailableHeight(height);
      setNavbarHeight(navbarHeightValue);
      return true;
    };

    let retryCount = 0;
    const maxRetries = 20;
    const retryInterval = 100;

    const tryUpdate = () => {
      const success = updateHeight();
      
      if (!success && retryCount < maxRetries) {
        retryCount++;
        setTimeout(tryUpdate, retryInterval);
      }
    };

    if (isVisible) {
      setTimeout(tryUpdate, 0);
    }

    window.addEventListener('resize', updateHeight);

    return () => window.removeEventListener('resize', updateHeight);
  }, [isVisible]);

  if (availableHeight === null) {
    return null;
  }

  const aboutProject = projects.about;
  const imageSrc = `${aboutProject.imagesPath}/about.png`;

  const navbar = document.querySelector('[data-navbar]');
  const actualNavbarHeight = navbar?.offsetHeight || 0;

  return (
    <div
      className="fixed right-4 transition-opacity duration-700 ease-in-out flex items-center justify-center"
      style={{
        top: `${actualNavbarHeight + 16}px`,
        height: `${availableHeight}px`,
        width: 'calc(50% - 2rem)',
        opacity: isVisible ? 1 : 0,
        pointerEvents: isVisible ? 'auto' : 'none',
      }}
    >
      <div className="relative w-full h-full flex items-center justify-center">
        <img
          src={imageSrc}
          alt="About"
          className="max-w-full max-h-full object-contain transition-opacity duration-500"
          style={{
            opacity: imageLoaded ? 1 : 0
          }}
          onLoad={() => setImageLoaded(true)}
        />
      </div>
    </div>
  );
}