import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
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
  History,
  Trash2
} from 'lucide-react';
import { useNotificationCenter } from '../../context/NotificationContext';
import { useFeedback } from '../../context/FeedbackContext';
import { notificationService, NotificationLog } from '../../services/notificationService';
import { Capacitor } from '@capacitor/core';
import { format } from 'date-fns';

interface NotificationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationSettingsModal({ isOpen, onClose }: NotificationSettingsModalProps) {
  const { preferences, updatePreferences, permissionStatus, requestPermission, fcmToken } = useNotificationCenter();
  const { toastSuccess, toastError } = useFeedback();

  const [activeTab, setActiveTab] = useState<'settings' | 'history'>('settings');
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [isRequesting, setIsRequesting] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [localPermission, setLocalPermission] = useState<string>(permissionStatus);
  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    if (isOpen) {
      setLogs(notificationService.getHistory());
      notificationService.checkPermission().then(setLocalPermission);
    }
  }, [isOpen, permissionStatus]);

  if (!isOpen) return null;

  const handleRequestPermission = async () => {
    setIsRequesting(true);
    try {
      const granted = await requestPermission();
      const updated = await notificationService.checkPermission();
      setLocalPermission(updated);
      if (granted || updated === 'granted') {
        toastSuccess('Permissions Granted', 'Push notifications are now enabled.');
      } else {
        toastError('Permission Required', 'Push permission was denied or dismissed.');
      }
    } finally {
      setIsRequesting(false);
    }
  };

  const handleSendTest = async () => {
    setIsSendingTest(true);
    try {
      const success = await notificationService.sendTestNotification();
      if (success) {
        toastSuccess('Test Sent', 'Check your device notification banner & sound.');
        setLogs(notificationService.getHistory());
      } else {
        toastError('Test Failed', 'Could not deliver test notification.');
      }
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleClearHistory = () => {
    notificationService.clearHistory();
    setLogs([]);
    toastSuccess('History Cleared', 'Notification logs removed.');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-xl bg-card border border-border/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border/50 flex items-center justify-between bg-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-accent/15 text-accent flex items-center justify-center">
              <Bell size={20} />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-text-primary tracking-tight">Android Notification Center</h2>
              <p className="text-[11px] text-text-secondary opacity-70">
                {isNative ? 'Capacitor Native Android Push' : 'Web Push & Foreground Alerts'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-muted hover:bg-border/60 text-text-secondary hover:text-text-primary flex items-center justify-center transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center px-4 pt-3 pb-2 border-b border-border/40 gap-2 bg-muted/20">
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'settings'
                ? 'bg-accent text-white shadow-sm'
                : 'text-text-secondary hover:text-text-primary hover:bg-card'
            }`}
          >
            Settings & Channels
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'bg-accent text-white shadow-sm'
                : 'text-text-secondary hover:text-text-primary hover:bg-card'
            }`}
          >
            <History size={13} />
            <span>Recent Alerts ({logs.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {activeTab === 'settings' ? (
            <>
              {/* Permission Banner */}
              <div className={`p-4 rounded-2xl border transition-all ${
                isGranted
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : isDenied
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
              }`}>
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-xl mt-0.5 ${
                    isGranted ? 'bg-emerald-500/20' : isDenied ? 'bg-rose-500/20' : 'bg-amber-500/20'
                  }`}>
                    {isGranted ? <CheckCircle2 size={18} /> : isDenied ? <XCircle size={18} /> : <AlertTriangle size={18} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-text-primary">
                        {isGranted ? 'Android Push Granted' : isDenied ? 'Permission Blocked' : 'Permission Required'}
                      </h4>
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-card/60 border border-border/60">
                        {localPermission}
                      </span>
                    </div>
                    <p className="text-[11px] text-text-secondary mt-1">
                      {isGranted
                        ? 'Real-time heads-up channels & background alerts are fully enabled.'
                        : isDenied
                        ? 'Enable notification permission in your Android App Info or Browser site settings.'
                        : 'Allow notifications to receive immediate receipts and overdue reminders.'}
                    </p>

                    <div className="mt-3 flex items-center gap-2">
                      {!isGranted && (
                        <button
                          onClick={handleRequestPermission}
                          disabled={isRequesting}
                          className="px-3 py-1.5 rounded-xl bg-accent text-white text-xs font-bold shadow-sm hover:opacity-90 active:scale-95 transition-all"
                        >
                          {isRequesting ? 'Requesting...' : 'Request Permission'}
                        </button>
                      )}
                      {isGranted && (
                        <button
                          onClick={handleSendTest}
                          disabled={isSendingTest}
                          className="px-3 py-1.5 rounded-xl bg-card border border-border/80 text-text-primary text-xs font-semibold hover:bg-bg active:scale-95 transition-all flex items-center gap-1.5"
                        >
                          <Send size={12} className={isSendingTest ? 'animate-spin text-accent' : 'text-accent'} />
                          <span>{isSendingTest ? 'Sending...' : 'Test Android Alert'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Master Switch */}
              <div className="p-4 rounded-2xl bg-card border border-border/60 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-text-primary">Master Notifications</h4>
                  <p className="text-[11px] text-text-secondary mt-0.5">Toggle all push and local background alerts</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preferences.enabled}
                    onChange={(e) => updatePreferences({ enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5.5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-accent" />
                </label>
              </div>

              {/* Categories */}
              <div className="space-y-2.5">
                <span className="text-[10px] font-black text-text-secondary uppercase tracking-widest px-1">
                  Android Notification Channels
                </span>
                <div className="rounded-2xl bg-card border border-border/60 divide-y divide-border/40 overflow-hidden text-xs">
                  {/* Payment Collections */}
                  <div className="p-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400">
                        <Banknote size={16} />
                      </div>
                      <div>
                        <p className="font-bold text-text-primary">Payment Receipts</p>
                        <p className="text-[10px] text-text-secondary">Instant alerts for Cash & UPI collections</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-400 uppercase bg-emerald-500/10 px-2 py-0.5 rounded-md">
                      Active
                    </span>
                  </div>

                  {/* Overdue & NP */}
                  <div className="p-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-rose-500/15 text-rose-400">
                        <AlertTriangle size={16} />
                      </div>
                      <div>
                        <p className="font-bold text-text-primary">Unpaid (NP) Alerts</p>
                        <p className="text-[10px] text-text-secondary">Heads-up alert when installment is missed</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferences.enableOverdueAlerts}
                        onChange={(e) => updatePreferences({ enableOverdueAlerts: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-500" />
                    </label>
                  </div>

                  {/* Daily Route & Summary */}
                  <div className="p-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-purple-500/15 text-purple-400">
                        <Clock size={16} />
                      </div>
                      <div>
                        <p className="font-bold text-text-primary">Daily Morning Route</p>
                        <p className="text-[10px] text-text-secondary">08:30 AM collection route targets</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferences.enableDueTodayAlerts}
                        onChange={(e) => updatePreferences({ enableDueTodayAlerts: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-500" />
                    </label>
                  </div>
                </div>
              </div>

              {/* Hardware Sound & Vibrate */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => updatePreferences({ enableSound: !preferences.enableSound })}
                  className={`p-3 rounded-2xl border flex items-center justify-between transition-all ${
                    preferences.enableSound
                      ? 'bg-card border-accent/40 text-text-primary'
                      : 'bg-card/40 border-border/40 text-text-secondary opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Volume2 size={16} className={preferences.enableSound ? 'text-accent' : ''} />
                    <span className="text-xs font-bold">Sound</span>
                  </div>
                  <span className="text-[10px] font-black uppercase text-accent">
                    {preferences.enableSound ? 'ON' : 'OFF'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => updatePreferences({ enableVibration: !preferences.enableVibration })}
                  className={`p-3 rounded-2xl border flex items-center justify-between transition-all ${
                    preferences.enableVibration
                      ? 'bg-card border-accent/40 text-text-primary'
                      : 'bg-card/40 border-border/40 text-text-secondary opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Vibrate size={16} className={preferences.enableVibration ? 'text-accent' : ''} />
                    <span className="text-xs font-bold">Haptics</span>
                  </div>
                  <span className="text-[10px] font-black uppercase text-accent">
                    {preferences.enableVibration ? 'ON' : 'OFF'}
                  </span>
                </button>
              </div>

              {/* Device Token */}
              {fcmToken && (
                <div className="p-3 rounded-2xl bg-bg border border-border/50 flex items-center justify-between gap-2 text-[11px]">
                  <span className="truncate font-mono text-text-secondary">
                    Token: {fcmToken.slice(0, 16)}...{fcmToken.slice(-6)}
                  </span>
                  <button
                    onClick={handleCopyToken}
                    className="p-1.5 rounded-lg bg-card border border-border/60 hover:bg-muted text-text-primary transition-colors shrink-0"
                    title="Copy FCM Device Token"
                  >
                    {copiedToken ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                  </button>
                </div>
              )}
            </>
          ) : (
            /* History Tab */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-text-primary">Logged Dispatch Events</span>
                {logs.length > 0 && (
                  <button
                    onClick={handleClearHistory}
                    className="text-[10px] font-bold text-danger hover:underline flex items-center gap-1"
                  >
                    <Trash2 size={11} />
                    <span>Clear Logs</span>
                  </button>
                )}
              </div>

              {logs.length === 0 ? (
                <div className="p-8 text-center bg-muted/20 rounded-2xl border border-dashed border-border/60">
                  <p className="text-xs text-text-secondary">No notification events recorded yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {logs.map((log) => (
                    <div key={log.id} className="p-3 rounded-2xl bg-card border border-border/60 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-text-primary">{log.title}</span>
                        <span className="text-[10px] text-text-secondary opacity-60">
                          {format(new Date(log.timestamp), 'HH:mm:ss')}
                        </span>
                      </div>
                      <p className="text-[11px] text-text-secondary leading-relaxed">{log.body}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 border-t border-border/50 bg-card/60 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-accent text-white text-xs font-bold hover:opacity-90 active:scale-95 transition-all"
          >
            Done
          </button>
        </div>
      </motion.div>
    </div>
  );
}
