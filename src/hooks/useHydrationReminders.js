import { useEffect } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { ensureHydrationRemindersScheduled } from '@/services/hydrationNotifications';

export function useHydrationReminders(enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    ensureHydrationRemindersScheduled();

    const listenerPromise = CapacitorApp.addListener('appStateChange', (state) => {
      if (state.isActive) {
        ensureHydrationRemindersScheduled();
      }
    });

    return () => {
      listenerPromise.then((listener) => listener.remove());
    };
  }, [enabled]);
}
