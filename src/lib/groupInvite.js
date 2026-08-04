import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';

/** Keep in sync with CFBundleURLSchemes / `NATIVE_AUTH_SCHEME` in native.js */
const APP_SCHEME = 'com.waterwarrior.app';

function isNativeApp() {
  return Capacitor.isNativePlatform();
}

/** Deep link / web URL that opens the join flow with this invite code. */
export function buildGroupInviteLink(inviteCode) {
  const code = String(inviteCode || '').trim().toUpperCase();
  if (!code) return '';
  if (isNativeApp()) {
    return `${APP_SCHEME}://groups/join?code=${encodeURIComponent(code)}`;
  }
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/groups?join=${encodeURIComponent(code)}`;
}

export function buildGroupInviteMessage(groupName, inviteCode) {
  const link = buildGroupInviteLink(inviteCode);
  const name = groupName || 'my group';
  return `Join my Water Warrior group "${name}"!\n\nCode: ${inviteCode}\n${link}`;
}

async function copyInviteText(text) {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  // Legacy fallback
  const el = document.createElement('textarea');
  el.value = text;
  el.setAttribute('readonly', '');
  el.style.position = 'fixed';
  el.style.left = '-9999px';
  document.body.appendChild(el);
  el.select();
  document.execCommand('copy');
  document.body.removeChild(el);
}

/**
 * Opens the system share sheet (Messages, Mail, etc.) when available.
 * Falls back to copying the invite text.
 * @returns {Promise<'shared' | 'copied' | 'cancelled'>}
 */
export async function shareGroupInvite({ groupName, inviteCode }) {
  const code = String(inviteCode || '').trim().toUpperCase();
  if (!code) throw new Error('Missing invite code');

  const text = buildGroupInviteMessage(groupName, code);
  const title = 'Join my Water Warrior group';

  // Capacitor Share works reliably on iOS; Web Share often rejects custom schemes.
  if (isNativeApp()) {
    try {
      const can = await Share.canShare();
      if (can?.value !== false) {
        await Share.share({
          title,
          text,
          dialogTitle: 'Invite friends',
        });
        return 'shared';
      }
    } catch (err) {
      // User dismissed sheet — Capacitor may throw or resolve; treat cancel quietly
      const msg = String(err?.message || err || '');
      if (/cancel|dismiss|abort/i.test(msg)) return 'cancelled';
      // Fall through to clipboard
    }
  } else if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      // Put link in text only — passing non-https `url` often fails on iOS Safari.
      await navigator.share({ title, text });
      return 'shared';
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled';
      // Fall through to clipboard
    }
  }

  try {
    await copyInviteText(text);
    return 'copied';
  } catch {
    throw new Error('Could not share or copy the invite. Long-press the code to copy it.');
  }
}

/** Extract invite code from a native or web groups join URL. */
export function parseGroupInviteFromUrl(url) {
  if (!url) return null;
  try {
    if (url.startsWith(APP_SCHEME)) {
      const normalized = url.replace(`${APP_SCHEME}://`, 'https://app/');
      const parsed = new URL(normalized);
      if (!parsed.pathname.includes('groups')) return null;
      return (parsed.searchParams.get('code') || parsed.searchParams.get('join') || '')
        .trim()
        .toUpperCase() || null;
    }
    const parsed = new URL(url, typeof window !== 'undefined' ? window.location.origin : undefined);
    if (!parsed.pathname.includes('groups')) return null;
    return (parsed.searchParams.get('join') || parsed.searchParams.get('code') || '')
      .trim()
      .toUpperCase() || null;
  } catch {
    return null;
  }
}
