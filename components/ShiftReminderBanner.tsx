import React, { useState, useEffect } from 'react';
import { Bell, BellOff, CheckCircle2, Sparkles, Clock, AlertCircle, ShieldAlert, Timer } from 'lucide-react';
import { 
  getNotificationPermissionStatus, 
  requestNotificationPermission, 
  sendTestNotification, 
  sendPushNotification,
  NotificationPermissionStatus 
} from '../services/reminderService';

export const ShiftReminderBanner: React.FC = () => {
  const [status, setStatus] = useState<NotificationPermissionStatus>('default');
  const [isTesting, setIsTesting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setStatus(getNotificationPermissionStatus());
  }, []);

  const handleEnable = async () => {
    setIsTesting(true);
    setMsg(null);
    const granted = await requestNotificationPermission();
    setStatus(getNotificationPermissionStatus());
    setIsTesting(false);
    if (granted) {
      setMsg('Push notifications enabled! Shift reminders (8:30 AM / 5:00 PM) & 8-hour safety alerts are now active.');
    } else {
      setMsg('Notification permission was blocked in browser settings.');
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    setMsg(null);
    const success = await sendTestNotification();
    setStatus(getNotificationPermissionStatus());
    setIsTesting(false);
    if (success) {
      setMsg('Test notification dispatched to your device!');
    } else {
      setMsg('Failed to send notification. Please check your browser permissions.');
    }
  };

  const handleTestWarning = async () => {
    setIsTesting(true);
    setMsg(null);
    const success = await sendPushNotification(
      '⚠️ 8-Hour Shift Warning (Test)',
      'You have been clocked in for 8 hours on [General]. Automatic clock-out will occur at 9 hours without user input.',
      'test-8h-warning'
    );
    setIsTesting(false);
    if (success) {
      setMsg('Test 8-Hour warning notification sent!');
    }
  };

  if (status === 'unsupported') {
    return null;
  }

  return (
    <div className="w-full max-w-md mx-auto px-4 my-3">
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950 text-white rounded-2xl p-4 shadow-md border border-blue-800/40 relative overflow-hidden">
        {/* Background glow accent */}
        <div className="absolute -right-6 -bottom-6 w-28 h-28 bg-blue-500/10 rounded-full blur-xl pointer-events-none" />

        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600/30 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
              <Bell className="w-4 h-4 text-blue-300 animate-pulse" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                TKO Shift Reminders & Safety
                <span className="text-[9px] font-extrabold uppercase bg-blue-500/30 text-blue-300 px-1.5 py-0.5 rounded border border-blue-400/30">
                  Mon – Fri
                </span>
              </h4>
              <p className="text-[11px] text-slate-300 font-medium mt-0.5 leading-snug">
                Push alert at <span className="text-amber-300 font-bold">8:30 AM</span> (Clock In) & <span className="text-emerald-300 font-bold">5:00 PM</span> (Clock Out)
              </p>
            </div>
          </div>
        </div>

        {/* 8h Warning & 9h Auto Clock-out Safety Badge */}
        <div className="mt-2.5 bg-slate-800/80 border border-slate-700/80 rounded-xl p-2.5 flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
            <div>
              <div className="font-bold text-slate-200">8h Warning / 9h Auto Clock-Out</div>
              <div className="text-[10px] text-slate-400 leading-tight">Automated overtime alert & hard shift close at 9h</div>
            </div>
          </div>
          {status === 'granted' && (
            <button
              type="button"
              onClick={handleTestWarning}
              disabled={isTesting}
              className="text-[10px] bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold px-2 py-1 rounded border border-amber-500/30 transition cursor-pointer shrink-0"
            >
              Test 8h Alert
            </button>
          )}
        </div>

        {msg && (
          <div className="mt-2.5 text-[11px] font-semibold text-emerald-300 bg-emerald-950/60 border border-emerald-800/50 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>{msg}</span>
          </div>
        )}

        <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-2">
          {status === 'granted' ? (
            <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Reminders & Protection Active</span>
            </div>
          ) : status === 'denied' ? (
            <div className="flex items-center gap-1.5 text-amber-400 text-[11px] font-bold">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Blocked in browser settings</span>
            </div>
          ) : (
            <div className="text-[11px] text-slate-400 font-medium">
              Enable notifications for daily shift alerts
            </div>
          )}

          <div className="flex items-center gap-2 shrink-0">
            {status !== 'granted' ? (
              <button
                type="button"
                onClick={handleEnable}
                disabled={isTesting}
                className="bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-sm transition-all cursor-pointer flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3" />
                Enable Alerts
              </button>
            ) : (
              <button
                type="button"
                onClick={handleTest}
                disabled={isTesting}
                className="bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 hover:text-white text-[11px] font-bold px-2.5 py-1 rounded-lg border border-slate-700 transition-all cursor-pointer"
              >
                Test Push
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShiftReminderBanner;
