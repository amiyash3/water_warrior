import React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Thumbnail with back photo + front inset. */
export function HydrationMomentThumb({ post, onClick, className }) {
  return (
    <button
      type="button"
      onClick={() => onClick?.(post)}
      className={cn(
        'aspect-[3/4] rounded-2xl overflow-hidden relative bg-muted block w-full text-left',
        onClick && 'active:scale-[0.98] transition-transform',
        className
      )}
    >
      <img src={post.back_photo_url} alt="" className="w-full h-full object-cover" />
      {post.front_photo_url && (
        <div className="absolute top-1.5 left-1.5 w-10 aspect-[3/4] rounded-lg overflow-hidden border border-white/80 pointer-events-none">
          <img src={post.front_photo_url} alt="" className="w-full h-full object-cover" />
        </div>
      )}
    </button>
  );
}

/** Full-screen expanded view of a hydration moment. */
export function HydrationMomentViewer({ post, onClose }) {
  if (!post) return null;

  const ml = post.bottle_size_ml || 500;
  const when = post.created_date
    ? new Date(post.created_date).toLocaleString('default', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : null;

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-black/90 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Hydration moment"
    >
      <div
        className="flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-3 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate">{when || 'Hydration moment'}</p>
          <p className="text-xs text-white/70">{ml} ml</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center shrink-0"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div
        className="flex-1 flex items-center justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] min-h-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative w-full max-w-md max-h-full aspect-[3/4] rounded-3xl overflow-hidden bg-muted shadow-2xl">
          <img
            src={post.back_photo_url}
            alt=""
            className="w-full h-full object-cover"
          />
          {post.front_photo_url && (
            <div className="absolute top-3 left-3 w-20 aspect-[3/4] rounded-xl overflow-hidden border-2 border-white/90 shadow-lg">
              <img src={post.front_photo_url} alt="" className="w-full h-full object-cover" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
