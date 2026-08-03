import { Browser } from '@capacitor/browser';
import { isNativeApp } from '@/lib/native';

/**
 * Open a legal / support URL in the system browser (native) or a new tab (web).
 * @param {string} url
 */
export async function openExternalUrl(url) {
  if (!url) return;
  if (isNativeApp()) {
    await Browser.open({ url });
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}
