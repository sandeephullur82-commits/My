import React, { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useRealtimeData } from '../hooks/useRealtimeData';
import { useFeedback } from './FeedbackContext';
import { useAuth } from './AuthContext';
import { useNavigate } from 'react-router-dom';
import { messaging } from '../lib/firebase';
import { getToken, onMessage } from 'firebase/messaging';
import { firestoreService } from '../services/firestoreService';
import {
  NotificationPreferences,
  DEFAULT_NOTIFICATION_PREFERENCES,
  PaymentAlert,
  evaluatePaymentAlerts,
  playNotificationChime,
  dispatchWebPush,
  getCachedPreferences,
  setCachedPreferences,
  isAlertAlreadyDispatchedToday,
  markAlertDispatched,
} from '../services/notificationService';

interface NotificationContextType {
  preferences: NotificationPreferences;
  updatePreferences: (newPrefs: Partial<NotificationPreferences>) => Promise<void>;
  permissionStatus: NotificationPermission;
  requestPermission: () => Promise<boolean>;
  isSupported: boolean;
  fcmToken: string | null;
  alerts: PaymentAlert[];
  upcomingAlerts: PaymentAlert[];
  dueTodayAlerts: PaymentAlert[];
  overdueAlerts: PaymentAlert[];
  triggerScanAndNotify: (manual?: boolean) => Promise<{ upcoming: number; dueToday: number; overdue: number }>;
  sendTestNotification: () => Promise<boolean>;
}

const NotificationContext = createContext<NotificationContextType>({
  preferences: DEFAULT_NOTIFICATION_PREFERENCES,
  updatePreferences: async () => {},
  permissionStatus: 'default',
  requestPermission: async () => false,
  isSupported: false,
  fcmToken: null,
  alerts: [],
  upcomingAlerts: [],
  dueTodayAlerts: [],
  overdueAlerts: [],
  triggerScanAndNotify: async () => ({ upcoming: 0, dueToday: 0, overdue: 0 }),
  sendTestNotification: async () => false,
});

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { customers, loading } = useRealtimeData();
  const { toastAction, toastSuccess, toastError } = useFeedback();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [preferences, setPreferences] = useState<NotificationPreferences>(getCachedPreferences);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>('default');
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  const initialScanDoneRef = useRef(false);

  // Check Notification API support & initial permission
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setIsSupported(true);
      setPermissionStatus(Notification.permission);
    }
  }, []);

  // Fetch user preferences from Firestore on auth change
  useEffect(() => {
    if (!user) return;
    let isMounted = true;

    firestoreService.getNotificationPreferences(user.uid).then((remote) => {
      if (isMounted && remote) {
        const merged = { ...DEFAULT_NOTIFICATION_PREFERENCES, ...remote };
        setPreferences(merged);
        setCachedPreferences(merged);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [user]);

  // Update preferences helper
  const updatePreferences = useCallback(
    async (partial: Partial<NotificationPreferences>) => {
      setPreferences((prev) => {
        const updated = { ...prev, ...partial };
        setCachedPreferences(updated);
        if (user) {
          firestoreService.saveNotificationPreferences(user.uid, updated);
        }
        return updated;
      });
    },
    [user]
  );

  // Request Notification Permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      toastError('Not Supported', 'This browser does not support push notifications.');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      setPermissionStatus(permission);

      if (permission === 'granted') {
        toastSuccess('Notifications Enabled', 'You will receive reminders for upcoming and overdue payments.');
        // Play gentle chime to confirm
        playNotificationChime('test');
        // Initialize FCM token if possible
        initFCM();
        return true;
      } else if (permission === 'denied') {
        toastError('Notifications Blocked', 'Please enable notifications in your browser/site settings.');
        return false;
      }
      return false;
    } catch (err) {
      console.error('Failed to request notification permission:', err);
      return false;
    }
  }, [toastSuccess, toastError]);

  // FCM Token Initialization
  const initFCM = useCallback(async () => {
    if (!user || permissionStatus !== 'granted') return;
    try {
      const msg = messaging();
      if (!msg) return;

      const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
      const token = await getToken(msg, vapidKey ? { vapidKey } : undefined);
      if (token) {
        setFcmToken(token);
        // Register token with backend server
        fetch('/api/tokens', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, userId: user.uid }),
        }).catch((e) => console.warn('Could not register FCM token with server:', e));
      }
    } catch (e) {
      console.warn('FCM registration skipped or not supported:', e);
    }
  }, [user, permissionStatus]);

  useEffect(() => {
    if (permissionStatus === 'granted' && user) {
      initFCM();
    }
  }, [permissionStatus, user, initFCM]);

  // Foreground FCM listener
  useEffect(() => {
    const msg = messaging();
    if (!msg) return;

    const unsubscribe = onMessage(msg, (payload) => {
      const title = payload.notification?.title || 'Pigmy Payment Alert';
      const body = payload.notification?.body || 'New collection update received.';
      const clickUrl = payload.data?.click_action || '/entry?filter=pending';

      if (preferences.enableSound) playNotificationChime('test');
      if (preferences.enableVibration && navigator.vibrate) navigator.vibrate([100, 50, 100]);

      toastAction({
        title,
        message: body,
        label: 'Open',
        priority: 'high',
        type: 'warning',
        onCommit: () => {
          navigate(clickUrl);
        },
      });
    });

    return () => unsubscribe();
  }, [preferences, toastAction, navigate]);

  // Dynamic evaluation of current active alerts
  const allAlerts = useMemo(() => {
    if (loading || customers.length === 0) return [];
    return evaluatePaymentAlerts(customers, preferences);
  }, [customers, preferences, loading]);

  const upcomingAlerts = useMemo(
    () => allAlerts.filter((a) => a.alertType === 'upcoming'),
    [allAlerts]
  );

  const dueTodayAlerts = useMemo(
    () => allAlerts.filter((a) => a.alertType === 'due_today'),
    [allAlerts]
  );

  const overdueAlerts = useMemo(
    () => allAlerts.filter((a) => a.alertType === 'overdue'),
    [allAlerts]
  );

  // Trigger evaluation and dispatch alerts (automated or manual)
  const triggerScanAndNotify = useCallback(
    async (manual = false): Promise<{ upcoming: number; dueToday: number; overdue: number }> => {
      const currentAlerts = evaluatePaymentAlerts(customers, preferences);
      const upcoming = currentAlerts.filter((a) => a.alertType === 'upcoming').length;
      const dueToday = currentAlerts.filter((a) => a.alertType === 'due_today').length;
      const overdue = currentAlerts.filter((a) => a.alertType === 'overdue').length;

      if (!preferences.enabled) {
        return { upcoming: 0, dueToday: 0, overdue: 0 };
      }

      let soundPlayed = false;
      let hasDispatched = false;

      for (const alert of currentAlerts) {
        // In automated mode, check if already dispatched today to avoid spamming
        if (!manual && isAlertAlreadyDispatchedToday(alert.id)) {
          continue;
        }

        hasDispatched = true;

        // 1. Dispatch System Web Push if enabled and permitted
        if (preferences.notifyChannels.webPush && permissionStatus === 'granted') {
          dispatchWebPush(alert.title, {
            body: alert.message,
            tag: alert.id,
            url: alert.collectionUrl,
          });
        }

        // 2. Dispatch In-App Alert and record to Firestore Notification Center
        if (preferences.notifyChannels.inApp) {
          if (user) {
            firestoreService.addNotification(user.uid, {
              type: alert.urgency === 'high' ? 'critical' : 'warning',
              priority: alert.urgency,
              title: alert.title,
              message: alert.message,
              amount: alert.pendingAmount,
              customerName: alert.customerName,
              customerPhone: alert.customerPhone,
              customerId: alert.customerId,
              alertCategory: alert.alertType,
              dueDate: alert.endDate ? new Date(alert.endDate).getTime() : undefined,
              diffDays: alert.diffDays,
              timestamp: Date.now(),
            });
          }

          toastAction({
            title: alert.title,
            message: alert.message,
            label: 'Collect Now',
            priority: alert.urgency,
            type: alert.alertType === 'overdue' ? 'error' : alert.alertType === 'due_today' ? 'warning' : 'info',
            onCommit: () => {
              navigate(alert.collectionUrl);
            },
          });
        }

        // Play chime once for batch
        if (!soundPlayed && preferences.enableSound) {
          playNotificationChime(alert.alertType);
          soundPlayed = true;
        }

        if (preferences.enableVibration && navigator.vibrate) {
          navigator.vibrate([100, 50, 100]);
        }

        markAlertDispatched(alert.id);
      }

      // If manual scan was triggered and no individual alerts matched
      if (manual && !hasDispatched) {
        toastSuccess('Scan Completed', 'All customers are up to date! No pending payments require immediate reminder.');
        if (preferences.enableSound) playNotificationChime('test');
      }

      return { upcoming, dueToday, overdue };
    },
    [customers, preferences, permissionStatus, user, toastAction, toastSuccess, navigate]
  );

  // Send interactive test push notification
  const sendTestNotification = useCallback(async (): Promise<boolean> => {
    let granted = permissionStatus === 'granted';

    if (!granted) {
      granted = await requestPermission();
      if (!granted) return false;
    }

    const testTitle = '🔔 Payment Reminder Test';
    const testBody = 'Push notifications are active! You will receive timely alerts for upcoming and overdue customer loan collections.';

    // 1. Web push
    dispatchWebPush(testTitle, {
      body: testBody,
      tag: `test-notification-${Date.now()}`,
      url: '/settings',
    });

    // 2. Audio & Haptics
    if (preferences.enableSound) playNotificationChime('test');
    if (preferences.enableVibration && navigator.vibrate) navigator.vibrate([80, 40, 80]);

    // 3. In-App Toast & Store
    toastSuccess('Notification Dispatched', 'Test alert sent! Check your system notification banner.');

    if (user) {
      firestoreService.addNotification(user.uid, {
        type: 'info',
        priority: 'medium',
        title: testTitle,
        message: testBody,
        alertCategory: 'general',
        timestamp: Date.now(),
      });
    }

    // 4. Also trigger server push if FCM token is registered
    if (fcmToken && user) {
      fetch('/api/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid, token: fcmToken }),
      }).catch((e) => console.warn('Server test push note:', e));
    }

    return true;
  }, [permissionStatus, requestPermission, preferences, toastSuccess, user, fcmToken]);

  // Initial automated check on data load
  useEffect(() => {
    if (loading || customers.length === 0 || initialScanDoneRef.current) return;
    initialScanDoneRef.current = true;

    // Small delay on app open so UI renders cleanly before checking
    const timer = setTimeout(() => {
      triggerScanAndNotify(false);
    }, 3500);

    return () => clearTimeout(timer);
  }, [loading, customers, triggerScanAndNotify]);

  // Periodic background check every 30 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      triggerScanAndNotify(false);
    }, 30 * 60 * 1000);

    return () => clearInterval(interval);
  }, [triggerScanAndNotify]);

  return (
    <NotificationContext.Provider
      value={{
        preferences,
        updatePreferences,
        permissionStatus,
        requestPermission,
        isSupported,
        fcmToken,
        alerts: allAlerts,
        upcomingAlerts,
        dueTodayAlerts,
        overdueAlerts,
        triggerScanAndNotify,
        sendTestNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotificationCenter = () => useContext(NotificationContext);
