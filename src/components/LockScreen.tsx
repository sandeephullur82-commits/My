import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { 
  Fingerprint, 
  ScanFace, 
  ShieldCheck, 
  Smartphone, 
  KeyRound, 
  Delete, 
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { useSecurity } from '../context/SecurityContext';
import { toast } from 'sonner';

export function LockScreen() {
  const { 
    biometricStatus, 
    authenticateWithBiometrics, 
    isAuthenticating,
    hasPin,
    verifyPin, 
    cooldownUntil 
  } = useSecurity();

  const [inputPin, setInputPin] = useState('');
  const [showPinPad, setShowPinPad] = useState(false);
  const [errorShake, setErrorShake] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Automatically trigger Biometric / Mobile Lock Prompt on mount
  useEffect(() => {
    let timer: NodeJS.Timeout;
    timer = setTimeout(() => {
      triggerBiometricAuth();
    }, 350);

    return () => clearTimeout(timer);
  }, []);

  const triggerBiometricAuth = async () => {
    setErrorMessage(null);
    const result = await authenticateWithBiometrics('Verify your fingerprint, face, or screen lock');
    if (result.success) {
      if (navigator.vibrate) navigator.vibrate(25);
    } else if (result.error && !result.error.toLowerCase().includes('cancel')) {
      setErrorMessage(result.error);
    }
  };

  const handleKeypad = (val: string) => {
    if (cooldownUntil && Date.now() < cooldownUntil) {
      const wait = Math.ceil((cooldownUntil - Date.now()) / 1000);
      toast.error(`Too many attempts. Wait ${wait}s`);
      return;
    }

    if (inputPin.length >= 4) return;
    const nextPin = inputPin + val;
    setInputPin(nextPin);

    if (nextPin.length === 4) {
      const result = verifyPin(nextPin);
      if (result.success) {
        if (navigator.vibrate) navigator.vibrate(20);
      } else {
        setErrorShake(true);
        if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
        setTimeout(() => {
          setErrorShake(false);
          setInputPin('');
        }, 500);
      }
    }
  };

  const handleDelete = () => {
    setInputPin(prev => prev.slice(0, -1));
  };

  // Determine which icon and label to show for biometric hardware
  const modality = biometricStatus?.modality || 'FINGERPRINT';
  const isFace = modality === 'FACE';
  const isMultiple = modality === 'MULTIPLE';

  return (
    <div className="fixed inset-0 z-50 bg-[#0B132B] text-slate-100 flex flex-col justify-between py-8 px-6 overflow-y-auto">
      {/* Ambient Emerald & Cyan Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] h-[340px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-[280px] h-[280px] bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Header with App Icon */}
      <div className="flex flex-col items-center gap-3 z-10 pt-4">
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 220, damping: 18 }}
          className="relative group"
        >
          <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-2xl shadow-emerald-500/20 border border-emerald-500/30 flex items-center justify-center bg-slate-900">
            <img 
              src="/src/assets/images/android_app_icon_1790870444731.jpg" 
              alt="Pigmy Pro App Icon" 
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
              onError={(e) => {
                // Fallback to favicon or CSS
                (e.currentTarget as HTMLImageElement).src = '/favicon.png';
              }}
            />
          </div>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center shadow-md">
            <ShieldCheck size={14} strokeWidth={2.5} />
          </div>
        </motion.div>

        <div className="text-center">
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center justify-center gap-1.5">
            Pigmy Pro
          </h1>
          <p className="text-[11px] font-semibold text-emerald-400 uppercase tracking-[0.25em] mt-0.5">
            Smart Collection Security
          </p>
        </div>
      </div>

      {/* Main Authentication Center */}
      <motion.div
        animate={errorShake ? { x: [-10, 10, -8, 8, -4, 4, 0] } : {}}
        transition={{ duration: 0.4 }}
        className="flex flex-col items-center gap-6 w-full max-w-sm mx-auto my-auto z-10 py-4"
      >
        {!showPinPad ? (
          <div className="flex flex-col items-center text-center gap-6 w-full">
            {/* Biometric Interactive Pulse Sensor */}
            <div className="relative">
              <motion.div
                animate={{
                  scale: [1, 1.15, 1],
                  opacity: [0.3, 0.7, 0.3]
                }}
                transition={{
                  duration: 2.2,
                  repeat: Infinity,
                  ease: 'easeInOut'
                }}
                className="absolute inset-0 rounded-full bg-emerald-500/20 blur-md"
              />

              <button
                type="button"
                onClick={triggerBiometricAuth}
                disabled={isAuthenticating}
                className="relative w-28 h-28 rounded-full bg-gradient-to-b from-slate-800 to-slate-900 border-2 border-emerald-400/40 hover:border-emerald-400 flex flex-col items-center justify-center shadow-xl shadow-emerald-500/15 active:scale-95 transition-all text-emerald-400 hover:text-emerald-300 focus:outline-none"
                aria-label="Scan Fingerprint or Face"
              >
                {isFace ? (
                  <ScanFace size={48} strokeWidth={1.5} className="animate-pulse" />
                ) : isMultiple ? (
                  <div className="flex items-center gap-1">
                    <Fingerprint size={38} strokeWidth={1.5} />
                    <ScanFace size={34} strokeWidth={1.5} />
                  </div>
                ) : (
                  <Fingerprint size={48} strokeWidth={1.5} className="animate-pulse" />
                )}
              </button>
            </div>

            <div className="space-y-1">
              <h2 className="text-base font-bold text-white tracking-wide">
                {isFace ? 'Look at screen for Face Unlock' : 'Touch Fingerprint Sensor'}
              </h2>
              <p className="text-xs text-slate-400">
                Or unlock with your Android phone PIN, Pattern, or Password
              </p>
            </div>

            {errorMessage && (
              <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs text-left max-w-xs">
                <AlertCircle size={16} className="shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col gap-3 w-full max-w-xs mt-2">
              <button
                type="button"
                onClick={triggerBiometricAuth}
                disabled={isAuthenticating}
                className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2.5 transition-all"
              >
                {isAuthenticating ? (
                  <>
                    <RefreshCw size={18} className="animate-spin" />
                    <span>Verifying Identity...</span>
                  </>
                ) : (
                  <>
                    <Smartphone size={18} />
                    <span>Unlock with Biometrics / Phone Lock</span>
                  </>
                )}
              </button>

              {hasPin && (
                <button
                  type="button"
                  onClick={() => setShowPinPad(true)}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 font-semibold text-xs border border-slate-700/60 flex items-center justify-center gap-2 transition-all"
                >
                  <KeyRound size={15} />
                  <span>Use 4-Digit In-App PIN</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Keypad Fallback (only shown if user explicitly tapped Use 4-Digit PIN) */
          <div className="flex flex-col items-center gap-5 w-full">
            <div className="text-center">
              <h2 className="text-sm font-bold text-white tracking-wide">Enter 4-Digit Security PIN</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">In-app master PIN verification</p>
            </div>

            {/* PIN Dots */}
            <div className="flex gap-4">
              {[0, 1, 2, 3].map(i => (
                <div
                  key={i}
                  className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-200 ${
                    inputPin.length > i
                      ? 'bg-emerald-400 border-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.6)]'
                      : 'border-slate-700 bg-transparent'
                  }`}
                />
              ))}
            </div>

            {/* Keypad Grid */}
            <div className="grid grid-cols-3 gap-3.5 w-full max-w-[260px] mx-auto mt-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'bio', '0', 'del'].map((key, i) => {
                if (key === 'bio') {
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setShowPinPad(false)}
                      className="w-14 h-14 mx-auto rounded-full bg-slate-800/60 hover:bg-slate-700 text-emerald-400 flex items-center justify-center border border-slate-700/50 active:scale-95 transition-all"
                      title="Back to Biometrics"
                    >
                      <Fingerprint size={22} />
                    </button>
                  );
                }
                if (key === 'del') {
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={handleDelete}
                      className="w-14 h-14 mx-auto rounded-full bg-slate-800/60 hover:bg-slate-700 text-slate-300 flex items-center justify-center border border-slate-700/50 active:scale-95 transition-all"
                      title="Delete"
                    >
                      <Delete size={20} />
                    </button>
                  );
                }
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleKeypad(key)}
                    className="w-14 h-14 mx-auto rounded-full bg-slate-800 hover:bg-slate-700 text-white text-lg font-bold flex items-center justify-center border border-slate-700 active:scale-95 transition-all shadow-sm"
                  >
                    {key}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setShowPinPad(false)}
              className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 underline mt-2"
            >
              Back to Mobile Lock & Biometrics
            </button>
          </div>
        )}
      </motion.div>

      {/* Security Footer */}
      <div className="flex flex-col items-center gap-1 z-10 pb-2">
        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          <ShieldCheck size={13} className="text-emerald-400" />
          <span>Android Keystore • BiometricPrompt Guarded</span>
        </div>
        <p className="text-[9px] text-slate-500 font-mono">
          Hardware-backed encryption active
        </p>
      </div>
    </div>
  );
}
