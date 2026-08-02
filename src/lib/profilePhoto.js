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

async function blobFromWebPath(webPath) {
  const response = await fetch(webPath);
  return response.blob();
}

/**
 * Pick a profile photo on iOS (Capacitor Camera) or fall back to a hidden file input on web.
 * @param {'camera' | 'library'} source
 * @returns {Promise<{ blob: Blob, previewUrl: string } | null>}
 */
export async function pickProfilePhoto(source) {
  if (Capacitor.isNativePlatform()) {
    try {
      const photo = await Camera.getPhoto({
        quality: 85,
        allowEditing: true,
        resultType: CameraResultType.Uri,
        source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos,
        correctOrientation: true,
        width: 800,
        height: 800,
      });

      if (!photo.webPath) return null;

      const blob = await blobFromWebPath(photo.webPath);
      return {
        blob,
        previewUrl: photo.webPath,
      };
    } catch (err) {
      // User cancelled the system sheet — not an error
      if (err?.message?.toLowerCase().includes('cancel') || err?.message?.toLowerCase().includes('user')) {
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
