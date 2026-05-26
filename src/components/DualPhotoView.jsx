import React, { useState } from 'react';
import { cn } from '@/lib/utils';

export default function DualPhotoView({ frontUrl, backUrl, className }) {
  const [swapped, setSwapped] = useState(false);

  const main = swapped ? frontUrl : backUrl;
  const overlay = swapped ? backUrl : frontUrl;

  return (
    <div className={cn("relative aspect-[3/4] rounded-3xl overflow-hidden bg-muted select-none", className)}>
      <img
        src={main}
        alt="Main"
        className="w-full h-full object-cover"
        draggable={false}
      />
      <button
        onClick={(e) => { e.stopPropagation(); setSwapped(!swapped); }}
        className="absolute top-4 left-4 w-28 aspect-[3/4] rounded-2xl overflow-hidden border-2 border-white/90 shadow-2xl hover:scale-105 transition-transform active:scale-95"
      >
        <img
          src={overlay}
          alt="Overlay"
          className="w-full h-full object-cover"
          draggable={false}
        />
      </button>
    </div>
  );
}