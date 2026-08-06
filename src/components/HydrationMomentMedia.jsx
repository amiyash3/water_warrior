import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/api/client';
import { toast } from 'sonner';
import PinchZoomStage from '@/components/PinchZoomStage';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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
export function HydrationMomentViewer({ post, onClose, onDeleted }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [swapped, setSwapped] = useState(false);

  useEffect(() => {
    if (!post) return undefined;
    const prevOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    const preventBehindScroll = (e) => {
      if (
        e.target?.closest?.(
          '[data-moment-viewer], [role="alertdialog"], [data-radix-alert-dialog-content]'
        )
      ) {
        return;
      }
      e.preventDefault();
    };
    document.addEventListener('touchmove', preventBehindScroll, { passive: false });
    document.addEventListener('wheel', preventBehindScroll, { passive: false });

    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);

    return () => {
      document.body.style.overflow = prevOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.removeEventListener('touchmove', preventBehindScroll);
      document.removeEventListener('wheel', preventBehindScroll);
      window.removeEventListener('keydown', onKey);
    };
  }, [post, onClose]);

  const handleDelete = useCallback(async () => {
    if (deleting || !post) return;
    setDeleting(true);
    try {
      await api.entities.WaterPost.delete(post.id);
      toast.success('Post deleted');
      setConfirmOpen(false);
      onDeleted?.(post.id);
      onClose?.();
    } catch (err) {
      toast.error(err?.message || 'Could not delete post');
    } finally {
      setDeleting(false);
    }
  }, [deleting, post, onDeleted, onClose]);

  if (!post || typeof document === 'undefined') return null;

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

  const mainUrl = swapped ? post.front_photo_url : post.back_photo_url;
  const insetUrl = swapped ? post.back_photo_url : post.front_photo_url;

  return createPortal(
    <>
      <div
        data-moment-viewer
        className="fixed inset-0 z-[100] flex flex-col bg-black/90 backdrop-blur-sm overscroll-none touch-none"
        role="dialog"
        aria-modal="true"
        aria-label="Hydration moment"
        onClick={onClose}
      >
        <div
          className="flex items-center justify-between gap-2 px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-3 text-white shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{when || 'Hydration moment'}</p>
            <p className="text-xs text-white/70">{ml} ml</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onDeleted && (
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center"
                aria-label="Delete post"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div
          className="flex-1 flex items-center justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] min-h-0"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="relative w-full max-w-md max-h-full aspect-[3/4] rounded-3xl overflow-hidden bg-black shadow-2xl">
            <PinchZoomStage>
              <img
                src={mainUrl}
                alt=""
                draggable={false}
                className="w-full h-full object-cover"
              />
            </PinchZoomStage>

            {insetUrl && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSwapped((v) => !v);
                }}
                className="absolute top-3 left-3 w-20 aspect-[3/4] rounded-xl overflow-hidden border-2 border-white/90 shadow-lg z-20"
                aria-label="Swap photos"
              >
                <img src={insetUrl} alt="" className="w-full h-full object-cover" draggable={false} />
              </button>
            )}
          </div>
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="rounded-3xl z-[110]">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this post?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the post and its comments. This can’t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-2xl" disabled={deleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-2xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>,
    document.body
  );
}
