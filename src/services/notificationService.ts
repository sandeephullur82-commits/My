import { Capacitor } from '@capacitor/core';
import { LocalNotifications, Channel, ActionPerformed as LocalActionPerformed } from '@capacitor/local-notifications';
import { PushNotifications, Token, ActionPerformed, PushNotificationSchema } from '@capacitor/push-notifications';
import { messaging, db, auth } from '../lib/firebase';
import { getToken, onMessage, MessagePayload } from 'firebase/messaging';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Customer } from './firestoreService';
import { differenceInCalendarDays, startOfDay, startOfToday, format, parseISO, isValid } from 'date-fns';
import { toSafeDate, safeFormat } from '../lib/utils';

export interface NotificationSettings {
  enableNotifications: boolean;
  notifyPayments: boolean;
  notifyNP: boolean;
  notifyMorningRoute: boolean;
  notifyEveningSummary: boolean;
  notifyRenewals: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
}

export interface NotificationLog {
  id: string;
  title: string;
  body: string;
  timestamp: number;
  type: 'payment' | 'np' | 'morning_route' | 'evening_summary' | 'test' | 'push' | 'sync' | 'renewal' | 'renewal_summary' | 'renewal_completed' | 'renewal_rejected' | 'new_loan';
  data?: Record<string, any>;
}

export interface NotificationPreferences {
  enabled: boolean;
  upcomingReminders: boolean;
  upcomingReminderDays: number[]; // e.g. [7, 5, 3, 2, 1, 0] (0 = on due date)
  overdueReminders: boolean;
  overdueFrequency: 'daily' | 'every_2_days' | 'every_3_days';
  minimumPendingAmount: number;
  dailyReminderTime: string;
  enableSound: boolean;
  enableVibration: boolean;
  notifyChannels: {
    webPush: boolean;
    inApp: boolean;
  };
  upcomingDaysBefore: number;
  enableUpcomingAlerts: boolean;
  enableDueTodayAlerts: boolean;
  enableOverdueAlerts: boolean;
  enableRenewalAlerts: boolean;
}

export const REMINDER_TIMING_OPTIONS = [
  { days: 7, label: '7 Days Before' },
  { days: 5, label: '5 Days Before' },
  { days: 3, label: '3 Days Before' },
  { days: 2, label: '2 Days Before' },
  { days: 1, label: '1 Day Before' },
  { days: 0, label: 'On Due Date' },
];

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  enabled: true,
  upcomingReminders: true,
  upcomingReminderDays: [3, 1, 0],
  overdueReminders: true,
  overdueFrequency: 'daily',
  minimumPendingAmount: 0,
  dailyReminderTime: '09:00',
  enableSound: true,
  enableVibration: true,
  notifyChannels: {
    webPush: true,
    inApp: true,
  },
  upcomingDaysBefore: 3,
  enableUpcomingAlerts: true,
  enableDueTodayAlerts: true,
  enableOverdueAlerts: true,
  enableRenewalAlerts: true,
};

export interface PaymentAlert {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  amountDue?: number;
  loanAmount?: number;
  paidAmount?: number;
  pendingAmount: number;
  dailyInstallment?: number;
  alertType: 'upcoming' | 'due_today' | 'overdue' | 'renewal';
  type?: 'upcoming' | 'due_today' | 'overdue' | 'renewal';
  title: string;
  message: string;
  collectionUrl: string;
  whatsappMessage?: string;
  urgency: 'high' | 'medium' | 'low';
  daysOverdue?: number;
  daysRemaining?: number;
  dueDate?: string;
  endDate?: any;
  startDate?: any;
  diffDays: number;
}

export type ForegroundNotificationCallback = (payload: {
  title: string;
  body: string;
  data?: Record<string, any>;
  deepLinkUrl?: string;
  type?: NotificationLog['type'];
}) => void;

const SETTINGS_KEY = 'pigmy_notification_settings_v1';
const HISTORY_KEY = 'pigmy_notification_history_v1';
const PREFS_CACHE_KEY = 'pigmy_notif_prefs_v1';
const DISPATCHED_ALERTS_KEY = 'pigmy_dispatched_alerts_';
const FCM_TOKEN_CACHE_KEY = 'pigmy_fcm_token_v1';

const DEFAULT_SETTINGS: NotificationSettings = {
  enableNotifications: true,
  notifyPayments: true,
  notifyNP: true,
  notifyMorningRoute: true,
  notifyEveningSummary: true,
  notifyRenewals: true,
  soundEnabled: true,
  vibrationEnabled: true,
};

export function getCachedPreferences(): NotificationPreferences {
  try {
    const raw = localStorage.getItem(PREFS_CACHE_KEY);
    if (raw) return { ...DEFAULT_NOTIFICATION_PREFERENCES, ...JSON.parse(raw) };
  } catch (e) {
    console.warn('Could not read cached preferences:', e);
  }
  return DEFAULT_NOTIFICATION_PREFERENCES;
}

export function setCachedPreferences(prefs: NotificationPreferences): void {
  try {
    localStorage.setItem(PREFS_CACHE_KEY, JSON.stringify(prefs));
  } catch (e) {
    console.warn('Could not write cached preferences:', e);
  }
}

export function isAlertAlreadyDispatchedToday(alertId: string): boolean {
  try {
    const today = new Date().toISOString().split('T')[0];
    const key = `${DISPATCHED_ALERTS_KEY}${today}`;
    const raw = localStorage.getItem(key);
    if (!raw) return false;
    const list: string[] = JSON.parse(raw);
    return list.includes(alertId);
  } catch {
    return false;
  }
}

export function markAlertDispatched(alertId: string): void {
  try {
    const today = new Date().toISOString().split('T')[0];
    const key = `${DISPATCHED_ALERTS_KEY}${today}`;
    const raw = localStorage.getItem(key);
    const list: string[] = raw ? JSON.parse(raw) : [];
    if (!list.includes(alertId)) {
      list.push(alertId);
      localStorage.setItem(key, JSON.stringify(list));
    }
  } catch (e) {
    console.warn('Could not mark alert dispatched:', e);
  }
}

export function playNotificationChime(type: 'upcoming' | 'due_today' | 'overdue' | 'renewal' | 'test' | 'push' = 'test'): void {
  try {
    if (typeof window === 'undefined') return;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'due_today' || type === 'test' || type === 'push') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (type === 'overdue') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, now); // A4
      osc.frequency.exponentialRampToValueAtTime(330, now + 0.2); // E4
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.4);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    }
  } catch (e) {
    console.warn('Audio chime failed:', e);
  }
}

export async function dispatchWebPush(
  title: string,
  options: {
    body: string;
    icon?: string;
    badge?: string;
    data?: any;
    tag?: string;
    url?: string;
    vibrate?: number[];
  }
): Promise<boolean> {
  return notificationService.dispatchNotification({
    title,
    body: options.body,
    type: 'test',
    extra: { ...options.data, url: options.url }
  });
}

export function evaluatePaymentAlerts(
  customers: Customer[],
  preferences: NotificationPreferences = DEFAULT_NOTIFICATION_PREFERENCES
): PaymentAlert[] {
  if (!preferences.enabled) return [];

  const todayStart = startOfToday();
  const alerts: PaymentAlert[] = [];
  const minPending = preferences.minimumPendingAmount || 0;

  for (const customer of customers) {
    if (customer.isDeleted) continue;

    const loanAmount = customer.loanAmount || customer.loan || 0;
    const paidAmount = customer.paid || 0;
    const pendingAmount = customer.pending !== undefined ? customer.pending : (loanAmount - paidAmount);

    if (pendingAmount <= minPending) continue;
    const safeEndDate = toSafeDate(customer.endDate);
    if (!safeEndDate) continue;

    const dueStart = startOfDay(safeEndDate);
    const diffDays = differenceInCalendarDays(dueStart, todayStart);
    const dueDateFormatted = safeFormat(safeEndDate, 'dd MMM yyyy');
    const collectionUrl = `/entry?search=${encodeURIComponent(customer.phone || customer.name)}&customerId=${customer.id}`;

    // 1. UPCOMING REMINDERS
    if (diffDays > 0 && preferences.upcomingReminders && preferences.enableUpcomingAlerts) {
      if (preferences.upcomingReminderDays.includes(diffDays) || diffDays <= preferences.upcomingDaysBefore) {
        const title = `⏳ Payment Due in ${diffDays} Day${diffDays > 1 ? 's' : ''}: ${customer.name}`;
        const message = `${customer.name} has ₹${pendingAmount.toLocaleString('en-IN')} pending for collection on ${dueDateFormatted}.`;
        const whatsappMessage = `Hello ${customer.name}, gentle reminder from Pigmy Pro: Your payment of ₹${pendingAmount.toLocaleString('en-IN')} is due on ${dueDateFormatted}. Thank you!`;

        alerts.push({
          id: `upcoming_${customer.id}_${diffDays}_${format(todayStart, 'yyyyMMdd')}`,
          customerId: customer.id,
          customerName: customer.name,
          customerPhone: customer.phone,
          loanAmount,
          paidAmount,
          pendingAmount,
          endDate: customer.endDate,
          startDate: customer.startDate,
          diffDays,
          alertType: 'upcoming',
          type: 'upcoming',
          title,
          message,
          urgency: diffDays <= 1 ? 'high' : 'medium',
          collectionUrl,
          whatsappMessage,
        });
      }
    }
    // 2. DUE TODAY
    else if (diffDays === 0 && preferences.enableDueTodayAlerts) {
      const title = `🚨 Loan Due Today: ${customer.name}`;
      const message = `Maturity date is today! ₹${pendingAmount.toLocaleString('en-IN')} pending collection.`;
      const whatsappMessage = `Hello ${customer.name}, your Pigmy loan maturity due date is today (${dueDateFormatted}). Kindly keep ₹${pendingAmount.toLocaleString('en-IN')} ready.`;

      alerts.push({
        id: `due_today_${customer.id}_${format(todayStart, 'yyyyMMdd')}`,
        customerId: customer.id,
        customerName: customer.name,
        customerPhone: customer.phone,
        loanAmount,
        paidAmount,
        pendingAmount,
        endDate: customer.endDate,
        startDate: customer.startDate,
        diffDays: 0,
        alertType: 'due_today',
        type: 'due_today',
        title,
        message,
        urgency: 'high',
        collectionUrl,
        whatsappMessage,
      });
    }
    // 3. OVERDUE
    else if (diffDays < 0 && preferences.overdueReminders && preferences.enableOverdueAlerts) {
      const daysOverdue = Math.abs(diffDays);
      let shouldAlert = true;

      if (preferences.overdueFrequency === 'every_2_days') {
        shouldAlert = daysOverdue % 2 === 0;
      } else if (preferences.overdueFrequency === 'every_3_days') {
        shouldAlert = daysOverdue % 3 === 0;
      }

      if (shouldAlert) {
        const title = `⚠️ Overdue Payment Alert: ${customer.name}`;
        const message = `Payment is overdue by ${daysOverdue} day${daysOverdue > 1 ? 's' : ''} (End Date: ${dueDateFormatted}). Outstanding: ₹${pendingAmount.toLocaleString('en-IN')}.`;
        const whatsappMessage = `Urgent Notice: Dear ${customer.name}, your Pigmy loan payment of ₹${pendingAmount.toLocaleString('en-IN')} is overdue by ${daysOverdue} days since ${dueDateFormatted}.`;

        alerts.push({
          id: `overdue_${customer.id}_${daysOverdue}_${format(todayStart, 'yyyyMMdd')}`,
          customerId: customer.id,
          customerName: customer.name,
          customerPhone: customer.phone,
          loanAmount,
          paidAmount,
          pendingAmount,
          endDate: customer.endDate,
          startDate: customer.startDate,
          diffDays,
          alertType: 'overdue',
          type: 'overdue',
          title,
          message,
          urgency: 'high',
          collectionUrl,
          whatsappMessage,
        });
      }
    }

    // 4. MATURED LOAN RENEWALS
    if (diffDays <= 0 && customer.renewalStatus !== 'rejected' && preferences.enableRenewalAlerts !== false) {
      const daysOverdue = Math.abs(diffDays);
      const title = `🔄 Matured Loan Renewal: ${customer.name}`;
      const message = `Loan duration completed with ₹${pendingAmount.toLocaleString('en-IN')} remaining. Available for restructuring in Dashboard Renewal Section.`;
      const whatsappMessage = `Hello ${customer.name}, your Pigmy loan duration has completed. Outstanding balance: ₹${pendingAmount.toLocaleString('en-IN')}. Please contact us to renew with revised terms.`;

      alerts.push({
        id: `renewal_${customer.id}_${daysOverdue}_${format(todayStart, 'yyyyMMdd')}`,
        customerId: customer.id,
        customerName: customer.name,
        customerPhone: customer.phone,
        loanAmount,
        paidAmount,
        pendingAmount,
        endDate: customer.endDate,
        startDate: customer.startDate,
        diffDays,
        alertType: 'renewal',
        type: 'renewal',
        title,
        message,
        urgency: 'high',
        collectionUrl: '/',
        whatsappMessage,
      });
    }
  }

  return alerts.sort((a, b) => {
    if (a.urgency === 'high' && b.urgency !== 'high') return -1;
    if (a.urgency !== 'high' && b.urgency === 'high') return 1;
    return a.diffDays - b.diffDays;
  });
}

class NotificationService {
  private initialized = false;
  private settings: NotificationSettings = DEFAULT_SETTINGS;
  private history: NotificationLog[] = [];
  private fcmToken: string | null = null;
  private customNavigate: ((url: string) => void) | null = null;
  private foregroundListeners: Set<ForegroundNotificationCallback> = new Set();

  constructor() {
    this.loadSettings();
    this.loadHistory();
    this.loadCachedToken();
  }

  private loadSettings() {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      if (stored) {
        this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn('Failed to load notification settings:', e);
    }
  }

  private loadHistory() {
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      if (stored) {
        this.history = JSON.parse(stored).slice(0, 30);
      }
    } catch (e) {
      console.warn('Failed to load notification history:', e);
    }
  }

  private loadCachedToken() {
    try {
      this.fcmToken = localStorage.getItem(FCM_TOKEN_CACHE_KEY);
    } catch {
      // ignore
    }
  }

  public setNavigationHandler(navigateFn: (url: string) => void) {
    this.customNavigate = navigateFn;
  }

  public onForegroundNotification(callback: ForegroundNotificationCallback): () => void {
    this.foregroundListeners.add(callback);
    return () => {
      this.foregroundListeners.delete(callback);
    };
  }

  private broadcastForegroundNotification(payload: {
    title: string;
    body: string;
    data?: Record<string, any>;
    deepLinkUrl?: string;
    type?: NotificationLog['type'];
  }) {
    this.foregroundListeners.forEach((cb) => {
      try {
        cb(payload);
      } catch (err) {
        console.warn('Error in foreground notification listener:', err);
      }
    });
  }

  public getSettings(): NotificationSettings {
    return { ...this.settings };
  }

  public getActiveToken(): string | null {
    return this.fcmToken;
  }

  public updateSettings(updates: Partial<NotificationSettings>) {
    this.settings = { ...this.settings, ...updates };
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    } catch (e) {
      console.warn('Failed to save notification settings:', e);
    }
  }

  public getHistory(): NotificationLog[] {
    return [...this.history];
  }

  public clearHistory() {
    this.history = [];
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch (e) {
      console.warn('Failed to clear notification history:', e);
    }
  }

  public recordLog(title: string, body: string, type: NotificationLog['type'], data?: Record<string, any>) {
    const log: NotificationLog = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      title,
      body,
      timestamp: Date.now(),
      type,
      data
    };
    this.history = [log, ...this.history].slice(0, 30);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(this.history));
    } catch (e) {
      console.warn('Failed to save notification history:', e);
    }
  }

  public resolveDeepLink(data: Record<string, any> = {}): string {
    const type = data.type || data.alertCategory || data.notification_type || data.alertType || '';
    
    if (data.click_action && typeof data.click_action === 'string' && data.click_action.startsWith('/')) {
      return data.click_action;
    }
    if (data.url && typeof data.url === 'string' && data.url.startsWith('/')) {
      return data.url;
    }

    if (data.receiptId || data.transactionId) {
      const id = data.receiptId || data.transactionId;
      return `/transactions?id=${encodeURIComponent(id)}`;
    }

    if (data.customerName) {
      return `/entry?search=${encodeURIComponent(data.customerName)}`;
    }
    if (data.customerId) {
      return `/entry?customerId=${encodeURIComponent(data.customerId)}`;
    }

    if (type === 'payment' || type === 'transaction') {
      return '/transactions';
    }
    if (type === 'np' || type === 'overdue') {
      return '/entry?filter=unpaid';
    }
    if (type === 'morning_route' || type === 'due_today' || type === 'upcoming') {
      return '/entry?filter=pending';
    }
    if (type === 'evening_summary' || type === 'sync') {
      return '/dashboard';
    }

    return '/dashboard';
  }

  public handleNotificationDeepLink(data: Record<string, any> = {}) {
    const targetUrl = this.resolveDeepLink(data);

    if (this.customNavigate) {
      this.customNavigate(targetUrl);
    } else if (typeof window !== 'undefined') {
      window.location.hash = targetUrl.startsWith('/') ? targetUrl : `/${targetUrl}`;
    }
  }

  public async registerDeviceToken(userId: string, token: string, platform: 'web' | 'android' | 'ios' = 'web'): Promise<void> {
    if (!token || !userId) return;

    this.fcmToken = token;
    try {
      localStorage.setItem(FCM_TOKEN_CACHE_KEY, token);
    } catch {
      // ignore
    }

    try {
      if (db) {
        const tokenRef = doc(db, 'users', userId, 'fcmTokens', token);
        await setDoc(tokenRef, {
          token,
          platform,
          updatedAt: serverTimestamp(),
          deviceInfo: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown'
        }, { merge: true });
      }
    } catch (err) {
      console.warn('Firestore device token write warning:', err);
    }

    try {
      await fetch('/api/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, userId, platform })
      });
    } catch (err) {
      console.warn('Backend /api/tokens registration skipped:', err);
    }
  }

  public async initialize(userId: string = 'admin_user'): Promise<void> {
    if (this.initialized) return;

    if (Capacitor.isNativePlatform()) {
      try {
        const channels: Channel[] = [
          {
            id: 'collections_channel',
            name: 'Payment Collections',
            description: 'Instant alerts for Cash and UPI payment receipts',
            importance: 5,
            visibility: 1,
            sound: 'beep.wav',
            vibration: true,
            lights: true,
            lightColor: '#10b981'
          },
          {
            id: 'np_alerts_channel',
            name: 'Unpaid (NP) Alerts',
            description: 'Immediate alerts when installments are marked Not Paid',
            importance: 5,
            visibility: 1,
            sound: 'beep.wav',
            vibration: true,
            lights: true,
            lightColor: '#f59e0b'
          },
          {
            id: 'daily_digest_channel',
            name: 'Daily Route & Summary',
            description: 'Morning collection goals and evening closing summaries',
            importance: 4,
            visibility: 1,
            sound: 'beep.wav',
            vibration: true,
            lights: true,
            lightColor: '#8b5cf6'
          },
          {
            id: 'renewals_channel',
            name: 'Loan Renewals & Restructuring',
            description: 'Alerts for matured accounts ready for renewal or restructuring',
            importance: 4,
            visibility: 1,
            sound: 'beep.wav',
            vibration: true,
            lights: true,
            lightColor: '#f59e0b'
          }
        ];

        for (const channel of channels) {
          try {
            await LocalNotifications.createChannel(channel);
          } catch (e) {
            console.warn(`Could not create channel ${channel.id}:`, e);
          }
        }

        try {
          await LocalNotifications.registerActionTypes({
            types: [
              {
                id: 'PAYMENT_ACTIONS',
                actions: [
                  { id: 'view_receipt', title: '🧾 View Receipt' },
                  { id: 'whatsapp', title: '💬 WhatsApp' }
                ]
              },
              {
                id: 'NP_ACTIONS',
                actions: [
                  { id: 'collect_now', title: '⚡ Collect Now' },
                  { id: 'whatsapp_reminder', title: '💬 Send Reminder' }
                ]
              },
              {
                id: 'ROUTE_ACTIONS',
                actions: [
                  { id: 'open_route', title: '🚀 Open Routes' },
                  { id: 'view_dashboard', title: '📊 View Goals' }
                ]
              },
              {
                id: 'SUMMARY_ACTIONS',
                actions: [
                  { id: 'export_pdf', title: '📥 Export PDF' },
                  { id: 'view_history', title: '📈 Ledger' }
                ]
              },
              {
                id: 'SYNC_ACTIONS',
                actions: [
                  { id: 'view_history', title: '📋 Ledger' }
                ]
              },
              {
                id: 'RENEWAL_ACTIONS',
                actions: [
                  { id: 'open_renewal', title: '🔄 Review Renewal' },
                  { id: 'whatsapp_renewal', title: '💬 WhatsApp' }
                ]
              },
              {
                id: 'RENEWED_CONFIRM_ACTIONS',
                actions: [
                  { id: 'view_dashboard', title: '📊 Dashboard' },
                  { id: 'open_route', title: '🚀 Daily Route' }
                ]
              }
            ]
          });

          LocalNotifications.addListener('localNotificationActionPerformed', (notificationAction: LocalActionPerformed) => {
            const actionId = notificationAction.actionId;
            const extra = (notificationAction.notification as any).extra || {};
            
            if (actionId === 'whatsapp' || actionId === 'whatsapp_reminder') {
              const rawPhone = extra.phone || extra.customerPhone || '';
              const cleanPhone = String(rawPhone).replace(/[^\d]/g, '');
              const phoneWithCode = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
              const textMsg = actionId === 'whatsapp_reminder'
                ? `Dear ${extra.customerName || 'Customer'}, your daily installment is pending. Please keep it ready or pay via UPI. Thank you!`
                : `Hello ${extra.customerName || 'Customer'}, payment received for your Pigmy account. Thank you!`;
              if (phoneWithCode) {
                window.open(`https://wa.me/${phoneWithCode}?text=${encodeURIComponent(textMsg)}`, '_blank');
              }
            } else if (actionId === 'whatsapp_renewal') {
              const rawPhone = extra.phone || extra.customerPhone || '';
              const cleanPhone = String(rawPhone).replace(/[^\d]/g, '');
              const phoneWithCode = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
              const textMsg = extra.newTotalDebt
                ? `Dear ${extra.customerName || 'Customer'}, your loan has been successfully renewed for Cycle #${extra.cycleNumber || 2} with total amount ₹${extra.newTotalDebt?.toLocaleString('en-IN')}. Daily installment: ₹${extra.dailyInstallment?.toLocaleString('en-IN')}. Thank you!`
                : `Hello ${extra.customerName || 'Customer'}, your loan tenure has ended with a remaining balance of ₹${(extra.pending || 0).toLocaleString('en-IN')}. Please contact us to renew or restructure your terms.`;
              if (phoneWithCode) {
                window.open(`https://wa.me/${phoneWithCode}?text=${encodeURIComponent(textMsg)}`, '_blank');
              }
            } else if (actionId === 'open_renewal') {
              window.location.href = '/';
            } else if (actionId === 'collect_now') {
              window.location.href = extra.customerId ? `/entry?customerId=${extra.customerId}` : '/entry';
            } else if (actionId === 'view_receipt') {
              window.location.href = extra.receiptId ? `/transactions?receipt=${extra.receiptId}` : '/transactions';
            } else if (actionId === 'export_pdf') {
              window.location.href = '/transactions?export=pdf';
            } else if (actionId === 'open_route') {
              window.location.href = '/entry';
            } else if (actionId === 'view_dashboard') {
              window.location.href = '/';
            } else if (actionId === 'view_history') {
              window.location.href = '/transactions';
            }
          });
        } catch (e) {
          console.warn('Could not register action types:', e);
        }

        await PushNotifications.addListener('registration', (token: Token) => {
          const currentUid = auth.currentUser?.uid || userId || 'admin_user';
          this.registerDeviceToken(currentUid, token.value, Capacitor.getPlatform() as 'android' | 'ios');
        });

        await PushNotifications.addListener('registrationError', (error: any) => {
          console.warn('Capacitor Push registration error:', error);
        });

        await PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
          const data = notification.data || {};
          const title = notification.title || 'Pigmy Collection Alert';
          const body = notification.body || 'New collection update received.';
          const deepLinkUrl = this.resolveDeepLink(data);

          this.recordLog(title, body, 'push', data);

          this.broadcastForegroundNotification({
            title,
            body,
            data,
            deepLinkUrl,
            type: (data.type as any) || 'push'
          });

          LocalNotifications.schedule({
            notifications: [{
              id: Math.floor(Date.now() % 1000000),
              title,
              body,
              channelId: (data.channelId as any) || 'collections_channel',
              smallIcon: 'ic_stat_icon_config_sample',
              iconColor: '#10b981',
              extra: data,
              schedule: { at: new Date(Date.now() + 100) }
            }]
          }).catch((e) => console.warn('Local notification trigger error:', e));

          if (this.settings.soundEnabled) {
            playNotificationChime('push');
          }
        });

        await PushNotifications.addListener('pushNotificationActionPerformed', (notification: ActionPerformed) => {
          const data = notification.notification?.data || {};
          this.handleNotificationDeepLink(data);
        });

        const perm = await PushNotifications.checkPermissions();
        if (perm.receive === 'granted') {
          await PushNotifications.register();
        }
      } catch (err) {
        console.warn('Capacitor native push setup error:', err);
      }
    }

    if (typeof window !== 'undefined' && 'Notification' in window && !Capacitor.isNativePlatform()) {
      try {
        const msg = messaging();
        if (msg) {
          onMessage(msg, (payload: MessagePayload) => {
            const data = payload.data || {};
            const title = payload.notification?.title || data.title || 'Pigmy Collection Alert';
            const body = payload.notification?.body || data.body || 'New collection update received.';
            const deepLinkUrl = this.resolveDeepLink(data);

            this.recordLog(title, body, 'push', data);

            this.broadcastForegroundNotification({
              title,
              body,
              data,
              deepLinkUrl,
              type: (data.type as any) || 'push'
            });

            if (this.settings.soundEnabled) {
              playNotificationChime('push');
            }
            if (this.settings.vibrationEnabled && navigator.vibrate) {
              navigator.vibrate([100, 50, 100]);
            }
          });
        }
      } catch (err) {
        console.warn('Web FCM onMessage listener skipped:', err);
      }
    }

    this.initialized = true;
  }

  public async checkPermission(): Promise<'granted' | 'denied' | 'prompt'> {
    if (Capacitor.isNativePlatform()) {
      try {
        const res = await PushNotifications.checkPermissions();
        if (res.receive === 'granted') return 'granted';
        if (res.receive === 'denied') return 'denied';
        return 'prompt';
      } catch {
        return 'prompt';
      }
    }

    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') return 'granted';
      if (Notification.permission === 'denied') return 'denied';
      return 'prompt';
    }

    return 'prompt';
  }

  public async requestPermission(): Promise<boolean> {
    try {
      if (Capacitor.isNativePlatform()) {
        const pushPerm = await PushNotifications.requestPermissions();
        const localPerm = await LocalNotifications.requestPermissions();
        
        if (pushPerm.receive === 'granted' || localPerm.display === 'granted') {
          await PushNotifications.register();
          await this.initialize();
          return true;
        }
        return false;
      }

      if (typeof window !== 'undefined' && 'Notification' in window) {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
          await this.initialize();
          await this.requestWebFCMToken();
          return true;
        }
      }
    } catch (err) {
      console.warn('Error requesting notification permission:', err);
    }
    return false;
  }

  public async requestWebFCMToken(): Promise<string | null> {
    if (typeof window === 'undefined' || Capacitor.isNativePlatform()) return null;

    try {
      const msg = messaging();
      if (!msg) return null;

      const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
      const token = await getToken(msg, vapidKey ? { vapidKey } : undefined);

      if (token) {
        const currentUid = auth.currentUser?.uid || 'anonymous';
        await this.registerDeviceToken(currentUid, token, 'web');
        return token;
      }
    } catch (err) {
      console.warn('Could not fetch Web FCM token:', err);
    }
    return null;
  }

  public async dispatchNotification(options: {
    id?: number;
    title: string;
    body: string;
    channelId?: 'collections_channel' | 'np_alerts_channel' | 'daily_digest_channel' | 'renewals_channel';
    type: NotificationLog['type'];
    extra?: Record<string, any>;
  }): Promise<boolean> {
    if (!this.settings.enableNotifications) return false;

    const notifId = options.id || Math.floor(Date.now() % 100000000);
    const deepLinkUrl = this.resolveDeepLink(options.extra || {});
    this.recordLog(options.title, options.body, options.type, options.extra);

    this.broadcastForegroundNotification({
      title: options.title,
      body: options.body,
      data: options.extra,
      deepLinkUrl,
      type: options.type
    });

    if (Capacitor.isNativePlatform()) {
      try {
        let actionTypeId = 'PAYMENT_ACTIONS';
        if (options.type === 'np') actionTypeId = 'NP_ACTIONS';
        else if (options.type === 'morning_route') actionTypeId = 'ROUTE_ACTIONS';
        else if (options.type === 'evening_summary') actionTypeId = 'SUMMARY_ACTIONS';
        else if (options.type === 'sync') actionTypeId = 'SYNC_ACTIONS';
        else if (options.type === 'renewal' || options.type === 'renewal_summary') actionTypeId = 'RENEWAL_ACTIONS';
        else if (options.type === 'renewal_completed' || options.type === 'new_loan') actionTypeId = 'RENEWED_CONFIRM_ACTIONS';

        await LocalNotifications.schedule({
          notifications: [
            {
              id: notifId,
              title: options.title,
              body: options.body,
              channelId: options.channelId || 'collections_channel',
              smallIcon: 'ic_stat_icon_config_sample',
              iconColor: options.type?.startsWith('renewal') ? '#f59e0b' : '#10b981',
              actionTypeId: actionTypeId,
              extra: options.extra,
              schedule: { at: new Date(Date.now() + 100) }
            }
          ]
        });
        return true;
      } catch (err) {
        console.warn('LocalNotifications.schedule error:', err);
      }
    }

    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        // Build rich Android Notification Center Action Buttons
        let actions: { action: string; title: string }[] = [];
        let vibrationPattern = [0, 100, 50, 100];
        let requireInteraction = false;

        switch (options.type) {
          case 'payment':
            actions = [
              { action: 'view_receipt', title: '🧾 View Receipt' },
              { action: 'whatsapp', title: '💬 WhatsApp' }
            ];
            vibrationPattern = [0, 120, 80, 140, 60, 200];
            break;

          case 'np':
            actions = [
              { action: 'collect_now', title: '⚡ Collect Now' },
              { action: 'whatsapp_reminder', title: '💬 Send Reminder' }
            ];
            vibrationPattern = [0, 250, 120, 250, 120, 400];
            requireInteraction = true;
            break;

          case 'morning_route':
            actions = [
              { action: 'open_route', title: '🚀 Open Routes' },
              { action: 'view_dashboard', title: '📊 View Goals' }
            ];
            vibrationPattern = [0, 150, 100, 150];
            break;

          case 'renewal':
          case 'renewal_summary':
            actions = [
              { action: 'open_renewal', title: '🔄 Review Renewal' },
              { action: 'whatsapp_renewal', title: '💬 WhatsApp' }
            ];
            vibrationPattern = [0, 200, 100, 200, 100, 300];
            requireInteraction = true;
            break;

          case 'renewal_completed':
          case 'new_loan':
            actions = [
              { action: 'view_dashboard', title: '📊 Dashboard' },
              { action: 'open_route', title: '🚀 Daily Route' }
            ];
            vibrationPattern = [0, 150, 80, 150];
            break;

          case 'renewal_rejected':
            actions = [
              { action: 'view_dashboard', title: '📊 Dashboard' }
            ];
            vibrationPattern = [0, 100, 50, 100];
            break;

          case 'evening_summary':
            actions = [
              { action: 'export_pdf', title: '📥 Export PDF' },
              { action: 'view_history', title: '📈 Ledger' }
            ];
            vibrationPattern = [0, 100, 50, 100, 50, 100];
            break;

          case 'sync':
            actions = [
              { action: 'view_history', title: '📋 Ledger' }
            ];
            vibrationPattern = [0, 80, 40, 80];
            break;

          default:
            actions = [
              { action: 'open_app', title: '📱 Open App' }
            ];
            break;
        }

        const tag = `pigmy-${options.type}-${options.extra?.customerId || options.extra?.txId || Date.now()}`;

        if ('serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.ready;
          const opts: any = {
            body: options.body,
            icon: '/pwa-192x192.png',
            badge: '/notification-badge.png', // Crisp monochrome silhouette for Android status bar
            tag: tag,
            renotify: true,
            requireInteraction: requireInteraction,
            actions: actions,
            timestamp: Date.now(),
            silent: false,
            data: { 
              ...options.extra, 
              deepLinkUrl,
              click_action: deepLinkUrl,
              phone: options.extra?.phone || options.extra?.customerPhone,
              customerId: options.extra?.customerId,
              customerName: options.extra?.customerName,
              receiptId: options.extra?.receiptId || options.extra?.txId
            }
          };

          if (this.settings.vibrationEnabled) {
            opts.vibrate = vibrationPattern;
          }

          await reg.showNotification(options.title, opts);
          return true;
        } else {
          new Notification(options.title, {
            body: options.body,
            icon: '/pwa-192x192.png',
            badge: '/notification-badge.png',
            tag: tag
          });
          return true;
        }
      } catch (err) {
        console.warn('Web Notification error:', err);
      }
    }

    return false;
  }

  public async notifyPaymentReceived(
    customerName: string,
    amount: number,
    type: 'cash' | 'phonepe',
    remainingBal: number
  ): Promise<boolean> {
    if (!this.settings.notifyPayments) return false;

    const typeLabel = type === 'cash' ? 'Cash' : 'UPI';
    const title = `💰 Payment Collected: ₹${amount.toLocaleString('en-IN')}`;
    const body = `${customerName} paid via ${typeLabel}. Remaining Loan Balance: ₹${remainingBal.toLocaleString('en-IN')}`;

    return this.dispatchNotification({
      title,
      body,
      channelId: 'collections_channel',
      type: 'payment',
      extra: { customerName, amount, type, remainingBal, notification_type: 'payment' }
    });
  }

  public async notifyAdvanceSavingsDeposit(
    customerName: string,
    amount: number,
    type: 'cash' | 'phonepe',
    totalAdvance: number
  ): Promise<boolean> {
    const title = `💰 Advance Savings: ${customerName}`;
    const body = `Collected ₹${amount.toLocaleString('en-IN')} ${type === 'cash' ? 'Cash' : 'UPI'} advance savings deposit. Total Advance: ₹${totalAdvance.toLocaleString('en-IN')}.`;

    return this.dispatchNotification({
      title,
      body,
      channelId: 'collections_channel',
      type: 'payment',
      extra: { customerName, amount, type, totalAdvance, notification_type: 'advance_deposit' }
    });
  }

  public async notifyNPLogged(
    customerName: string,
    amount: number,
    dateStr?: string
  ): Promise<boolean> {
    if (!this.settings.notifyNP) return false;

    const title = `⚠️ Missed Installment (NP): ${customerName}`;
    const body = `Marked as Not Paid for ₹${amount.toLocaleString('en-IN')}${dateStr ? ` (${dateStr})` : ''}. Added to Unpaid Section.`;

    return this.dispatchNotification({
      title,
      body,
      channelId: 'np_alerts_channel',
      type: 'np',
      extra: { customerName, amount, dateStr, notification_type: 'np' }
    });
  }

  public async notifyCollectionSync(
    syncedCount: number,
    totalAmount: number
  ): Promise<boolean> {
    const title = `🔄 Collections Synchronized`;
    const body = `Successfully synced ${syncedCount} collection${syncedCount === 1 ? '' : 's'} (₹${totalAmount.toLocaleString('en-IN')}) to Cloud Ledger.`;

    return this.dispatchNotification({
      title,
      body,
      channelId: 'collections_channel',
      type: 'sync',
      extra: { syncedCount, totalAmount, notification_type: 'sync' }
    });
  }

  public async notifyMorningRoute(
    pendingCount: number,
    targetAmount: number
  ): Promise<boolean> {
    if (!this.settings.notifyMorningRoute) return false;

    const title = `📋 Morning Collection Route Ready`;
    const body = `${pendingCount} customers pending collection today. Total Daily Target: ₹${targetAmount.toLocaleString('en-IN')}.`;

    return this.dispatchNotification({
      title,
      body,
      channelId: 'daily_digest_channel',
      type: 'morning_route',
      extra: { pendingCount, targetAmount, notification_type: 'morning_route' }
    });
  }

  public async notifyEveningSummary(
    cashTotal: number,
    upiTotal: number,
    npCount: number
  ): Promise<boolean> {
    if (!this.settings.notifyEveningSummary) return false;

    const grandTotal = cashTotal + upiTotal;
    const title = `🏁 Daily Collection Summary: ₹${grandTotal.toLocaleString('en-IN')}`;
    const body = `Cash: ₹${cashTotal.toLocaleString('en-IN')} | UPI: ₹${upiTotal.toLocaleString('en-IN')}${npCount > 0 ? ` | Unpaid (NP): ${npCount}` : ' | All Paid!'}`;

    return this.dispatchNotification({
      title,
      body,
      channelId: 'daily_digest_channel',
      type: 'evening_summary',
      extra: { cashTotal, upiTotal, npCount, notification_type: 'evening_summary' }
    });
  }

  public async notifyRenewalDue(customer: {
    id: string;
    name: string;
    phone?: string;
    pending: number;
    endDate: number;
    daysOverdue?: number;
  }): Promise<boolean> {
    if (!this.settings.enableNotifications) return false;

    const daysText = customer.daysOverdue !== undefined && customer.daysOverdue > 0
      ? ` (Matured ${customer.daysOverdue}d ago)`
      : ' (Matured today)';
    const title = `🔄 Renewal Due: ${customer.name}`;
    const body = `Loan term completed${daysText}. Pending balance: ₹${customer.pending.toLocaleString('en-IN')}. Tap to renew or restructure terms.`;

    return this.dispatchNotification({
      title,
      body,
      channelId: 'renewals_channel',
      type: 'renewal',
      extra: {
        customerId: customer.id,
        customerName: customer.name,
        phone: customer.phone,
        pending: customer.pending,
        click_action: '/',
        notification_type: 'renewal'
      }
    });
  }

  public async notifyRenewalSummary(count: number, totalRemaining: number): Promise<boolean> {
    if (!this.settings.enableNotifications) return false;

    const title = `🔄 ${count} Matured Loan${count === 1 ? '' : 's'} Ready for Renewal`;
    const body = `₹${totalRemaining.toLocaleString('en-IN')} pending balance across expired accounts. Review and renew on Dashboard.`;

    return this.dispatchNotification({
      title,
      body,
      channelId: 'renewals_channel',
      type: 'renewal_summary',
      extra: {
        count,
        totalRemaining,
        click_action: '/',
        notification_type: 'renewal_summary'
      }
    });
  }

  public async notifyLoanRenewed(
    customerName: string,
    cycleNumber: number,
    newTotalDebt: number,
    durationDays: number,
    dailyInstallment: number,
    customerId?: string,
    customerPhone?: string
  ): Promise<boolean> {
    const title = `🎉 Loan Renewed: ${customerName} (Cycle #${cycleNumber})`;
    const body = `Renewed successfully! New Total: ₹${newTotalDebt.toLocaleString('en-IN')} for ${durationDays} days (₹${dailyInstallment.toLocaleString('en-IN')}/day).`;

    return this.dispatchNotification({
      title,
      body,
      channelId: 'renewals_channel',
      type: 'renewal_completed',
      extra: {
        customerName,
        cycleNumber,
        newTotalDebt,
        durationDays,
        dailyInstallment,
        customerId,
        phone: customerPhone,
        click_action: '/',
        notification_type: 'renewal_completed'
      }
    });
  }

  public async notifyNewLoanIssued(
    customerName: string,
    cycleNumber: number,
    newLoanAmount: number,
    durationDays: number,
    dailyInstallment: number,
    customerId?: string,
    customerPhone?: string
  ): Promise<boolean> {
    const title = `🚀 New Loan Started: ${customerName} (Cycle #${cycleNumber})`;
    const body = `Cycle #${cycleNumber} active! Loan Amount: ₹${newLoanAmount.toLocaleString('en-IN')} for ${durationDays} days (₹${dailyInstallment.toLocaleString('en-IN')}/day).`;

    return this.dispatchNotification({
      title,
      body,
      channelId: 'renewals_channel',
      type: 'new_loan',
      extra: {
        customerName,
        cycleNumber,
        newLoanAmount,
        durationDays,
        dailyInstallment,
        customerId,
        phone: customerPhone,
        click_action: customerId ? `/entry?customerId=${customerId}` : '/entry',
        notification_type: 'new_loan'
      }
    });
  }

  public async notifyRenewalRejected(
    customerName: string,
    pendingAmount: number,
    customerId?: string
  ): Promise<boolean> {
    const title = `⚠️ Renewal Rejected: ${customerName}`;
    const body = `Kept as overdue in regular collections (₹${pendingAmount.toLocaleString('en-IN')}). Re-assigned to overdue route.`;

    return this.dispatchNotification({
      title,
      body,
      channelId: 'renewals_channel',
      type: 'renewal_rejected',
      extra: {
        customerName,
        pendingAmount,
        customerId,
        click_action: '/',
        notification_type: 'renewal_rejected'
      }
    });
  }

  public async sendTestNotification(): Promise<boolean> {
    const title = `🔔 Pigmy Android Notification Center`;
    const body = `Test alert delivered successfully! Your Android device will receive instant payment receipts, NP alerts, and daily summaries.`;

    return this.dispatchNotification({
      title,
      body,
      channelId: 'collections_channel',
      type: 'test',
      extra: { notification_type: 'test' }
    });
  }
}

export const notificationService = new NotificationService();
