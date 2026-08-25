/**
 * KS Enterprise Group - Building Dreams - Shift & Safety Notification Service
 * Handles:
 * - 8:30 AM: Remind user to Clock In if not clocked in (Monday - Friday).
 * - 5:00 PM: Remind user to Clock Out if currently clocked in (Monday - Friday).
 * - 8-Hour Warning: High priority push notification warning at 8 hours of active shift.
 * - 9-Hour Auto Clock-Out: Automatic system clock-out at 9 hours without user input.
 */

import { TimeEntry } from '../types';

export type NotificationPermissionStatus = 'granted' | 'denied' | 'default' | 'unsupported';

export const getNotificationPermissionStatus = (): NotificationPermissionStatus => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission as NotificationPermissionStatus;
};

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'REGISTER_REMINDERS',
          timestamp: Date.now()
        });
      }
      return true;
    }
  } catch (err) {
    console.warn('Notification permission request error:', err);
  }
  return false;
};

export const sendPushNotification = async (
  title: string,
  body: string,
  tag: string = 'shift-reminder',
  requireInteraction: boolean = true
): Promise<boolean> => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  if (Notification.permission !== 'granted') {
    return false;
  }

  try {
    // Prefer ServiceWorker registration for rich native mobile PWA background push notifications
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) {
        await reg.showNotification(title, {
          body,
          icon: '/pwa-icon.svg',
          badge: '/pwa-icon.svg',
          tag,
          vibrate: [300, 150, 300, 150, 300],
          data: { url: '/', time: Date.now() },
          requireInteraction: requireInteraction,
        });
        return true;
      }
    }

    // Fallback to standard Notification API
    const notif = new Notification(title, {
      body,
      icon: '/pwa-icon.svg',
      tag,
      requireInteraction: requireInteraction,
    });
    notif.onclick = () => {
      window.focus();
      notif.close();
    };
    return true;
  } catch (err) {
    console.warn('Error displaying push notification:', err);
    return false;
  }
};

export const sendTestNotification = async (): Promise<boolean> => {
  const granted = await requestNotificationPermission();
  if (!granted && Notification.permission !== 'granted') {
    alert('Please enable notifications in your browser settings to receive shift reminders and safety warnings.');
    return false;
  }
  return sendPushNotification(
    '🔔 TKO Field Operations Reminders Active',
    'Automatic push alerts are configured for 8:30 AM Clock-In, 5:00 PM Clock-Out (Mon–Fri), and 8-Hour Overtime Safety Warning.',
    'test-reminder'
  );
};

/**
 * Checks scheduled time and sends daily shift reminders if needed (Mon - Fri).
 */
export const checkAndSendShiftReminders = (isClockedIn: boolean): void => {
  if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 5 = Friday, 6 = Saturday

  // Monday through Friday check ONLY (1 = Mon, 5 = Fri)
  if (dayOfWeek < 1 || dayOfWeek > 5) {
    return;
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const date = now.getDate().toString().padStart(2, '0');
  const todayStr = `${year}-${month}-${date}`;

  // 1) 8:30 AM Clock-In Reminder (8:30 AM = 510 minutes)
  // Window: 8:30 AM up to 1:00 PM (780 minutes)
  const CLOCKIN_MINUTES = 8 * 60 + 30; // 510
  const CLOCKIN_WINDOW_END = 13 * 60;  // 780

  if (currentMinutes >= CLOCKIN_MINUTES && currentMinutes < CLOCKIN_WINDOW_END) {
    if (!isClockedIn) {
      const key = `tko_reminder_clockin_${todayStr}`;
      if (localStorage.getItem(key) !== 'sent') {
        sendPushNotification(
          '⏰ Reminder: Time to Clock In',
          'Good morning! You haven\'t clocked in for today\'s shift. Tap to start your shift timer.',
          `clock-in-${todayStr}`
        ).then(success => {
          if (success) {
            localStorage.setItem(key, 'sent');
          }
        });
      }
    }
  }

  // 2) 5:00 PM Clock-Out Reminder (5:00 PM = 17:00 = 1020 minutes)
  // Window: 5:00 PM (1020 minutes) up to 11:59 PM (1439 minutes)
  const CLOCKOUT_MINUTES = 17 * 60; // 1020

  if (currentMinutes >= CLOCKOUT_MINUTES) {
    if (isClockedIn) {
      const key = `tko_reminder_clockout_${todayStr}`;
      if (localStorage.getItem(key) !== 'sent') {
        sendPushNotification(
          '⏰ End of Day: Time to Clock Out',
          'It\'s 5:00 PM! You are currently still clocked in. Tap to review your entries and clock out.',
          `clock-out-${todayStr}`
        ).then(success => {
          if (success) {
            localStorage.setItem(key, 'sent');
          }
        });
      }
    }
  }
};

/**
 * 8-Hour Overtime / Shift Warning & 9-Hour Automatic Clock-Out System
 * - Triggers a high-priority push notification at 8 hours of active shift.
 * - Automatically closes shift and triggers clock-out at 9 hours without user input.
 */
export const check8HourWarningAndAutoClockOut = (
  activeEntry: TimeEntry | null | undefined,
  onAutoClockOut: (entry: TimeEntry) => void
): void => {
  if (!activeEntry || !activeEntry.clockIn || activeEntry.clockOut || activeEntry.isExpense) {
    return;
  }

  const inTime = new Date(activeEntry.clockIn).getTime();
  if (isNaN(inTime)) return;

  const now = Date.now();
  const elapsedMs = now - inTime;
  const elapsedHours = elapsedMs / (1000 * 60 * 60);

  const entryIdKey = activeEntry.id || activeEntry.clockIn;

  // 1. Check for 8-Hour Warning (Between 8.0h and 9.0h)
  if (elapsedHours >= 8.0 && elapsedHours < 9.0) {
    const warningKey = `tko_warning_8h_${entryIdKey}`;
    if (localStorage.getItem(warningKey) !== 'sent') {
      sendPushNotification(
        '⚠️ 8-Hour Shift Warning',
        `You have been clocked in for 8 hours on [${activeEntry.projectName || 'General'}]. Automatic clock-out will occur at 9 hours without user input.`,
        `warning-8h-${entryIdKey}`,
        true
      ).then(success => {
        if (success) {
          localStorage.setItem(warningKey, 'sent');
        }
      });
    }
  }

  // 2. Check for 9-Hour Automatic Clock-Out (>= 9.0 hours)
  if (elapsedHours >= 9.0) {
    const autoOutKey = `tko_autoclockout_9h_${entryIdKey}`;
    if (localStorage.getItem(autoOutKey) !== 'done') {
      localStorage.setItem(autoOutKey, 'done');

      // Send immediate notification
      sendPushNotification(
        '🛑 9-Hour Auto Clock-Out Triggered',
        `Your shift has exceeded the 9-hour limit on [${activeEntry.projectName || 'General'}] and has been automatically clocked out.`,
        `autoclockout-9h-${entryIdKey}`,
        true
      );

      // Trigger automatic clock-out logic
      onAutoClockOut(activeEntry);
    }
  }
};
