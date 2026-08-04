import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/lib/supabase';
import {
  markPasswordRecoveryPending,
  navigateToPasswordReset,
} from '@/lib/passwordRecovery';
import { parseGroupInviteFromUrl } from '@/lib/groupInvite';

/** Must match CFBundleURLSchemes in ios/App/App/Info.plist and Supabase redirect URLs. */
export const NATIVE_AUTH_SCHEME = 'com.waterwarrior.app';
export const NATIVE_AUTH_CALLBACK = `${NATIVE_AUTH_SCHEME}://auth/callback`;

export function isNativeApp() {
  return Capacitor.isNativePlatform();
}

/** Redirect target for Supabase email links (password reset, confirm email). */
export function getAuthRedirectUrl(suffix = '/auth?mode=reset') {
  if (isNativeApp()) {
    // Keep mode=reset in the query so cold-start / parsing can detect recovery intent.
    const query = suffix.includes('?') ? suffix.slice(suffix.indexOf('?')) : '';
    return query ? `${NATIVE_AUTH_CALLBACK}${query}` : NATIVE_AUTH_CALLBACK;
  }
  return `${window.location.origin}${suffix.startsWith('/') ? suffix : `/${suffix}`}`;
}

function parseCallbackUrl(url) {
  // Custom schemes: com.waterwarrior.app://auth/callback?code=...#access_token=...
  const normalized = url.replace(`${NATIVE_AUTH_SCHEME}://`, 'https://callback/');
  let parsed;
  try {
    parsed = new URL(normalized);
  } catch {
    return { query: new URLSearchParams(), hash: new URLSearchParams() };
  }
  const hash = new URLSearchParams((parsed.hash || '').replace(/^#/, ''));
  return { query: parsed.searchParams, hash };
}

function navigateToGroupJoin(code) {
  if (!code || typeof window === 'undefined') return;
  const next = `/groups?join=${encodeURIComponent(code)}`;
  if (window.location.pathname.startsWith('/groups')) {
    window.history.replaceState({}, '', next);
    window.dispatchEvent(new PopStateEvent('popstate'));
  } else {
    window.location.assign(next);
  }
}

/**
 * Establish a Supabase session from an auth deep-link / redirect URL.
 * @param {string} url
 * @returns {Promise<{ recovery: boolean }>}
 */
export async function handleAuthCallbackUrl(url) {
  if (!supabase || !url?.startsWith(NATIVE_AUTH_SCHEME)) {
    return { recovery: false };
  }

  // Group invite deep links (not auth)
  const inviteCode = parseGroupInviteFromUrl(url);
  if (inviteCode && url.includes('groups')) {
    navigateToGroupJoin(inviteCode);
    return { recovery: false };
  }

  const { query, hash } = parseCallbackUrl(url);
  const type = hash.get('type') || query.get('type') || '';
  const mode = query.get('mode') || '';
  const isRecovery =
    type === 'recovery' || mode === 'reset' || mode === 'recovery';

  const accessToken = hash.get('access_token');
  const refreshToken = hash.get('refresh_token');
  const code = query.get('code');

  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) throw error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
  } else if (!isRecovery) {
    return { recovery: false };
  }

  if (isRecovery) {
    markPasswordRecoveryPending();
    navigateToPasswordReset();
    return { recovery: true };
  }

  return { recovery: false };
}

/** Wire Supabase magic-link / reset-password + group invite deep links. */
export function setupNativeAuthDeepLinks() {
  if (!isNativeApp()) return undefined;

  const onUrl = (url) => {
    if (!url) return;
    const inviteCode = parseGroupInviteFromUrl(url);
    if (inviteCode && url.includes('groups')) {
      navigateToGroupJoin(inviteCode);
      return;
    }
    if (!supabase) return;
    handleAuthCallbackUrl(url).catch((err) => {
      console.error('Native auth callback failed:', err);
    });
  };

  let removeListener;
  App.addListener('appUrlOpen', ({ url }) => onUrl(url)).then((handle) => {
    removeListener = () => handle.remove();
  });

  App.getLaunchUrl()
    .then((result) => {
      if (result?.url) onUrl(result.url);
    })
    .catch(() => {});

  return () => removeListener?.();
}
