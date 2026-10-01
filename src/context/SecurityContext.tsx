import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { biometricService, BiometricStatus } from '../services/biometricService';

interface SecurityContextType {
  isLocked: boolean;
  setIsLocked: (val: boolean) => void;
  lockNow: () => void;
  unlockNow: () => void;
  
  // Biometric & Mobile Lock
  biometricStatus: BiometricStatus | null;
  biometricsEnabled: boolean;
  setBiometricsEnabled: (enabled: boolean) => void;
  authenticateWithBiometrics: (reason?: string) => Promise<{ success: boolean; error?: string }>;
  isAuthenticating: boolean;
  
  // Backward compatible In-App PIN
  hasPin: boolean;
  setPin: (pin: string | null) => void;
  verifyPin: (pin: string) => { success: boolean; cooldown?: number };
  failedAttempts: number;
  cooldownUntil: number | null;
}

const SecurityContext = createContext<SecurityContextType | undefined>(undefined);

export function SecurityProvider({ children }: { children: React.ReactNode }) {
  // Biometric / Device lock is enabled by default
  const [biometricsEnabled, setBiometricsEnabledState] = useState<boolean>(() => biometricService.isBiometricEnabled());
  const [pin, setInternalPin] = useState<string | null>(() => localStorage.getItem('app_pin'));
  
  // App starts locked if either biometrics or PIN is active
  const [isLocked, setIsLocked] = useState<boolean>(() => {
    const bioEnabled = biometricService.isBiometricEnabled();
    const hasExistingPin = !!localStorage.getItem('app_pin');
    return bioEnabled || hasExistingPin;
  });

  const [biometricStatus, setBiometricStatus] = useState<BiometricStatus | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  
  const lastActiveTimestamp = useRef(Date.now());
  const isPromptingRef = useRef(false);

  // Initialize biometric status on mount
  useEffect(() => {
    let isMounted = true;
    biometricService.checkAvailability().then((status) => {
      if (isMounted) {
        setBiometricStatus(status);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const authenticateWithBiometrics = useCallback(async (reason?: string): Promise<{ success: boolean; error?: string }> => {
    if (isPromptingRef.current) {
      return { success: false, error: 'Authentication already in progress' };
    }
    
    isPromptingRef.current = true;
    setIsAuthenticating(true);
    
    try {
      const result = await biometricService.authenticate({
        title: 'Pigmy Pro Authentication',
        reason: reason || 'Unlock Pigmy Pro Smart Collection Ledger'
      });

      if (result.success) {
        setIsLocked(false);
        setFailedAttempts(0);
        setCooldownUntil(null);
        return { success: true };
      } else {
        return { success: false, error: result.error };
      }
    } finally {
      setIsAuthenticating(false);
      isPromptingRef.current = false;
    }
  }, []);

  const setBiometricsEnabled = (enabled: boolean) => {
    biometricService.setBiometricEnabled(enabled);
    setBiometricsEnabledState(enabled);
    if (!enabled && !pin) {
      setIsLocked(false);
    }
  };

  const lockNow = () => {
    setIsLocked(true);
  };

  const unlockNow = () => {
    setIsLocked(false);
  };

  // Capacitor App Lifecycle: Background to Foreground detection
  useEffect(() => {
    let removeAppListener: (() => void) | undefined;

    if (Capacitor.isNativePlatform()) {
      CapacitorApp.addListener('appStateChange', async (state) => {
        if (!state.isActive) {
          // App went into background or multitasking view
          lastActiveTimestamp.current = Date.now();
        } else {
          // App returned to foreground
          const shouldLock = biometricService.isLockOnBackgroundEnabled() && 
            (biometricService.isBiometricEnabled() || !!localStorage.getItem('app_pin'));
          
          if (shouldLock) {
            setIsLocked(true);
            // Prompt automatically on returning to foreground
            setTimeout(() => {
              authenticateWithBiometrics();
            }, 300);
          }
        }
      }).then(handle => {
        removeAppListener = () => handle.remove();
      });
    }

    // Web visibility change fallback
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        lastActiveTimestamp.current = Date.now();
      } else if (document.visibilityState === 'visible') {
        const diff = Date.now() - lastActiveTimestamp.current;
        const shouldLock = biometricService.isLockOnBackgroundEnabled() && 
          (biometricsEnabled || !!pin);
        
        // When switching tabs or returning to browser window
        if (shouldLock && diff > 1500) {
          setIsLocked(true);
        }
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (removeAppListener) removeAppListener();
      window.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [biometricsEnabled, pin, authenticateWithBiometrics]);

  // Backward-compatible In-App PIN logic
  const setPin = (newPin: string | null) => {
    if (newPin) {
      localStorage.setItem('app_pin', newPin);
    } else {
      localStorage.removeItem('app_pin');
      if (!biometricsEnabled) {
        setIsLocked(false);
      }
    }
    setInternalPin(newPin);
  };

  const verifyPin = (input: string) => {
    if (cooldownUntil && Date.now() < cooldownUntil) {
      return { success: false, cooldown: Math.ceil((cooldownUntil - Date.now()) / 1000) };
    }

    if (input === pin) {
      setIsLocked(false);
      setFailedAttempts(0);
      setCooldownUntil(null);
      return { success: true };
    }

    const newAttempts = failedAttempts + 1;
    setFailedAttempts(newAttempts);

    if (newAttempts >= 5) {
      const cooldown = Date.now() + 30000;
      setCooldownUntil(cooldown);
      setTimeout(() => setFailedAttempts(0), 30000);
      return { success: false, cooldown: 30 };
    }

    return { success: false };
  };

  return (
    <SecurityContext.Provider value={{ 
      isLocked, 
      setIsLocked,
      lockNow,
      unlockNow,
      biometricStatus,
      biometricsEnabled,
      setBiometricsEnabled,
      authenticateWithBiometrics,
      isAuthenticating,
      hasPin: !!pin, 
      setPin, 
      verifyPin,
      failedAttempts,
      cooldownUntil
    }}>
      {children}
    </SecurityContext.Provider>
  );
}

export const useSecurity = () => {
  const context = useContext(SecurityContext);
  if (!context) throw new Error('useSecurity must be used within SecurityProvider');
  return context;
};
