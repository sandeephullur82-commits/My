import React, { useRef, useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useRealtimeData } from '../hooks/useRealtimeData';
import { 
  Moon, Sun, LogOut, User, 
  ShieldCheck, Palette, LayoutDashboard, 
  ChevronRight, ToggleLeft, ToggleRight, Lock, Smartphone, Delete,
  Database, AlertCircle, Calendar, Hash, Scale, 
  RefreshCw, Files, FileSpreadsheet, FileJson, FileText,
  Bell, BellRing, Clock, Volume2, VolumeX, CheckCircle2,
  Send, Zap, Check
} from 'lucide-react';
import { useTheme } from '../components/ThemeProvider';
import { useUI } from '../context/UIContext';
import { useAuth } from '../context/AuthContext';
import { useNotificationCenter } from '../context/NotificationContext';
import { firestoreService } from '../services/firestoreService';
import { useFeedback } from '../context/FeedbackContext';
import { BottomSheet } from '../components/BottomSheet';
import { REMINDER_TIMING_OPTIONS } from '../services/notificationService';

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
    sendTestNotification
  } = useNotificationCenter();
  const { toastSuccess, toastError, toastAction } = useFeedback();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isScanning, setIsScanning] = useState(false);
  const [isTestingPush, setIsTestingPush] = useState(false);

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
      await sendTestNotification();
    } finally {
      setIsTestingPush(false);
    }
  };

  const handleScanCustomerPayments = async () => {
    setIsScanning(true);
    try {
      const res = await triggerScanAndNotify(true);
      toastSuccess('Scan Completed', `Evaluated accounts: ${res.upcoming} upcoming, ${res.dueToday} due today, ${res.overdue} overdue.`);
    } finally {
      setIsScanning(false);
    }
  };



  return (
    <div className="px-6 py-8 flex flex-col gap-8 pb-20 animate-in fade-in duration-500">
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
          <h2 className="text-xl font-black text-text-primary tracking-tighter">Administrator</h2>
          <p className="text-[11px] font-black text-text-secondary opacity-40 uppercase tracking-[0.2em] mt-0.5">{user?.email}</p>
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

        {/* Payment Reminders & Push Notifications Section */}
        <div>
          <div className="flex items-center justify-between px-4 mb-3">
            <h3 className="text-[10px] font-black text-text-secondary opacity-40 uppercase tracking-[0.2em]">
              Payment Reminders & Push Notifications
            </h3>
            <span className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
              preferences.enabled && permissionStatus === 'granted'
                ? 'bg-success/10 text-success border border-success/20'
                : preferences.enabled
                ? 'bg-warning/10 text-warning border border-warning/20'
                : 'bg-muted text-text-secondary'
            }`}>
              {preferences.enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>

          <div className="bg-card rounded-[24px] border border-border/50 shadow-sm overflow-hidden p-4 sm:p-5 space-y-6">
            {/* Master Toggle */}
            <div className="flex items-center justify-between pb-4 border-b border-border/40">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
                  <BellRing size={20} />
                </div>
                <div>
                  <p className="font-bold text-sm text-text-primary tracking-tight">Payment Alerts Engine</p>
                  <p className="text-[11px] font-medium text-text-secondary opacity-70 mt-0.5">
                    Trigger push notifications based on customer end dates & pending amounts
                  </p>
                </div>
              </div>
              <button
                onClick={() => updatePreferences({ enabled: !preferences.enabled })}
                className="text-text-primary active:scale-95 transition-all shrink-0 ml-3"
                title={preferences.enabled ? 'Disable all reminders' : 'Enable all reminders'}
              >
                {preferences.enabled ? (
                  <ToggleRight size={32} className="text-accent" />
                ) : (
                  <ToggleLeft size={32} className="text-text-secondary opacity-30" />
                )}
              </button>
            </div>

            {/* Device Push Permission & Test Bar */}
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
                      ? 'Browser & OS notifications enabled'
                      : permissionStatus === 'denied'
                      ? 'Blocked in browser permissions'
                      : 'Grant notification permission for background alerts'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                {permissionStatus !== 'granted' ? (
                  <button
                    onClick={handleTogglePushPermission}
                    className="h-8 px-3 rounded-xl bg-accent text-white text-[11px] font-bold uppercase tracking-wider hover:opacity-90 active:scale-95 transition-all"
                  >
                    Enable Push
                  </button>
                ) : (
                  <button
                    onClick={handleRunTestPush}
                    disabled={isTestingPush}
                    className="h-8 px-3 rounded-xl bg-card border border-border/40 text-text-secondary hover:text-accent text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 active:scale-95 transition-all disabled:opacity-50"
                  >
                    <Send size={12} className={isTestingPush ? 'animate-spin' : ''} />
                    <span>Send Test Push</span>
                  </button>
                )}
              </div>
            </div>

            {/* UPCOMING REMINDERS & TIMING CONFIGURATION */}
            <div className="space-y-3 pt-1">
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
                <div className="mt-2 p-3.5 rounded-2xl bg-bg border border-border/40 space-y-2.5">
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

            {/* OVERDUE REMINDERS CONFIGURATION */}
            <div className="space-y-3 pt-2 border-t border-border/40">
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

            {/* MINIMUM PENDING AMOUNT FILTER */}
            <div className="pt-2 border-t border-border/40 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-xs text-text-primary tracking-tight">Minimum Pending Amount</h4>
                  <p className="text-[10px] text-text-secondary opacity-70">
                    Only alert if pending balance is at or above:
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
                        ? 'bg-accent text-white border-accent'
                        : 'bg-bg text-text-secondary border-border/40 hover:border-border'
                    }`}
                  >
                    {amt === 0 ? 'Any (₹0)' : `≥ ₹${amt}`}
                  </button>
                ))}
              </div>
            </div>

            {/* CHANNELS, SOUND & HAPTICS */}
            <div className="pt-2 border-t border-border/40 space-y-3">
              <span className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">
                Sound & Feedback
              </span>
              <div className="grid grid-cols-2 gap-2">
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

            {/* LIVE STATUS BANNER & SCAN BUTTON */}
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
          </div>
        </div>



        {/* Security Section */}
        <div>
          <h3 className="text-[10px] font-black text-text-secondary opacity-40 uppercase tracking-[0.2em] px-4 mb-3">Security & Biometrics</h3>
          <div className="bg-card rounded-[24px] border border-border/50 shadow-sm overflow-hidden p-2 space-y-1">
            {/* Biometric & Mobile Lock */}
            <div className="p-4 rounded-2xl bg-bg border border-border/40 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                  {biometricStatus?.modality === 'FACE' ? (
                    <ScanFace size={22} />
                  ) : (
                    <Fingerprint size={22} />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-sm text-text-primary tracking-tight">Biometric & Mobile Lock</p>
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                      biometricsEnabled
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-slate-500/10 text-text-secondary'
                    }`}>
                      {biometricsEnabled ? 'Active' : 'Off'}
                    </span>
                  </div>
                  <p className="text-[11px] font-medium text-text-secondary opacity-70 mt-0.5">
                    {biometricStatus?.modalityLabel || 'Fingerprint, Face & Phone PIN/Pattern'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  const next = !biometricsEnabled;
                  setBiometricsEnabled(next);
                  if (next) {
                    toastSuccess('Biometric Lock Enabled', 'Secured with Fingerprint, Face, and Android Device Lock.');
                  } else {
                    toastAction({
                      title: 'Biometric Lock Disabled',
                      message: 'Hardware biometric verification is now turned off.',
                      label: 'OK'
                    });
                  }
                }}
                className="text-text-primary active:scale-95 transition-all shrink-0 ml-2"
                title={biometricsEnabled ? 'Disable Biometric Lock' : 'Enable Biometric Lock'}
              >
                {biometricsEnabled ? (
                  <ToggleRight size={32} className="text-emerald-500" />
                ) : (
                  <ToggleLeft size={32} className="text-text-secondary opacity-30" />
                )}
              </button>
            </div>

            {/* In-App 4-Digit PIN */}
            <button
              onClick={handleToggleLock}
              className="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-bg transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center">
                  <ShieldCheck size={20} />
                </div>
                <div className="text-left">
                  <p className="font-bold text-sm text-text-primary tracking-tight">4-Digit Security PIN</p>
                  <p className="text-[10px] font-medium text-text-secondary opacity-60 uppercase tracking-widest leading-none mt-1">
                    {hasPin ? 'Configured as secondary backup' : 'Optional secondary fallback'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                 {hasPin ? <ToggleRight size={24} className="text-success" /> : <ToggleLeft size={24} className="text-text-secondary opacity-30" />}
              </div>
            </button>

            {/* Lock Now Button */}
            {(biometricsEnabled || hasPin) && (
              <button
                onClick={handleManualLock}
                className="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-bg transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-zinc-500/10 text-zinc-500 flex items-center justify-center">
                    <Lock size={20} />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-sm text-text-primary tracking-tight">Lock App Now</p>
                    <p className="text-[10px] font-medium text-text-secondary opacity-60 uppercase tracking-widest leading-none mt-1">
                      Immediately trigger biometric lock shield
                    </p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-text-secondary opacity-30" />
              </button>
            )}

            <button
              onClick={logout}
              className="w-full flex items-center justify-between p-4 rounded-2xl bg-danger/5 hover:bg-danger/10 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-danger/10 text-danger flex items-center justify-center">
                  <LogOut size={20} />
                </div>
                <div className="text-left">
                  <p className="font-bold text-sm text-danger tracking-tight">Sign Out</p>
                  <p className="text-[10px] font-medium text-danger/60 uppercase tracking-widest leading-none mt-1">End active session</p>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>

      <div className="text-center pb-8 opacity-20">
         <p className="text-[9px] font-black uppercase tracking-[0.5em] select-none cursor-default">Pigmy Pro Engine v1.2.0</p>
      </div>

      <PinSetupSheet isOpen={showSetPin} onClose={() => setShowSetPin(false)} />
      <PinDisableSheet isOpen={showDisablePin} onClose={() => setShowDisablePin(false)} />

      {/* disabled content */}


    </div>
  );
}

function PinSetupSheet({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { setPin } = useSecurity();
  const { toastSuccess, toastError } = useFeedback();
  const [step, setStep] = useState<'enter' | 'confirm'>('enter');
  const [firstPin, setFirstPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStep('enter');
      setFirstPin('');
      setConfirmPin('');
      setError(false);
    }
  }, [isOpen]);

  const currentPin = step === 'enter' ? firstPin : confirmPin;

  const handleKeypad = (val: string) => {
    if (currentPin.length >= 4) return;
    const nextVal = currentPin + val;
    
    if (step === 'enter') {
      setFirstPin(nextVal);
      if (nextVal.length === 4) {
        setTimeout(() => {
          setStep('confirm');
        }, 200);
      }
    } else {
      setConfirmPin(nextVal);
      if (nextVal.length === 4) {
        if (firstPin === nextVal) {
          setPin(nextVal);
          toastSuccess('Security Active', 'App Lock has been enabled with your PIN.');
          onClose();
        } else {
          setError(true);
          toastError('Error', 'PIN codes do not match.');
          if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
          setTimeout(() => {
            setConfirmPin('');
            setError(false);
          }, 800);
        }
      }
    }
  };

  const handleDelete = () => {
    if (step === 'enter') {
      setFirstPin(prev => prev.slice(0, -1));
    } else {
      setConfirmPin(prev => prev.slice(0, -1));
    }
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="App Lock Setup"
      subtitle={step === 'enter' ? "Set a new 4-digit PIN" : "Verify your secure PIN"}
      maxWidth="max-w-[420px]"
    >
      <div className="flex flex-col items-center justify-center w-full max-w-[420px] mx-auto py-2">
        <div className="text-center mb-3">
          <p className="text-xs font-semibold text-text-secondary opacity-70">
            {step === 'enter' ? 'Choose a memorable access PIN' : 'Re-enter PIN to confirm security'}
          </p>
        </div>

        <motion.div 
          animate={error ? { x: [-10, 10, -10, 10, 0] } : {}}
          className="flex gap-4 my-2"
        >
          {[0, 1, 2, 3].map(i => (
            <div 
              key={i}
              className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-200 ${
                currentPin.length > i 
                  ? 'bg-accent border-accent scale-110 shadow-sm shadow-accent/40' 
                  : 'border-text-secondary/30 bg-transparent'
              }`} 
            />
          ))}
        </motion.div>

        <div 
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '16px',
            justifyItems: 'center',
            alignItems: 'center',
            width: 'fit-content',
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
          className="w-fit mx-auto mt-6 flex-shrink-0"
        >
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'empty', '0', 'del'].map((key, index) => {
            if (key === 'empty') {
              return (
                <div 
                  key={index} 
                  className="w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center pointer-events-none select-none" 
                />
              );
            }
            if (key === 'del') {
              return (
                <button
                  key={index}
                  type="button"
                  onClick={handleDelete}
                  style={{
                    visibility: (step === 'enter' ? firstPin.length : confirmPin.length) === 0 ? 'hidden' : 'visible',
                    pointerEvents: (step === 'enter' ? firstPin.length : confirmPin.length) === 0 ? 'none' : 'auto'
                  }}
                  className="w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center rounded-full text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors outline-none"
                >
                  <Delete size={20} />
                </button>
              );
            }
            return (
              <button
                key={index}
                type="button"
                onClick={() => handleKeypad(key)}
                className="w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-lg sm:text-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700/60 shadow-xs transition-colors outline-none"
              >
                {key}
              </button>
            );
          })}
        </div>

        {step === 'confirm' && (
          <button 
            type="button"
            onClick={() => {
              setStep('enter');
              setConfirmPin('');
            }}
            className="text-[10px] font-black uppercase tracking-widest text-accent mt-4 hover:opacity-85"
          >
            ← Back to set PIN
          </button>
        )}
      </div>
    </BottomSheet>
  );
}

function PinDisableSheet({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { verifyPin, setPin } = useSecurity();
  const { toastSuccess, toastError } = useFeedback();
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setInput('');
      setError(false);
    }
  }, [isOpen]);

  const handleKeypad = (val: string) => {
    if (input.length >= 4) return;
    const nextVal = input + val;
    setInput(nextVal);

    if (nextVal.length === 4) {
      const result = verifyPin(nextVal);
      if (result.success) {
        setPin(null);
        toastSuccess('Security Removed', 'PIN protection has been disabled.');
        onClose();
      } else {
        setError(true);
        toastError('Incorrect PIN', 'The security PIN you entered is invalid.');
        if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
        setTimeout(() => {
          setInput('');
          setError(false);
        }, 800);
      }
    }
  };

  const handleDelete = () => {
    setInput(prev => prev.slice(0, -1));
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Disable App Lock"
      subtitle="Enter your 4-digit PIN"
      maxWidth="max-w-[420px]"
    >
      <div className="flex flex-col items-center justify-center w-full max-w-[420px] mx-auto py-2">
        <div className="text-center mb-3">
          <p className="text-xs font-semibold text-text-secondary opacity-70">
            For security reasons, verify your current PIN.
          </p>
        </div>

        <motion.div 
          animate={error ? { x: [-10, 10, -10, 10, 0] } : {}}
          className="flex gap-4 my-2"
        >
          {[0, 1, 2, 3].map(i => (
            <div 
              key={i}
              className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-200 ${
                input.length > i 
                  ? 'bg-danger border-danger scale-110 shadow-sm shadow-danger/40' 
                  : 'border-text-secondary/30 bg-transparent'
              }`} 
            />
          ))}
        </motion.div>

        <div 
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '16px',
            justifyItems: 'center',
            alignItems: 'center',
            width: 'fit-content',
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
          className="w-fit mx-auto mt-6 flex-shrink-0"
        >
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'empty', '0', 'del'].map((key, index) => {
            if (key === 'empty') {
              return (
                <div 
                  key={index} 
                  className="w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center pointer-events-none select-none" 
                />
              );
            }
            if (key === 'del') {
              return (
                <button
                  key={index}
                  type="button"
                  onClick={handleDelete}
                  style={{
                    visibility: input.length === 0 ? 'hidden' : 'visible',
                    pointerEvents: input.length === 0 ? 'none' : 'auto'
                  }}
                  className="w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center rounded-full text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors outline-none"
                >
                  <Delete size={20} />
                </button>
              );
            }
            return (
              <button
                key={index}
                type="button"
                onClick={() => handleKeypad(key)}
                className="w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-lg sm:text-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700/60 shadow-xs transition-colors outline-none"
              >
                {key}
              </button>
            );
          })}
        </div>
      </div>
    </BottomSheet>
  );
}
