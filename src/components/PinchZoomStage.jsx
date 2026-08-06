import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

function distance(a, b) {
  const dx = a.clientX - b.clientX;
  const dy = a.clientY - b.clientY;
  return Math.hypot(dx, dy);
}

function midpoint(a, b, rect) {
  return {
    x: (a.clientX + b.clientX) / 2 - rect.left,
    y: (a.clientY + b.clientY) / 2 - rect.top,
  };
}

/** Keep scaled content covering the viewport — no blank edges. */
function clampTranslate(tx, ty, scale, width, height) {
  if (scale <= 1.001) return { tx: 0, ty: 0 };
  const minX = width * (1 - scale);
  const minY = height * (1 - scale);
  return {
    tx: Math.min(0, Math.max(minX, tx)),
    ty: Math.min(0, Math.max(minY, ty)),
  };
}

/**
 * Pinch-to-zoom while fingers are down (zooms toward pinch point); snaps back on release.
 * Translation is clamped so the image always fills the frame.
 * @param {{ children: React.ReactNode, className?: string }} props
 */
export default function PinchZoomStage({ children, className }) {
  const elRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const stateRef = useRef({
    scale: 1,
    tx: 0,
    ty: 0,
    mode: null,
    startDist: 0,
    startScale: 1,
    originX: 0,
    originY: 0,
    startX: 0,
    startY: 0,
    startTx: 0,
    startTy: 0,
  });

  const sync = (next) => {
    stateRef.current = { ...stateRef.current, ...next };
    if (next.scale != null) setScale(next.scale);
    if (next.tx != null) setTx(next.tx);
    if (next.ty != null) setTy(next.ty);
  };

  const clampScale = (s) => Math.min(4, Math.max(1, s));

  useEffect(() => {
    const el = elRef.current;
    if (!el) return undefined;

    const applyTransform = (nextScale, nextTx, nextTy) => {
      const { width, height } = el.getBoundingClientRect();
      const clamped = clampTranslate(nextTx, nextTy, nextScale, width, height);
      sync({ scale: nextScale, tx: clamped.tx, ty: clamped.ty });
    };

    const onTouchStart = (e) => {
      const s = stateRef.current;
      if (e.touches.length === 2) {
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        const mid = midpoint(e.touches[0], e.touches[1], rect);
        // Content-space point under the pinch (transform-origin top-left)
        const originX = (mid.x - s.tx) / s.scale;
        const originY = (mid.y - s.ty) / s.scale;
        sync({
          mode: 'pinch',
          startDist: distance(e.touches[0], e.touches[1]),
          startScale: s.scale,
          originX,
          originY,
        });
        return;
      }
      if (e.touches.length === 1 && s.scale > 1.05) {
        sync({
          mode: 'pan',
          startX: e.touches[0].clientX,
          startY: e.touches[0].clientY,
          startTx: s.tx,
          startTy: s.ty,
        });
      }
    };

    const onTouchMove = (e) => {
      const s = stateRef.current;
      if (s.mode === 'pinch' && e.touches.length === 2) {
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        const mid = midpoint(e.touches[0], e.touches[1], rect);
        const next = clampScale(
          s.startScale * (distance(e.touches[0], e.touches[1]) / (s.startDist || 1))
        );
        applyTransform(next, mid.x - s.originX * next, mid.y - s.originY * next);
        return;
      }
      if (s.mode === 'pan' && e.touches.length === 1 && s.scale > 1.05) {
        e.preventDefault();
        applyTransform(
          s.scale,
          s.startTx + (e.touches[0].clientX - s.startX),
          s.startTy + (e.touches[0].clientY - s.startY)
        );
      }
    };

    const reset = () => {
      sync({ mode: null, scale: 1, tx: 0, ty: 0 });
    };

    const onTouchEnd = (e) => {
      if (e.touches.length === 0) {
        reset();
        return;
      }
      if (e.touches.length < 2 && stateRef.current.mode === 'pinch') {
        reset();
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    el.addEventListener('touchcancel', onTouchEnd);
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, []);

  return (
    <div
      ref={elRef}
      className={cn('w-full h-full select-none overflow-hidden', className)}
      style={{ touchAction: scale > 1.01 ? 'none' : 'pan-y' }}
    >
      <div
        className="w-full h-full will-change-transform"
        style={{
          transform: `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`,
          transformOrigin: '0 0',
          transition: scale === 1 && tx === 0 && ty === 0 ? 'transform 0.2s ease-out' : 'none',
        }}
      >
        {children}
      </div>
    </div>
  );
}
