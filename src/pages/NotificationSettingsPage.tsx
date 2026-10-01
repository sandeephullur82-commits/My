import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  ChevronLeft, 
  Bell, 
  BellRing, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Volume2, 
  Vibrate, 
  Smartphone, 
  Banknote, 
  Clock, 
  Calendar, 
  Send, 
  ShieldAlert, 
  RefreshCw, 
  Copy, 
  Check, 
  Sparkles,
  Info,
  Sliders,
  ExternalLink
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNotificationCenter } from '../context/NotificationContext';
import { useFeedback } from '../context/FeedbackContext';
import { notificationService } from '../services/notificationService';
import { Capacitor } from '@capacitor/core';

export function NotificationSettingsPage() {
  const navigate = useNavigate();
  const { preferences, updatePreferences, permissionStatus, requestPermission, fcmToken } = useNotificationCenter();
  const { toastSuccess, toastError } = useFeedback();

  const [isRequesting, setIsRequesting] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [localPermission, setLocalPermission] = useState<string>(permissionStatus);
  const isNative = Capacitor.isNativePlatform();

  // Keep local permission in sync
  useEffect(() => {
    notificationService.checkPermission().then((res) => {
      setLocalPermission(res);
    });
  }, [permissionStatus]);

  const handleRequestPermission = async () => {
    setIsRequesting(true);
    try {
      const granted = await requestPermission();
      const updatedPerm = await notificationService.checkPermission();
      setLocalPermission(updatedPerm);

      if (granted || updatedPerm === 'granted') {
        toastSuccess('Permissions Granted', 'Push notifications are now enabled for Pigmy Pro.');
      } else {
        toastError('Permission Required', 'Push permission was denied or not completed.');
      }
    } catch (e: any) {
      toastError('Permission Error', e?.message || 'Failed to request notification permission.');
    } finally {
      setIsRequesting(false);
    }
  };

  const handleSendTest = async () => {
    setIsSendingTest(true);
    try {
      const success = await notificationService.sendTestNotification();
      if (success) {
        toastSuccess('Test Sent', 'Check your top notification banner and audio feedback.');
      } else {
        toastError('Test Failed', 'Could not deliver test notification. Check your permissions.');
      }
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleCopyToken = () => {
    if (!fcmToken) return;
    navigator.clipboard.writeText(fcmToken);
    setCopiedToken(true);
    toastSuccess('Token Copied', 'FCM device token copied to clipboard.');
    setTimeout(() => setCopiedToken(false), 2500);
  };

  const isDenied = localPermission === 'denied';
  const isGranted = localPermission === 'granted';

  return (
    <div className="min-h-screen bg-bg pb-24 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="sticky top-0 z-30 bg-card/80 backdrop-blur-md border-b border-border/40 px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-xs font-semibold text-text-secondary hover:text-text-primary p-2 -ml-2 rounded-xl hover:bg-bg transition-colors"
        >
          <ChevronLeft size={18} />
          <span>Back</span>
        </button>
        <h1 className="text-sm font-bold text-text-primary tracking-tight">Notification Settings</h1>
        <div className="w-8" />
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Permission Status Banner */}
        <div className={`rounded-3xl p-5 border transition-all ${
          isGranted
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            : isDenied
            ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
        }`}>
          <div className="flex items-start gap-3.5">
            <div className={`mt-0.5 p-2 rounded-2xl ${
              isGranted ? 'bg-emerald-500/20 text-emerald-400' : isDenied ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'
            }`}>
              {isGranted ? <CheckCircle2 size={22} /> : isDenied ? <XCircle size={22} /> : <AlertTriangle size={22} />}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-text-primary">
                  {isGranted ? 'Push Notifications Active' : isDenied ? 'Notifications Blocked' : 'Permission Required'}
                </h3>
                <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                  isGranted 
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
                    : isDenied 
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' 
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                }`}>
                  {localPermission}
                </span>
              </div>

              <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                {isGranted
                  ? 'Your device is configured to receive real-time collection updates, payment receipts, and route digests.'
                  : isDenied
                  ? 'Notifications are disabled in your system or browser settings. You must unblock permissions in site settings to receive background alerts.'
                  : 'Enable push permissions to receive instant collection updates and daily summaries on your device.'}
              </p>

              {/* Action Buttons based on state */}
              <div className="mt-4 flex flex-wrap gap-2">
                {!isGranted && !isDenied && (
                  <button
                    onClick={handleRequestPermission}
                    disabled={isRequesting}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-accent text-white text-xs font-bold shadow-md hover:bg-accent/90 transition-all disabled:opacity-50"
                  >
                    <BellRing size={14} />
                    {isRequesting ? 'Requesting...' : 'Enable Push Notifications'}
                  </button>
                )}

                {isDenied && (
                  <div className="space-y-2 w-full pt-1">
                    <div className="bg-card/90 rounded-2xl p-3 border border-border/60 text-xs text-text-secondary space-y-1.5">
                      <p className="font-semibold text-text-primary flex items-center gap-1.5">
                        <ShieldAlert size={14} className="text-rose-400" />
                        How to unblock notifications:
                      </p>
                      {isNative ? (
                        <ol className="list-decimal list-inside space-y-1 text-[11px] text-text-secondary">
                          <li>Open Android Settings ➔ Apps ➔ Pigmy Pro</li>
                          <li>Tap <b>Permissions</b> ➔ <b>Notifications</b></li>
                          <li>Toggle <b>Allow Notifications</b> to On</li>
                        </ol>
                      ) : (
                        <ol className="list-decimal list-inside space-y-1 text-[11px] text-text-secondary">
                          <li>Click the <b>Padlock / Settings icon</b> in your browser address bar</li>
                          <li>Locate <b>Notifications</b> and switch from Block to <b>Allow</b></li>
                          <li>Reload this page</li>
                        </ol>
                      )}
                    </div>
                    <button
                      onClick={handleRequestPermission}
                      className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-card border border-border/80 text-text-primary text-xs font-semibold hover:bg-bg transition-colors"
                    >
                      <RefreshCw size={13} />
                      Re-check Permission Status
                    </button>
                  </div>
                )}

                {isGranted && (
                  <button
                    onClick={handleSendTest}
                    disabled={isSendingTest}
                    className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-card border border-border/80 text-text-primary text-xs font-semibold hover:bg-bg transition-colors shadow-sm"
                  >
                    <Send size={13} className={isSendingTest ? 'animate-pulse text-accent' : 'text-accent'} />
                    {isSendingTest ? 'Sending...' : 'Send Test Notification'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Master Switch */}
        <div className="bg-card rounded-3xl p-5 border border-border/50 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className={`p-2.5 rounded-2xl ${preferences.enabled ? 'bg-accent/15 text-accent' : 'bg-muted text-text-secondary'}`}>
              <Bell size={22} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-text-primary">Push Notifications</h2>
              <p className="text-xs text-text-secondary mt-0.5">Master toggle for alerts across all categories</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={preferences.enabled}
              onChange={(e) => updatePreferences({ enabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-12 h-6.5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent" />
          </label>
        </div>

        {/* Specific Notification Categories */}
        <div className="space-y-3">
          <h3 className="text-[10px] font-black text-text-secondary opacity-60 uppercase tracking-[0.2em] px-2">
            Notification Categories
          </h3>

          <div className={`bg-card rounded-3xl border border-border/50 shadow-sm divide-y divide-border/40 overflow-hidden transition-opacity ${!preferences.enabled ? 'opacity-40 pointer-events-none' : ''}`}>
            {/* Payment Receipts */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-start gap-3.5 pr-4">
                <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 mt-0.5">
                  <Banknote size={18} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-text-primary">Payment Receipts</h4>
                  <p className="text-[11px] text-text-secondary mt-0.5 leading-relaxed">
                    Instant alerts and receipts when cash or UPI payments are recorded.
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={preferences.notifyChannels?.inApp ?? true}
                  onChange={(e) => updatePreferences({
                    notifyChannels: { ...preferences.notifyChannels, inApp: e.target.checked }
                  })}
                  className="sr-only peer"
                />
                <div className="w-10 h-5.5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-emerald-500" />
              </label>
            </div>

            {/* Overdue & NP Alerts */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-start gap-3.5 pr-4">
                <div className="p-2 rounded-xl bg-rose-500/15 text-rose-400 mt-0.5">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-text-primary">Overdue & Missed (NP) Alerts</h4>
                  <p className="text-[11px] text-text-secondary mt-0.5 leading-relaxed">
                    Immediate notification when an installment is marked Not Paid or overdue.
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={preferences.enableOverdueAlerts}
                  onChange={(e) => updatePreferences({ enableOverdueAlerts: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-10 h-5.5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-rose-500" />
              </label>
            </div>

            {/* Daily Due Reminders */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-start gap-3.5 pr-4">
                <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 mt-0.5">
                  <Clock size={18} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-text-primary">Daily Due Reminders</h4>
                  <p className="text-[11px] text-text-secondary mt-0.5 leading-relaxed">
                    Morning digest of customers scheduled for collection today (08:30 AM).
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={preferences.enableDueTodayAlerts}
                  onChange={(e) => updatePreferences({ enableDueTodayAlerts: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-10 h-5.5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-amber-500" />
              </label>
            </div>

            {/* Upcoming Maturity Notices */}
            <div className="p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-3.5 pr-4">
                  <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-400 mt-0.5">
                    <Calendar size={18} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-text-primary">Upcoming Maturity Alerts</h4>
                    <p className="text-[11px] text-text-secondary mt-0.5 leading-relaxed">
                      Advance warning before customer loan duration concludes.
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={preferences.enableUpcomingAlerts}
                    onChange={(e) => updatePreferences({ enableUpcomingAlerts: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5.5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-indigo-500" />
                </label>
              </div>

              {/* Days Before Selector */}
              {preferences.enableUpcomingAlerts && (
                <div className="mt-1 pl-12 flex items-center gap-2">
                  <span className="text-[11px] text-text-secondary">Warn in advance:</span>
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 5, 7].map((days) => (
                      <button
                        key={days}
                        onClick={() => updatePreferences({ upcomingDaysBefore: days })}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                          preferences.upcomingDaysBefore === days
                            ? 'bg-indigo-500 text-white shadow-sm'
                            : 'bg-card border border-border/60 text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        {days} {days === 1 ? 'day' : 'days'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Audio & Haptic Hardware Toggles */}
        <div className="space-y-3">
          <h3 className="text-[10px] font-black text-text-secondary opacity-60 uppercase tracking-[0.2em] px-2">
            Sound & Hardware Feedback
          </h3>

          <div className="bg-card rounded-3xl border border-border/50 shadow-sm divide-y divide-border/40 overflow-hidden">
            {/* Sound Chimes */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="p-2 rounded-xl bg-purple-500/15 text-purple-400">
                  <Volume2 size={18} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-text-primary">Notification Chimes</h4>
                  <p className="text-[11px] text-text-secondary mt-0.5">Play audio tone when payments and alerts arrive</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={preferences.enableSound}
                  onChange={(e) => updatePreferences({ enableSound: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-10 h-5.5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-purple-500" />
              </label>
            </div>

            {/* Haptic Vibration */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="p-2 rounded-xl bg-cyan-500/15 text-cyan-400">
                  <Vibrate size={18} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-text-primary">Haptic Feedback</h4>
                  <p className="text-[11px] text-text-secondary mt-0.5">Vibrate device on payment entry and notifications</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={preferences.enableVibration}
                  onChange={(e) => updatePreferences({ enableVibration: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-10 h-5.5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-cyan-500" />
              </label>
            </div>
          </div>
        </div>

        {/* Device & Token Diagnostics */}
        <div className="bg-card/50 rounded-3xl p-4 border border-border/40 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-text-secondary flex items-center gap-1.5">
              <Smartphone size={14} className="text-accent" />
              Platform: {isNative ? 'Android Native (Capacitor)' : 'Web PWA / Browser'}
            </span>
            <span className="text-[10px] text-text-secondary opacity-60">FCM Engine v1</span>
          </div>

          {fcmToken && (
            <div className="flex items-center justify-between gap-2 p-2.5 rounded-2xl bg-bg border border-border/50 text-[11px]">
              <span className="truncate font-mono text-text-secondary flex-1">
                Token: {fcmToken.substring(0, 18)}...{fcmToken.substring(fcmToken.length - 8)}
              </span>
              <button
                onClick={handleCopyToken}
                className="p-1.5 rounded-lg bg-card hover:bg-border/40 text-text-primary transition-colors shrink-0"
                title="Copy FCM Token"
              >
                {copiedToken ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
