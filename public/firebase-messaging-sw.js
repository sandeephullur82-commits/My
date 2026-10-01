// Firebase Cloud Messaging Background Service Worker
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

/* eslint-disable no-undef */
// Self-register listener for incoming background push messages
self.addEventListener('push', function (event) {
  if (event.data) {
    try {
      const payload = event.data.json();
      const notificationTitle = payload.notification?.title || payload.data?.title || 'Pigmy Collection Alert';
      const notificationOptions = {
        body: payload.notification?.body || payload.data?.body || 'New collection update received.',
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        data: payload.data || {},
        vibrate: [100, 50, 100],
      };

      event.waitUntil(
        self.registration.showNotification(notificationTitle, notificationOptions)
      );
    } catch (e) {
      console.warn('Error parsing background push:', e);
    }
  }
});

// Handle Notification Clicks and deep-link routing
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const data = event.notification.data || {};
  
  // Resolve target deep link URL based on notification type
  let targetUrl = '/dashboard';
  const type = data.type || data.alertCategory || data.notification_type;
  
  if (type === 'payment' || type === 'np' || type === 'overdue' || type === 'due_today' || type === 'upcoming') {
    if (data.customerName) {
      targetUrl = `/entry?search=${encodeURIComponent(data.customerName)}`;
    } else if (data.customerId) {
      targetUrl = `/entry?customerId=${encodeURIComponent(data.customerId)}`;
    } else {
      targetUrl = '/entry?filter=unpaid';
    }
  } else if (type === 'morning_route') {
    targetUrl = '/entry?filter=pending';
  } else if (type === 'evening_summary') {
    targetUrl = '/dashboard';
  } else if (data.click_action) {
    targetUrl = data.click_action;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
