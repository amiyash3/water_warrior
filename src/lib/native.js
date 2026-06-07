import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/lib/supabase';

/** Must match CFBundleURLSchemes in ios/App/App/Info.plist and Supabase redirect URLs. */
export const NATIVE_AUTH_SCHEME = 'com.waterwarrior.app';
export const NATIVE_AUTH_CALLBACK = `${NATIVE_AUTH_SCHEME}://auth/callback`;

export function isNativeApp() {
  return Capacitor.isNativePlatform();
}

/** Redirect target for Supabase email links (password reset, confirm email). */
export function getAuthRedirectUrl(suffix = '/auth?mode=reset') {
  if (isNativeApp()) {
    const query = suffix.includes('?') ? suffix.slice(suffix.indexOf('?')) : '';
    return query ? `${NATIVE_AUTH_CALLBACK}${query}` : NATIVE_AUTH_CALLBACK;
  }
  return `${window.location.origin}${suffix.startsWith('/') ? suffix : `/${suffix}`}`;
}

async function handleAuthCallbackUrl(url) {
  if (!supabase || !url.startsWith(NATIVE_AUTH_SCHEME)) return;

  const hash = url.includes('#') ? url.split('#')[1] : '';
  const hashParams = new URLSearchParams(hash);
  const accessToken = hashParams.get('access_token');
  const refreshToken = hashParams.get('refresh_token');

  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) throw error;
  }
}

/** Wire Supabase magic-link / reset-password callbacks into the native app. */
export function setupNativeAuthDeepLinks() {
  if (!isNativeApp() || !supabase) return undefined;

  let removeListener;
  App.addListener('appUrlOpen', ({ url }) => {
    handleAuthCallbackUrl(url).catch((err) => {
      console.error('Native auth callback failed:', err);
    });
  }).then((handle) => {
    removeListener = () => handle.remove();
  });

  return () => removeListener?.();
}
