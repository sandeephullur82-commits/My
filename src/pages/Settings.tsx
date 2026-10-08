import React, { useRef, useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useRealtimeData } from '../hooks/useRealtimeData';
import { 
  Moon, Sun, User, 
  Palette, LayoutDashboard, ShieldCheck,
  ChevronRight, ToggleLeft, ToggleRight, Smartphone, Delete,
  Database, AlertCircle, Calendar, Hash, Scale, 
  RefreshCw, Files, FileSpreadsheet, FileJson, FileText,
  Bell, BellRing, Clock, Volume2, VolumeX, CheckCircle2,
  Send, Zap, Check, Copy, History, Trash2, ChevronDown, ChevronUp, CheckCircle, RotateCcw,
  MessageCircle
} from 'lucide-react';
import { useTheme } from '../components/ThemeProvider';
import { useUI } from '../context/UIContext';
import { useAuth } from '../context/AuthContext';
import { useNotificationCenter } from '../context/NotificationContext';
import { firestoreService } from '../services/firestoreService';
import { useFeedback } from '../context/FeedbackContext';
import { BottomSheet } from '../components/BottomSheet';
import { notificationService, NotificationLog, REMINDER_TIMING_OPTIONS } from '../services/notificationService';
import { whatsappReportService, WhatsAppReportSettings } from '../services/whatsappReportService';

export function Settings() {
  const { theme, toggleTheme } = useTheme();
  const { isCompact, toggleCompact } = useUI();
  const { user, logout } = useAuth();
  const { 
    permissionStatus, 
    requestPermission, 
    preferences, 
    updatePreferences, 
    upcomingAlerts, 
    dueTodayAlerts, 
    overdueAlerts,
    triggerScanAndNotify,
    sendTestNotification,
    fcmToken
  } = useNotificationCenter();
  const { toastSuccess, toastError, toastAction } = useFeedback();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { customers, transactions } = useRealtimeData();

  const [whatsappSettings, setWhatsappSettings] = useState<WhatsAppReportSettings>(() => whatsappReportService.getSettings());
  const [isSendingWhatsAppReport, setIsSendingWhatsAppReport] = useState(false);

  const handleUpdateWhatsApp = (patch: Partial<WhatsAppReportSettings>) => {
    const updated = whatsappReportService.saveSettings(patch);
    setWhatsappSettings(updated);
    toastSuccess('Settings Saved', 'WhatsApp report configuration updated.');
  };

  const handleSendWhatsAppNow = async () => {
    setIsSendingWhatsAppReport(true);
    try {
      const res = await whatsappReportService.sendReportToWhatsApp(
        customers,
        transactions,
        whatsappSettings.phoneNumber
      );
      if (res.success) {
        toastSuccess('WhatsApp Statement Ready', 'Master report generated and sent to WhatsApp.');
      }
    } catch {
      toastError('Error', 'Could not dispatch WhatsApp report.');
    } finally {
      setIsSendingWhatsAppReport(false);
    }
  };

  const [isScanning, setIsScanning] = useState(false);
  const [isTestingPush, setIsTestingPush] = useState(false);
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  useEffect(() => {
    setLogs(notificationService.getHistory());
  }, []);

  const handleTogglePushPermission = async () => {
    if (permissionStatus === 'denied') {
      toastError('Access Blocked', 'Notifications are blocked in your browser/device permissions.');
      return;
    }
    
    if (permissionStatus !== 'granted') {
      const granted = await requestPermission();
      if (granted) {
        toastSuccess('Push Enabled', 'You will now receive timely payment notifications.');
      }
    } else {
      toastAction({
        title: 'Push Notifications Active',
        message: 'Your device is configured to receive browser & system notifications.',
        label: 'Close',
      });
    }
  };

  const handleToggleReminderDay = (day: number) => {
    const current = preferences.upcomingReminderDays || [];
    const exists = current.includes(day);
    let updated: number[];
    if (exists) {
      // Don't allow removing all if upcoming reminders is enabled
      if (current.length <= 1) {
        toastError('Minimum 1 Required', 'Select at least one reminder timing rule.');
        return;
      }
      updated = current.filter(d => d !== day);
    } else {
      updated = [...current, day].sort((a, b) => b - a);
    }
    updatePreferences({ upcomingReminderDays: updated });
  };

  const handleRunTestPush = async () => {
    setIsTestingPush(true);
    try {
      const success = await sendTestNotification();
      if (success) {
        setLogs(notificationService.getHistory());
      }
    } finally {
      setIsTestingPush(false);
    }
  };

  const [isTestingRenewal, setIsTestingRenewal] = useState(false);

  const handleRunTestRenewal = async () => {
    setIsTestingRenewal(true);
    try {
      await notificationService.notifyRenewalDue({
        id: 'test-renewal-sample',
        name: 'Suresh Kumar (Sample)',
        phone: '9876543210',
        pending: 4500,
        endDate: Date.now() - 2 * 86400000,
        daysOverdue: 2
      });
      setLogs(notificationService.getHistory());
      toastSuccess('Test Renewal Alert Sent', 'Check your Android notification tray for the renewal prompt.');
    } catch {
      toastError('Error', 'Could not send test renewal alert.');
    } finally {
      setIsTestingRenewal(false);
    }
  };

  const handleScanCustomerPayments = async () => {
    setIsScanning(true);
    try {
      const res = await triggerScanAndNotify(true);
      toastSuccess('Scan Completed', `Evaluated accounts: ${res.upcoming} upcoming, ${res.dueToday} due today, ${res.overdue} overdue.`);
      setLogs(notificationService.getHistory());
    } finally {
      setIsScanning(false);
    }
  };

  const handleClearLogs = () => {
    notificationService.clearHistory();
    setLogs([]);
    toastSuccess('Logs Cleared', 'Notification history logs have been cleared.');
  };

  const handleCopyToken = () => {
    if (!fcmToken) return;
    navigator.clipboard.writeText(fcmToken);
    setCopiedToken(true);
    toastSuccess('Token Copied', 'FCM device registration token copied to clipboard.');
    setTimeout(() => setCopiedToken(false), 2500);
  };



  return (
    <div className="h-full overflow-y-auto px-6 py-8 flex flex-col gap-8 pb-32 animate-in fade-in duration-500">
      {/* Account Section */}
      <div className="flex flex-col items-center gap-4 py-4 px-2">
        <div className="relative group">
          <div className="w-24 h-24 bg-accent/10 border-4 border-card rounded-full flex items-center justify-center text-accent shadow-xl">
            <User size={48} strokeWidth={1.5} />
          </div>
          <div className="absolute -bottom-1 -right-1 bg-success text-white p-1.5 rounded-full border-2 border-card">
            <ShieldCheck size={14} />
          </div>
        </div>
        <div className="text-center">
          <h2 className="text-xl font-black text-text-primary tracking-tighter">Direct Firestore Access</h2>
          <p className="text-[11px] font-black text-text-secondary opacity-50 uppercase tracking-[0.2em] mt-0.5">Authentication Disabled • Live Ledger Sync</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Preference Section */}
        <div>
          <h3 className="text-[10px] font-black text-text-secondary opacity-40 uppercase tracking-[0.2em] px-4 mb-3">Preferences</h3>
          <div className="bg-card rounded-[24px] border border-border/50 shadow-sm overflow-hidden p-2 space-y-1">
            <button
              onClick={toggleTheme}
              className="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-bg transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
                  <Palette size={20} />
                </div>
                <div className="text-left">
                  <p className="font-bold text-sm text-text-primary tracking-tight">Appearance</p>
                  <p className="text-[10px] font-medium text-text-secondary opacity-60 uppercase tracking-widest leading-none mt-1">
                    {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                 {theme === 'dark' ? <Moon size={18} className="text-accent" /> : <Sun size={18} className="text-warning" />}
              </div>
            </button>

            <button
              onClick={toggleCompact}
              className="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-bg transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
                  <LayoutDashboard size={20} />
                </div>
                <div className="text-left">
                  <p className="font-bold text-sm text-text-primary tracking-tight">Compact Mode</p>
                  <p className="text-[10px] font-medium text-text-secondary opacity-60 uppercase tracking-widest leading-none mt-1">
                    {isCompact ? 'High Density' : 'Standard View'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                 {isCompact ? <ToggleRight size={24} className="text-accent" /> : <ToggleLeft size={24} className="text-text-secondary opacity-30" />}
              </div>
            </button>
          </div>
        </div>

        {/* Notification Center & Delivery Configuration */}
        <div>
          <div className="flex items-center justify-between px-4 mb-3">
            <h3 className="text-[10px] font-black text-text-secondary opacity-40 uppercase tracking-[0.2em]">
              Notification Center & Delivery Configuration
            </h3>
            <span className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
              preferences.enabled && permissionStatus === 'granted'
                ? 'bg-success/10 text-success border border-success/20'
                : preferences.enabled
                ? 'bg-warning/10 text-warning border border-warning/20'
                : 'bg-muted text-text-secondary'
            }`}>
              {preferences.enabled ? 'Engine Active' : 'Engine Paused'}
            </span>
          </div>

          <div className="bg-card rounded-[24px] border border-border/50 shadow-sm overflow-hidden p-4 sm:p-5 space-y-6">
            {/* 1. Master Engine Switch */}
            <div className="flex items-center justify-between pb-4 border-b border-border/40">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
                  <BellRing size={20} />
                </div>
                <div>
                  <p className="font-bold text-sm text-text-primary tracking-tight">Payment Alerts Engine</p>
                  <p className="text-[11px] font-medium text-text-secondary opacity-70 mt-0.5">
                    Automate notifications for upcoming maturities, due today payments, and overdue debts
                  </p>
                </div>
              </div>
              <button
                onClick={() => updatePreferences({ enabled: !preferences.enabled })}
                className="text-text-primary active:scale-95 transition-all shrink-0 ml-3"
                title={preferences.enabled ? 'Pause notification engine' : 'Activate notification engine'}
              >
                {preferences.enabled ? (
                  <ToggleRight size={32} className="text-accent" />
                ) : (
                  <ToggleLeft size={32} className="text-text-secondary opacity-30" />
                )}
              </button>
            </div>

            {/* 2. System Delivery & Push Credentials */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-text-secondary opacity-60">
                  1. Delivery Channels & Device Status
                </span>
                <span className="text-[10px] font-bold text-text-secondary">
                  {permissionStatus === 'granted' ? 'Connected' : 'Setup Required'}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-bg border border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    permissionStatus === 'granted' 
                      ? 'bg-success/10 text-success' 
                      : permissionStatus === 'denied'
                      ? 'bg-danger/10 text-danger'
                      : 'bg-accent/10 text-accent'
                  }`}>
                    <Smartphone size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-text-primary">System Push Status</span>
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                        permissionStatus === 'granted'
                          ? 'bg-success/10 text-success'
                          : permissionStatus === 'denied'
                          ? 'bg-danger/10 text-danger'
                          : 'bg-accent/10 text-accent'
                      }`}>
                        {permissionStatus === 'granted' ? 'Allowed' : permissionStatus === 'denied' ? 'Blocked' : 'Setup Required'}
                      </span>
                    </div>
                    <p className="text-[10px] text-text-secondary opacity-70 mt-0.5">
                      {permissionStatus === 'granted'
                        ? 'System & web push alerts enabled for this device'
                        : permissionStatus === 'denied'
                        ? 'Blocked in browser/device site permissions'
                        : 'Grant permission to receive alerts when app is closed'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  {permissionStatus !== 'granted' ? (
                    <button
                      onClick={handleTogglePushPermission}
                      className="h-8 px-3 rounded-xl bg-accent text-white text-[11px] font-bold uppercase tracking-wider hover:opacity-90 active:scale-95 transition-all shadow-xs"
                    >
                      Enable Push
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        onClick={handleRunTestPush}
                        disabled={isTestingPush}
                        className="h-8 px-2.5 rounded-xl bg-card border border-border/40 text-text-secondary hover:text-accent text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 active:scale-95 transition-all disabled:opacity-50"
                        title="Send general test alert"
                      >
                        <Send size={12} className={isTestingPush ? 'animate-spin' : ''} />
                        <span>Test Push</span>
                      </button>
                      <button
                        onClick={handleRunTestRenewal}
                        disabled={isTestingRenewal}
                        className="h-8 px-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 active:scale-95 transition-all disabled:opacity-50"
                        title="Send sample Android notification for renewal"
                      >
                        <RotateCcw size={12} className={isTestingRenewal ? 'animate-spin' : ''} />
                        <span>Test Renewal Alert</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* FCM Device Registration Token */}
              {fcmToken && (
                <div className="p-3 rounded-2xl bg-bg/60 border border-border/40 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Device Registration Token</p>
                    <p className="text-[11px] font-mono text-text-primary truncate opacity-80 mt-0.5">{fcmToken}</p>
                  </div>
                  <button
                    onClick={handleCopyToken}
                    className="h-7 px-2.5 rounded-lg bg-card border border-border/40 text-[10px] font-bold text-text-secondary hover:text-text-primary flex items-center gap-1 shrink-0 active:scale-95 transition-all"
                    title="Copy FCM Token"
                  >
                    {copiedToken ? <Check size={12} className="text-success" /> : <Copy size={12} />}
                    <span>{copiedToken ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* 3. Automated Schedule & Due Date Rules */}
            <div className="space-y-4 pt-4 border-t border-border/40">
              <span className="text-[10px] font-black uppercase tracking-widest text-text-secondary opacity-60">
                2. Automated Schedules & Due Dates
              </span>

              {/* Upcoming Due Date Reminders */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Clock size={16} className="text-accent" />
                      <h4 className="font-bold text-sm text-text-primary tracking-tight">Upcoming Due Date Reminders</h4>
                    </div>
                    <p className="text-[11px] text-text-secondary opacity-70 mt-0.5">
                      Notify when a loan end date is approaching with pending balance
                    </p>
                  </div>
                  <button
                    onClick={() => updatePreferences({ upcomingReminders: !preferences.upcomingReminders })}
                    className="active:scale-95 transition-all"
                  >
                    {preferences.upcomingReminders ? (
                      <ToggleRight size={28} className="text-accent" />
                    ) : (
                      <ToggleLeft size={28} className="text-text-secondary opacity-30" />
                    )}
                  </button>
                </div>

                {preferences.upcomingReminders && (
                  <div className="p-3.5 rounded-2xl bg-bg border border-border/40 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">
                        Reminder Timing Rules
                      </span>
                      <span className="text-[10px] text-accent font-medium">
                        {(preferences.upcomingReminderDays || []).length} active
                      </span>
                    </div>
                    <p className="text-[10px] text-text-secondary opacity-60">
                      Select the days before the customer maturity date when reminders should trigger:
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                      {REMINDER_TIMING_OPTIONS.map((opt) => {
                        const isActive = (preferences.upcomingReminderDays || []).includes(opt.days);
                        return (
                          <button
                            key={opt.days}
                            type="button"
                            onClick={() => handleToggleReminderDay(opt.days)}
                            className={`h-9 px-3 rounded-xl text-[11px] font-bold flex items-center justify-between transition-all active:scale-95 border ${
                              isActive
                                ? 'bg-accent text-white border-accent shadow-sm'
                                : 'bg-card text-text-secondary border-border/40 hover:border-border'
                            }`}
                          >
                            <span>{opt.label}</span>
                            {isActive && <Check size={14} className="shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Due Today Alerts */}
              <div className="flex items-center justify-between pt-2">
                <div>
                  <div className="flex items-center gap-2">
                    <Calendar size={16} className="text-warning" />
                    <h4 className="font-bold text-sm text-text-primary tracking-tight">Due Today Alerts</h4>
                  </div>
                  <p className="text-[11px] text-text-secondary opacity-70 mt-0.5">
                    Send high-priority reminder on the exact maturity date
                  </p>
                </div>
                <button
                  onClick={() => updatePreferences({ enableDueTodayAlerts: !preferences.enableDueTodayAlerts })}
                  className="active:scale-95 transition-all"
                >
                  {preferences.enableDueTodayAlerts !== false ? (
                    <ToggleRight size={28} className="text-warning" />
                  ) : (
                    <ToggleLeft size={28} className="text-text-secondary opacity-30" />
                  )}
                </button>
              </div>

              {/* Overdue Reminders Configuration */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <AlertCircle size={16} className="text-danger" />
                      <h4 className="font-bold text-sm text-text-primary tracking-tight">Overdue Payment Alerts</h4>
                    </div>
                    <p className="text-[11px] text-text-secondary opacity-70 mt-0.5">
                      Trigger alert when loan maturity end date has passed and pending balance remains
                    </p>
                  </div>
                  <button
                    onClick={() => updatePreferences({ overdueReminders: !preferences.overdueReminders })}
                    className="active:scale-95 transition-all"
                  >
                    {preferences.overdueReminders ? (
                      <ToggleRight size={28} className="text-danger" />
                    ) : (
                      <ToggleLeft size={28} className="text-text-secondary opacity-30" />
                    )}
                  </button>
                </div>

                {preferences.overdueReminders && (
                  <div className="p-3.5 rounded-2xl bg-bg border border-border/40 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">
                        Overdue Alert Frequency
                      </span>
                      <span className="text-[10px] text-danger font-medium uppercase">
                        {preferences.overdueFrequency?.replace(/_/g, ' ') || 'daily'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      {[
                        { id: 'daily', label: 'Daily' },
                        { id: 'every_2_days', label: 'Every 2 Days' },
                        { id: 'every_3_days', label: 'Every 3 Days' },
                      ].map((freq) => (
                        <button
                          key={freq.id}
                          type="button"
                          onClick={() => updatePreferences({ overdueFrequency: freq.id as any })}
                          className={`h-8 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border ${
                            preferences.overdueFrequency === freq.id
                              ? 'bg-danger text-white border-danger shadow-sm'
                              : 'bg-card text-text-secondary border-border/40 hover:border-border'
                          }`}
                        >
                          {freq.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Matured Loan Renewals Alert */}
              <div className="flex items-center justify-between pt-2">
                <div>
                  <div className="flex items-center gap-2">
                    <RotateCcw size={16} className="text-amber-500" />
                    <h4 className="font-bold text-sm text-text-primary tracking-tight">Matured Loan Renewals Alert</h4>
                  </div>
                  <p className="text-[11px] text-text-secondary opacity-70 mt-0.5">
                    Notify when loan tenure has ended with balance remaining to restructure or renew
                  </p>
                </div>
                <button
                  onClick={() => updatePreferences({ enableRenewalAlerts: !preferences.enableRenewalAlerts })}
                  className="active:scale-95 transition-all cursor-pointer"
                >
                  {preferences.enableRenewalAlerts !== false ? (
                    <ToggleRight size={28} className="text-amber-500" />
                  ) : (
                    <ToggleLeft size={28} className="text-text-secondary opacity-30" />
                  )}
                </button>
              </div>

              {/* Daily Automated WhatsApp PDF Report */}
              <div className="space-y-3 pt-3 border-t border-border/30">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <MessageCircle size={16} className="text-emerald-600 dark:text-emerald-400" />
                      <h4 className="font-bold text-sm text-text-primary tracking-tight">Daily WhatsApp PDF Statement</h4>
                      <span className="text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-md">
                        Free Channel
                      </span>
                    </div>
                    <p className="text-[11px] text-text-secondary opacity-70 mt-0.5">
                      Automated morning dispatch of complete Firestore ledger in structured PDF format
                    </p>
                  </div>
                  <button
                    onClick={() => handleUpdateWhatsApp({ enabled: !whatsappSettings.enabled })}
                    className="active:scale-95 transition-all cursor-pointer"
                  >
                    {whatsappSettings.enabled ? (
                      <ToggleRight size={28} className="text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <ToggleLeft size={28} className="text-text-secondary opacity-30" />
                    )}
                  </button>
                </div>

                {whatsappSettings.enabled && (
                  <div className="p-3.5 rounded-2xl bg-bg border border-border/40 space-y-3">
                    <div className="flex flex-col sm:flex-row gap-2.5">
                      <div className="flex-1 space-y-1">
                        <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                          Target WhatsApp Phone Number
                        </label>
                        <input
                          type="tel"
                          value={whatsappSettings.phoneNumber}
                          onChange={(e) => setWhatsappSettings(prev => ({ ...prev, phoneNumber: e.target.value }))}
                          onBlur={() => handleUpdateWhatsApp({ phoneNumber: whatsappSettings.phoneNumber })}
                          placeholder="e.g. 919876543210 (Country code + number)"
                          className="w-full h-9 px-3 rounded-xl bg-card border border-border/60 text-xs font-semibold focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div className="w-full sm:w-36 space-y-1">
                        <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                          Dispatch Time
                        </label>
                        <input
                          type="time"
                          value={whatsappSettings.dispatchTime}
                          onChange={(e) => handleUpdateWhatsApp({ dispatchTime: e.target.value })}
                          className="w-full h-9 px-3 rounded-xl bg-card border border-border/60 text-xs font-bold text-text-primary focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-1.5 text-[10px] text-text-secondary opacity-70">
                        <Clock size={12} className="text-emerald-500" />
                        <span>Daily trigger: <strong className="text-text-primary">{whatsappSettings.dispatchTime} AM</strong> • Free delivery</span>
                      </div>

                      <button
                        type="button"
                        onClick={handleSendWhatsAppNow}
                        disabled={isSendingWhatsAppReport}
                        className="h-8 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 active:scale-95 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                      >
                        <Send size={12} />
                        <span>{isSendingWhatsAppReport ? 'Dispatching...' : 'Send Today’s PDF Now'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 4. Thresholds & Feedback Rules */}
            <div className="space-y-4 pt-4 border-t border-border/40">
              <span className="text-[10px] font-black uppercase tracking-widest text-text-secondary opacity-60">
                3. Thresholds & Audio Feedback
              </span>

              {/* Minimum Pending Balance Filter */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-xs text-text-primary tracking-tight">Minimum Pending Amount Filter</h4>
                    <p className="text-[10px] text-text-secondary opacity-70">
                      Suppress alerts for balances below:
                    </p>
                  </div>
                  <span className="text-xs font-black text-accent bg-accent/10 px-2 py-0.5 rounded-md">
                    ₹{(preferences.minimumPendingAmount || 0).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2 pt-1">
                  {[0, 100, 500, 1000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => updatePreferences({ minimumPendingAmount: amt })}
                      className={`h-8 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border ${
                        preferences.minimumPendingAmount === amt
                          ? 'bg-accent text-white border-accent shadow-xs'
                          : 'bg-bg text-text-secondary border-border/40 hover:border-border'
                      }`}
                    >
                      {amt === 0 ? 'Any (₹0)' : `≥ ₹${amt}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sound & Haptics */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => updatePreferences({ enableSound: !preferences.enableSound })}
                  className={`p-3 rounded-2xl border flex items-center justify-between transition-all ${
                    preferences.enableSound
                      ? 'bg-bg border-accent/40 text-text-primary'
                      : 'bg-bg/50 border-border/30 text-text-secondary opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {preferences.enableSound ? <Volume2 size={16} className="text-accent" /> : <VolumeX size={16} />}
                    <span className="text-xs font-bold">Audio Chime</span>
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
                      ? 'bg-bg border-accent/40 text-text-primary'
                      : 'bg-bg/50 border-border/30 text-text-secondary opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Smartphone size={16} className={preferences.enableVibration ? 'text-accent' : ''} />
                    <span className="text-xs font-bold">Vibration</span>
                  </div>
                  <span className="text-[10px] font-black uppercase text-accent">
                    {preferences.enableVibration ? 'ON' : 'OFF'}
                  </span>
                </button>
              </div>
            </div>

            {/* 5. Live Diagnostics & Dispatch Logs */}
            <div className="space-y-4 pt-4 border-t border-border/40">
              <span className="text-[10px] font-black uppercase tracking-widest text-text-secondary opacity-60">
                4. Live Status & Dispatch Logs
              </span>

              {/* Live Status Window & Manual Scan */}
              <div className="p-4 rounded-2xl bg-accent/5 border border-accent/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Zap size={14} className="text-accent" />
                    <span className="text-xs font-bold text-text-primary">Current Alert Window Status</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[11px] font-medium text-text-secondary">
                    <span className="text-accent font-bold">{upcomingAlerts.length} upcoming</span>
                    <span>•</span>
                    <span className="text-warning font-bold">{dueTodayAlerts.length} due today</span>
                    <span>•</span>
                    <span className="text-danger font-bold">{overdueAlerts.length} overdue</span>
                  </div>
                </div>

                <button
                  onClick={handleScanCustomerPayments}
                  disabled={isScanning}
                  className="w-full sm:w-auto h-9 px-4 rounded-xl bg-accent text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 shadow-sm"
                >
                  <BellRing size={14} className={isScanning ? 'animate-spin' : ''} />
                  <span>Scan & Trigger Now</span>
                </button>
              </div>

              {/* Collapsible Notification History Logs */}
              <div className="rounded-2xl border border-border/40 bg-bg overflow-hidden">
                <button
                  onClick={() => setIsLogsOpen(!isLogsOpen)}
                  className="w-full p-3.5 flex items-center justify-between hover:bg-card/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <History size={16} className="text-text-secondary" />
                    <span className="text-xs font-bold text-text-primary">Recent Delivery Logs</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent/10 text-accent">
                      {logs.length}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {isLogsOpen ? <ChevronUp size={16} className="text-text-secondary" /> : <ChevronDown size={16} className="text-text-secondary" />}
                  </div>
                </button>

                {isLogsOpen && (
                  <div className="p-3 border-t border-border/40 space-y-2 bg-card">
                    {logs.length === 0 ? (
                      <div className="text-center py-6 text-text-secondary opacity-60 text-xs">
                        No delivery logs recorded yet. Run a test push or wait for scheduled triggers.
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between pb-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">
                            Activity History
                          </span>
                          <button
                            onClick={handleClearLogs}
                            className="text-[10px] font-bold text-danger hover:underline flex items-center gap-1"
                          >
                            <Trash2 size={11} />
                            <span>Clear Logs</span>
                          </button>
                        </div>
                        <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                          {logs.slice(0, 10).map((log) => (
                            <div key={log.id} className="p-2 rounded-xl bg-bg border border-border/30 text-xs flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="font-bold text-text-primary text-[11px] truncate">{log.title}</p>
                                <p className="text-[10px] text-text-secondary opacity-70 truncate">{log.body}</p>
                              </div>
                              <span className="text-[9px] font-mono text-text-secondary opacity-50 shrink-0">
                                {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>



        {/* Account Section */}
        <div>
          <h3 className="text-[10px] font-black text-text-secondary opacity-40 uppercase tracking-[0.2em] px-4 mb-3">Database Mode</h3>
          <div className="bg-card rounded-[24px] border border-border/50 shadow-sm overflow-hidden p-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-success/10 text-success flex items-center justify-center">
                <CheckCircle size={20} />
              </div>
              <div className="text-left flex-1 min-w-0">
                <p className="font-bold text-sm text-text-primary tracking-tight">Direct Access Active</p>
                <p className="text-[10px] font-medium text-text-secondary opacity-70 uppercase tracking-widest leading-none mt-1">Full dataset access without login credentials</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="text-center pb-8 opacity-20">
         <p className="text-[9px] font-black uppercase tracking-[0.5em] select-none cursor-default">Pigmy Pro Engine v1.2.0</p>
      </div>

    </div>
  );
}
