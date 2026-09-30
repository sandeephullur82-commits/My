import { useState, useEffect } from 'react';
import { messaging, auth, db } from '../lib/firebase';
import { getToken, onMessage } from 'firebase/messaging';
import { toast } from 'sonner';

export function useNotifications() {
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>('default');
  const [fcmToken, setFcmToken] = useState<string | null>(null);

  useEffect(() => {
    if ('Notification' in window) {
      setPermissionStatus(Notification.permission);
    }
  }, []);

  useEffect(() => {
    if (permissionStatus === 'granted' && auth.currentUser) {
      initializeFCM();
    }
  }, [permissionStatus, auth.currentUser]);

  const requestPermission = async () => {
    if (!('Notification' in window)) {
      toast.error('This browser does not support notifications');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      setPermissionStatus(permission);
      
      if (permission === 'granted') {
        await initializeFCM();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error requesting permission:', error);
      return false;
    }
  };

  const initializeFCM = async () => {
    try {
      const msg = messaging();
      if (!msg) return;

      const user = auth.currentUser;
      if (!user) return;

      const token = await getToken(msg, {
        vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY // User needs to set this in Secrets
      });

      if (token) {
        setFcmToken(token);
        // Register with our backend
        await fetch('/api/tokens', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, userId: user.uid })
        });
        console.log('FCM Token registered:', token);
      }
    } catch (error) {
      console.error('Error initializing FCM:', error);
    }
  };

  useEffect(() => {
    const msg = messaging();
    if (msg) {
      const unsubscribe = onMessage(msg, (payload) => {
        console.log('Received foreground message:', payload);
        toast(payload.notification?.title || 'Notification', {
          description: payload.notification?.body,
          action: {
            label: 'Open',
            onClick: () => {
              if (payload.data?.click_action) {
                window.location.href = payload.data.click_action;
              }
            }
          }
        });
      });
      return () => unsubscribe();
    }
  }, []);

  return { permissionStatus, fcmToken, requestPermission };
}
