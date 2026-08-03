import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

function base64ToBlob(base64, mimeType = 'image/jpeg') {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

/**
 * Pick a profile photo on iOS (Capacitor Camera) or fall back to a hidden file input on web.
 * @param {'camera' | 'library'} source
 * @returns {Promise<{ blob: Blob, previewUrl: string } | null>}
 */
export async function pickProfilePhoto(source) {
  if (Capacitor.isNativePlatform()) {
    try {
      // Base64 avoids WKWebView fetch() failures on capacitor/file URLs.
      // allowEditing:false avoids iOS Portrait-mode camera paths that break on
      // Simulator and some dual-camera devices (FigCapture / -17281).
      const photo = await Camera.getPhoto({
        quality: 85,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos,
        correctOrientation: true,
        width: 800,
        height: 800,
      });

      if (!photo.base64String) return null;

      const mimeType = photo.format === 'png' ? 'image/png' : 'image/jpeg';
      const blob = base64ToBlob(photo.base64String, mimeType);
      const previewUrl = URL.createObjectURL(blob);
      return { blob, previewUrl };
    } catch (err) {
      // User cancelled the system sheet — not an error
      const msg = String(err?.message || err || '').toLowerCase();
      if (msg.includes('cancel') || msg.includes('user') || msg.includes('denied')) {
        if (msg.includes('denied')) throw err;
        return null;
      }
      throw err;
    }
  }

  return pickProfilePhotoWeb(source);
}

function pickProfilePhotoWeb(source) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (source === 'camera') {
      input.capture = 'user';
    }

    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      resolve({
        blob: file,
        previewUrl: URL.createObjectURL(file),
      });
    };

    input.oncancel = () => resolve(null);
    input.click();
  });
}

export async function dataUrlToBlob(dataUrl) {
  const [header, data] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
  return base64ToBlob(data, mime);
}
