import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import { Camera, X, Check, Droplets, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const BOTTLE_SIZES = [250, 500, 750, 1000];

// Convert a video stream frame to a Blob
function captureFrameFromVideo(videoEl) {
  const canvas = document.createElement('canvas');
  canvas.width = videoEl.videoWidth || 640;
  canvas.height = videoEl.videoHeight || 480;
  canvas.getContext('2d').drawImage(videoEl, 0, 0);
  return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.92));
}

export default function Capture() {
  const navigate = useNavigate();

  // Refs for the two video elements
  const frontVideoRef = useRef(null);
  const backVideoRef = useRef(null);

  // Streams
  const frontStreamRef = useRef(null);
  const backStreamRef = useRef(null);

  const [cameraState, setCameraState] = useState('idle'); // idle | loading | ready | captured | error
  const [cameraError, setCameraError] = useState('');

  // Captured blobs / previews
  const [frontBlob, setFrontBlob] = useState(null);
  const [backBlob, setBackBlob] = useState(null);
  const [frontPreview, setFrontPreview] = useState(null);
  const [backPreview, setBackPreview] = useState(null);

  const [caption, setCaption] = useState('');
  const [location, setLocation] = useState('');
  const [bottleSize, setBottleSize] = useState(500);
  const [submitting, setSubmitting] = useState(false);

  const startCameras = useCallback(async () => {
    setCameraState('loading');
    setCameraError('');
    stopStreams();

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera not supported in this browser.');
      }
      // Request cameras — try environment first with ideal (not exact) to avoid failures on mobile
      const frontStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      const backStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
        .catch(() => navigator.mediaDevices.getUserMedia({ video: true, audio: false }));

      frontStreamRef.current = frontStream;
      backStreamRef.current = backStream;

      if (frontVideoRef.current) {
        frontVideoRef.current.srcObject = frontStream;
        await frontVideoRef.current.play();
      }
      if (backVideoRef.current) {
        backVideoRef.current.srcObject = backStream;
        await backVideoRef.current.play();
      }

      setCameraState('ready');
    } catch (err) {
      console.error(err);
      const msg = err.name === 'NotAllowedError'
        ? 'Camera permission denied. Please allow camera access in your browser settings and try again.'
        : err.name === 'NotFoundError'
        ? 'No camera found on this device.'
        : 'Could not access cameras. Make sure you allow camera permissions.';
      setCameraError(msg);
      setCameraState('error');
    }
  }, []);

  const stopStreams = () => {
    frontStreamRef.current?.getTracks().forEach(t => t.stop());
    backStreamRef.current?.getTracks().forEach(t => t.stop());
    frontStreamRef.current = null;
    backStreamRef.current = null;
  };

  useEffect(() => {
    startCameras();
    return () => stopStreams();
  }, [startCameras]);

  const captureSimultaneously = async () => {
    if (!frontVideoRef.current || !backVideoRef.current) return;
    const [fBlob, bBlob] = await Promise.all([
      captureFrameFromVideo(frontVideoRef.current),
      captureFrameFromVideo(backVideoRef.current),
    ]);
    setFrontBlob(fBlob);
    setBackBlob(bBlob);
    setFrontPreview(URL.createObjectURL(fBlob));
    setBackPreview(URL.createObjectURL(bBlob));
    stopStreams();
    setCameraState('captured');
  };

  const retake = () => {
    setFrontBlob(null); setBackBlob(null);
    setFrontPreview(null); setBackPreview(null);
    startCameras();
  };

  const submit = async () => {
    if (!frontBlob || !backBlob) return;
    setSubmitting(true);

    try {
      const [frontUpload, backUpload] = await Promise.all([
        api.integrations.Core.UploadFile({ file: frontBlob }),
        api.integrations.Core.UploadFile({ file: backBlob }),
      ]);

      await api.entities.WaterPost.create({
        front_photo_url: frontUpload.file_url,
        back_photo_url: backUpload.file_url,
        caption,
        location,
        bottle_size_ml: bottleSize,
      });

      const me = await api.auth.me();
      const today = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const goalMl = me.daily_goal_ml || 2000;

      const todayPosts = await api.entities.WaterPost.filter({ created_by: me.email }, '-created_date', 200);
      const todayMl = todayPosts
        .filter(p => p.created_date?.slice(0, 10) === today)
        .reduce((sum, p) => sum + (p.bottle_size_ml || 500), 0);

      const hitGoalToday = todayMl >= goalMl;
      let newStreak = me.streak_count || 0;
      if (hitGoalToday) {
        if (me.last_goal_date === today) {
          newStreak = me.streak_count || 1;
        } else if (me.last_goal_date === yesterday) {
          newStreak = (me.streak_count || 0) + 1;
        } else {
          newStreak = 1;
        }
        await api.auth.updateMe({ streak_count: newStreak, last_goal_date: today });
      }

      toast.success('Splash! Post shared with your friends.');
      navigate('/');
    } catch (err) {
      console.error(err);
      toast.error('Could not share your post. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] p-5 pb-32">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Capture</h2>
          <p className="text-sm text-muted-foreground mt-1">Both cameras fire at once — just like Beer Buddy!</p>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-muted hover:bg-muted/70 flex items-center justify-center"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Dual camera viewfinder */}
      <div className="relative aspect-[3/4] rounded-3xl overflow-hidden bg-black mb-6 shadow-2xl shadow-primary/10">
        {/* Back camera — main */}
        <video
          ref={backVideoRef}
          className={cn(
            "w-full h-full object-cover",
            cameraState === 'captured' ? 'hidden' : 'block'
          )}
          playsInline
          muted
        />
        {/* Back photo — after capture */}
        {backPreview && (
          <img
            src={backPreview}
            alt="Bottle"
            className={cn("w-full h-full object-cover", cameraState === 'captured' ? 'block' : 'hidden')}
          />
        )}

        {/* Front camera — overlay pip */}
        <div className="absolute top-4 left-4 w-28 aspect-[3/4] rounded-2xl overflow-hidden border-2 border-white/90 shadow-2xl bg-black">
          <video
            ref={frontVideoRef}
            className={cn(
              "w-full h-full object-cover scale-x-[-1]",
              cameraState === 'captured' ? 'hidden' : 'block'
            )}
            playsInline
            muted
          />
          {frontPreview && (
            <img
              src={frontPreview}
              alt="You"
              className={cn("w-full h-full object-cover scale-x-[-1]", cameraState === 'captured' ? 'block' : 'hidden')}
            />
          )}
        </div>

        {/* Loading overlay */}
        {cameraState === 'loading' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 text-white gap-3">
            <Loader2 className="w-10 h-10 animate-spin" />
            <p className="text-sm font-medium">Starting cameras…</p>
          </div>
        )}

        {/* Error overlay */}
        {cameraState === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white gap-4 p-6 text-center">
            <AlertCircle className="w-10 h-10 text-red-400" />
            <p className="text-sm">{cameraError}</p>
            <Button size="sm" variant="secondary" onClick={startCameras}>
              <RefreshCw className="w-4 h-4 mr-2" /> Try again
            </Button>
          </div>
        )}

        {/* Shutter button — only when live */}
        {cameraState === 'ready' && (
          <button
            onClick={captureSimultaneously}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 w-20 h-20 rounded-full bg-white/90 hover:bg-white active:scale-95 transition-all shadow-2xl flex items-center justify-center"
          >
            <div className="w-16 h-16 rounded-full water-gradient flex items-center justify-center">
              <Camera className="w-7 h-7 text-white" />
            </div>
          </button>
        )}

        {/* Retake button — after capture */}
        {cameraState === 'captured' && (
          <button
            onClick={retake}
            className="absolute bottom-6 right-6 flex items-center gap-2 px-4 py-2.5 rounded-full bg-black/60 text-white text-sm font-medium backdrop-blur hover:bg-black/70 transition-all"
          >
            <RefreshCw className="w-4 h-4" /> Retake
          </button>
        )}
      </div>

      {/* Details — only after capture */}
      {cameraState === 'captured' && (
        <>
          <div className="space-y-5 bg-card rounded-3xl border border-border/50 p-5">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
                <Droplets className="w-3.5 h-3.5" />
                Bottle size
              </label>
              <div className="grid grid-cols-4 gap-2">
                {BOTTLE_SIZES.map(s => (
                  <button
                    key={s}
                    onClick={() => setBottleSize(s)}
                    className={cn(
                      "py-3 rounded-2xl text-sm font-semibold transition-all border",
                      bottleSize === s
                        ? "water-gradient text-white border-transparent shadow-md shadow-primary/20"
                        : "bg-background border-border hover:border-primary/40"
                    )}
                  >
                    {s}ml
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Caption</label>
              <Textarea
                placeholder="How's the hydration going?"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className="rounded-2xl border-border resize-none"
                rows={3}
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Location (optional)</label>
              <Input
                placeholder="e.g. The gym"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="rounded-2xl border-border"
              />
            </div>
          </div>

          <Button
            onClick={submit}
            disabled={submitting}
            size="lg"
            className="w-full mt-6 rounded-full h-14 text-base water-gradient border-0 shadow-xl shadow-primary/30"
          >
            {submitting ? (
              <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Sharing…</>
            ) : (
              <><Check className="w-5 h-5 mr-2" /> Share hydration</>
            )}
          </Button>
        </>
      )}
    </div>
  );
}