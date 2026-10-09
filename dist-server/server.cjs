var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_url = require("url");
var import_vite = require("vite");
var import_firebase_admin = __toESM(require("firebase-admin"), 1);
var import_node_cron = __toESM(require("node-cron"), 1);
var import_dotenv = __toESM(require("dotenv"), 1);
var import_meta = {};
import_dotenv.default.config();
var currentFilename = typeof import_meta !== "undefined" && import_meta.url ? (0, import_url.fileURLToPath)(import_meta.url) : typeof __filename !== "undefined" ? __filename : "";
var currentDirname = typeof __dirname !== "undefined" ? __dirname : import_path.default.dirname(currentFilename);
function parseFirebaseServiceAccount(raw) {
  if (!raw) return null;
  let str = raw.trim();
  if (!str.startsWith("{") && !str.startsWith('"') && !str.startsWith("'")) {
    try {
      const decoded = Buffer.from(str, "base64").toString("utf-8");
      if (decoded.trim().startsWith("{")) {
        str = decoded.trim();
      }
    } catch {
    }
  }
  if (str.startsWith('"') && str.endsWith('"') || str.startsWith("'") && str.endsWith("'")) {
    try {
      const unquoted = JSON.parse(str);
      if (typeof unquoted === "object" && unquoted !== null) {
        if (unquoted.private_key) {
          unquoted.private_key = unquoted.private_key.replace(/\\n/g, "\n");
        }
        return unquoted;
      }
      str = unquoted;
    } catch {
      str = str.slice(1, -1);
    }
  }
  try {
    const parsed = JSON.parse(str);
    if (parsed && typeof parsed === "object") {
      if (parsed.private_key) {
        parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
      }
      return parsed;
    }
  } catch {
    try {
      const parsed = new Function(`"use strict"; return (${str});`)();
      if (parsed && typeof parsed === "object") {
        if (parsed.private_key) {
          parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
        }
        return parsed;
      }
    } catch {
      try {
        const doubleQuoted = str.replace(/([{,]\s*)'([^']+)'(\s*:)/g, '$1"$2"$3').replace(/:\s*'([^']*)'/g, ': "$1"');
        const parsed = JSON.parse(doubleQuoted);
        if (parsed && typeof parsed === "object") {
          if (parsed.private_key) {
            parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
          }
          return parsed;
        }
      } catch {
      }
    }
  }
  return null;
}
var firebaseAdmin = null;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    const serviceAccount = parseFirebaseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT);
    if (serviceAccount && serviceAccount.project_id) {
      firebaseAdmin = import_firebase_admin.default.initializeApp({
        credential: import_firebase_admin.default.credential.cert(serviceAccount)
      });
      console.log("Firebase Admin Initialized with Service Account");
    } else {
      console.warn("FIREBASE_SERVICE_ACCOUNT could not be resolved into a valid credentials object. Falling back to default credentials.");
      try {
        firebaseAdmin = import_firebase_admin.default.initializeApp();
      } catch (err) {
        console.warn("Firebase Admin default initialization failed:", err);
      }
    }
  } catch (e) {
    console.warn("Failed to initialize Firebase Admin with service account:", e?.message || e);
    try {
      firebaseAdmin = import_firebase_admin.default.initializeApp();
    } catch (err) {
      console.warn("Firebase Admin default initialization failed:", err);
    }
  }
} else {
  try {
    firebaseAdmin = import_firebase_admin.default.initializeApp();
    console.log("Firebase Admin Initialized with Default Credentials");
  } catch (e) {
    console.warn("Firebase Admin credentials not provided. Most backend admin features will be dormant until configured.");
  }
}
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  let db = null;
  let messaging = null;
  if (import_firebase_admin.default.apps.length > 0) {
    try {
      db = import_firebase_admin.default.firestore();
    } catch (e) {
      console.warn("Firestore not available in Firebase Admin:", e);
    }
    try {
      messaging = import_firebase_admin.default.messaging();
    } catch (e) {
      console.warn("Firebase Messaging not available in Firebase Admin:", e);
    }
  }
  app.use(import_express.default.json({ limit: "512kb" }));
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });
  const isValidId = (id) => {
    return typeof id === "string" && /^[a-zA-Z0-9_\-]{1,128}$/.test(id);
  };
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
  });
  const handleWhatsAppGet = (req, res) => {
    const queryString = new URLSearchParams(req.query).toString();
    const targetUrl = `/whatsapp/callback${queryString ? `?${queryString}` : ""}`;
    return res.redirect(targetUrl);
  };
  const handleWhatsAppPost = (req, res) => {
    console.log("[WhatsApp Webhook] Received POST event:", JSON.stringify(req.body));
    return res.status(200).json({ status: "EVENT_RECEIVED", success: true });
  };
  const whatsappApiRoutes = [
    "/api/whatsapp/callback",
    "/api/whatsapp/webhook",
    "/api/whatsapp",
    "/api/callback",
    "/api/webhook"
  ];
  whatsappApiRoutes.forEach((route) => {
    app.get(route, handleWhatsAppGet);
    app.post(route, handleWhatsAppPost);
  });
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
  app.post("/api/tokens", async (req, res) => {
    const { token, userId } = req.body;
    if (!token || !userId) return res.status(400).json({ error: "Missing token or userId" });
    if (!isValidId(userId) || typeof token !== "string" || token.length > 512) {
      return res.status(400).json({ error: "Invalid userId or token format" });
    }
    if (!db) return res.status(503).json({ error: "Database not connected" });
    try {
      await db.collection("users").doc(userId).collection("fcmTokens").doc(token).set({
        token,
        updatedAt: import_firebase_admin.default.firestore.FieldValue.serverTimestamp(),
        deviceInfo: String(req.headers["user-agent"] || "").slice(0, 255)
      });
      res.json({ success: true });
    } catch (error) {
      console.error("Error storing token:", error);
      res.status(500).json({ error: "Failed to store token" });
    }
  });
  app.post("/api/notifications/test", async (req, res) => {
    const { userId, token } = req.body;
    if (!userId) return res.status(400).json({ error: "Missing userId" });
    if (!isValidId(userId) || token && (typeof token !== "string" || token.length > 512)) {
      return res.status(400).json({ error: "Invalid userId or token format" });
    }
    if (!messaging) return res.status(503).json({ error: "Messaging not configured" });
    try {
      const title = "\u{1F514} Payment Reminder Test";
      const body = "Push notifications are active for Pigmy Collection! You will receive timely alerts for upcoming and overdue customer payments.";
      if (token) {
        await messaging.send({
          token,
          notification: { title, body },
          data: { click_action: "/settings" },
          webpush: {
            notification: {
              icon: "/pwa-192x192.png",
              badge: "/favicon.ico"
            }
          }
        });
      } else {
        await sendNotificationToUser(userId, title, body, { click_action: "/settings" });
      }
      res.json({ success: true, message: "Test notification dispatched" });
    } catch (error) {
      console.error("Error sending test notification:", error);
      res.status(500).json({ error: "Failed to send test notification" });
    }
  });
  const sendNotificationToUser = async (userId, title, body, data = {}) => {
    if (!db || !messaging) return;
    try {
      const tokensSnap = await db.collection("users").doc(userId).collection("fcmTokens").get();
      const tokens = tokensSnap.docs.map((d) => d.id);
      if (tokens.length === 0) return;
      const message = {
        tokens,
        notification: { title, body },
        data: { ...data, click_action: data.click_action || "/dashboard" },
        webpush: {
          notification: {
            icon: "/pwa-192x192.png",
            badge: "/favicon.ico"
          }
        }
      };
      const response = await messaging.sendEachForMulticast(message);
      if (response.failureCount > 0) {
        const failedTokens = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            failedTokens.push(tokens[idx]);
          }
        });
        const CHUNK_SIZE = 400;
        for (let i = 0; i < failedTokens.length; i += CHUNK_SIZE) {
          const chunk = failedTokens.slice(i, i + CHUNK_SIZE);
          const cleanupBatch = db.batch();
          chunk.forEach((t) => {
            cleanupBatch.delete(db.collection("users").doc(userId).collection("fcmTokens").doc(t));
          });
          await cleanupBatch.commit();
        }
      }
    } catch (error) {
      console.error(`Error sending notification to user ${userId}:`, error);
    }
  };
  const checkPaymentsAndRemind = async () => {
    if (!db) return;
    console.log("Running Payment Reminders & Due Date Check...");
    try {
      const usersSnap = await db.collection("users").get();
      const now = /* @__PURE__ */ new Date();
      const todayDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const userList = usersSnap.docs.map((d) => d.id);
      if (userList.length === 0) userList.push("admin_user");
      let cachedRootCustomers = null;
      for (const userId of userList) {
        let customersSnap = await db.collection("users").doc(userId).collection("customers").where("isDeleted", "==", false).get();
        let customerList = [];
        if (!customersSnap.empty) {
          customerList = customersSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        } else {
          if (!cachedRootCustomers) {
            const rootSnap = await db.collection("customers").where("isDeleted", "==", false).get();
            cachedRootCustomers = rootSnap.docs;
          }
          customerList = cachedRootCustomers.map((doc) => ({ id: doc.id, ...doc.data() }));
        }
        let prefs = {
          enabled: true,
          upcomingReminders: true,
          upcomingReminderDays: [3, 1, 0],
          overdueReminders: true,
          minimumPendingAmount: 0
        };
        try {
          const prefDoc = await db.collection("users").doc(userId).collection("settings").doc("notifications").get();
          if (prefDoc.exists) {
            prefs = { ...prefs, ...prefDoc.data() };
          }
        } catch (e) {
        }
        if (!prefs.enabled) continue;
        const upcomingList = [];
        const dueTodayList = [];
        const overdueList = [];
        customerList.forEach((c) => {
          const pending = c.pending !== void 0 ? c.pending : (c.loan || 0) - (c.paid || 0);
          if (pending <= (prefs.minimumPendingAmount || 0)) return;
          if (!c.endDate) return;
          const endDateTime = new Date(c.endDate);
          const endDateOnly = new Date(endDateTime.getFullYear(), endDateTime.getMonth(), endDateTime.getDate()).getTime();
          const diffDays = Math.round((endDateOnly - todayDateOnly) / (1e3 * 60 * 60 * 24));
          if (diffDays > 0 && prefs.upcomingReminders && prefs.upcomingReminderDays.includes(diffDays)) {
            upcomingList.push({ ...c, diffDays, pending });
          } else if (diffDays === 0 && prefs.upcomingReminders && prefs.upcomingReminderDays.includes(0)) {
            dueTodayList.push({ ...c, diffDays: 0, pending });
          } else if (diffDays < 0 && prefs.overdueReminders) {
            overdueList.push({ ...c, diffDays, daysOverdue: Math.abs(diffDays), pending });
          }
        });
        if (dueTodayList.length > 0) {
          const totalPending = dueTodayList.reduce((s, c) => s + c.pending, 0);
          const title = `\u{1F6A8} Loan Due Today (${dueTodayList.length})`;
          const body = `${dueTodayList.length === 1 ? dueTodayList[0].name : `${dueTodayList.length} customers`} maturity date is today! Total \u20B9${totalPending.toLocaleString("en-IN")}.`;
          await sendNotificationToUser(userId, title, body, {
            type: "due_today",
            click_action: "/notifications?filter=due_soon"
          });
        }
        if (upcomingList.length > 0) {
          const totalPending = upcomingList.reduce((s, c) => s + c.pending, 0);
          const title = `\u23F3 Payment Reminders (${upcomingList.length} Upcoming)`;
          const body = `${upcomingList.length} customer loan${upcomingList.length > 1 ? "s are" : " is"} approaching end date. Total \u20B9${totalPending.toLocaleString("en-IN")}.`;
          await sendNotificationToUser(userId, title, body, {
            type: "upcoming",
            click_action: "/notifications?filter=due_soon"
          });
        }
        if (overdueList.length > 0) {
          const totalPending = overdueList.reduce((s, c) => s + c.pending, 0);
          const title = `\u26A0\uFE0F Overdue Payment Alert (${overdueList.length})`;
          const body = `${overdueList.length} customer${overdueList.length > 1 ? "s are" : ""} past maturity end date. Outstanding \u20B9${totalPending.toLocaleString("en-IN")}.`;
          await sendNotificationToUser(userId, title, body, {
            type: "overdue",
            click_action: "/notifications?filter=overdue"
          });
        }
      }
    } catch (err) {
      console.error("Error in checkPaymentsAndRemind:", err);
    }
  };
  app.post("/api/notifications/scan-and-trigger", async (req, res) => {
    if (!db) return res.status(503).json({ error: "Database not connected" });
    try {
      await checkPaymentsAndRemind();
      res.json({ success: true, message: "Payment check completed" });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  const checkUnsettledAndRemind = async () => {
    if (!db) return;
    console.log("Running Unsettled check...");
    try {
      const usersSnap = await db.collection("users").get();
      const userList = usersSnap.docs.map((d) => d.id);
      if (userList.length === 0) userList.push("admin_user");
      let cachedRootEntries = null;
      for (const userId of userList) {
        let entriesSnap = await db.collection("users").doc(userId).collection("entries").where("status", "==", "unsettled").where("isDeleted", "==", false).get();
        let entriesList = [];
        if (!entriesSnap.empty) {
          entriesList = entriesSnap.docs;
        } else {
          if (!cachedRootEntries) {
            const rootSnap = await db.collection("entries").where("status", "==", "unsettled").where("isDeleted", "==", false).get();
            cachedRootEntries = rootSnap.docs;
          }
          entriesList = cachedRootEntries;
        }
        let count = 0;
        let total = 0;
        entriesList.forEach((doc) => {
          const tx = doc.data();
          count++;
          total += tx.amount;
        });
        if (count > 0) {
          const title = "\u{1F4D1} Unsettled Ledger Reminder";
          const body = `You have ${count} unsettled entries totaling \u20B9${total.toLocaleString("en-IN")}. Tap to clear.`;
          await sendNotificationToUser(userId, title, body, { type: "unsettled" });
        }
      }
    } catch (err) {
      console.error("Error in checkUnsettledAndRemind:", err);
    }
  };
  import_node_cron.default.schedule("0 9 * * *", async () => {
    console.log("Morning reminder trigger");
    await checkPaymentsAndRemind();
  }, { timezone: "Asia/Kolkata" });
  import_node_cron.default.schedule("0 19 * * *", async () => {
    console.log("Evening summary trigger");
    await checkUnsettledAndRemind();
  }, { timezone: "Asia/Kolkata" });
  import_node_cron.default.schedule("0 * * * *", async () => {
    await checkPaymentsAndRemind();
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
    app.use("*", async (req, res, next) => {
      if (req.method === "GET" && !req.path.startsWith("/api/")) {
        try {
          const template = import_fs.default.readFileSync(import_path.default.join(process.cwd(), "index.html"), "utf-8");
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
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath, {
      maxAge: "1y",
      immutable: true,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith(".html")) {
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        }
      }
    }));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
