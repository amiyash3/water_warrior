const STORAGE_KEY = 'ww_password_recovery';

/** Mark that the user arrived via a password-recovery link. */
export function markPasswordRecoveryPending() {
  try {
    sessionStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // ignore
  }
  window.dispatchEvent(new CustomEvent('ww:password-recovery'));
}

/** @returns {boolean} */
export function isPasswordRecoveryPending() {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function clearPasswordRecoveryPending() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Send the SPA to the reset-password screen. */
export function navigateToPasswordReset() {
  markPasswordRecoveryPending();
  const target = '/auth?mode=reset';
  if (window.location.pathname + window.location.search !== target) {
    window.location.replace(target);
  }
}
