import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  Smartphone, 
  Banknote, 
  Clock, 
  Volume2, 
  VolumeX, 
  Vibrate, 
  Send, 
  Trash2, 
  ShieldCheck, 
  Sparkles,
  Info,
  Layers,
  ChevronRight,
  Sun,
  Moon
} from 'lucide-react';
import { notificationService, NotificationSettings, NotificationLog } from '../../services/notificationService';
import { toast } from 'sonner';
import { safeFormat } from '../../lib/utils';
import { Capacitor } from '@capacitor/core';

interface NotificationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationSettingsModal({ isOpen, onClose }: NotificationSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'settings' | 'history' | 'android'>('settings');
  const [settings, setSettings] = useState<NotificationSettings>(notificationService.getSettings());
  const [history, setHistory] = useState<NotificationLog[]>(notificationService.getHistory());
  const [permissionState, setPermissionState] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  const [isSendingTest, setIsSendingTest] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSettings(notificationService.getSettings());
      setHistory(notificationService.getHistory());
      notificationService.checkPermission().then(setPermissionState);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleToggle = (key: keyof NotificationSettings) => {
    const updated = { ...settings, [key]: !settings[key] };
    setSettings(updated);
    notificationService.updateSettings(updated);
  };

  const handleRequestPermission = async () => {
    const granted = await notificationService.requestPermission();
    if (granted) {
      setPermissionState('granted');
      toast.success('Notification permissions enabled!');
      // Send welcoming test notification
      await notificationService.sendTestNotification();
      setHistory(notificationService.getHistory());
    } else {
      setPermissionState('denied');
      toast.error('Permission denied. Please enable notifications in your Android/Browser settings.');
    }
  };

  const handleSendTest = async () => {
    setIsSendingTest(true);
    try {
      const delivered = await notificationService.sendTestNotification();
      setHistory(notificationService.getHistory());
      if (delivered) {
        toast.success('Test alert dispatched to Android Notification Center!');
      } else {
        toast.info('Test logged in Notification History (enable permissions for system drawer popup).');
      }
    } catch {
      toast.error('Could not send test notification.');
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleClearHistory = () => {
    notificationService.clearHistory();
    setHistory([]);
    toast.success('Notification history cleared.');
  };

  return createPortal(
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 overflow-hidden pointer-events-auto"
        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
      >
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/65 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="w-full max-w-lg bg-card border border-border/80 rounded-[32px] shadow-2xl overflow-hidden relative z-10 flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-5 sm:p-6 pb-4 border-b border-border/60 bg-gradient-to-b from-blue-500/10 via-card to-card shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/15 border border-blue-500/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 shadow-xs">
                  <Bell size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">
                      System Drawer
                    </span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                      permissionState === 'granted' 
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                    }`}>
                      {permissionState === 'granted' ? <CheckCircle2 size={10} /> : <AlertTriangle size={10} />}
                      <span>{permissionState === 'granted' ? 'Active' : 'Permission Required'}</span>
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-text-primary tracking-tight">
                    Android Notification Center
                  </h3>
                  <p className="text-[11px] font-medium text-text-secondary opacity-75">
                    {Capacitor.isNativePlatform() ? 'Native Android Shell (Capacitor)' : 'Web App & Android PWA Mode'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-muted/80 hover:bg-muted text-text-secondary hover:text-text-primary flex items-center justify-center active:scale-95 transition-all cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Permission Action Banner (if not granted) */}
            {permissionState !== 'granted' && (
              <div className="mt-4 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
                  <p className="text-xs font-semibold text-text-primary truncate">
                    Enable alerts to receive instant receipts & NP reminders.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleRequestPermission}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-black uppercase tracking-wider shrink-0 active:scale-95 transition-all shadow-xs cursor-pointer"
                >
                  Enable
                </button>
              </div>
            )}

            {/* Tabs */}
            <div className="flex items-center gap-1 mt-3.5 bg-muted/70 p-1 rounded-xl border border-border/50 text-xs font-black">
              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all uppercase tracking-wider text-[10px] ${
                  activeTab === 'settings'
                    ? 'bg-card text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <Layers size={12} />
                <span>Triggers & Sound</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all uppercase tracking-wider text-[10px] ${
                  activeTab === 'history'
                    ? 'bg-card text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <Clock size={12} />
                <span>Alert History ({history.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('android')}
                className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all uppercase tracking-wider text-[10px] ${
                  activeTab === 'android'
                    ? 'bg-card text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <Smartphone size={12} />
                <span>APK Guide</span>
              </button>
            </div>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {activeTab === 'settings' && (
              <div className="space-y-4">
                {/* Master Switch */}
                <div className="p-3.5 bg-muted/50 border border-border/80 rounded-2xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                      <Bell size={20} />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-text-primary uppercase tracking-tight">
                        Enable Notifications
                      </h4>
                      <p className="text-[11px] text-text-secondary">
                        Master toggle for all device alerts
                      </p>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.enableNotifications}
                      onChange={() => handleToggle('enableNotifications')}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-muted peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {/* Specific Triggers */}
                <div className="space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-text-secondary px-1">
                    Notification Event Channels
                  </span>

                  {/* 1. Payment Receipts */}
                  <div className="p-3 bg-card border border-border/70 rounded-2xl flex items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                        <Banknote size={18} />
                      </div>
                      <div>
                        <h5 className="text-xs font-bold text-text-primary">
                          Instant Payment Receipts
                        </h5>
                        <p className="text-[10px] text-text-secondary">
                          Alert on Cash or UPI installment recorded
                        </p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.notifyPayments}
                      onChange={() => handleToggle('notifyPayments')}
                      className="w-4 h-4 accent-emerald-600 cursor-pointer"
                    />
                  </div>

                  {/* 2. NP Alerts */}
                  <div className="p-3 bg-card border border-border/70 rounded-2xl flex items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                        <AlertTriangle size={18} />
                      </div>
                      <div>
                        <h5 className="text-xs font-bold text-text-primary">
                          Unpaid (NP) Installment Alerts
                        </h5>
                        <p className="text-[10px] text-text-secondary">
                          Alert when customer is marked Not Paid
                        </p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.notifyNP}
                      onChange={() => handleToggle('notifyNP')}
                      className="w-4 h-4 accent-amber-600 cursor-pointer"
                    />
                  </div>

                  {/* 3. Morning Route Target */}
                  <div className="p-3 bg-card border border-border/70 rounded-2xl flex items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
                        <Sun size={18} />
                      </div>
                      <div>
                        <h5 className="text-xs font-bold text-text-primary">
                          Morning Route Target (08:30 AM)
                        </h5>
                        <p className="text-[10px] text-text-secondary">
                          Daily customer count & collection goal
                        </p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.notifyMorningRoute}
                      onChange={() => handleToggle('notifyMorningRoute')}
                      className="w-4 h-4 accent-purple-600 cursor-pointer"
                    />
                  </div>

                  {/* 4. Evening Summary */}
                  <div className="p-3 bg-card border border-border/70 rounded-2xl flex items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                        <Moon size={18} />
                      </div>
                      <div>
                        <h5 className="text-xs font-bold text-text-primary">
                          Evening Daily Summary (07:00 PM)
                        </h5>
                        <p className="text-[10px] text-text-secondary">
                          Closing balance of Cash, UPI, and Missed NPs
                        </p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.notifyEveningSummary}
                      onChange={() => handleToggle('notifyEveningSummary')}
                      className="w-4 h-4 accent-blue-600 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Sound & Vibration */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleToggle('soundEnabled')}
                    className={`p-3 rounded-2xl border flex items-center justify-between transition-all ${
                      settings.soundEnabled 
                        ? 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400' 
                        : 'bg-muted border-border text-text-secondary'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {settings.soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                      <span className="text-xs font-bold">Sound</span>
                    </div>
                    <span className="text-[10px] uppercase font-black">
                      {settings.soundEnabled ? 'ON' : 'OFF'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggle('vibrationEnabled')}
                    className={`p-3 rounded-2xl border flex items-center justify-between transition-all ${
                      settings.vibrationEnabled 
                        ? 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400' 
                        : 'bg-muted border-border text-text-secondary'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Vibrate size={16} />
                      <span className="text-xs font-bold">Vibrate</span>
                    </div>
                    <span className="text-[10px] uppercase font-black">
                      {settings.vibrationEnabled ? 'ON' : 'OFF'}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold text-text-secondary">
                    Delivered Alerts ({history.length})
                  </span>
                  {history.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearHistory}
                      className="text-[10px] text-danger hover:underline font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 size={12} />
                      <span>Clear Log</span>
                    </button>
                  )}
                </div>

                {history.length === 0 ? (
                  <div className="py-12 text-center text-xs text-text-secondary">
                    No recent notification alerts in history.
                  </div>
                ) : (
                  history.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 bg-muted/40 border border-border/70 rounded-2xl space-y-1 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-text-primary truncate">
                          {log.title}
                        </span>
                        <span className="text-[10px] text-text-secondary shrink-0">
                          {safeFormat(log.timestamp, 'hh:mm a')}
                        </span>
                      </div>
                      <p className="text-[11px] text-text-secondary">
                        {log.body}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Android APK Setup Guide Tab */}
            {activeTab === 'android' && (
              <div className="space-y-3 text-xs">
                <div className="p-3.5 bg-blue-500/10 border border-blue-500/25 rounded-2xl">
                  <div className="flex items-center gap-2 text-blue-600 font-bold mb-1">
                    <Smartphone size={16} />
                    <span>How to Build & Run on Android Device</span>
                  </div>
                  <p className="text-[11px] text-text-secondary leading-relaxed">
                    This app includes a full native Capacitor Android wrapper with Notification Channels and background alarm permissions configured.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="p-3 bg-card border border-border rounded-xl">
                    <span className="text-[10px] font-black text-blue-600 block uppercase">Step 1: Sync Assets</span>
                    <p className="font-mono text-[11px] bg-muted p-1.5 rounded mt-1">npm run build && npx cap sync android</p>
                  </div>

                  <div className="p-3 bg-card border border-border rounded-xl">
                    <span className="text-[10px] font-black text-blue-600 block uppercase">Step 2: Open in Android Studio</span>
                    <p className="font-mono text-[11px] bg-muted p-1.5 rounded mt-1">npx cap open android</p>
                  </div>

                  <div className="p-3 bg-card border border-border rounded-xl">
                    <span className="text-[10px] font-black text-blue-600 block uppercase">Step 3: Generate APK</span>
                    <p className="text-[11px] text-text-secondary mt-0.5">Click Build &gt; Build Bundle(s) / APK(s) &gt; Build APK in Android Studio and install the APK on any Android phone.</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 sm:p-5 border-t border-border/60 bg-muted/30 flex items-center justify-between gap-3 shrink-0">
            <button
              type="button"
              disabled={isSendingTest}
              onClick={handleSendTest}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 active:scale-95 transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Send size={13} />
              <span>{isSendingTest ? 'Dispatching...' : 'Test Android Alert'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-card border border-border/80 hover:bg-muted text-text-primary font-bold text-xs uppercase tracking-wider active:scale-95 transition-all cursor-pointer"
            >
              Done
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
