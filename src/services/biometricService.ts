import { NativeBiometric, BiometryType } from '@capgo/capacitor-native-biometric';
import { Capacitor } from '@capacitor/core';

export type BiometricModality = 'FINGERPRINT' | 'FACE' | 'MULTIPLE' | 'DEVICE_CREDENTIAL' | 'NONE';

export interface BiometricStatus {
  isAvailable: boolean;
  modality: BiometricModality;
  modalityLabel: string;
  hasDeviceLock: boolean;
  isNative: boolean;
  isConfigured: boolean;
}

const STORAGE_KEYS = {
  BIOMETRIC_ENABLED: 'pigmy_biometric_enabled',
  LOCK_ON_BACKGROUND: 'pigmy_lock_on_background',
  LAST_UNLOCKED_AT: 'pigmy_last_unlocked_at'
};

class BiometricService {
  private cachedStatus: BiometricStatus | null = null;

  /**
   * Check if biometrics and device credentials are supported
   */
  async checkAvailability(): Promise<BiometricStatus> {
    const isNative = Capacitor.isNativePlatform();
    const isConfigured = this.isBiometricEnabled();

    if (!isNative) {
      // Web / PWA preview environment
      const hasWebAuthn = typeof window !== 'undefined' && 
        window.PublicKeyCredential && 
        typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function';
      
      let platformAuth = false;
      try {
        if (hasWebAuthn) {
          platformAuth = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        }
      } catch {
        platformAuth = false;
      }

      const status: BiometricStatus = {
        isAvailable: true, // Allow verification preview on web
        modality: platformAuth ? 'FINGERPRINT' : 'DEVICE_CREDENTIAL',
        modalityLabel: platformAuth ? 'Biometric / Screen Lock' : 'Mobile Screen Lock PIN/Password',
        hasDeviceLock: true,
        isNative: false,
        isConfigured
      };
      this.cachedStatus = status;
      return status;
    }

    try {
      const result = await NativeBiometric.isAvailable({ 
        useFallback: true,
        preferMultipleBiometryType: true
      });

      let modality: BiometricModality = 'NONE';
      let modalityLabel = 'Device Lock (PIN / Pattern)';

      switch (result.biometryType) {
        case BiometryType.TOUCH_ID:
        case BiometryType.FINGERPRINT:
          modality = 'FINGERPRINT';
          modalityLabel = 'Fingerprint Sensor';
          break;
        case BiometryType.FACE_ID:
        case BiometryType.FACE_AUTHENTICATION:
          modality = 'FACE';
          modalityLabel = 'Face Recognition';
          break;
        case BiometryType.MULTIPLE:
          modality = 'MULTIPLE';
          modalityLabel = 'Fingerprint & Face Unlock';
          break;
        case BiometryType.DEVICE_CREDENTIAL:
          modality = 'DEVICE_CREDENTIAL';
          modalityLabel = 'Device PIN / Pattern / Password';
          break;
        default:
          if (result.deviceIsSecure) {
            modality = 'DEVICE_CREDENTIAL';
            modalityLabel = 'Device PIN / Pattern';
          }
      }

      const status: BiometricStatus = {
        isAvailable: result.isAvailable || result.deviceIsSecure,
        modality,
        modalityLabel,
        hasDeviceLock: result.deviceIsSecure,
        isNative: true,
        isConfigured
      };

      this.cachedStatus = status;
      return status;
    } catch (err) {
      console.warn('[BiometricService] Native availability check error:', err);
      const fallback: BiometricStatus = {
        isAvailable: true,
        modality: 'DEVICE_CREDENTIAL',
        modalityLabel: 'Device Screen Lock / Biometrics',
        hasDeviceLock: true,
        isNative: true,
        isConfigured
      };
      this.cachedStatus = fallback;
      return fallback;
    }
  }

  /**
   * Prompts native Android BiometricPrompt with fallback to device credentials (PIN/Pattern)
   */
  async authenticate(options?: { reason?: string; title?: string }): Promise<{ success: boolean; error?: string }> {
    const isNative = Capacitor.isNativePlatform();

    if (!isNative) {
      // In web/desktop preview: simulate native mobile biometric & device credential unlock
      console.log('[BiometricService] Executing Web/Browser verification');
      this.recordUnlockSuccess();
      return { success: true };
    }

    try {
      await NativeBiometric.verifyIdentity({
        title: options?.title || 'Pigmy Pro Authentication',
        subtitle: 'Verify your identity to access collections',
        description: 'Use your fingerprint, face recognition, or phone screen lock',
        reason: options?.reason || 'Authorize access to Pigmy Pro smart ledger',
        useFallback: true, // Allows Android device PIN / pattern / password
        maxAttempts: 5
      });

      this.recordUnlockSuccess();
      return { success: true };
    } catch (err: any) {
      console.warn('[BiometricService] Authentication failed or cancelled:', err);
      const message = err?.message || 'Biometric authentication was cancelled or failed.';
      return { success: false, error: message };
    }
  }

  isBiometricEnabled(): boolean {
    const val = localStorage.getItem(STORAGE_KEYS.BIOMETRIC_ENABLED);
    // Enabled by default for secure field collection banking app
    return val === null ? true : val === 'true';
  }

  setBiometricEnabled(enabled: boolean): void {
    localStorage.setItem(STORAGE_KEYS.BIOMETRIC_ENABLED, enabled ? 'true' : 'false');
    if (this.cachedStatus) {
      this.cachedStatus.isConfigured = enabled;
    }
  }

  isLockOnBackgroundEnabled(): boolean {
    const val = localStorage.getItem(STORAGE_KEYS.LOCK_ON_BACKGROUND);
    return val === null ? true : val === 'true';
  }

  setLockOnBackgroundEnabled(enabled: boolean): void {
    localStorage.setItem(STORAGE_KEYS.LOCK_ON_BACKGROUND, enabled ? 'true' : 'false');
  }

  recordUnlockSuccess(): void {
    localStorage.setItem(STORAGE_KEYS.LAST_UNLOCKED_AT, Date.now().toString());
  }

  getLastUnlockedAt(): number {
    const val = localStorage.getItem(STORAGE_KEYS.LAST_UNLOCKED_AT);
    return val ? parseInt(val, 10) : 0;
  }
}

export const biometricService = new BiometricService();
