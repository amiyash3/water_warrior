import { Camera } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

/**
 * Ask iOS/Android for camera permission before getUserMedia.
 * Safe no-op on web.
 */
export async function ensureCameraPermission() {
  if (!Capacitor.isNativePlatform()) return true;

  try {
    const current = await Camera.checkPermissions();
    if (current.camera === 'granted' || current.camera === 'limited') return true;

    const requested = await Camera.requestPermissions({ permissions: ['camera'] });
    return requested.camera === 'granted' || requested.camera === 'limited';
  } catch (err) {
    console.warn('Camera permission check failed', err);
    return true; // still attempt getUserMedia — OS may prompt
  }
}

export function isNativeApp() {
  return Capacitor.isNativePlatform();
}
