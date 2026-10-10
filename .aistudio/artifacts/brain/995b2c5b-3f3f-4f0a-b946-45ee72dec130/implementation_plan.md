# Pigmy Pro Hybrid Mobile & Android Enhancement

Streamlining daily collection operations with robust native Android and PWA receipt sharing, instant non-blocking notification feedback with one-tap undo, and seamless cross-platform installability.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural decisions were aligned during Phase 1 clarification:
> - **Notification & Undo Behavior**: Replaced artificial countdown delays with instant ledger persistence paired with a non-blocking compact toast offering a quick 2.5-second undo window.
> - **Receipt & PDF Action Streamlining**: Removed the redundant download button from the PDF modal in favor of an instant Native Share Sheet and direct WhatsApp share link, ensuring rapid customer receipts in field operations.
> - **PWA & Android Hybrid Experience**: Dual-delivery model supporting both the compiled Android APK (Capacitor/native) and an installable Progressive Web App (PWA) with smart in-app install banners and standalone mode detection.

- **Confirmed Decision 1**: Compact, non-blocking toast notifications with instant operation commits and zero artificial delay.
- **Confirmed Decision 2**: Native Android share sheet and direct WhatsApp receipt forwarding; removed standalone download button from the PDF modal.
- **Confirmed Decision 3**: Full PWA installability flow (manifest, service worker, install prompts) alongside native Android bridge integration.

---

### 1. Overview & Core Concept

- **What It Does**: Pigmy Pro is a daily collection fintech application for microfinance agents and collectors. This upgrade ensures collectors in the field can instantly share digital receipts via WhatsApp and the Android system share sheet, print receipts to thermal or system printers without errors, execute high-speed entries without waiting on notification countdown timers, and install or run the app seamlessly as either an Android APK or an offline-capable PWA.
- **Target Audience / Persona**: Daily pigmy collection agents, field cashiers, and micro-lending supervisors operating on Android smartphones or mobile web in dynamic field conditions.
- **Key Value**: Zero-latency collection speed, audit-safe ledger updates, reliable one-touch customer receipt communication, and complete flexibility between native APK and installable web app.

---

### 2. User Experience & Visual Design

- **Key User Flows**:
  1. *Collection & Instant Receipt Flow*:
     - Agent taps Cash or PhonePe on a borrower's card.
     - Transaction commits immediately to local state and Firestore (zero delay).
     - A non-blocking compact toast appears above the bottom nav (`Payment Recorded • ₹500` with an amber `Undo` pill and dismiss cross), automatically fading after 2 seconds without obstructing subsequent taps or searches.
     - The Receipt Success modal presents clear customer details, new balance, a direct green **WhatsApp** button, and a gradient **Share Image** button.
  2. *PDF Report & Export Flow*:
     - Agent opens a daily collection ledger or audit report in `PDFViewerModal`.
     - The top header provides direct action buttons: **Print** (system spooler), **WhatsApp** (formatted summary share), and **Share** (native file share sheet). The download button is removed for an uncluttered interface.
  3. *Hybrid Install & Platform Detection Flow*:
     - When opened in mobile Chrome or Safari, a clean "Install App" prompt appears in the header and Settings page.
     - Tapping "Install" launches the native browser prompt; once installed or running as an Android APK, the button automatically hides itself.

- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Utilitarian, tactile fintech interface designed for outdoor sunlight legibility and high thumb-reach ergonomics.
  - *Color Palette & Tokens*:
    - Canvas: Deep slate `bg-slate-950` / crisp light mode `bg-slate-50`.
    - Primary Accents: Emerald `text-emerald-500` / `bg-emerald-600` for confirmed payments and WhatsApp actions; Cyan/Teal for native shares.
    - Warnings & Undo: Warm amber `text-amber-400` / `bg-amber-400` for NP debt and undo controls.
  - *Typography & Hierarchy*:
    - Numbers and monetary amounts set in tabular figures (`tabular-nums`) with bold sans-serif labels.
    - Zero static pill enclosures on metadata: clean text separated by middots (`·`).
  - *Touch Ergonomics & Thumb Zones*:
    - All touch hitboxes strictly $\ge 44 \times 44\text{px}$.
    - Fixed bottom navigation stays within a 15% mobile sticky height cap.
    - Non-blocking toasts anchored at `bottom-20 md:bottom-6` with `pointer-events-none` container so background scrolling and tapping remain 100% active.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Direct File Sharing & WhatsApp Scheme Fallback**:
  - *Chosen Approach*: Multi-tier sharing engine. Tier 1: Check for Capacitor native `Share.share` with local cache URI; Tier 2: Check for Web Share API Level 2 (`navigator.canShare({ files })`); Tier 3: Direct WhatsApp URL scheme (`https://wa.me/` or `intent://`); Tier 4: Graceful document save fallback.
  - *Why*: Eliminates broken shares and redirects in Android WebView where `window.open` is frequently blocked by WebChromeClient or popup restrictions.
  - *Alternatives Considered*: Standard browser `window.open` was failing inside native Android containers.

- **Decision 2: Native Android Print Spooler vs. Web Print**:
  - *Chosen Approach*: Dual-layer print dispatch. In native Android/Capacitor, invoke `AndroidNativeApp.printCurrentPage` via the bridge or send printable bitmap/HTML via a hidden iframe adapter. In PWA/browser, invoke the system print dialog via a hidden DOM iframe rather than `window.open`.
  - *Why*: Resolves the issue where Android app users were redirected to a blank screen or a generic share sheet instead of actual printing.

- **Decision 3: Elimination of Notification Commit Waiting Delays**:
  - *Chosen Approach*: Immediate database and memory mutation upon user action. The toast is purely informational and offers an instant rollback handler (`onUndo`) rather than pausing the save operation for 3–4 seconds.
  - *Why*: Significantly speeds up field collection throughput when servicing dozens of borrowers in succession.

- **Decision 4: Removal of Download Button from PDF Viewer**:
  - *Chosen Approach*: Streamlined top action bar with Print, WhatsApp, and Native Share.
  - *Why*: Aligns with user preference; collectors share reports with bank managers or customers rather than managing loose files in device download directories.

---

### 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Pigmy Pro Application                           │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌───────────────────────┐            ┌─────────────────────────────┐  │
│  │   UI & Entry Layer    │            │   Hybrid Platform Bridge    │  │
│  │  • CustomerCard       │            │  • isNativeAndroidApp()     │  │
│  │  • ReceiptSuccessModal│            │  • isPWAStandalone()        │  │
│  │  • PDFViewerModal     │            │  • usePWAInstall Hook       │  │
│  └───────────┬───────────┘            └──────────────┬──────────────┘  │
│              │                                       │                 │
│              ▼                                       ▼                 │
│  ┌───────────────────────┐            ┌─────────────────────────────┐  │
│  │   Fast Feedback Hub   │            │   Universal Sharing Engine  │  │
│  │  • Zero-delay Commit  │            │  • Capacitor Share Plugin   │  │
│  │  • Non-blocking Toast │            │  • Web Share API (Files)    │  │
│  │  • Instant Undo Hook  │            │  • WhatsApp Intent Builder  │  │
│  └───────────┬───────────┘            │  • Android Print Spooler    │  │
│              │                        └──────────────┬──────────────┘  │
│              ▼                                       ▼                 │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │              Firestore Service & Local IndexedDB / Cache         │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

- **Universal Sharing Engine (`src/utils/capacitorDeviceHelper.ts`)**:
  - `shareFileForAndroid`: Robust file sharing supporting Capacitor `@capacitor/share`, Web Share API with `File` objects, and direct WhatsApp intent redirection.
  - `printFileForAndroid`: Native print dispatch leveraging Android `PrintManager` and clean hidden-iframe spooling for mobile web/PWA without popup blocker interference.
  - `openWhatsAppDirect`: Clean phone number sanitization (adding country code `91` if missing) and safe navigation using `window.location.href` or intent scheme instead of blocked popups.

- **PDF Action Redesign (`src/components/PDFViewerModal.tsx`)**:
  - Replaced `<Download>` button with a direct `<MessageCircle>` WhatsApp share button and `<Share2>` native share button.
  - WhatsApp share generates a clean summary message (Report Title, Period, Total Entries, Total Balance) alongside the document share.

- **Receipt Success Action Redesign (`src/components/ReceiptSuccessModal.tsx`)**:
  - Direct WhatsApp button using reliable redirect protocol.
  - Share Image button using cache file URI resolution.
  - Print button targeting thermal printer or system print spooler with verified feedback.

- **Feedback & Toast Engine (`src/context/FeedbackContext.tsx` & `src/components/FintechToast.tsx`)**:
  - Instant commit model: `onCommit` executes synchronously at event start.
  - If user taps "Undo" in the toast, the transaction is deleted/reverted from Firestore and customer balance restored immediately.
  - Toast auto-dismiss duration reduced to 2.0s with non-blocking click-through canvas.

- **PWA Integration (`src/hooks/usePWAInstall.ts` & `src/components/PWAInstallBanner.tsx`)**:
  - Capture `beforeinstallprompt` event and store deferred prompt.
  - Detect `display-mode: standalone` and Capacitor native platform to suppress install buttons when already installed.
  - Mount responsive install CTA in navigation and settings.
