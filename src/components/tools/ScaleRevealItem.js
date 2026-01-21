'use client';

import { forwardRef } from 'react';

const ScaleRevealItem = forwardRef(function ScaleRevealItem(
  { src, alt = '' },
  ref
) {
  return (
    <div
      ref={ref}
      className="relative w-full h-full overflow-hidden will-change-transform"
    >
      <img
        src={src}
        alt={alt}
        className="w-full h-full object-contain p-2 transform-gpu"
      />
    </div>
  );
});

export default ScaleRevealItem;
