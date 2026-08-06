/**
 * Reminder Service for Shift Notifications
 * Handles Monday - Friday shift reminders:
 * - 8:30 AM: Remind user to Clock In if not already clocked in.
 * - 5:00 PM: Remind user to Clock Out if currently clocked in.
 */

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

export const sendPushNotification = async (title: string, body: string, tag: string = 'shift-reminder'): Promise<boolean> => {
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
          vibrate: [200, 100, 200, 100, 200],
          data: { url: '/', time: Date.now() },
          requireInteraction: true,
        });
        return true;
      }
    }

    // Fallback to standard Notification API
    const notif = new Notification(title, {
      body,
      icon: '/pwa-icon.svg',
      tag,
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
    alert('Please enable notifications in your browser settings to receive shift reminders.');
    return false;
  }
  return sendPushNotification(
    '🔔 Shift Reminders Active!',
    'You will receive automatic alerts at 8:30 AM to Clock In and 5:00 PM to Clock Out (Mon–Fri).',
    'test-reminder'
  );
};

/**
 * Checks current time and sends shift reminders if needed.
 * Should be called periodically (e.g. every 30-60 seconds) and on visibility change.
 *
 * Rules:
 * - Days: Monday through Friday (getDay() 1 to 5)
 * - 8:30 AM (510 min from midnight): If !isClockedIn -> Remind to Clock In
 * - 5:00 PM (1020 min from midnight): If isClockedIn -> Remind to Clock Out
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
      const key = `geotime_reminder_clockin_${todayStr}`;
      if (localStorage.getItem(key) !== 'sent') {
        sendPushNotification(
          '⏰ Time to Clock In!',
          'Good morning! You haven\'t clocked in yet. Tap to open your timesheet and start your shift.',
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
      const key = `geotime_reminder_clockout_${todayStr}`;
      if (localStorage.getItem(key) !== 'sent') {
        sendPushNotification(
          '⏰ Time to Clock Out!',
          'It\'s 5:00 PM! You are still clocked in. Tap to review your shift and clock out.',
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
