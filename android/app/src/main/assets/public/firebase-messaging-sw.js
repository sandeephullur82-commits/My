// Scripts for Firebase Messaging Service Worker & Native Android Notification Handling
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// Initialize Firebase app in the service worker if not already initialized
if (typeof firebase !== 'undefined' && (!firebase.apps || !firebase.apps.length)) {
  firebase.initializeApp({
    apiKey: "AIzaSyDummyKeyForServiceWorkerBackground",
    authDomain: "pigmy-collection-app.firebaseapp.com",
    projectId: "pigmy-collection-app",
    storageBucket: "pigmy-collection-app.appspot.com",
    messagingSenderId: "377803922713",
    appId: "1:377803922713:web:995b2c5b3f3f4f0ab94645"
  });
}

let messaging = null;
try {
  if (typeof firebase !== 'undefined' && firebase.messaging) {
    messaging = firebase.messaging();
  }
} catch (e) {
  console.warn('[firebase-messaging-sw.js] Messaging init skipped:', e);
}

// Tailored Android Notification Center options builder
function buildAndroidNotificationOptions(payload) {
  const data = payload.data || {};
  const notif = payload.notification || {};
  const type = data.type || data.notification_type || 'general';

  // 1. Interactive Android Notification Center Action Buttons
  let actions = [];
  let vibrationPattern = [0, 100, 50, 100];
  let requireInteraction = false;
  const tag = `pigmy-${type}-${data.customerId || data.txId || Date.now()}`;

  switch (type) {
    case 'payment':
      actions = [
        { action: 'view_receipt', title: '🧾 View Receipt' },
        { action: 'whatsapp', title: '💬 WhatsApp' }
      ];
      vibrationPattern = [0, 120, 80, 140, 60, 200];
      break;

    case 'np':
    case 'missed':
      actions = [
        { action: 'collect_now', title: '⚡ Collect Now' },
        { action: 'whatsapp_reminder', title: '💬 Send Reminder' }
      ];
      vibrationPattern = [0, 250, 120, 250, 120, 400];
      requireInteraction = true;
      break;

    case 'overdue':
    case 'due_today':
      actions = [
        { action: 'collect_now', title: '⚡ Collect Now' },
        { action: 'call_customer', title: '📞 Call' }
      ];
      vibrationPattern = [0, 200, 100, 200, 100, 300];
      requireInteraction = true;
      break;

    case 'morning_route':
      actions = [
        { action: 'open_route', title: '🚀 Open Routes' },
        { action: 'view_dashboard', title: '📊 View Goals' }
      ];
      vibrationPattern = [0, 150, 100, 150];
      break;

    case 'evening_summary':
      actions = [
        { action: 'export_pdf', title: '📥 Export PDF' },
        { action: 'view_history', title: '📈 Ledger' }
      ];
      vibrationPattern = [0, 100, 50, 100, 50, 100];
      break;

    case 'renewal':
    case 'renewal_due':
    case 'renewal_summary':
      actions = [
        { action: 'open_renewal', title: '🔄 Review Renewal' },
        { action: 'whatsapp_renewal', title: '💬 WhatsApp' }
      ];
      vibrationPattern = [0, 200, 100, 200, 100, 300];
      requireInteraction = true;
      break;

    case 'renewal_completed':
      actions = [
        { action: 'view_dashboard', title: '📊 Dashboard' },
        { action: 'open_route', title: '🚀 Daily Route' }
      ];
      vibrationPattern = [0, 150, 80, 150];
      break;

    case 'new_loan':
      actions = [
        { action: 'open_route', title: '🚀 Daily Route' },
        { action: 'view_dashboard', title: '📊 Dashboard' }
      ];
      vibrationPattern = [0, 150, 80, 150];
      break;

    case 'renewal_rejected':
      actions = [
        { action: 'view_dashboard', title: '📊 Dashboard' }
      ];
      vibrationPattern = [0, 100, 50, 100];
      break;

    case 'sync':
      actions = [
        { action: 'view_history', title: '📋 View Ledger' }
      ];
      vibrationPattern = [0, 80, 40, 80];
      break;

    default:
      actions = [
        { action: 'open_app', title: '📱 Open App' }
      ];
      break;
  }

  return {
    body: notif.body || data.body || 'New collection update received.',
    icon: '/pwa-192x192.png',
    badge: '/notification-badge.png', // Crisp monochrome silhouette for Android status bar
    image: notif.image || data.image || undefined,
    actions: actions,
    tag: tag,
    renotify: true,
    requireInteraction: requireInteraction,
    vibrate: vibrationPattern,
    timestamp: Date.now(),
    silent: false,
    data: {
      ...data,
      click_action: data.click_action || data.url || '/entry',
      phone: data.phone || data.customerPhone,
      customerId: data.customerId,
      receiptId: data.receiptId || data.txId,
      customerName: data.customerName
    }
  };
}

if (messaging) {
  messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message:', payload);
    const notificationTitle = payload.notification?.title || payload.data?.title || 'Pigmy Pro Alert';
    const notificationOptions = buildAndroidNotificationOptions(payload);

    self.registration.showNotification(notificationTitle, notificationOptions);
  });
}

// Android Notification Center Action & Click Listener
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const action = event.action;

  let targetUrl = data.click_action || '/';

  // 1. WhatsApp Action (Direct chat with borrower from Android Notification Center)
  if (action === 'whatsapp' || action === 'whatsapp_reminder' || action === 'whatsapp_renewal') {
    const rawPhone = data.phone || '';
    const cleanPhone = String(rawPhone).replace(/[^\d]/g, '');
    const phoneWithCode = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    
    let textMsg = `Hello ${data.customerName || 'Customer'}, this is regarding your Pigmy deposit account with Pigmy Pro.`;
    if (action === 'whatsapp_reminder') {
      textMsg = `Dear ${data.customerName || 'Customer'}, your daily Pigmy deposit installment is pending. Please keep it ready or pay via UPI. Thank you!`;
    } else if (action === 'whatsapp_renewal') {
      textMsg = data.newTotalDebt
        ? `Dear ${data.customerName || 'Customer'}, your loan has been successfully renewed for Cycle #${data.cycleNumber || 2} with new total balance ₹${Number(data.newTotalDebt).toLocaleString('en-IN')}. Daily installment: ₹${Number(data.dailyInstallment || 0).toLocaleString('en-IN')}/day. Thank you!`
        : `Hello ${data.customerName || 'Customer'}, your loan tenure has completed with a pending balance of ₹${Number(data.pending || 0).toLocaleString('en-IN')}. Please contact us to renew or restructure your loan.`;
    }

    if (phoneWithCode) {
      targetUrl = `https://wa.me/${phoneWithCode}?text=${encodeURIComponent(textMsg)}`;
      event.waitUntil(clients.openWindow(targetUrl));
      return;
    }
  }

  // Open Renewal in Dashboard
  if (action === 'open_renewal') {
    targetUrl = '/';
  }

  // 2. Call Customer Action (Direct dialer prompt from Android Notification Center)
  if (action === 'call_customer' && data.phone) {
    const rawPhone = data.phone || '';
    const cleanPhone = String(rawPhone).replace(/[^\d]/g, '');
    const phoneWithCode = cleanPhone.length === 10 ? `+91${cleanPhone}` : `+${cleanPhone}`;
    targetUrl = `tel:${phoneWithCode}`;
    event.waitUntil(clients.openWindow(targetUrl));
    return;
  }

  // 3. Collect Now Action (Opens collection entry for customer)
  if (action === 'collect_now') {
    targetUrl = data.customerId ? `/entry?customerId=${data.customerId}` : '/entry';
  }

  // 4. View Receipt Action (Direct deep link to digital receipt)
  if (action === 'view_receipt') {
    targetUrl = data.receiptId ? `/transactions?receipt=${data.receiptId}` : '/transactions';
  }

  // 5. Export PDF Action
  if (action === 'export_pdf') {
    targetUrl = '/transactions?export=pdf';
  }

  // 6. Open Route Action
  if (action === 'open_route') {
    targetUrl = '/entry';
  }

  // 7. View Dashboard / History
  if (action === 'view_dashboard') {
    targetUrl = '/';
  } else if (action === 'view_history') {
    targetUrl = '/transactions';
  }

  // Focus existing open window or launch new window with deep-link
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
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
