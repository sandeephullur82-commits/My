import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

interface SecurityContextType {
  isLocked: boolean;
  setIsLocked: (val: boolean) => void;
  hasPin: boolean;
  setPin: (pin: string | null) => void;
  verifyPin: (pin: string) => { success: boolean; cooldown?: number };
  failedAttempts: number;
  cooldownUntil: number | null;
}

const SecurityContext = createContext<SecurityContextType | undefined>(undefined);

export function SecurityProvider({ children }: { children: React.ReactNode }) {
  const [isLocked, setIsLocked] = useState(!!localStorage.getItem('app_pin'));
  const [pin, setInternalPin] = useState<string | null>(localStorage.getItem('app_pin'));
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const lastActiveTimestamp = useRef(Date.now());

  // Fintech Background Locking Logic
  useEffect(() => {
    if (!pin) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        lastActiveTimestamp.current = Date.now();
      } else {
        const diff = Date.now() - lastActiveTimestamp.current;
        if (diff > 5000) { // 5 seconds threshold
          setIsLocked(true);
        }
      }
    };

    const handleFocus = () => {
      // Re-check on focus
      const diff = Date.now() - lastActiveTimestamp.current;
      if (diff > 5000 && document.visibilityState === 'visible') {
        setIsLocked(true);
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [pin]);

  const setPin = (newPin: string | null) => {
    if (newPin) {
      localStorage.setItem('app_pin', newPin);
    } else {
      localStorage.removeItem('app_pin');
      setIsLocked(false);
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
      const cooldown = Date.now() + 30000; // 30 seconds cooldown
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
