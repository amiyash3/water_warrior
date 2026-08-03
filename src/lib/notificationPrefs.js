const STORAGE_KEY = 'ww_notifications_enabled';

/** @returns {boolean} */
export function getNotificationsEnabled() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return true; // on by default
    return raw === 'true';
  } catch {
    return true;
  }
}

/** @param {boolean} enabled */
export function setNotificationsEnabled(enabled) {
  localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
  window.dispatchEvent(
    new CustomEvent('ww:notifications-changed', { detail: { enabled } })
  );
}
