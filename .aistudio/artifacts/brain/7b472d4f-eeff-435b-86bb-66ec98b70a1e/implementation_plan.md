# Complete Android Removal & Pure PWA Architecture

Transition PigmyPro to a pure, lightweight Progressive Web App (PWA) by completely removing all Android native directories (`android/`, `android-app/`), APK build scripts, and download mechanisms, while elevating the mobile PWA installation experience into an installable, standalone web application.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> Based on your confirmed choices in Phase 1:
> - **Removal Scope**: All Android native directories (`android/`, `android-app/`), APK generation scripts (`scripts/generate-apk.py`), GitHub Actions APK workflows (`.github/workflows/`), and server APK download endpoints will be permanently removed.
> - **Mobile Installation**: Replaced with a streamlined, zero-friction **PWA Home Screen Installation** experience featuring a prominent top banner, dedicated Settings install card, and browser menu fallback guidance for Chrome/Android and Safari/iOS.

- **Confirmed Decision 1**: Eliminate native Android compilation overhead and sideloading errors. Android users will install PigmyPro directly through Chrome's native WebAPK engine with one click (no "unknown sources" security warnings, no parsing errors).
- **Confirmed Decision 2**: Preserve all collector workflows (offline receipt printing, daily pigmy collections, SMS/WhatsApp sharing, biometric app lock via WebAuthn, and cloud sync) powered by web standards.

---

## 1. Overview & Core Concept

- **What It Does**: PigmyPro becomes a 100% web-native, offline-first Progressive Web App. Field agents can open the app URL on any smartphone or tablet, tap **Install App**, and have PigmyPro installed directly onto their home screen and app drawer as a standalone native app.
- **Target Audience / Persona**: Pigmy collection agents, cooperative bank field staff, and microfinance field officers working in rural or urban markets.
- **Key Value**:
  - Zero sideloading hurdles or APK parse errors.
  - Automatic updates on every launch without manual APK re-downloads.
  - Complete offline resilience using IndexedDB and Service Worker precaching.
  - Clean codebase with no heavy Java/Gradle build dependencies.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **First-Time Mobile Visitor**:
   - Agent opens `https://ais-pre-...run.app` in Chrome on Android (or Safari on iOS).
   - An elegant top install banner appears: **"Install Pigmy Pro on Phone • Offline Ready"** with a direct **[Install App]** CTA button.
   - Tapping **[Install App]** triggers Chrome's native WebAPK installation modal.
   - PigmyPro appears in the agent's Android app launcher alongside other native applications.
2. **Standalone Operation**:
   - Once installed and launched from the home screen, the browser address bar and navigation controls are completely hidden (`display: standalone`).
   - The install banner automatically suppresses itself.
   - PigmyPro runs in full-screen mode with bottom navigation bar ergonomics and local offline cache.
3. **Settings & Device Information**:
   - The Settings page displays a clean **App Mode & Installation** card showing active standalone status or quick installation controls.
   - All references to `.apk` files, sideloading, or GitHub Actions builds are eliminated.

### Visual Identity & Theme
- **Aesthetic Direction**: High-contrast, utilitarian fintech interface tailored for outdoor daylight readability and single-thumb touch operation.
- **Color Palette**:
  - Primary: Deep Indigo / Slate (`#0f172a`, `#4f46e5`)
  - Accent / Growth: Emerald (`#10b981`)
  - Warning / Overdue: Amber (`#f59e0b`)
  - Surface: High-contrast card elevations (`bg-card`, `border-border/50`) with no static pill capsules or decorative clutter.
- **Touch Ergonomics**:
  - All touch targets strictly $\ge 44 \times 44\text{px}$ to prevent mis-taps while walking in markets.
  - Top header and banner combined height stays below 15% of viewport height.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Removal of Android Native Directories (`android/` & `android-app/`)**
  - *Chosen Approach*: Delete `android/`, `android-app/`, and all `.github/workflows/` files.
  - *Why*: Eliminates 4GB+ of Gradle cache bloat, eliminates container build timeouts, and removes confusion caused by uncompiled/sideloaded `.apk` files that fail Android OS package parsing checks.
  - *Alternatives Considered*: Retaining the folders was considered, but keeping dead native code adds maintenance drag and confuses developers.
- **Decision 2: Web Standards for Native Capabilities**
  - *Chosen Approach*: Use Web Share API (`navigator.share`), Web Notifications (`Notification.requestPermission`), Web Authentication (`navigator.credentials`), and standard CSS media printing for POS thermal printers.
  - *Why*: These web APIs work natively inside modern Android Chrome and iOS Safari when installed as a PWA without needing heavy native plugin bridges.

---

## 4. Technical Architecture & Data Strategy

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       PIGMYPRO CLIENT (PWA & WEB)                           │
│                                                                             │
│  ┌─────────────────────────┐   ┌─────────────────────────────────────────┐  │
│  │   UI & Navigation       │   │           PWA Shell & Install           │  │
│  │  - Dashboard & Charts   │   │  - PWAInstallBanner (Top trigger)       │  │
│  │  - Quick Entry (Numpad) │   │  - usePWAInstall (beforeinstallprompt)  │  │
│  │  - Customer Management  │   │  - Settings App Mode Card               │  │
│  │  - Daily Ledger         │   │  - manifest.webmanifest (standalone)   │  │
│  └────────────┬────────────┘   └────────────────────┬────────────────────┘  │
│               │                                     │                       │
│  ┌────────────▼─────────────────────────────────────▼────────────────────┐  │
│  │                     Data & Persistence Layer                          │  │
│  │  - IndexedDB (Dexie / Offline Cache)                                  │  │
│  │  - Service Worker (Workbox precache of JS/CSS/Fonts)                  │  │
│  │  - Firestore Direct Sync (Real-time collections & transactions)       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTP / WS
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          EXPRESS SERVER (PORT 3000)                         │
│  - Vite Middleware (dev) / Static bundle serving (production)               │
│  - Payment schedule cron job & WhatsApp webhook callback simulations        │
│  - (APK endpoints /api/download-apk permanently removed)                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Action Plan & Tasks

1. **Delete Android Directories & Artifacts**:
   - Remove `/android/` (Capacitor Android wrapper).
   - Remove `/android-app/` (Native Jetpack Compose).
   - Remove `/.github/workflows/build-android-apk.yml` and `build-apk.yml`.
   - Remove `/scripts/generate-apk.py`.
   - Remove `/public/pigmy-pro.apk` and `/dist/pigmy-pro.apk`.
2. **Clean Server Endpoints (`server.ts`)**:
   - Remove `/api/download-apk`, `/PigmyPro.apk`, and `/pigmy-pro.apk` handlers.
3. **Clean Package Scripts (`package.json`)**:
   - Remove `"build:apk"` and `"cap:sync"` from `scripts`.
   - Remove unused Capacitor CLI scripts while maintaining web helper fallbacks.
4. **Refactor Settings & Platform UI (`src/pages/Settings.tsx` & `src/components/PWAInstallBanner.tsx`)**:
   - Remove the entire APK download button, download states, and sideloading instructions.
   - Remove the GitHub Actions CI guide.
   - Polish the "App Mode & Installation" card with standalone status detection and direct one-click PWA installation.
   - Refine `PWAInstallBanner` to provide the premier mobile install experience.
5. **Verification**:
   - Verify build with `npm run build` and `compile_applet`.
   - Verify manifest validity (`manifest.webmanifest`) and service worker generation.
