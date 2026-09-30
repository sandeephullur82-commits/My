import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import admin from "firebase-admin";
import cron from "node-cron";
import dotenv from "dotenv";

dotenv.config();

const currentFilename = typeof import.meta !== 'undefined' && import.meta.url ? fileURLToPath(import.meta.url) : (typeof __filename !== 'undefined' ? __filename : '');
const currentDirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(currentFilename);

// Helper to parse Firebase Service Account JSON supporting single quotes, base64, and escaped strings
function parseFirebaseServiceAccount(raw?: string): any {
  if (!raw) return null;
  let str = raw.trim();

  // 1. Check if base64 encoded
  if (!str.startsWith('{') && !str.startsWith('"') && !str.startsWith("'")) {
    try {
      const decoded = Buffer.from(str, 'base64').toString('utf-8');
      if (decoded.trim().startsWith('{')) {
        str = decoded.trim();
      }
    } catch {
      // ignore
    }
  }

  // 2. Strip outer enclosing quotes if stringified twice
  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    try {
      const unquoted = JSON.parse(str);
      if (typeof unquoted === 'object' && unquoted !== null) {
        if (unquoted.private_key) {
          unquoted.private_key = unquoted.private_key.replace(/\\n/g, '\n');
        }
        return unquoted;
      }
      str = unquoted;
    } catch {
      str = str.slice(1, -1);
    }
  }

  // 3. Attempt standard JSON.parse
  try {
    const parsed = JSON.parse(str);
    if (parsed && typeof parsed === 'object') {
      if (parsed.private_key) {
        parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
      }
      return parsed;
    }
  } catch {
    // 4. Handle JS object literal / single-quoted JSON (e.g., {'type': 'service_account', ...})
    try {
      const parsed = new Function(`"use strict"; return (${str});`)();
      if (parsed && typeof parsed === 'object') {
        if (parsed.private_key) {
          parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
        }
        return parsed;
      }
    } catch {
      // 5. Try regex normalization of quotes
      try {
        const doubleQuoted = str
          .replace(/([{,]\s*)'([^']+)'(\s*:)/g, '$1"$2"$3')
          .replace(/:\s*'([^']*)'/g, ': "$1"');
        const parsed = JSON.parse(doubleQuoted);
        if (parsed && typeof parsed === 'object') {
          if (parsed.private_key) {
            parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
          }
          return parsed;
        }
      } catch {
        // give up
      }
    }
  }
  return null;
}

// Initialize Firebase Admin
let firebaseAdmin: admin.app.App | null = null;

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    const serviceAccount = parseFirebaseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT);
    if (serviceAccount && serviceAccount.project_id) {
      firebaseAdmin = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log("Firebase Admin Initialized with Service Account");
    } else {
      console.warn("FIREBASE_SERVICE_ACCOUNT could not be resolved into a valid credentials object. Falling back to default credentials.");
      try {
        firebaseAdmin = admin.initializeApp();
      } catch (err) {
        console.warn("Firebase Admin default initialization failed:", err);
      }
    }
  } catch (e: any) {
    console.warn("Failed to initialize Firebase Admin with service account:", e?.message || e);
    try {
      firebaseAdmin = admin.initializeApp(); 
    } catch (err) {
      console.warn("Firebase Admin default initialization failed:", err);
    }
  }
} else {
  // Basic initialization if no service account
  try {
    firebaseAdmin = admin.initializeApp();
    console.log("Firebase Admin Initialized with Default Credentials");
  } catch (e) {
    console.warn("Firebase Admin credentials not provided. Most backend admin features will be dormant until configured.");
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  let db: admin.firestore.Firestore | null = null;
  let messaging: admin.messaging.Messaging | null = null;

  if (admin.apps.length > 0) {
    try {
      db = admin.firestore();
    } catch (e) {
      console.warn("Firestore not available in Firebase Admin:", e);
    }
    try {
      messaging = admin.messaging();
    } catch (e) {
      console.warn("Firebase Messaging not available in Firebase Admin:", e);
    }
  }

  // API Routes
  app.use(express.json());

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // WhatsApp Redirect Callback Handler (GET)
  const handleWhatsAppGet = (req: express.Request, res: express.Response) => {
    // Browser redirect callback: safely route back to the client callback page
    const queryString = new URLSearchParams(req.query as Record<string, string>).toString();
    const targetUrl = `/whatsapp/callback${queryString ? `?${queryString}` : ""}`;
    return res.redirect(targetUrl);
  };

  // WhatsApp Webhook & Callback Event Receiver (POST)
  const handleWhatsAppPost = (req: express.Request, res: express.Response) => {
    console.log("[WhatsApp Webhook] Received POST event:", JSON.stringify(req.body));
    return res.status(200).json({ status: "EVENT_RECEIVED", success: true });
  };

  const whatsappApiRoutes = [
    "/api/whatsapp/callback",
    "/api/whatsapp/webhook",
    "/api/whatsapp",
    "/api/callback",
    "/api/webhook",
  ];

  whatsappApiRoutes.forEach((route) => {
    app.get(route, handleWhatsAppGet);
    app.post(route, handleWhatsAppPost);
  });

  // Serve Messaging Service Worker with injected environment variables
  app.get("/firebase-messaging-sw.js", (req, res) => {
    const swContent = `
      importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
      importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

      firebase.initializeApp({
        apiKey: "${process.env.VITE_FIREBASE_API_KEY}",
        authDomain: "${process.env.VITE_FIREBASE_AUTH_DOMAIN}",
        projectId: "${process.env.VITE_FIREBASE_PROJECT_ID}",
        storageBucket: "${process.env.VITE_FIREBASE_STORAGE_BUCKET}",
        messagingSenderId: "${process.env.VITE_FIREBASE_MESSAGING_SENDER_ID}",
        appId: "${process.env.VITE_FIREBASE_APP_ID}"
      });

      const messaging = firebase.messaging();

      messaging.onBackgroundMessage((payload) => {
        console.log('[firebase-messaging-sw.js] Received background message ', payload);
        const notificationTitle = payload.notification.title;
        const notificationOptions = {
          body: payload.notification.body,
          icon: '/logo.png',
          data: payload.data
        };

        self.registration.showNotification(notificationTitle, notificationOptions);
      });

      self.addEventListener('notificationclick', (event) => {
        event.notification.close();
        const urlToOpen = event.notification.data?.click_action || '/';
        event.waitUntil(
          clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            for (let i = 0; i < windowClients.length; i++) {
              const client = windowClients[i];
              if (client.url.includes(urlToOpen) && 'focus' in client) {
                return client.focus();
              }
            }
            if (clients.openWindow) {
              return clients.openWindow(urlToOpen);
            }
          })
        );
      });
    `;
    res.setHeader("Content-Type", "application/javascript");
    res.send(swContent);
  });

  // Store FCM Token
  app.post("/api/tokens", async (req, res) => {
    const { token, userId } = req.body;
    if (!token || !userId) return res.status(400).json({ error: "Missing token or userId" });
    if (!db) return res.status(503).json({ error: "Database not connected" });

    try {
      await db.collection("users").doc(userId).collection("fcmTokens").doc(token).set({
        token,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        deviceInfo: req.headers["user-agent"]
      });
      res.json({ success: true });
    } catch (error) {
      console.error("Error storing token:", error);
      res.status(500).json({ error: "Failed to store token" });
    }
  });

  // Test Notification Endpoint
  app.post("/api/notifications/test", async (req, res) => {
    const { userId, token } = req.body;
    if (!userId) return res.status(400).json({ error: "Missing userId" });
    if (!messaging) return res.status(503).json({ error: "Messaging not configured" });

    try {
      const title = "🔔 Payment Reminder Test";
      const body = "Push notifications are active for Pigmy Collection! You will receive timely alerts for upcoming and overdue customer payments.";
      
      if (token) {
        await messaging.send({
          token,
          notification: { title, body },
          data: { click_action: '/settings' },
          webpush: {
            notification: {
              icon: '/pwa-192x192.png',
              badge: '/favicon.ico',
            }
          }
        });
      } else {
        await sendNotificationToUser(userId, title, body, { click_action: '/settings' });
      }

      res.json({ success: true, message: "Test notification dispatched" });
    } catch (error) {
      console.error("Error sending test notification:", error);
      res.status(500).json({ error: "Failed to send test notification" });
    }
  });

  // Helper to send notifications to a user
  const sendNotificationToUser = async (userId: string, title: string, body: string, data = {}) => {
    if (!db || !messaging) return;
    try {
      const tokensSnap = await db.collection("users").doc(userId).collection("fcmTokens").get();
      const tokens = tokensSnap.docs.map(d => d.id);

      if (tokens.length === 0) return;

      const message: admin.messaging.MulticastMessage = {
        tokens,
        notification: { title, body },
        data: { ...data, click_action: (data as any).click_action || '/dashboard' },
        webpush: {
          notification: {
            icon: '/pwa-192x192.png',
            badge: '/favicon.ico'
          }
        }
      };

      const response = await messaging.sendEachForMulticast(message);
      
      // Clean up invalid tokens
      if (response.failureCount > 0) {
        const failedTokens: string[] = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            failedTokens.push(tokens[idx]);
          }
        });
        
        const cleanupBatch = db.batch();
        failedTokens.forEach(t => {
          cleanupBatch.delete(db.collection("users").doc(userId).collection("fcmTokens").doc(t));
        });
        await cleanupBatch.commit();
      }
    } catch (error) {
      console.error(`Error sending notification to user ${userId}:`, error);
    }
  };

  // Triggers Logic: Evaluates upcoming due dates and overdue payments based on customer 'endDate' and 'pending'
  const checkPaymentsAndRemind = async () => {
    if (!db) return;
    console.log("Running Payment Reminders & Due Date Check...");
    try {
      const usersSnap = await db.collection("users").get();
      const now = new Date();
      const todayDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

      for (const userDoc of usersSnap.docs) {
        const userId = userDoc.id;
        
        // Use standard collection query per user to avoid collectionGroup composite index errors
        const customersSnap = await db.collection("users").doc(userId).collection("customers")
          .where("isDeleted", "==", false).get();
          
        const customerList = customersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Fetch user preferences if available
        let prefs = {
          enabled: true,
          upcomingReminders: true,
          upcomingReminderDays: [3, 1, 0],
          overdueReminders: true,
          minimumPendingAmount: 0,
        };

        try {
          const prefDoc = await db.collection("users").doc(userId).collection("settings").doc("notifications").get();
          if (prefDoc.exists) {
            prefs = { ...prefs, ...prefDoc.data() };
          }
        } catch (e) {
          // fallback to defaults
        }

        if (!prefs.enabled) continue;

        const upcomingList: any[] = [];
        const dueTodayList: any[] = [];
        const overdueList: any[] = [];

        customerList.forEach((c: any) => {
          const pending = c.pending !== undefined ? c.pending : ((c.loan || 0) - (c.paid || 0));
          if (pending <= (prefs.minimumPendingAmount || 0)) return;
          if (!c.endDate) return;

          const endDateTime = new Date(c.endDate);
          const endDateOnly = new Date(endDateTime.getFullYear(), endDateTime.getMonth(), endDateTime.getDate()).getTime();
          const diffDays = Math.round((endDateOnly - todayDateOnly) / (1000 * 60 * 60 * 24));

          if (diffDays > 0 && prefs.upcomingReminders && prefs.upcomingReminderDays.includes(diffDays)) {
            upcomingList.push({ ...c, diffDays, pending });
          } else if (diffDays === 0 && prefs.upcomingReminders && prefs.upcomingReminderDays.includes(0)) {
            dueTodayList.push({ ...c, diffDays: 0, pending });
          } else if (diffDays < 0 && prefs.overdueReminders) {
            overdueList.push({ ...c, diffDays, daysOverdue: Math.abs(diffDays), pending });
          }
        });

        // 1. Dispatch Due Today alerts
        if (dueTodayList.length > 0) {
          const totalPending = dueTodayList.reduce((s, c) => s + c.pending, 0);
          const title = `🚨 Loan Due Today (${dueTodayList.length})`;
          const body = `${dueTodayList.length === 1 ? dueTodayList[0].name : `${dueTodayList.length} customers`} maturity date is today! Total ₹${totalPending.toLocaleString('en-IN')}.`;
          await sendNotificationToUser(userId, title, body, { 
            type: 'due_today',
            click_action: '/notifications?filter=due_soon' 
          });
        }

        // 2. Dispatch Upcoming Due Date alerts
        if (upcomingList.length > 0) {
          const totalPending = upcomingList.reduce((s, c) => s + c.pending, 0);
          const title = `⏳ Payment Reminders (${upcomingList.length} Upcoming)`;
          const body = `${upcomingList.length} customer loan${upcomingList.length > 1 ? 's are' : ' is'} approaching end date. Total ₹${totalPending.toLocaleString('en-IN')}.`;
          await sendNotificationToUser(userId, title, body, { 
            type: 'upcoming',
            click_action: '/notifications?filter=due_soon' 
          });
        }

        // 3. Dispatch Overdue alerts
        if (overdueList.length > 0) {
          const totalPending = overdueList.reduce((s, c) => s + c.pending, 0);
          const title = `⚠️ Overdue Payment Alert (${overdueList.length})`;
          const body = `${overdueList.length} customer${overdueList.length > 1 ? 's are' : ''} past maturity end date. Outstanding ₹${totalPending.toLocaleString('en-IN')}.`;
          await sendNotificationToUser(userId, title, body, { 
            type: 'overdue',
            click_action: '/notifications?filter=overdue' 
          });
        }
      }
    } catch (err) {
      console.error("Error in checkPaymentsAndRemind:", err);
    }
  };

  // Manual Trigger Endpoint
  app.post("/api/notifications/scan-and-trigger", async (req, res) => {
    if (!db) return res.status(503).json({ error: "Database not connected" });
    try {
      await checkPaymentsAndRemind();
      res.json({ success: true, message: "Payment check completed" });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  const checkUnsettledAndRemind = async () => {
    if (!db) return;
    console.log("Running Unsettled check...");
    try {
      const usersSnap = await db.collection("users").get();
      
      for (const userDoc of usersSnap.docs) {
        const userId = userDoc.id;
        // Use standard collection query per user to avoid collectionGroup composite index errors
        const entriesSnap = await db.collection("users").doc(userId).collection("entries")
          .where("status", "==", "unsettled")
          .where("isDeleted", "==", false)
          .get();
        
        let count = 0;
        let total = 0;
        
        entriesSnap.docs.forEach(doc => {
          const tx = doc.data();
          count++;
          total += tx.amount;
        });

        if (count > 0) {
          const title = "📑 Unsettled Ledger Reminder";
          const body = `You have ${count} unsettled entries totaling ₹${total.toLocaleString('en-IN')}. Tap to clear.`;
          await sendNotificationToUser(userId, title, body, { type: 'unsettled' });
        }
      }
    } catch (err) {
      console.error("Error in checkUnsettledAndRemind:", err);
    }
  };

  // Morning Reminder: 9:00 AM (Checks payments and sends daily reminders)
  cron.schedule("0 9 * * *", async () => {
    console.log("Morning reminder trigger");
    await checkPaymentsAndRemind();
  }, { timezone: "Asia/Kolkata" });

  // Evening Summary: 7:00 PM
  cron.schedule("0 19 * * *", async () => {
    console.log("Evening summary trigger");
    await checkUnsettledAndRemind();
  }, { timezone: "Asia/Kolkata" });

  // Hourly Check for Upcoming and Overdue Payments
  cron.schedule("0 * * * *", async () => {
    await checkPaymentsAndRemind();
  });

  // Vite Middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);

    // Fallback for any client route to prevent 404 in dev
    app.use("*", async (req, res, next) => {
      if (req.method === "GET" && !req.path.startsWith("/api/")) {
        try {
          const template = fs.readFileSync(path.join(process.cwd(), "index.html"), "utf-8");
          const html = await vite.transformIndexHtml(req.originalUrl || req.url, template);
          res.status(200).set({ "Content-Type": "text/html" }).end(html);
        } catch (e) {
          next(e);
        }
      } else {
        next();
      }
    });
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
