import { Capacitor } from '@capacitor/core';
import { LocalNotifications, Channel } from '@capacitor/local-notifications';
import { PushNotifications, Token, ActionPerformed, PushNotificationSchema } from '@capacitor/push-notifications';
import { messaging, db, auth } from '../lib/firebase';
import { getToken, onMessage, MessagePayload } from 'firebase/messaging';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Customer } from './firestoreService';
import { differenceInDays, parseISO, isValid } from 'date-fns';

export interface NotificationSettings {
  enableNotifications: boolean;
  notifyPayments: boolean;
  notifyNP: boolean;
  notifyMorningRoute: boolean;
  notifyEveningSummary: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
}

export interface NotificationLog {
  id: string;
  title: string;
  body: string;
  timestamp: number;
  type: 'payment' | 'np' | 'morning_route' | 'evening_summary' | 'test' | 'push' | 'sync';
  data?: Record<string, any>;
}

export interface NotificationPreferences {
  enabled: boolean;
  notifyChannels: {
    webPush: boolean;
    inApp: boolean;
    email?: boolean;
  };
  upcomingDaysBefore: number;
  enableSound: boolean;
  enableVibration: boolean;
  enableUpcomingAlerts: boolean;
  enableDueTodayAlerts: boolean;
  enableOverdueAlerts: boolean;
  dailyReminderHour: number;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  enabled: true,
  notifyChannels: {
    webPush: true,
    inApp: true,
  },
  upcomingDaysBefore: 2,
  enableSound: true,
  enableVibration: true,
  enableUpcomingAlerts: true,
  enableDueTodayAlerts: true,
  enableOverdueAlerts: true,
  dailyReminderHour: 9,
};

export interface PaymentAlert {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  amountDue: number;
  pendingAmount: number;
  dailyInstallment: number;
  alertType: 'upcoming' | 'due_today' | 'overdue';
  type: 'upcoming' | 'due_today' | 'overdue';
  title: string;
  message: string;
  collectionUrl: string;
  urgency: 'high' | 'medium' | 'low';
  daysOverdue?: number;
  daysRemaining?: number;
  dueDate: string;
  endDate: string;
  diffDays: number;
}

export type ForegroundNotificationCallback = (payload: {
  title: string;
  body: string;
  data?: Record<string, any>;
  deepLinkUrl?: string;
  type?: 'payment' | 'np' | 'morning_route' | 'evening_summary' | 'test' | 'push' | 'sync';
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

export function playNotificationChime(type: 'upcoming' | 'due_today' | 'overdue' | 'test' | 'push' = 'test'): void {
  try {
    if (typeof window === 'undefined') return;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
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
      osc.type = 'triangle';
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
  preferences: NotificationPreferences
): PaymentAlert[] {
  const alerts: PaymentAlert[] = [];
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  customers.forEach((c) => {
    const loan = c.loanAmount || c.loan || 0;
    const paid = c.paid || 0;
    const pending = c.pending !== undefined ? c.pending : loan - paid;

    if (pending <= 0) return; // Fully settled

    const daily = c.durationDays && c.durationDays > 0 ? Math.round(loan / c.durationDays) : 100;
    const amountDue = Math.min(pending, daily);

    // Calculate due date based on startDate and duration
    let dueDateStr = todayStr;
    let daysRemaining = 0;
    let daysOverdue = 0;
    let diffDays = 0;

    if (c.startDate) {
      try {
        const start = typeof c.startDate === 'number' ? new Date(c.startDate) : parseISO(String(c.startDate));
        if (isValid(start)) {
          const duration = c.durationDays || 100;
          const end = new Date(start.getTime() + duration * 24 * 60 * 60 * 1000);
          dueDateStr = end.toISOString().split('T')[0];
          diffDays = differenceInDays(end, now);
          if (diffDays < 0) {
            daysOverdue = Math.abs(diffDays);
          } else {
            daysRemaining = diffDays;
          }
        }
      } catch (e) {
        // Fallback to today
      }
    }

    if (daysOverdue > 0 && preferences.enableOverdueAlerts) {
      alerts.push({
        id: `overdue_${c.id}_${todayStr}`,
        customerId: c.id,
        customerName: c.name,
        customerPhone: c.phone,
        amountDue,
        pendingAmount: pending,
        dailyInstallment: daily,
        alertType: 'overdue',
        type: 'overdue',
        title: `⚠️ Overdue Payment: ${c.name}`,
        message: `${c.name} is ${daysOverdue} days overdue. Pending balance: ₹${pending.toLocaleString('en-IN')}.`,
        collectionUrl: `/entry?search=${encodeURIComponent(c.name)}`,
        urgency: 'high',
        daysOverdue,
        dueDate: dueDateStr,
        endDate: dueDateStr,
        diffDays,
      });
    } else if (daysRemaining === 0 && preferences.enableDueTodayAlerts) {
      alerts.push({
        id: `due_${c.id}_${todayStr}`,
        customerId: c.id,
        customerName: c.name,
        customerPhone: c.phone,
        amountDue,
        pendingAmount: pending,
        dailyInstallment: daily,
        alertType: 'due_today',
        type: 'due_today',
        title: `📅 Payment Due Today: ${c.name}`,
        message: `Daily installment of ₹${amountDue.toLocaleString('en-IN')} due today.`,
        collectionUrl: `/entry?search=${encodeURIComponent(c.name)}`,
        urgency: 'medium',
        dueDate: dueDateStr,
        endDate: dueDateStr,
        diffDays: 0,
      });
    } else if (
      daysRemaining > 0 &&
      daysRemaining <= preferences.upcomingDaysBefore &&
      preferences.enableUpcomingAlerts
    ) {
      alerts.push({
        id: `upcoming_${c.id}_${todayStr}`,
        customerId: c.id,
        customerName: c.name,
        customerPhone: c.phone,
        amountDue,
        pendingAmount: pending,
        dailyInstallment: daily,
        alertType: 'upcoming',
        type: 'upcoming',
        title: `🔔 Upcoming Payment: ${c.name}`,
        message: `Maturity in ${daysRemaining} days. Current balance: ₹${pending.toLocaleString('en-IN')}.`,
        collectionUrl: `/entry?search=${encodeURIComponent(c.name)}`,
        urgency: 'low',
        daysRemaining,
        dueDate: dueDateStr,
        endDate: dueDateStr,
        diffDays,
      });
    }
  });

  return alerts;
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

  /**
   * Resolves deep link URL from payload attributes
   */
  public resolveDeepLink(data: Record<string, any> = {}): string {
    const type = data.type || data.alertCategory || data.notification_type || data.alertType || '';
    
    // Explicit custom url or click_action
    if (data.click_action && typeof data.click_action === 'string' && data.click_action.startsWith('/')) {
      return data.click_action;
    }
    if (data.url && typeof data.url === 'string' && data.url.startsWith('/')) {
      return data.url;
    }

    // Receipt / Transaction ID deep link
    if (data.receiptId || data.transactionId) {
      const id = data.receiptId || data.transactionId;
      return `/transactions?id=${encodeURIComponent(id)}`;
    }

    // Customer specific deep link
    if (data.customerName) {
      return `/entry?search=${encodeURIComponent(data.customerName)}`;
    }
    if (data.customerId) {
      return `/entry?customerId=${encodeURIComponent(data.customerId)}`;
    }

    // Category based routing
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

  /**
   * Deep-link action handler based on notification payload type
   */
  public handleNotificationDeepLink(data: Record<string, any> = {}) {
    const targetUrl = this.resolveDeepLink(data);

    if (this.customNavigate) {
      this.customNavigate(targetUrl);
    } else if (typeof window !== 'undefined') {
      window.location.hash = targetUrl.startsWith('/') ? targetUrl : `/${targetUrl}`;
    }
  }

  /**
   * Registers device push token to Firestore and the backend /api/tokens route
   */
  public async registerDeviceToken(userId: string, token: string, platform: 'web' | 'android' | 'ios' = 'web'): Promise<void> {
    if (!token || !userId) return;

    this.fcmToken = token;
    try {
      localStorage.setItem(FCM_TOKEN_CACHE_KEY, token);
    } catch {
      // ignore
    }

    // 1. Store in Firestore under users/{userId}/fcmTokens/{token}
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

    // 2. Register with backend /api/tokens endpoint
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

  /**
   * Initialize Firebase Cloud Messaging & Capacitor Native Push Notifications
   */
  public async initialize(): Promise<void> {
    if (this.initialized) return;

    // 1. Android / iOS Native Capacitor Push Notification Flow
    if (Capacitor.isNativePlatform()) {
      try {
        // Create Android Notification Channels
        const channels: Channel[] = [
          {
            id: 'collections_channel',
            name: 'Payment Collections',
            description: 'Instant alerts for Cash and UPI payment receipts',
            importance: 5, // High / Heads-up
            visibility: 1, // Public
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
          }
        ];

        for (const channel of channels) {
          try {
            await LocalNotifications.createChannel(channel);
          } catch (e) {
            console.warn(`Could not create channel ${channel.id}:`, e);
          }
        }

        // Register Push Notification Listeners
        await PushNotifications.addListener('registration', (token: Token) => {
          const currentUid = auth.currentUser?.uid || 'anonymous';
          this.registerDeviceToken(currentUid, token.value, Capacitor.getPlatform() as 'android' | 'ios');
        });

        await PushNotifications.addListener('registrationError', (error: any) => {
          console.warn('Capacitor Push registration error:', error);
        });

        // Triggered when push arrives while app is in foreground
        await PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
          const data = notification.data || {};
          const title = notification.title || 'Pigmy Collection Alert';
          const body = notification.body || 'New collection update received.';
          const deepLinkUrl = this.resolveDeepLink(data);

          this.recordLog(title, body, 'push', data);

          // Trigger in-app toast listener
          this.broadcastForegroundNotification({
            title,
            body,
            data,
            deepLinkUrl,
            type: (data.type as any) || 'push'
          });

          // Local notifications on native foreground
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

        // Request Push Registration if permitted
        const perm = await PushNotifications.checkPermissions();
        if (perm.receive === 'granted') {
          await PushNotifications.register();
        }
      } catch (err) {
        console.warn('Capacitor native push setup error:', err);
      }
    }

    // 2. Web Browser FCM Flow
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

            // Broadcast to in-app toast listeners for immediate user feedback
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
    channelId?: 'collections_channel' | 'np_alerts_channel' | 'daily_digest_channel';
    type: NotificationLog['type'];
    extra?: Record<string, any>;
  }): Promise<boolean> {
    if (!this.settings.enableNotifications) return false;

    const notifId = options.id || Math.floor(Date.now() % 100000000);
    const deepLinkUrl = this.resolveDeepLink(options.extra || {});
    this.recordLog(options.title, options.body, options.type, options.extra);

    // Broadcast to in-app feedback toasts
    this.broadcastForegroundNotification({
      title: options.title,
      body: options.body,
      data: options.extra,
      deepLinkUrl,
      type: options.type
    });

    // 1. Android Capacitor Native Path
    if (Capacitor.isNativePlatform()) {
      try {
        await LocalNotifications.schedule({
          notifications: [
            {
              id: notifId,
              title: options.title,
              body: options.body,
              channelId: options.channelId || 'collections_channel',
              smallIcon: 'ic_stat_icon_config_sample',
              iconColor: '#10b981',
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

    // 2. Web Notification / ServiceWorker Path
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          const reg = await navigator.serviceWorker.ready;
          const opts: any = {
            body: options.body,
            icon: '/pwa-192x192.png',
            badge: '/pwa-192x192.png',
            data: { ...options.extra, deepLinkUrl }
          };
          if (this.settings.vibrationEnabled) {
            opts.vibrate = [100, 50, 100];
          }
          await reg.showNotification(options.title, opts);
          return true;
        } else {
          new Notification(options.title, {
            body: options.body,
            icon: '/pwa-192x192.png'
          });
          return true;
        }
      } catch (err) {
        console.warn('Web Notification error:', err);
      }
    }

    return false;
  }

  // Instant Payment Receipt Notification
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

  // Unpaid (NP) Alert Notification
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

  // Cloud & Queue Sync Complete Notification
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

  // Morning Route Start & Daily Collection Target (08:30 AM)
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

  // End of Day Financial Summary (07:00 PM)
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

  // Test Notification Trigger
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
