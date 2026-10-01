# Android Mobile Lock, Biometric & Face Authentication Plan

Comprehensive security architecture to protect Pigmy Pro with Android native Biometric Authentication (Fingerprint, Face Unlock) and Android System Device Lock (PIN, Pattern, Password), enforced on app cold launch and every resume from background.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> The following user preferences were confirmed in Phase 1 and govern the authentication flow:
> - **Enforcement Trigger**: App cold start and every time the application returns to the foreground from background/multitasking.
> - **Fallback Mechanism**: Direct Android Device System Lock credentials (Device PIN / Pattern / Password) through native `BiometricPrompt` device credential fallback (`DEVICE_CREDENTIAL | BIOMETRIC_STRONG`).
> - **Privacy Guard**: Native and web blur overlay shield active during backgrounding to prevent sensitive financial ledgers from leaking in the Android app switcher.

---

## 1. Overview & Core Concept

- **What It Does**: Secures all daily collection records, ledger adjustments, customer balance sheets, and cash summaries behind the device's hardware-backed biometric security (Fingerprint / Face Unlock / Iris) with immediate fallback to the Android device PIN/Pattern screen lock.
- **Target Audience**: Field collection agents, bank officers, and administrators who carry financial and sensitive customer balance data on their Android devices.
- **Key Value**: Zero unauthorized access if the device is lost, shared, or left unattended.

---

## 2. User Experience & Visual Design

```
┌─────────────────────────────────────────────────────────┐
│               Pigmy Pro Biometric Lock Screen           │
│                                                         │
│    ┌───────────────────────────────────────────────┐    │
│    │               [ Pigmy Pro Logo ]              │    │
│    │           Smart Collection Security           │    │
│    │                                               │    │
│    │               ┌───────────────┐               │    │
│    │               │  (  ◎ 🛡️ ◎  ) │               │    │
│    │               │  Touch Sensor │               │    │
│    │               │   or Face ID  │               │    │
│    │               └───────────────┘               │    │
│    │                                               │    │
│    │         "Verify your identity to unlock"      │    │
│    │                                               │    │
│    │        ┌─────────────────────────────┐        │    │
│    │        │  [ Unlock with Biometrics ] │        │    │
│    │        └─────────────────────────────┘        │    │
│    │                                               │    │
│    │        ┌─────────────────────────────┐        │    │
│    │        │ [ Use Device PIN / Pattern ]│        │    │
│    │        └─────────────────────────────┘        │    │
│    └───────────────────────────────────────────────┘    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

- **Lock Screen UI**: Sleek, distraction-free fintech security curtain featuring emerald neon ambient lighting, animated biometric pulses, and instant prompt triggers.
- **Background Privacy Shield**: When the app transitions to the background (app switcher / home button pressed), a secure opaque backdrop obscures financial customer lists and collection totals.
- **Instant Resume Authentication**: When brought back to the foreground, the native Android `BiometricPrompt` dialogue immediately triggers.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Native BiometricPrompt with Device Credential Support**:
  - *Chosen Approach*: Configure `@capgo/capacitor-native-biometric` (or `@capacitor-community/biometric-auth`) with `useFallback: true` and `BIOMETRIC_STRONG | DEVICE_CREDENTIAL` flags on Android so that users who don't have biometric enrolled can seamlessly use their phone's PIN/Pattern.
  - *Why*: Direct compliance with Android 10+ Keystore guidelines and zero friction for agents without fingerprint hardware.
- **Decision 2: Web / Browser Preview Fallback**:
  - *Chosen Approach*: In web browser preview environments (where native Android Keystore is unavailable), provide WebAuthn / TouchID / Windows Hello fallback alongside an intuitive simulated device credential test prompt so developers and administrators can test lock flows seamlessly.
  - *Why*: Ensures 100% functional fidelity both inside the Android APK and in the web preview.

---

## 4. Technical Architecture & Security Lifecycle

```
       [ App Launch / Android Resume from Background ]
                              │
                              ▼
                 [ App State Check (Is Locked?) ]
                 ┌────────────┴────────────┐
             [ No ]                      [ Yes ]
               │                           │
               ▼                           ▼
        [ Normal View ]          [ Render Security Shield ]
                                           │
                                           ▼
                            [ Trigger BiometricPrompt ]
                            ┌──────────────┴──────────────┐
                    [ Success ]                      [ Failed / Cancelled ]
                        │                                     │
                        ▼                                     ▼
                [ Dismiss Shield ]                  [ Stay Locked / Offer ]
                [ Grant Access ]                    [ Device PIN Fallback ]
```

### Execution Steps Upon Approval:
1. **Plugin Installation**: Install `@capgo/capacitor-native-biometric` & `@capacitor/app` for native hardware keystore access and Android lifecycle events (`appStateChange`).
2. **Android Permissions**: Ensure `USE_BIOMETRIC` and `USE_FINGERPRINT` permissions in `AndroidManifest.xml`.
3. **Biometric Security Service & Context**: Create `src/services/biometricService.ts` and `src/context/SecurityContext.tsx` to handle authentication state, hardware capabilities check, background lock timers, and native prompt invocation.
4. **App Integration**: Wrap the main application layout in the security guard and add a dedicated "Security & Biometrics" control inside the Settings drawer.
5. **Compilation & Native Android Sync**: Verify compilation with `compile_applet` and run `npx cap sync android`.
