import { useEffect } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import {
  cancelHydrationReminders,
  ensureHydrationRemindersScheduled,
} from '@/services/hydrationNotifications';
import { getNotificationsEnabled } from '@/lib/notificationPrefs';

export function useHydrationReminders(authReady = true) {
  useEffect(() => {
    if (!authReady) return;

    const sync = () => {
      if (getNotificationsEnabled()) {
        ensureHydrationRemindersScheduled();
      } else {
        cancelHydrationReminders().catch(() => {});
      }
    };

    sync();

    const onPref = () => sync();
    window.addEventListener('ww:notifications-changed', onPref);

    const listenerPromise = CapacitorApp.addListener('appStateChange', (state) => {
      if (state.isActive) sync();
    });

    return () => {
      window.removeEventListener('ww:notifications-changed', onPref);
      listenerPromise.then((listener) => listener.remove());
    };
  }, [authReady]);
}
