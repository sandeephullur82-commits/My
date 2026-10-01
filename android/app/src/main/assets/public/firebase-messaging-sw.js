// Scripts for firebase messaging service worker
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// Initialize Firebase app in the service worker
firebase.initializeApp({
  apiKey: "AIzaSyDummyKeyForServiceWorkerBackground",
  authDomain: "pigmy-collection-app.firebaseapp.com",
  projectId: "pigmy-collection-app",
  storageBucket: "pigmy-collection-app.appspot.com",
  messagingSenderId: "377803922713",
  appId: "1:377803922713:web:995b2c5b3f3f4f0ab94645"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);
  const notificationTitle = payload.notification?.title || payload.data?.title || 'Pigmy Pro Alert';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || 'New collection notification received.',
    icon: '/pwa-192x192.png',
    badge: '/favicon.ico',
    tag: payload.data?.tag || 'pigmy-alert',
    data: payload.data || { click_action: '/entry' },
    vibrate: [200, 100, 200]
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.click_action || event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
