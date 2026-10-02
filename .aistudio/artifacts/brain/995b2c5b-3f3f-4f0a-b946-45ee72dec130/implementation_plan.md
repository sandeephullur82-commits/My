# Standalone Offline Android App Build Plan

This plan establishes the architecture and build pipeline to package the complete React web application directly inside a standalone Android APK. The app will run locally and offline via Capacitor's native WebView bridge without requiring any web server deployment or hosting.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> The following user preferences were confirmed and govern the build pipeline:
> - **Execution Mode**: **Standalone Offline APK** — The entire compiled React bundle (HTML, JavaScript, CSS, SVGs, audio chimes, icons, and assets) will be bundled directly into the Android native assets (`android/app/src/main/assets/public/`), allowing the Android application to launch and run locally without requiring any cloud web server or internet connection.
> - **Build Output**: **Ready-to-install Debug APK** — We will run the Gradle build pipeline (`./gradlew assembleDebug`) to generate `app-debug.apk` that can be directly transferred, side-loaded, or installed on any physical Android phone or Android emulator.

---

## 1. Architecture: How the Web App Runs Inside Android Without Deployment

```
┌─────────────────────────────────────────────────────────────────┐
│                     Android Device (Phone / Tablet)             │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    Pigmy Pro Android APK                  │  │
│  │                                                           │  │
│  │  ┌───────────────────────┐     ┌───────────────────────┐  │  │
│  │  │   Android Native OS   │     │  Embedded Web Assets  │  │  │
│  │  │  - BiometricPrompt    │     │  (Inside APK Assets)  │  │  │
│  │  │  - Android Keystore   │◄───►│  - index.html         │  │  │
│  │  │  - Device PIN/Pattern │     │  - app.bundle.js      │  │  │
│  │  │  - Push & Alarms      │     │  - styles.css         │  │  │
│  │  └───────────────────────┘     └───────────────────────┘  │  │
│  │                 ▲                                         │  │
│  │                 │ Capacitor JavaScript Bridge             │  │
│  │                 ▼                                         │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │   Hardware-Accelerated Android WebView              │  │  │
│  │  │   Scheme: https://localhost (Local APK Files)       │  │  │
│  │  │   - No web server / external hosting needed         │  │  │
│  │  │   - Full React SPA with offline IndexedDB storage   │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

1. **Local WebView Asset Loader**:
   Capacitor configures Android's `WebViewAssetLoader` with a virtual scheme (`https://localhost`). When the Android app opens, it loads files directly from the app's internal read-only assets directory. There are **zero network roundtrips** to load the app UI.
2. **Offline-First Storage**:
   Customer balance records, transactions, agent preferences, and authentication states persist locally in SQLite / IndexedDB (`idb`), so agents can record daily collections even in low or no network coverage areas.
3. **Hardware Biometrics & Mobile Lock**:
   Uses the Android Keystore API and native `BiometricPrompt` with device credential fallback (Fingerprint, Face Recognition, Device PIN/Pattern) directly on the device.

---

## 2. Implementation Steps

### Step 1: Capacitor Configuration Verification
- Ensure `capacitor.config.ts` is explicitly configured for offline asset serving:
  - `webDir: 'dist'`
  - `bundledWebRuntime: false`
  - `server: { androidScheme: 'https' }`

### Step 2: Production React Asset Compilation
- Run `npm run build` (or Vite production build) to generate fully minified, optimized production JavaScript, CSS, and HTML bundles in `./dist`.

### Step 3: Capacitor Android Sync
- Run `npx cap sync android` to copy the production assets into `android/app/src/main/assets/public/` and synchronize all native Android plugins (`@capgo/capacitor-native-biometric`, `@capacitor/app`, `@capacitor/local-notifications`, `@capacitor/push-notifications`).

### Step 4: Gradle Build Execution
- Set permissions on `android/gradlew` (`chmod +x android/gradlew`).
- Check Android SDK / JDK environment variables (`ANDROID_HOME`, `JAVA_HOME`).
- Execute Gradle build: `./gradlew assembleDebug` in the `/android` directory.
- Verify the generated APK file: `android/app/build/outputs/apk/debug/app-debug.apk`.

### Step 5: Verification & Distribution
- Check APK size, package structure, and verify the manifest declarations.
- Provide clear instructions on how to install and test the APK on physical devices (via USB/ADB or direct download) or Android Studio.
