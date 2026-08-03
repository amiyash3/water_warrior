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
  ImagePlus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { BottlePicker, OTHER_BOTTLE_ID } from '@/components/MyBottlesManager';
import CustomAmountInput from '@/components/CustomAmountInput';

const BOTTLE_SIZES = [250, 500, 750, 1000];
const MEDIA_TIMEOUT_MS = 15000;

function isMobileDevice() {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

function canUseLiveCamera() {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && window.isSecureContext;
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
    return 'Live camera preview needs HTTPS. Use the buttons below to take photos with your phone camera instead.';
  }
  if (err?.message?.includes('timed out')) {
    return 'Camera took too long to start. Try photo capture below or close other camera apps.';
  }
  if (err?.name === 'NotAllowedError') {
    return 'Camera permission denied. Allow camera in browser settings, or use photo capture below.';
  }
  if (err?.name === 'NotFoundError') {
    return 'No camera found. Use photo capture below.';
  }
  if (err?.name === 'NotReadableError' || err?.name === 'OverconstrainedError') {
    return 'Camera is busy. Close other apps using the camera, or use photo capture below.';
  }
  return 'Could not start live camera. Use photo capture below.';
}

function captureFrameFromVideo(videoEl) {
  const canvas = document.createElement('canvas');
  canvas.width = videoEl.videoWidth || 640;
  canvas.height = videoEl.videoHeight || 480;
  canvas.getContext('2d').drawImage(videoEl, 0, 0);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
}

function attachVideoStream(videoEl, stream) {
  if (!videoEl) return Promise.resolve();

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
    { video: { facingMode: { ideal: facingMode } }, audio: false },
    { video: { facingMode }, audio: false },
    { video: true, audio: false },
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
  throw lastErr;
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
  const bottleInputRef = useRef(null);
  const selfieInputRef = useRef(null);
  const mountedRef = useRef(true);

  /** live = getUserMedia preview | native = two-step file/camera inputs (works on HTTP) */
  const [captureMethod, setCaptureMethod] = useState(() =>
    isMobileDevice() && !canUseLiveCamera() ? 'native' : 'live'
  );
  const [nativeStep, setNativeStep] = useState('bottle'); // bottle | selfie | done

  const [cameraState, setCameraState] = useState('idle');
  const [cameraError, setCameraError] = useState('');
  const [frontBlob, setFrontBlob] = useState(null);
  const [backBlob, setBackBlob] = useState(null);
  const [frontPreview, setFrontPreview] = useState(null);
  const [backPreview, setBackPreview] = useState(null);
  const [caption, setCaption] = useState('');
  const [location, setLocation] = useState('');
  const [bottleSize, setBottleSize] = useState(500);
  const [bottles, setBottles] = useState([]);
  const [selectedBottleId, setSelectedBottleId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [capturing, setCapturing] = useState(false);

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

  const switchToNativeCapture = useCallback(() => {
    stopStreams();
    setCaptureMethod('native');
    setNativeStep(frontBlob && backBlob ? 'done' : backBlob ? 'selfie' : 'bottle');
    setCameraError('');
    setCameraState(frontBlob && backBlob ? 'captured' : 'ready');
  }, [stopStreams, frontBlob, backBlob]);

  const startLiveCameras = useCallback(async () => {
    setCameraState('loading');
    setCameraError('');
    stopStreams();

    try {
      if (!canUseLiveCamera()) {
        switchToNativeCapture();
        return;
      }

      if (isMobile.current) {
        const backStream = await getVideoStream('environment');
        if (!mountedRef.current) {
          backStream.getTracks().forEach((t) => t.stop());
          return;
        }
        backStreamRef.current = backStream;
        await attachVideoStream(backVideoRef.current, backStream);
        if (mountedRef.current) {
          setCaptureMethod('live');
          setCameraState('ready');
        }
        return;
      }

      const frontStream = await getVideoStream('user');
      const backStream = await getVideoStream('environment');

      if (!mountedRef.current) {
        frontStream.getTracks().forEach((t) => t.stop());
        backStream.getTracks().forEach((t) => t.stop());
        return;
      }

      frontStreamRef.current = frontStream;
      backStreamRef.current = backStream;

      await Promise.all([
        attachVideoStream(frontVideoRef.current, frontStream),
        attachVideoStream(backVideoRef.current, backStream),
      ]);

      if (mountedRef.current) {
        setCaptureMethod('live');
        setCameraState('ready');
      }
    } catch (err) {
      console.error(err);
      stopStreams();
      if (!mountedRef.current) return;

      if (isMobile.current) {
        setCameraError(getCameraErrorMessage(err));
        switchToNativeCapture();
        toast.message('Using photo capture mode', {
          description: 'Take a bottle photo, then a selfie.',
        });
      } else {
        setCameraError(getCameraErrorMessage(err));
        setCameraState('error');
      }
    }
  }, [stopStreams, switchToNativeCapture]);

  useEffect(() => {
    mountedRef.current = true;
    if (captureMethod === 'native') {
      setCameraState('ready');
    } else {
      startLiveCameras();
    }
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBottleSelect = (bottleId) => {
    setSelectedBottleId(bottleId);
    if (bottleId === OTHER_BOTTLE_ID) return;
    const bottle = bottles.find((b) => b.id === bottleId);
    if (bottle) setBottleSize(bottle.size_ml);
  };

  const handleNativeFile = (kind, file) => {
    if (!file) return;

    if (kind === 'bottle') {
      revokePreview(backPreview);
      setBackBlob(file);
      setBackPreview(fileToPreview(file));
      setNativeStep('selfie');
      toast.success('Bottle photo captured — now take your selfie');
    } else {
      revokePreview(frontPreview);
      setFrontBlob(file);
      setFrontPreview(fileToPreview(file));
      setNativeStep('done');
      setCameraState('captured');
      toast.success('Both photos ready!');
    }
  };

  const captureLiveShutter = async () => {
    if (capturing) return;
    setCapturing(true);

    try {
      if (isMobile.current) {
        if (!backVideoRef.current) throw new Error('Camera not ready');

        const backFrame = await captureFrameFromVideo(backVideoRef.current);
        stopStreams();

        let frontFrame = null;
        try {
          const frontStream = await getVideoStream('user');
          frontStreamRef.current = frontStream;
          await attachVideoStream(frontVideoRef.current, frontStream);
          await new Promise((r) => setTimeout(r, 500));
          if (frontVideoRef.current?.videoWidth) {
            frontFrame = await captureFrameFromVideo(frontVideoRef.current);
          }
          stopStreams();
        } catch (selfieErr) {
          console.warn('Live selfie failed, falling back to native', selfieErr);
          stopStreams();
          setBackBlob(backFrame);
          setBackPreview(fileToPreview(backFrame));
          setNativeStep('selfie');
          setCaptureMethod('native');
          setCameraState('ready');
          toast.message('Now take your selfie', {
            description: 'Tap the button below to open the front camera.',
          });
          return;
        }

        if (!frontFrame) throw new Error('Could not capture selfie');

        setBackBlob(backFrame);
        setFrontBlob(frontFrame);
        setBackPreview(fileToPreview(backFrame));
        setFrontPreview(fileToPreview(frontFrame));
        setCameraState('captured');
        return;
      }

      if (!frontVideoRef.current || !backVideoRef.current) return;

      const [fBlob, bBlob] = await Promise.all([
        captureFrameFromVideo(frontVideoRef.current),
        captureFrameFromVideo(backVideoRef.current),
      ]);

      setFrontBlob(fBlob);
      setBackBlob(bBlob);
      setFrontPreview(fileToPreview(fBlob));
      setBackPreview(fileToPreview(bBlob));
      stopStreams();
      setCameraState('captured');
    } catch (err) {
      console.error(err);
      toast.error(getCameraErrorMessage(err));
      if (isMobile.current) switchToNativeCapture();
      else startLiveCameras();
    } finally {
      setCapturing(false);
    }
  };

  const retake = () => {
    revokePreview(frontPreview);
    revokePreview(backPreview);
    setFrontBlob(null);
    setBackBlob(null);
    setFrontPreview(null);
    setBackPreview(null);
    setNativeStep('bottle');

    if (captureMethod === 'native' || !canUseLiveCamera()) {
      setCaptureMethod('native');
      setCameraState('ready');
      return;
    }

    setCaptureMethod('live');
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
        bottle_size_ml: bottleSize,
        bottle_id: selectedBottleId && selectedBottleId !== OTHER_BOTTLE_ID ? selectedBottleId : null,
      });

      const me = await api.auth.me();
      const today = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const goalMl = me.daily_goal_ml || 2000;

      const todayPosts = await api.entities.WaterPost.filter(
        { created_by: me.email },
        '-created_date',
        200
      );
      const todayMl = todayPosts
        .filter((p) => p.created_date?.slice(0, 10) === today)
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

  const showLivePreview = captureMethod === 'live' && cameraState !== 'captured';
  const showPipPlaceholder =
    captureMethod === 'live' && isMobile.current && cameraState === 'ready' && !frontPreview;

  const nativeBottlePreview = captureMethod === 'native' && backPreview;
  const nativeSelfiePreview = captureMethod === 'native' && frontPreview;

  return (
    <div className="min-h-[calc(100vh-80px)] p-5 pb-32">
      <input
        ref={bottleInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          handleNativeFile('bottle', e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <input
        ref={selfieInputRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={(e) => {
          handleNativeFile('selfie', e.target.files?.[0]);
          e.target.value = '';
        }}
      />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Capture</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {captureMethod === 'native'
              ? 'Step 1: bottle photo · Step 2: selfie'
              : isMobile.current
                ? 'Rear live preview — shutter, then selfie'
                : 'Both cameras live — tap to capture'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-muted hover:bg-muted/70 flex items-center justify-center"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {!window.isSecureContext && isMobile.current && captureMethod === 'native' && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          You&apos;re on HTTP (not secure). Photo capture mode works; for live preview use{' '}
          <span className="font-semibold">npm run dev:mobile</span> and open the{' '}
          <span className="font-semibold">https://</span> link.
        </div>
      )}

      <div className="relative aspect-[3/4] rounded-3xl overflow-hidden bg-black mb-6 shadow-2xl shadow-primary/10">
        {showLivePreview && (
          <video
            ref={backVideoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
            autoPlay
          />
        )}

        {nativeBottlePreview && cameraState !== 'captured' && (
          <img src={backPreview} alt="Bottle" className="w-full h-full object-cover opacity-40" />
        )}
        {cameraState === 'captured' && backPreview && (
          <img src={backPreview} alt="Bottle" className="w-full h-full object-cover" />
        )}

        <div className="absolute top-4 left-4 w-28 aspect-[3/4] rounded-2xl overflow-hidden border-2 border-white/90 shadow-2xl bg-black">
          {showPipPlaceholder && (
            <div className="w-full h-full flex flex-col items-center justify-center text-white/80 p-2 text-center">
              <User className="w-8 h-8 mb-1" />
              <span className="text-[10px] font-medium leading-tight">Selfie on capture</span>
            </div>
          )}
          {showLivePreview && !showPipPlaceholder && (
            <video
              ref={frontVideoRef}
              className="w-full h-full object-cover scale-x-[-1]"
              playsInline
              muted
              autoPlay
            />
          )}
          {(nativeSelfiePreview || (cameraState === 'captured' && frontPreview)) && (
            <img
              src={frontPreview}
              alt="You"
              className={cn(
                'w-full h-full object-cover scale-x-[-1]',
                cameraState === 'captured' || nativeSelfiePreview ? 'block' : 'hidden'
              )}
            />
          )}
        </div>

        {captureMethod === 'native' && cameraState !== 'captured' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 z-10">
            {nativeStep === 'bottle' && (
              <>
                <p className="text-white text-center text-sm font-medium px-4">
                  Step 1 of 2 — photograph your water bottle
                </p>
                <Button
                  type="button"
                  size="lg"
                  className="rounded-full water-gradient border-0"
                  onClick={() => bottleInputRef.current?.click()}
                >
                  <Camera className="w-5 h-5 mr-2" />
                  Take bottle photo
                </Button>
              </>
            )}
            {nativeStep === 'selfie' && (
              <>
                <p className="text-white text-center text-sm font-medium px-4">
                  Step 2 of 2 — now take your selfie
                </p>
                <Button
                  type="button"
                  size="lg"
                  className="rounded-full water-gradient border-0"
                  onClick={() => selfieInputRef.current?.click()}
                >
                  <User className="w-5 h-5 mr-2" />
                  Take selfie
                </Button>
              </>
            )}
          </div>
        )}

        {(cameraState === 'loading' || capturing) && captureMethod === 'live' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 text-white gap-3 z-10">
            <Loader2 className="w-10 h-10 animate-spin" />
            <p className="text-sm font-medium">
              {capturing ? 'Snapping selfie…' : 'Starting camera…'}
            </p>
          </div>
        )}

        {cameraState === 'error' && captureMethod === 'live' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white gap-4 p-6 text-center z-10">
            <AlertCircle className="w-10 h-10 text-red-400" />
            <p className="text-sm">{cameraError}</p>
            <div className="flex flex-col gap-2 w-full max-w-xs">
              <Button size="sm" variant="secondary" onClick={startLiveCameras}>
                <RefreshCw className="w-4 h-4 mr-2" /> Try live camera
              </Button>
              <Button size="sm" className="water-gradient border-0" onClick={switchToNativeCapture}>
                <ImagePlus className="w-4 h-4 mr-2" /> Use photo capture
              </Button>
            </div>
          </div>
        )}

        {captureMethod === 'live' && cameraState === 'ready' && !capturing && (
          <button
            type="button"
            onClick={captureLiveShutter}
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
                Caption
              </label>
              <Textarea
                placeholder="How's the hydration going?"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className="rounded-2xl border-border resize-none"
                rows={3}
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