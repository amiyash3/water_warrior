// src/services/hydrationNotifications.js
//
// Schedules 3 local reminders a day (morning / afternoon / night) at a
// random time within a configurable window for each. Capacitor's
// LocalNotifications API only supports scheduling a fixed `at` Date per
// notification (no native "random daily" trigger), so the strategy is:
//
//   1. Pre-compute real Dates for the next N days, picking a random
//      time inside each window per day.
//   2. Schedule all of them at once with stable, deterministic ids.
//   3. Call `ensureHydrationRemindersScheduled()` on app launch / resume
//      to "top up" the queue once it starts running low.
//
// Requires: npm install @capacitor/local-notifications
//           npx cap sync

import { LocalNotifications } from '@capacitor/local-notifications';

// ---- Config ---------------------------------------------------------

// Edit these hours to taste. endHour is exclusive-ish (we pick a random
// minute-of-day strictly between start and end).
export const REMINDER_WINDOWS = [
  { key: 'morning', label: 'Morning', startHour: 8, endHour: 11 },
  { key: 'afternoon', label: 'Afternoon', startHour: 12, endHour: 15 },
  { key: 'night', label: 'Evening', startHour: 18, endHour: 21 },
];

// Friendly, varied copy so it doesn't feel like the same alert 3x/day.
const MESSAGES = {
  morning: [
    'Good morning! Start the day with a glass of water 💧🫙',
    'Rise, shine, hydrate. Your body needs water after a night of sleep.',
    "Morning check-in: how's your water intake looking so far?",
    'Hydration is key to a productive day. Have you had water yet?',
    'Time to wake up and hydrate! Your body will thank you.',
    'Keep water with you today! A hydrated body is a happy body.',
  ],
  afternoon: [
    "Midday hydration check: when was your last glass of water?",
    'Quick reminder to refill your bottle before the afternoon slump hits.',
    'Stay sharp this afternoon — a glass of water can help with focus.',
    'Afternoon alert: your body is 60% water, keep it topped up!',
    'Busy day? Take a moment to drink some water and refresh your mind.',
  ],
  night: [
    'Evening reminder: log your water intake for today 🌙',
    "One more glass before bed? Let's close out the day hydrated.",
    'How did your hydration goals go today? Take a moment to check in.',
    'Thirsty? A glass of water before bed can help you sleep better.',
    'Grab a glass of water and reflect on your hydration journey today.',
    'Keep a glass of water near your bed tonight — it can help with overnight recovery.',
  ],
};

// Keep our notification ids in their own numeric range so we never
// collide with ids used elsewhere in the app. Capacitor ids must be
// 32-bit integers.
const ID_BASE = 900000;
const DAYS_TO_SCHEDULE = 14; // how far ahead we keep notifications queued
const TOP_UP_THRESHOLD_DAYS = 4; // refill once fewer than this many days remain

function pickMessage(windowKey) {
  const options = MESSAGES[windowKey];
  return options[Math.floor(Math.random() * options.length)];
}

// Deterministic id for a given (dayOffset, windowIndex) pair so we can
// always find/cancel our own notifications later without guessing.
function idFor(dayOffset, windowIndex) {
  return ID_BASE + dayOffset * 10 + windowIndex;
}

// Random Date within [startHour, endHour) on the given day offset from today.
function randomTimeInWindow(dayOffset, window) {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);

  const startMinutes = window.startHour * 60;
  const endMinutes = window.endHour * 60;
  const randomMinute =
    startMinutes + Math.floor(Math.random() * (endMinutes - startMinutes));

  date.setHours(Math.floor(randomMinute / 60), randomMinute % 60, 0, 0);
  return date;
}

// ---- Permissions ------------------------------------------------------

export async function requestHydrationNotificationPermission() {
  const current = await LocalNotifications.checkPermissions();
  if (current.display === 'granted') return true;

  const result = await LocalNotifications.requestPermissions();
  return result.display === 'granted';
}

// ---- Building & scheduling ---------------------------------------------

// Builds notification payloads for day offsets [startDayOffset, startDayOffset + numDays).
// Skips any slot whose random time has already passed today.
function buildNotifications(startDayOffset, numDays) {
  const now = new Date();
  const notifications = [];

  for (let d = startDayOffset; d < startDayOffset + numDays; d++) {
    REMINDER_WINDOWS.forEach((window, windowIndex) => {
      const at = randomTimeInWindow(d, window);
      if (at <= now) return; // don't schedule something in the past

      notifications.push({
        id: idFor(d, windowIndex),
        title: 'Water Warrior',
        body: pickMessage(window.key),
        schedule: { at, allowWhileIdle: true },
        extra: { type: 'hydration-reminder', window: window.key },
      });
    });
  }

  return notifications;
}

// Cancels every pending notification we own (identified by our id range),
// then schedules a fresh batch for the next `days` days starting today.
export async function scheduleHydrationReminders(days = DAYS_TO_SCHEDULE) {
  const granted = await requestHydrationNotificationPermission();
  if (!granted) {
    console.warn('Hydration reminders: notification permission not granted');
    return false;
  }

  await cancelHydrationReminders();

  const notifications = buildNotifications(0, days);
  if (notifications.length > 0) {
    await LocalNotifications.schedule({ notifications });
  }
  return true;
}

// Cancels only the notifications this module scheduled (by id range),
// leaving any other notifications in the app untouched.
export async function cancelHydrationReminders() {
  const pending = await LocalNotifications.getPending();
  const ours = pending.notifications.filter(
    (n) => n.id >= ID_BASE && n.id < ID_BASE + 1_000_000
  );
  if (ours.length > 0) {
    await LocalNotifications.cancel({
      notifications: ours.map((n) => ({ id: n.id })),
    });
  }
}

// Call this on app launch and on resume (see integration notes below).
// If the queue is running low, extends it — it does NOT touch existing
// scheduled notifications, so it's safe to call often.
export async function ensureHydrationRemindersScheduled() {
  const pending = await LocalNotifications.getPending();
  const ours = pending.notifications.filter(
    (n) => n.id >= ID_BASE && n.id < ID_BASE + 1_000_000
  );

  if (ours.length === 0) {
    // Nothing scheduled yet (first run, or permission was just granted)
    await scheduleHydrationReminders();
    return;
  }

  const daysRemaining = ours.length / REMINDER_WINDOWS.length;
  if (daysRemaining < TOP_UP_THRESHOLD_DAYS) {
    const maxId = Math.max(...ours.map((n) => n.id));
    const lastDayOffset = Math.floor((maxId - ID_BASE) / 10);
    const newNotifications = buildNotifications(
      lastDayOffset + 1,
      DAYS_TO_SCHEDULE
    );
    if (newNotifications.length > 0) {
      await LocalNotifications.schedule({ notifications: newNotifications });
    }
  }
}
