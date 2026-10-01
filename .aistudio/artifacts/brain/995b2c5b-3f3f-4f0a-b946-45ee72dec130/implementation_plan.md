# Implementation Plan: In-App Toast System & FCM-to-Capacitor Deep Linking

Build a high-performance, top-floating visual toast system for instant user feedback on collection syncs and receipts, combined with FCM foreground listener and deep-link payload routing in `notificationService.ts`.

---

## Proposed Changes

### 1. In-App Visual Toast Feedback System (`src/components/FintechToast.tsx` & `src/context/FeedbackContext.tsx`)
- **Top-Floating Interactive Banner**: Rendered in a fixed top-center viewport portal with high z-index, frosted glass backdrop, and fintech color accents (Emerald for payments, Amber for unpaid/overdue, Indigo for syncs/reports).
- **Auto-Dismiss & Interactions**:
  - 4-second default timeout with subtle countdown progress bar.
  - Pause auto-dismiss on pointer hover / touch.
  - Swipe-to-dismiss drag gestures powered by `motion/react`.
  - Action buttons (e.g. "View Ledger", "Print Receipt", "Undo", "Navigate").
  - Haptic feedback (`navigator.vibrate`) and audio chimes on event trigger.

### 2. Update `src/services/notificationService.ts`
- **FCM Foreground Listener & In-App Bridge**:
  - Listen for Web & native FCM payloads when the app is active.
  - Dispatch both native Capacitor Local Notification UI and in-app visual toast banners simultaneously.
- **Deep-Link Payload Field Mapper**:
  - Map `customerId`, `customerName`, `amount`, `paymentType`, `alertType`, `receiptId`, and `url` to targeted app views (`/entry`, `/transactions`, `/dashboard`, `/reports`).
  - Broadcast incoming push events to registered UI listeners for instant reactivity.

### 3. App-Level Sync & Receipt Feedback
- Connect collection transactions, offline queue syncs, and manual receipts so each generates crisp, non-intrusive in-app visual feedback with quick action links.

---

## Verification Plan

1. **Compilation & Linting**: Run `lint_applet` and `compile_applet`.
2. **Capacitor Sync**: Run `npx cap sync android` to ensure all native push and notification plugins are up to date.
3. **Interactive Testing**: Verify test notification triggers, foreground FCM message handling, action clicks, auto-dismiss, and swipe-to-dismiss.
