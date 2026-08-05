import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import {
  Camera,
  X,
  Check,
  Droplets,
  Loader2,
  RefreshCw,
  AlertCircle,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { BottlePicker, OTHER_BOTTLE_ID } from '@/components/MyBottlesManager';
import CustomAmountInput from '@/components/CustomAmountInput';
import { ensureCameraPermission } from '@/lib/hydrationCapture';
import { getRandomFact } from '@/data/waterFacts';
import { openExternalUrl } from '@/lib/openExternalUrl';
import { LEGAL_URLS } from '@/components/AccountSettings';
import { toLocalDateString } from '../utils/date';

const BOTTLE_SIZES = [250, 500, 750, 1000];
const MEDIA_TIMEOUT_MS = 15000;

function isMobileDevice() {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth < 768;
}

function canUseLiveCamera() {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    !!window.isSecureContext
  );
}

function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}

function getCameraErrorMessage(err) {
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return 'Camera needs a secure connection. Rebuild the iOS app or use the https:// dev link.';
  }
  if (err?.message?.includes('timed out')) {
    return 'Camera took too long to start. Close other camera apps and try again.';
  }
  if (err?.name === 'NotAllowedError' || err?.message?.includes('permission')) {
    return 'Camera permission denied. Allow camera in Settings → Water Warrior.';
  }
  if (err?.name === 'NotFoundError') {
    return 'No camera found on this device.';
  }
  if (err?.name === 'NotReadableError' || err?.name === 'OverconstrainedError') {
    return 'Camera is busy. Close other apps using the camera and try again.';
  }
  return err?.message || 'Could not start the in-app camera.';
}

function captureFrameFromVideo(videoEl) {
  const canvas = document.createElement('canvas');
  canvas.width = videoEl.videoWidth || 640;
  canvas.height = videoEl.videoHeight || 480;
  canvas.getContext('2d').drawImage(videoEl, 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not capture frame'))),
      'image/jpeg',
      0.92
    );
  });
}

async function waitForVideoFrame(videoEl, timeoutMs = 4000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (videoEl && videoEl.videoWidth > 0 && videoEl.readyState >= 2) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error('Camera preview not ready');
}

function attachVideoStream(videoEl, stream) {
  if (!videoEl) return Promise.reject(new Error('Camera view not ready'));

  videoEl.srcObject = stream;
  videoEl.muted = true;
  videoEl.playsInline = true;
  videoEl.setAttribute('playsinline', '');
  videoEl.setAttribute('webkit-playsinline', '');

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      videoEl.removeEventListener('loadedmetadata', onReady);
      resolve();
    };

    const onReady = () => {
      const playPromise = videoEl.play();
      if (playPromise?.then) playPromise.then(finish).catch(finish);
      else finish();
    };

    videoEl.addEventListener('loadedmetadata', onReady);
    if (videoEl.readyState >= 1) onReady();
    setTimeout(finish, 4000);
  });
}

async function getVideoStream(facingMode) {
  const attempts = [
    { video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
    { video: { facingMode: { ideal: facingMode } }, audio: false },
    { video: { facingMode }, audio: false },
  ];

  let lastErr;
  for (const constraints of attempts) {
    try {
      return await withTimeout(
        navigator.mediaDevices.getUserMedia(constraints),
        MEDIA_TIMEOUT_MS,
        'Camera timed out'
      );
    } catch (err) {
      lastErr = err;
    }
  }

  // Last resort: pick a device by label
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cams = devices.filter((d) => d.kind === 'videoinput');
    const preferFront = facingMode === 'user';
    const match =
      cams.find((d) => {
        const label = (d.label || '').toLowerCase();
        if (preferFront) return label.includes('front') || label.includes('user') || label.includes('facetime');
        return label.includes('back') || label.includes('rear') || label.includes('environment');
      }) || (preferFront ? cams[0] : cams[cams.length - 1]);

    if (match?.deviceId) {
      return await withTimeout(
        navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: match.deviceId } },
          audio: false,
        }),
        MEDIA_TIMEOUT_MS,
        'Camera timed out'
      );
    }
  } catch (err) {
    lastErr = err;
  }

  throw lastErr || new Error('Could not open camera');
}

function fileToPreview(blob) {
  return URL.createObjectURL(blob);
}

export default function Capture() {
  const navigate = useNavigate();
  const isMobile = useRef(isMobileDevice());

  const frontVideoRef = useRef(null);
  const backVideoRef = useRef(null);
  const frontStreamRef = useRef(null);
  const backStreamRef = useRef(null);
  const mountedRef = useRef(true);

  const [cameraState, setCameraState] = useState('loading'); // loading | ready | capturing | captured | error
  const [cameraError, setCameraError] = useState('');
  const [captureHint, setCaptureHint] = useState(''); // status text while snapping
  const [loadingFact, setLoadingFact] = useState(() => getRandomFact());
  const [showSelfieLive, setShowSelfieLive] = useState(false);
  const [frontBlob, setFrontBlob] = useState(null);
  const [backBlob, setBackBlob] = useState(null);
  const [frontPreview, setFrontPreview] = useState(null);
  const [backPreview, setBackPreview] = useState(null);
  const [caption, setCaption] = useState('');
  const [location, setLocation] = useState('');
  const [bottleSize, setBottleSize] = useState(500);
  const [bottlesDrank, setBottlesDrank] = useState(1);
  const [customBottlesOpen, setCustomBottlesOpen] = useState(false);
  const [customBottlesInput, setCustomBottlesInput] = useState('');
  const [bottles, setBottles] = useState([]);
  const [selectedBottleId, setSelectedBottleId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const revokePreview = (url) => {
    if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
  };

  const stopStreams = useCallback(() => {
    frontStreamRef.current?.getTracks().forEach((t) => t.stop());
    backStreamRef.current?.getTracks().forEach((t) => t.stop());
    frontStreamRef.current = null;
    backStreamRef.current = null;
    if (frontVideoRef.current) frontVideoRef.current.srcObject = null;
    if (backVideoRef.current) backVideoRef.current.srcObject = null;
  }, []);

  const startLiveCameras = useCallback(async () => {
    setLoadingFact(getRandomFact());
    setCameraState('loading');
    setCameraError('');
    setShowSelfieLive(false);
    setCaptureHint('');
    stopStreams();

    try {
      if (!canUseLiveCamera()) {
        throw new Error('In-app camera is not available in this context.');
      }

      const allowed = await ensureCameraPermission();
      if (!allowed) {
        throw Object.assign(new Error('Camera permission denied'), { name: 'NotAllowedError' });
      }

      // Let React paint the <video> elements before attaching streams
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

      if (isMobile.current) {
        const backStream = await getVideoStream('environment');
        if (!mountedRef.current) {
          backStream.getTracks().forEach((t) => t.stop());
          return;
        }
        backStreamRef.current = backStream;
        await attachVideoStream(backVideoRef.current, backStream);
        await waitForVideoFrame(backVideoRef.current);
        if (mountedRef.current) setCameraState('ready');
        return;
      }

      const [frontStream, backStream] = await Promise.all([
        getVideoStream('user'),
        getVideoStream('environment'),
      ]);

      if (!mountedRef.current) {
        frontStream.getTracks().forEach((t) => t.stop());
        backStream.getTracks().forEach((t) => t.stop());
        return;
      }

      frontStreamRef.current = frontStream;
      backStreamRef.current = backStream;
      setShowSelfieLive(true);

      await Promise.all([
        attachVideoStream(frontVideoRef.current, frontStream),
        attachVideoStream(backVideoRef.current, backStream),
      ]);
      await Promise.all([
        waitForVideoFrame(frontVideoRef.current),
        waitForVideoFrame(backVideoRef.current),
      ]);

      if (mountedRef.current) setCameraState('ready');
    } catch (err) {
      console.error(err);
      stopStreams();
      if (!mountedRef.current) return;
      setCameraError(getCameraErrorMessage(err));
      setCameraState('error');
    }
  }, [stopStreams]);

  useEffect(() => {
    mountedRef.current = true;
    startLiveCameras();
    api.entities.UserBottle.list()
      .then((list) => {
        setBottles(list);
        const defaultBottle = list.find((b) => b.is_default) ?? list[0];
        if (defaultBottle) {
          setSelectedBottleId(defaultBottle.id);
          setBottleSize(defaultBottle.size_ml);
        }
      })
      .catch(() => {});
    return () => {
      mountedRef.current = false;
      stopStreams();
    };
  }, []);

  const handleBottleSelect = (bottleId) => {
    setSelectedBottleId(bottleId);
    if (bottleId === OTHER_BOTTLE_ID) return;
    const bottle = bottles.find((b) => b.id === bottleId);
    if (bottle) setBottleSize(bottle.size_ml);
  };

  const onShutter = async () => {
    if (cameraState !== 'ready') return;
    setLoadingFact(getRandomFact());
    setCameraState('capturing');
    setCaptureHint('Capturing…');

    try {
      if (isMobile.current) {
        if (!backVideoRef.current) throw new Error('Camera not ready');
        await waitForVideoFrame(backVideoRef.current, 1500);

        // 1) Bottle / rear frame from the live preview (no system camera)
        const backFrame = await captureFrameFromVideo(backVideoRef.current);

        // Freeze rear preview visually
        const backUrl = fileToPreview(backFrame);
        setBackBlob(backFrame);
        setBackPreview((prev) => {
          if (prev && prev !== backUrl) revokePreview(prev);
          return backUrl;
        });

        // 2) Switch to front camera in-app and grab selfie
        setLoadingFact(getRandomFact());
        setCaptureHint('Snapping selfie…');
        stopStreams();
        setShowSelfieLive(true);

        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

        const frontStream = await getVideoStream('user');
        if (!mountedRef.current) {
          frontStream.getTracks().forEach((t) => t.stop());
          return;
        }
        frontStreamRef.current = frontStream;
        await attachVideoStream(frontVideoRef.current, frontStream);
        await waitForVideoFrame(frontVideoRef.current);
        await new Promise((r) => setTimeout(r, 200));

        const frontFrame = await captureFrameFromVideo(frontVideoRef.current);
        stopStreams();
        setShowSelfieLive(false);

        const frontUrl = fileToPreview(frontFrame);
        setFrontBlob(frontFrame);
        setFrontPreview((prev) => {
          if (prev && prev !== frontUrl) revokePreview(prev);
          return frontUrl;
        });
        setCameraState('captured');
        setCaptureHint('');
        return;
      }

      // Desktop: both streams already live
      if (!frontVideoRef.current || !backVideoRef.current) throw new Error('Camera not ready');

      const [fBlob, bBlob] = await Promise.all([
        captureFrameFromVideo(frontVideoRef.current),
        captureFrameFromVideo(backVideoRef.current),
      ]);

      stopStreams();
      setShowSelfieLive(false);

      const frontUrl = fileToPreview(fBlob);
      const backUrl = fileToPreview(bBlob);
      setFrontBlob(fBlob);
      setBackBlob(bBlob);
      setFrontPreview((prev) => {
        if (prev && prev !== frontUrl) revokePreview(prev);
        return frontUrl;
      });
      setBackPreview((prev) => {
        if (prev && prev !== backUrl) revokePreview(prev);
        return backUrl;
      });
      setCameraState('captured');
      setCaptureHint('');
    } catch (err) {
      console.error(err);
      stopStreams();
      setShowSelfieLive(false);
      toast.error(getCameraErrorMessage(err));
      setCaptureHint('');
      startLiveCameras();
    }
  };

  const retake = () => {
    revokePreview(frontPreview);
    revokePreview(backPreview);
    setFrontBlob(null);
    setBackBlob(null);
    setFrontPreview(null);
    setBackPreview(null);
    setCaptureHint('');
    setShowSelfieLive(false);
    startLiveCameras();
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
        bottle_size_ml: bottleSize * Math.max(1, bottlesDrank),
        bottle_id: selectedBottleId && selectedBottleId !== OTHER_BOTTLE_ID ? selectedBottleId : null,
      });

      const me = await api.auth.me();
      const today = toLocalDateString(new Date());
      const yesterday = toLocalDateString(new Date(Date.now() - 86400000));
      const goalMl = me.daily_goal_ml || 2000;

      const todayPosts = await api.entities.WaterPost.filter(
        { created_by: me.email },
        '-created_date',
        200
      );
      const todayMl = todayPosts
        .filter((p) => toLocalDateString(p.created_date) === today)
        .reduce((sum, p) => sum + (p.bottle_size_ml || 500), 0);

      if (todayMl >= goalMl) {
        let newStreak = me.streak_count || 0;
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
      toast.error(
        err?.code === 'CONTENT_REJECTED' ||
          err?.message?.includes('Community Guidelines')
          ? err.message
          : 'Could not share your post. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const showLive = cameraState === 'loading' || cameraState === 'ready' || cameraState === 'capturing';
  const showShutter = cameraState === 'ready';

  return (
    <div className="min-h-[calc(100vh-80px)] p-5 pb-32">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Capture</h2>
          <p className="text-sm text-muted-foreground mt-1">Tap the shutter to show your hydration</p>
        </div>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-muted hover:bg-muted/70 flex items-center justify-center"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="relative aspect-[3/4] rounded-3xl overflow-hidden bg-black mb-6 shadow-2xl shadow-primary/10">
        {/* Keep videos mounted whenever we might need them so refs stay valid */}
        <video
          ref={backVideoRef}
          className={cn(
            'w-full h-full object-cover',
            showLive && cameraState !== 'captured' ? 'block' : 'hidden'
          )}
          playsInline
          muted
          autoPlay
        />

        {cameraState === 'captured' && backPreview && (
          <img src={backPreview} alt="Bottle" className="w-full h-full object-cover" />
        )}

        {/* During mobile capture, briefly freeze rear still under selfie */}
        {cameraState === 'capturing' && backPreview && (
          <img src={backPreview} alt="" className="absolute inset-0 w-full h-full object-cover" />
        )}

        <div className="absolute top-4 left-4 w-28 aspect-[3/4] rounded-2xl overflow-hidden border-2 border-white/90 shadow-2xl bg-black z-[5]">
          {showLive && !showSelfieLive && cameraState !== 'captured' && (
            <div className="w-full h-full flex flex-col items-center justify-center text-white/80 p-2 text-center">
              <User className="w-8 h-8 mb-1" />
              <span className="text-[10px] font-medium leading-tight">Selfie on capture</span>
            </div>
          )}

          <video
            ref={frontVideoRef}
            className={cn(
              'w-full h-full object-cover scale-x-[-1]',
              showSelfieLive && cameraState !== 'captured' ? 'block' : 'hidden'
            )}
            playsInline
            muted
            autoPlay
          />

          {cameraState === 'captured' && frontPreview && (
            <img src={frontPreview} alt="You" className="w-full h-full object-cover scale-x-[-1]" />
          )}
        </div>

        {(cameraState === 'loading' || cameraState === 'capturing') && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 text-white gap-4 px-8 z-10 pointer-events-none">
            <Loader2 className="w-9 h-9 animate-spin shrink-0" />
            <p className="text-sm font-medium">
              {cameraState === 'loading' ? 'Starting camera…' : captureHint || 'Capturing…'}
            </p>
            <div className="max-w-[16rem] text-center space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">
                Did you know…
              </p>
              <p className="text-sm leading-relaxed text-white/90">{loadingFact}</p>
            </div>
          </div>
        )}

        {cameraState === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white gap-4 p-6 text-center z-10">
            <AlertCircle className="w-10 h-10 text-red-400" />
            <p className="text-sm">{cameraError}</p>
            <Button size="sm" variant="secondary" onClick={startLiveCameras}>
              <RefreshCw className="w-4 h-4 mr-2" /> Try again
            </Button>
          </div>
        )}

        {showShutter && (
          <button
            type="button"
            onClick={onShutter}
            aria-label="Tap the shutter to show your hydration"
            className="absolute bottom-6 left-1/2 -translate-x-1/2 w-20 h-20 rounded-full bg-white/90 hover:bg-white active:scale-95 transition-all shadow-2xl flex items-center justify-center z-10"
          >
            <div className="w-16 h-16 rounded-full water-gradient flex items-center justify-center">
              <Camera className="w-7 h-7 text-white" />
            </div>
          </button>
        )}

        {cameraState === 'captured' && (
          <button
            type="button"
            onClick={retake}
            className="absolute bottom-6 right-6 flex items-center gap-2 px-4 py-2.5 rounded-full bg-black/60 text-white text-sm font-medium backdrop-blur hover:bg-black/70 transition-all z-10"
          >
            <RefreshCw className="w-4 h-4" /> Retake
          </button>
        )}
      </div>

      {cameraState === 'captured' && (
        <>
          <div className="space-y-5 bg-card rounded-3xl border border-border/50 p-5">
            <div>
              {bottles.length > 0 ? (
                <BottlePicker
                  bottles={bottles}
                  selectedId={selectedBottleId}
                  onSelect={handleBottleSelect}
                  sizeOptions={BOTTLE_SIZES}
                  bottleSize={bottleSize}
                  onSizeChange={setBottleSize}
                />
              ) : (
                <>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
                    <Droplets className="w-3.5 h-3.5" />
                    Bottle size
                  </label>
                  <p className="text-xs text-muted-foreground mb-1">ml</p>
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    {[250, 500, 750, 1000].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setBottleSize(s)}
                        className={cn(
                          'py-3 rounded-2xl text-sm font-semibold transition-all border',
                          bottleSize === s
                            ? 'water-gradient text-white border-transparent shadow-md shadow-primary/20'
                            : 'bg-background border-border hover:border-primary/40'
                        )}
                      >
                        {s}ml
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mb-1">oz</p>
                  <div className="grid grid-cols-6 gap-2">
                    {[8, 12, 16, 24, 32, 64].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setBottleSize(Math.round(s * 29.574))}
                        className={cn(
                          'py-3 rounded-2xl text-sm font-semibold transition-all border',
                          Math.abs(bottleSize - Math.round(s * 29.574)) < 10
                            ? 'water-gradient text-white border-transparent shadow-md shadow-primary/20'
                            : 'bg-background border-border hover:border-primary/40'
                        )}
                      >
                        {s}oz
                      </button>
                    ))}
                  </div>

                  <CustomAmountInput onSubmit={setBottleSize} />
                  <p className="text-xs text-muted-foreground mt-1">
                    Currently set to {bottleSize}ml · {Math.round(bottleSize / 29.574)}oz
                  </p>

                  <p className="text-xs text-muted-foreground mt-2">
                    Save bottles in Account to track them in stats.
                  </p>
                </>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                Bottles drank
              </label>
              <p className="text-xs text-muted-foreground mb-2">
                How many since your last post? Default is 1.
              </p>
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 3].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => {
                      setBottlesDrank(n);
                      setCustomBottlesOpen(false);
                      setCustomBottlesInput('');
                    }}
                    className={cn(
                      'py-3 rounded-2xl text-sm font-semibold transition-all border',
                      bottlesDrank === n && !customBottlesOpen
                        ? 'water-gradient text-white border-transparent shadow-md shadow-primary/20'
                        : 'bg-background border-border hover:border-primary/40'
                    )}
                  >
                    {n}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setCustomBottlesOpen(true);
                    setCustomBottlesInput(bottlesDrank > 3 ? String(bottlesDrank) : '');
                  }}
                  className={cn(
                    'py-3 rounded-2xl text-sm font-semibold transition-all border',
                    customBottlesOpen || bottlesDrank > 3
                      ? 'water-gradient text-white border-transparent shadow-md shadow-primary/20'
                      : 'bg-background border-border hover:border-primary/40'
                  )}
                >
                  {bottlesDrank > 3 ? bottlesDrank : 'Custom'}
                </button>
              </div>
              {customBottlesOpen && (
                <div className="flex items-center gap-2 mt-2">
                  <Input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="99"
                    placeholder="e.g. 5"
                    value={customBottlesInput}
                    onChange={(e) => setCustomBottlesInput(e.target.value)}
                    className="rounded-2xl border-border"
                  />
                  <Button
                    type="button"
                    className="rounded-2xl shrink-0"
                    onClick={() => {
                      const n = parseInt(customBottlesInput, 10);
                      if (!n || n < 1) {
                        toast.error('Enter at least 1 bottle');
                        return;
                      }
                      setBottlesDrank(Math.min(99, n));
                      setCustomBottlesOpen(false);
                    }}
                  >
                    Set
                  </Button>
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                Total logged: {(bottleSize * Math.max(1, bottlesDrank)).toLocaleString()} ml ·{' '}
                {Math.round((bottleSize * Math.max(1, bottlesDrank)) / 29.574)} oz
                {bottlesDrank > 1 ? ` (${bottlesDrank} × ${bottleSize} ml)` : ''}
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                Caption (optional)
              </label>
              <Textarea
                placeholder="How's the hydration going?"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className="rounded-2xl border-border resize-none"
                rows={3}
                maxLength={500}
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                Location (optional)
              </label>
              <Input
                placeholder="e.g. The gym"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="rounded-2xl border-border"
                maxLength={200}
              />
            </div>

            <p className="text-xs text-muted-foreground leading-snug">
              Captions are screened against our{' '}
              <button
                type="button"
                className="underline underline-offset-2 hover:text-foreground"
                onClick={() => openExternalUrl(LEGAL_URLS.communityGuidelines)}
              >
                Community Guidelines
              </button>
              .
            </p>
          </div>

          <Button
            onClick={submit}
            disabled={submitting}
            size="lg"
            className="w-full mt-6 rounded-full h-14 text-base water-gradient border-0 shadow-xl shadow-primary/30"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Sharing…
              </>
            ) : (
              <>
                <Check className="w-5 h-5 mr-2" /> Share hydration
              </>
            )}
          </Button>
        </>
      )}
    </div>
  );
}
