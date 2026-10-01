# Implementation Plan: FCM & Capacitor Push Notifications with Deep-Linking

Comprehensive initialization of Firebase Cloud Messaging (FCM) and Capacitor Native Push Notifications in `src/services/notificationService.ts`, complete with multi-platform device token synchronization (Firestore + backend `/api/tokens`), background push event listeners, and type-based deep linking.

---

## 1. Confirmed User Decisions

- **Token Storage Strategy**: Dual registration — Store tokens in Firestore under `users/{userId}` (and `deviceTokens` sub-collection) and register with the backend `/api/tokens` endpoint.
- **Deep Linking Behavior**:
  - `overdue` / `np` / `payment`: Deep link directly to the customer collection screen (`/entry?search={customerName}` or `/customers?id={customerId}`).
  - `morning_route`: Deep link to pending collection route (`/entry?filter=pending`).
  - `evening_summary`: Deep link to dashboard and financial reports (`/dashboard` or `/reports`).
  - Fallback: Safely navigate to `/dashboard` if the payload or target ID cannot be resolved.

---

## 2. Architecture & Notification Flow

```
                               ┌────────────────────────────────────────────────────────┐
                               │                 Incoming Push Event                    │
                               └──────────────────────────┬─────────────────────────────┘
                                                          │
                             ┌────────────────────────────┴────────────────────────────┐
                             ▼                                                         ▼
            [Native Android / Capacitor]                                  [Web Browser / PWA]
            • PushNotifications listener                                  • Service Worker (`firebase-messaging-sw.js`)
            • Background intent / notification tray                       • FCM `onMessage` / Web Push API
                             │                                                         │
                             └────────────────────────────┬────────────────────────────┘
                                                          │
                                                          ▼
                                          Notification Type Router
                 ┌────────────────────────────────────────┼──────────────────────────────────────┐
                 ▼                                        ▼                                      ▼
     [Payment / NP / Overdue]                     [Morning Route]                        [Evening Summary]
  ➔ `/entry?search={customerName}`             ➔ `/entry?tab=pending`                   ➔ `/dashboard`
```

---

## 3. Proposed Changes & Implementation Steps

### Phase 1: `src/services/notificationService.ts` Implementation
- **FCM Web Initialization**:
  - Safe import of `messaging()` from `../lib/firebase`.
  - Fetch FCM Web token with `getToken` using VAPID key (`VITE_FIREBASE_VAPID_KEY`).
  - Foreground message handler with `onMessage` dispatching chimes, vibration, and in-app feedback.
- **Capacitor Push Notifications Initialization**:
  - `PushNotifications.requestPermissions()` & `PushNotifications.register()`.
  - Event listeners:
    - `registration`: Extracts device token and triggers token registration.
    - `registrationError`: Logs error details with clear diagnostic feedback.
    - `pushNotificationReceived`: Logs to local notification history and triggers local channel chime.
    - `pushNotificationActionPerformed`: Handles notification tray click and performs type-based deep-linking.
- **Token Registration Engine**:
  - `registerDeviceToken(userId, token, platform)`:
    - Writes device token to Firestore (`users/{userId}/deviceTokens/{tokenId}`).
    - Posts token to `/api/tokens` backend endpoint.
- **Type-Based Deep-Linking Engine**:
  - `handleNotificationClick(data)`: Resolves type (`payment`, `np`, `overdue`, `morning_route`, `evening_summary`) and routes the user safely to the corresponding screen.
- **Maintain App-Wide Compatibility**:
  - Preserve all exported interfaces, helper methods (`evaluatePaymentAlerts`, `playNotificationChime`, `dispatchWebPush`, etc.), and singleton methods.

### Phase 2: Background Service Worker (`public/firebase-messaging-sw.js`)
- Ensure standard FCM service worker is present in `public/` to handle background web push events, parse custom notification payloads, and handle `notificationclick` navigation to the target route.

### Phase 3: Backend Token Route Verification
- Ensure `server.ts` exposes `/api/tokens` endpoint to persist and validate active device push tokens.

---

## 4. Verification Plan

### Automated Verification
- Run `lint_applet` to guarantee type safety with Firebase Messaging and Capacitor Push APIs.
- Run `compile_applet` to verify clean production build output.

### Interactive Device Verification
1. Open Notification Settings / Drawer and verify permissions are requested.
2. Verify token generation in console / Firestore and successful `/api/tokens` sync.
3. Test dispatch of local and push notification payload with `type: 'payment'` to verify deep linking to the customer's entry screen upon click.
