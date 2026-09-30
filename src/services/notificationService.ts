import { format, differenceInCalendarDays, startOfDay, startOfToday } from 'date-fns';
import { Customer, firestoreService } from './firestoreService';
import { triggerWhatsApp } from '../lib/whatsapp';
import { toSafeDate, safeFormat } from '../lib/utils';

export interface NotificationPreferences {
  enabled: boolean;
  upcomingReminders: boolean;
  upcomingReminderDays: number[]; // e.g. [7, 5, 3, 2, 1, 0] (0 = on due date)
  overdueReminders: boolean;
  overdueFrequency: 'daily' | 'every_2_days' | 'every_3_days';
  minimumPendingAmount: number;
  dailyReminderTime: string; // HH:mm format, e.g. '09:00'
  enableSound: boolean;
  enableVibration: boolean;
  notifyChannels: {
    webPush: boolean;
    inApp: boolean;
  };
  lastCheckDate?: string;
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
  upcomingReminderDays: [3, 1, 0], // Default: 3 days before, 1 day before, and on due date
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
};

export interface PaymentAlert {
  id: string; // Unique deduplication key
  customerId: string;
  customerName: string;
  customerPhone: string;
  loanAmount: number;
  paidAmount: number;
  pendingAmount: number;
  endDate: number;
  startDate: number;
  diffDays: number; // >0: days remaining, 0: due today, <0: days overdue
  alertType: 'upcoming' | 'due_today' | 'overdue';
  title: string;
  message: string;
  urgency: 'high' | 'medium' | 'low';
  collectionUrl: string;
  whatsappMessage: string;
}

/**
 * Evaluates customers against notification preferences based on 'endDate' and 'pending' amount.
 */
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

    // Only alert if there is an active pending balance above the minimum threshold
    if (pendingAmount <= minPending) continue;
    const safeEndDate = toSafeDate(customer.endDate);
    if (!safeEndDate) continue;

    const dueStart = startOfDay(safeEndDate);
    const diffDays = differenceInCalendarDays(dueStart, todayStart);
    const dueDateFormatted = safeFormat(safeEndDate, 'dd MMM yyyy');
    const collectionUrl = `/entry?search=${encodeURIComponent(customer.phone || customer.name)}&customerId=${customer.id}`;

    // 1. UPCOMING REMINDERS (diffDays > 0)
    if (diffDays > 0 && preferences.upcomingReminders) {
      if (preferences.upcomingReminderDays.includes(diffDays)) {
        const title = `⏳ Payment Due in ${diffDays} Day${diffDays > 1 ? 's' : ''}: ${customer.name}`;
        const message = `${customer.name} has ₹${pendingAmount.toLocaleString('en-IN')} pending for collection on ${dueDateFormatted}.`;
        const whatsappMessage = `Hello ${customer.name}, this is a gentle reminder from Pigmy Collection that your loan payment of ₹${pendingAmount.toLocaleString('en-IN')} is due in ${diffDays} day${diffDays > 1 ? 's' : ''} on ${dueDateFormatted}. Please keep the amount ready. Thank you!`;

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
          title,
          message,
          urgency: diffDays <= 1 ? 'high' : 'medium',
          collectionUrl,
          whatsappMessage,
        });
      }
    }

    // 2. DUE TODAY (diffDays === 0)
    else if (diffDays === 0 && preferences.upcomingReminders) {
      if (preferences.upcomingReminderDays.includes(0)) {
        const title = `🚨 Loan Due Today: ${customer.name}`;
        const message = `Maturity date is today! ₹${pendingAmount.toLocaleString('en-IN')} pending collection.`;
        const whatsappMessage = `Hello ${customer.name}, your Pigmy loan maturity due date is today (${dueDateFormatted}). Kindly keep the pending collection of ₹${pendingAmount.toLocaleString('en-IN')} ready. Thank you!`;

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
          title,
          message,
          urgency: 'high',
          collectionUrl,
          whatsappMessage,
        });
      }
    }

    // 3. OVERDUE PAYMENTS (diffDays < 0)
    else if (diffDays < 0 && preferences.overdueReminders) {
      const daysOverdue = Math.abs(diffDays);
      let shouldAlert = true;

      if (preferences.overdueFrequency === 'every_2_days') {
        shouldAlert = daysOverdue % 2 === 0;
      } else if (preferences.overdueFrequency === 'every_3_days') {
        shouldAlert = daysOverdue % 3 === 0;
      }

      if (shouldAlert) {
        const title = `⚠️ Overdue Payment Alert: ${customer.name}`;
        const message = `Payment is overdue by ${daysOverdue} day${daysOverdue > 1 ? 's' : ''} (End Date: ${dueDateFormatted}). Outstanding balance: ₹${pendingAmount.toLocaleString('en-IN')}.`;
        const whatsappMessage = `Urgent Notice: Dear ${customer.name}, your Pigmy loan payment of ₹${pendingAmount.toLocaleString('en-IN')} is overdue by ${daysOverdue} day${daysOverdue > 1 ? 's' : ''} since ${dueDateFormatted}. Please contact us immediately to clear the outstanding dues.`;

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
          title,
          message,
          urgency: 'high',
          collectionUrl,
          whatsappMessage,
        });
      }
    }
  }

  // Sort: high urgency first, then overdue (oldest first), then due today, then upcoming
  return alerts.sort((a, b) => {
    if (a.urgency === 'high' && b.urgency !== 'high') return -1;
    if (a.urgency !== 'high' && b.urgency === 'high') return 1;
    return a.diffDays - b.diffDays;
  });
}

/**
 * Plays an audio chime using Web Audio API (Zero external assets needed)
 */
export function playNotificationChime(type: 'upcoming' | 'due_today' | 'overdue' | 'test' = 'test') {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (type === 'overdue') {
      // Deeper urgent two-tone
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.setValueAtTime(349.23, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } else {
      // Cheerful high fintech chime
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08); // A5
      osc.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.16); // D6
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    }
  } catch (e) {
    // Audio may fail if user has not interacted with DOM yet
  }
}

/**
 * Dispatches an OS/Browser Web Push Notification
 */
export async function dispatchWebPush(
  title: string,
  options: {
    body: string;
    tag?: string;
    url?: string;
    icon?: string;
    badge?: string;
    data?: any;
  }
): Promise<boolean> {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return false;
  }

  const defaultIcon = '/pwa-192x192.png';
  const defaultBadge = '/favicon.ico';
  const tag = options.tag || 'pigmy-notification';
  const url = options.url || '/';

  try {
    // 1. Prefer Service Worker showNotification if active
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && reg.showNotification) {
        await reg.showNotification(title, {
          body: options.body,
          icon: options.icon || defaultIcon,
          badge: options.badge || defaultBadge,
          tag,
          data: { ...options.data, url },
          vibrate: [200, 100, 200],
        } as any);
        return true;
      }
    }

    // 2. Direct Web Notification fallback
    const notification = new Notification(title, {
      body: options.body,
      icon: options.icon || defaultIcon,
      tag,
    });

    notification.onclick = () => {
      window.focus();
      if (url) {
        window.location.href = url;
      }
      notification.close();
    };

    return true;
  } catch (err) {
    console.warn('Could not display push notification:', err);
    return false;
  }
}

/**
 * Storage helpers for local notification preferences cache
 */
const PREFS_STORAGE_KEY = 'pigmy_notification_preferences';
const SHOWN_ALERTS_KEY = 'pigmy_shown_alerts_v1';

export function getCachedPreferences(): NotificationPreferences {
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_NOTIFICATION_PREFERENCES, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.error('Error reading cached preferences:', e);
  }
  return DEFAULT_NOTIFICATION_PREFERENCES;
}

export function setCachedPreferences(prefs: NotificationPreferences): void {
  try {
    localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch (e) {
    console.error('Error saving cached preferences:', e);
  }
}

export function isAlertAlreadyDispatchedToday(alertId: string): boolean {
  try {
    const raw = localStorage.getItem(SHOWN_ALERTS_KEY);
    const set: string[] = raw ? JSON.parse(raw) : [];
    return set.includes(alertId);
  } catch {
    return false;
  }
}

export function markAlertDispatched(alertId: string): void {
  try {
    const raw = localStorage.getItem(SHOWN_ALERTS_KEY);
    let list: string[] = raw ? JSON.parse(raw) : [];
    list.push(alertId);
    // Keep last 150 items to avoid storage growth
    if (list.length > 150) {
      list = list.slice(-150);
    }
    localStorage.setItem(SHOWN_ALERTS_KEY, JSON.stringify(list));
  } catch (e) {
    console.error('Error recording dispatched alert:', e);
  }
}
