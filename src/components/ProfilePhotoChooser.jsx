import React, { useState } from 'react';
import { Camera, ImagePlus, User, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { pickProfilePhoto } from '@/lib/profilePhoto';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

/**
 * Shared UI for choosing / changing a profile photo (iOS camera, library, or clear).
 */
export default function ProfilePhotoChooser({
  previewUrl,
  onChange,
  onClear,
  size = 'lg',
  showClear = true,
  className,
}) {
  const [busy, setBusy] = useState(null);

  const handlePick = async (source) => {
    setBusy(source);
    try {
      const result = await pickProfilePhoto(source);
      if (result) onChange(result);
    } catch (err) {
      console.error(err);
      toast.error(
        source === 'camera'
          ? 'Could not open camera. Check permissions in Settings.'
          : 'Could not open photo library. Check permissions in Settings.'
      );
    } finally {
      setBusy(null);
    }
  };

  const avatarSize = size === 'xl' ? 'w-28 h-28' : 'w-24 h-24';

  return (
    <div className={cn('flex flex-col items-center gap-4', className)}>
      <div className={cn('relative rounded-full overflow-hidden water-gradient ring-4 ring-white/30 shadow-xl', avatarSize)}>
        {previewUrl ? (
          <img src={previewUrl} alt="Profile" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white">
            <User className="w-10 h-10" strokeWidth={1.75} />
          </div>
        )}
        {busy && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-white animate-spin" />
          </div>
        )}
        {showClear && previewUrl && !busy && (
          <button
            type="button"
            onClick={onClear}
            className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center"
            aria-label="Remove photo"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-2 w-full max-w-xs">
        <Button
          type="button"
          variant="secondary"
          className="flex-1 rounded-full"
          disabled={!!busy}
          onClick={() => handlePick('camera')}
        >
          {busy === 'camera' ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Camera className="w-4 h-4 mr-2" />
          )}
          Take photo
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="flex-1 rounded-full"
          disabled={!!busy}
          onClick={() => handlePick('library')}
        >
          {busy === 'library' ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <ImagePlus className="w-4 h-4 mr-2" />
          )}
          Photo library
        </Button>
      </div>
    </div>
  );
}
