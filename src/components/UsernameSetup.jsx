import React, { useState } from 'react';
import { api } from '@/api/client';
import { Droplets, Loader2, ArrowRight, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ProfilePhotoChooser from '@/components/ProfilePhotoChooser';
import { toast } from 'sonner';

export default function UsernameSetup({ onComplete }) {
  const [step, setStep] = useState('username'); // username | photo
  const [username, setUsername] = useState('');
  const [photoBlob, setPhotoBlob] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [saving, setSaving] = useState(false);

  const goToPhoto = (e) => {
    e.preventDefault();
    const trimmed = username.trim().replace(/\s+/g, '_');
    if (trimmed.length < 2) {
      toast.error('Username must be at least 2 characters');
      return;
    }
    setUsername(trimmed);
    setStep('photo');
  };

  const finish = async ({ withPhoto }) => {
    setSaving(true);
    try {
      const trimmed = username.trim().replace(/\s+/g, '_');
      let avatarUrl = null;

      if (withPhoto && photoBlob) {
        const upload = await api.integrations.Core.UploadFile({
          file: photoBlob,
          bucket: 'avatars',
        });
        avatarUrl = upload.file_url;
      }

      await api.auth.updateMe({
        username: trimmed,
        ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
      });

      toast.success(`Welcome, @${trimmed}!`);
      onComplete(trimmed);
    } catch (err) {
      console.error(err);
      toast.error(err?.message || 'Could not save your profile. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoChange = ({ blob, previewUrl }) => {
    if (photoPreview?.startsWith('blob:')) URL.revokeObjectURL(photoPreview);
    setPhotoBlob(blob);
    setPhotoPreview(previewUrl);
  };

  const clearPhoto = () => {
    if (photoPreview?.startsWith('blob:')) URL.revokeObjectURL(photoPreview);
    setPhotoBlob(null);
    setPhotoPreview(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-background overflow-y-auto">
      <div className="w-full max-w-sm text-center py-8">
        {step === 'username' ? (
          <>
            <div className="w-24 h-24 mx-auto rounded-3xl water-gradient flex items-center justify-center shadow-2xl shadow-primary/30 mb-8 animate-float">
              <Droplets className="w-12 h-12 text-white" strokeWidth={2} />
            </div>

            <h1 className="text-3xl font-bold tracking-tight mb-2">
              Welcome to
              <br />
              Water Warrior
            </h1>
            <p className="text-muted-foreground text-sm mb-8 leading-relaxed">
              Choose a username so your friends can find you and cheer on your hydration journey.
            </p>

            <form onSubmit={goToPhoto} className="space-y-4">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold text-sm">
                  @
                </span>
                <Input
                  value={username}
                  onChange={(e) =>
                    setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ''))
                  }
                  placeholder="yourname"
                  className="pl-8 h-14 rounded-2xl text-center text-lg font-semibold tracking-wide border-border"
                  autoFocus
                  maxLength={30}
                />
              </div>
              <p className="text-xs text-muted-foreground">Letters, numbers, dots and underscores only.</p>

              <Button
                type="submit"
                disabled={username.trim().length < 2}
                size="lg"
                className="w-full rounded-full h-14 text-base water-gradient border-0 shadow-xl shadow-primary/30 disabled:opacity-40"
              >
                Continue <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </form>
          </>
        ) : (
          <>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Step 2 of 2
            </p>
            <h1 className="text-3xl font-bold tracking-tight mb-2">Add a profile photo</h1>
            <p className="text-muted-foreground text-sm mb-8 leading-relaxed">
              Take a selfie, pick from your library, or skip — you can always change this later.
            </p>

            <ProfilePhotoChooser
              previewUrl={photoPreview}
              onChange={handlePhotoChange}
              onClear={clearPhoto}
              className="mb-8"
            />

            <div className="space-y-3">
              <Button
                type="button"
                disabled={saving || !photoBlob}
                size="lg"
                className="w-full rounded-full h-14 text-base water-gradient border-0 shadow-xl shadow-primary/30 disabled:opacity-40"
                onClick={() => finish({ withPhoto: true })}
              >
                {saving ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Saving…
                  </>
                ) : (
                  <>
                    Use this photo <ArrowRight className="w-5 h-5 ml-2" />
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                disabled={saving}
                className="w-full rounded-full h-12"
                onClick={() => finish({ withPhoto: false })}
              >
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Continue without a photo
              </Button>

              <Button
                type="button"
                variant="ghost"
                disabled={saving}
                className="w-full rounded-full text-muted-foreground"
                onClick={() => setStep('username')}
              >
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
