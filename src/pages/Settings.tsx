import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Moon, Sun, LogOut, User, 
  ShieldCheck, Palette, LayoutDashboard, 
  ChevronRight, ToggleLeft, ToggleRight, Lock, Delete
} from 'lucide-react';
import { useSecurity } from '../context/SecurityContext';
import { useTheme } from '../components/ThemeProvider';
import { useUI } from '../context/UIContext';
import { useAuth } from '../context/AuthContext';
import { useFeedback } from '../context/FeedbackContext';
import { BottomSheet } from '../components/BottomSheet';

export function Settings() {
  const { theme, toggleTheme } = useTheme();
  const { isCompact, toggleCompact } = useUI();
  const { user, logout } = useAuth();
  const { hasPin, setPin, setIsLocked } = useSecurity();
  const { toastSuccess, toastError } = useFeedback();

  const [showSetPin, setShowSetPin] = useState(false);
  const [showDisablePin, setShowDisablePin] = useState(false);

  const handleToggleLock = () => {
    if (hasPin) {
      setShowDisablePin(true);
    } else {
      setShowSetPin(true);
    }
  };

  const handleManualLock = () => {
    if (hasPin) {
      setIsLocked(true);
      toastSuccess('Session Locked', 'Access restricted until next PIN entry.');
    } else {
      toastError('Lock Failed', 'Please set a security PIN first.');
    }
  };



  return (
    <div className="px-6 py-8 flex flex-col gap-8 pb-20 animate-in fade-in duration-500">
      {/* Account Section */}
      <div className="flex flex-col items-center gap-4 py-4 px-2">
        <div className="relative group">
          <div className="w-24 h-24 bg-accent/10 border-4 border-card rounded-full flex items-center justify-center text-accent shadow-xl">
            <User size={48} strokeWidth={1.5} />
          </div>
          <div className="absolute -bottom-1 -right-1 bg-success text-white p-1.5 rounded-full border-2 border-card">
            <ShieldCheck size={14} />
          </div>
        </div>
        <div className="text-center">
          <h2 className="text-xl font-black text-text-primary tracking-tighter">Administrator</h2>
          <p className="text-[11px] font-black text-text-secondary opacity-40 uppercase tracking-[0.2em] mt-0.5">{user?.email}</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Preference Section */}
        <div>
          <h3 className="text-[10px] font-black text-text-secondary opacity-40 uppercase tracking-[0.2em] px-4 mb-3">Preferences</h3>
          <div className="bg-card rounded-[24px] border border-border/50 shadow-sm overflow-hidden p-2 space-y-1">
            <button
              onClick={toggleTheme}
              className="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-bg transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
                  <Palette size={20} />
                </div>
                <div className="text-left">
                  <p className="font-bold text-sm text-text-primary tracking-tight">Appearance</p>
                  <p className="text-[10px] font-medium text-text-secondary opacity-60 uppercase tracking-widest leading-none mt-1">
                    {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                 {theme === 'dark' ? <Moon size={18} className="text-accent" /> : <Sun size={18} className="text-warning" />}
              </div>
            </button>

            <button
              onClick={toggleCompact}
              className="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-bg transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
                  <LayoutDashboard size={20} />
                </div>
                <div className="text-left">
                  <p className="font-bold text-sm text-text-primary tracking-tight">Compact Mode</p>
                  <p className="text-[10px] font-medium text-text-secondary opacity-60 uppercase tracking-widest leading-none mt-1">
                    {isCompact ? 'High Density' : 'Standard View'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                 {isCompact ? <ToggleRight size={24} className="text-accent" /> : <ToggleLeft size={24} className="text-text-secondary opacity-30" />}
              </div>
            </button>
          </div>
        </div>

        {/* Security Section */}
        <div>
          <h3 className="text-[10px] font-black text-text-secondary opacity-40 uppercase tracking-[0.2em] px-4 mb-3">Security</h3>
          <div className="bg-card rounded-[24px] border border-border/50 shadow-sm overflow-hidden p-2 space-y-1">
            <button
              onClick={handleToggleLock}
              className="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-bg transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center">
                  <ShieldCheck size={20} />
                </div>
                <div className="text-left">
                  <p className="font-bold text-sm text-text-primary tracking-tight">App Lock</p>
                  <p className="text-[10px] font-medium text-text-secondary opacity-60 uppercase tracking-widest leading-none mt-1">
                    {hasPin ? 'PIN Enabled' : 'Security Disabled'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                 {hasPin ? <ToggleRight size={24} className="text-success" /> : <ToggleLeft size={24} className="text-text-secondary opacity-30" />}
              </div>
            </button>

            {hasPin && (
              <button
                onClick={handleManualLock}
                className="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-bg transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-zinc-500/10 text-zinc-500 flex items-center justify-center">
                    <Lock size={20} />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-sm text-text-primary tracking-tight">Lock Now</p>
                    <p className="text-[10px] font-medium text-text-secondary opacity-60 uppercase tracking-widest leading-none mt-1">Protect session immediately</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-text-secondary opacity-30" />
              </button>
            )}

            <button
              onClick={logout}
              className="w-full flex items-center justify-between p-4 rounded-2xl bg-danger/5 hover:bg-danger/10 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-danger/10 text-danger flex items-center justify-center">
                  <LogOut size={20} />
                </div>
                <div className="text-left">
                  <p className="font-bold text-sm text-danger tracking-tight">Sign Out</p>
                  <p className="text-[10px] font-medium text-danger/60 uppercase tracking-widest leading-none mt-1">End active session</p>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>

      <div className="text-center pb-8 opacity-20">
         <p className="text-[9px] font-black uppercase tracking-[0.5em] select-none cursor-default">Pigmy Pro Engine v1.2.0</p>
      </div>

      <PinSetupSheet isOpen={showSetPin} onClose={() => setShowSetPin(false)} />
      <PinDisableSheet isOpen={showDisablePin} onClose={() => setShowDisablePin(false)} />

      {/* disabled content */}


    </div>
  );
}

function PinSetupSheet({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { setPin } = useSecurity();
  const { toastSuccess, toastError } = useFeedback();
  const [step, setStep] = useState<'enter' | 'confirm'>('enter');
  const [firstPin, setFirstPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStep('enter');
      setFirstPin('');
      setConfirmPin('');
      setError(false);
    }
  }, [isOpen]);

  const currentPin = step === 'enter' ? firstPin : confirmPin;

  const handleKeypad = (val: string) => {
    if (currentPin.length >= 4) return;
    const nextVal = currentPin + val;
    
    if (step === 'enter') {
      setFirstPin(nextVal);
      if (nextVal.length === 4) {
        setTimeout(() => {
          setStep('confirm');
        }, 200);
      }
    } else {
      setConfirmPin(nextVal);
      if (nextVal.length === 4) {
        if (firstPin === nextVal) {
          setPin(nextVal);
          toastSuccess('Security Active', 'App Lock has been enabled with your PIN.');
          onClose();
        } else {
          setError(true);
          toastError('Error', 'PIN codes do not match.');
          if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
          setTimeout(() => {
            setConfirmPin('');
            setError(false);
          }, 800);
        }
      }
    }
  };

  const handleDelete = () => {
    if (step === 'enter') {
      setFirstPin(prev => prev.slice(0, -1));
    } else {
      setConfirmPin(prev => prev.slice(0, -1));
    }
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="App Lock Setup"
      subtitle={step === 'enter' ? "Set a new 4-digit PIN" : "Verify your secure PIN"}
      maxWidth="max-w-[420px]"
    >
      <div className="flex flex-col items-center justify-center w-full max-w-[420px] mx-auto py-2">
        <div className="text-center mb-3">
          <p className="text-xs font-semibold text-text-secondary opacity-70">
            {step === 'enter' ? 'Choose a memorable access PIN' : 'Re-enter PIN to confirm security'}
          </p>
        </div>

        <motion.div 
          animate={error ? { x: [-10, 10, -10, 10, 0] } : {}}
          className="flex gap-4 my-2"
        >
          {[0, 1, 2, 3].map(i => (
            <div 
              key={i}
              className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-200 ${
                currentPin.length > i 
                  ? 'bg-accent border-accent scale-110 shadow-sm shadow-accent/40' 
                  : 'border-text-secondary/30 bg-transparent'
              }`} 
            />
          ))}
        </motion.div>

        <div 
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '16px',
            justifyItems: 'center',
            alignItems: 'center',
            width: 'fit-content',
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
          className="w-fit mx-auto mt-6 flex-shrink-0"
        >
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'empty', '0', 'del'].map((key, index) => {
            if (key === 'empty') {
              return (
                <div 
                  key={index} 
                  className="w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center pointer-events-none select-none" 
                />
              );
            }
            if (key === 'del') {
              return (
                <button
                  key={index}
                  type="button"
                  onClick={handleDelete}
                  style={{
                    visibility: (step === 'enter' ? firstPin.length : confirmPin.length) === 0 ? 'hidden' : 'visible',
                    pointerEvents: (step === 'enter' ? firstPin.length : confirmPin.length) === 0 ? 'none' : 'auto'
                  }}
                  className="w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center rounded-full text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors outline-none"
                >
                  <Delete size={20} />
                </button>
              );
            }
            return (
              <button
                key={index}
                type="button"
                onClick={() => handleKeypad(key)}
                className="w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-lg sm:text-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700/60 shadow-xs transition-colors outline-none"
              >
                {key}
              </button>
            );
          })}
        </div>

        {step === 'confirm' && (
          <button 
            type="button"
            onClick={() => {
              setStep('enter');
              setConfirmPin('');
            }}
            className="text-[10px] font-black uppercase tracking-widest text-accent mt-4 hover:opacity-85"
          >
            ← Back to set PIN
          </button>
        )}
      </div>
    </BottomSheet>
  );
}

function PinDisableSheet({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { verifyPin, setPin } = useSecurity();
  const { toastSuccess, toastError } = useFeedback();
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setInput('');
      setError(false);
    }
  }, [isOpen]);

  const handleKeypad = (val: string) => {
    if (input.length >= 4) return;
    const nextVal = input + val;
    setInput(nextVal);

    if (nextVal.length === 4) {
      const result = verifyPin(nextVal);
      if (result.success) {
        setPin(null);
        toastSuccess('Security Removed', 'PIN protection has been disabled.');
        onClose();
      } else {
        setError(true);
        toastError('Incorrect PIN', 'The security PIN you entered is invalid.');
        if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
        setTimeout(() => {
          setInput('');
          setError(false);
        }, 800);
      }
    }
  };

  const handleDelete = () => {
    setInput(prev => prev.slice(0, -1));
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Disable App Lock"
      subtitle="Enter your 4-digit PIN"
      maxWidth="max-w-[420px]"
    >
      <div className="flex flex-col items-center justify-center w-full max-w-[420px] mx-auto py-2">
        <div className="text-center mb-3">
          <p className="text-xs font-semibold text-text-secondary opacity-70">
            For security reasons, verify your current PIN.
          </p>
        </div>

        <motion.div 
          animate={error ? { x: [-10, 10, -10, 10, 0] } : {}}
          className="flex gap-4 my-2"
        >
          {[0, 1, 2, 3].map(i => (
            <div 
              key={i}
              className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-200 ${
                input.length > i 
                  ? 'bg-danger border-danger scale-110 shadow-sm shadow-danger/40' 
                  : 'border-text-secondary/30 bg-transparent'
              }`} 
            />
          ))}
        </motion.div>

        <div 
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '16px',
            justifyItems: 'center',
            alignItems: 'center',
            width: 'fit-content',
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
          className="w-fit mx-auto mt-6 flex-shrink-0"
        >
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'empty', '0', 'del'].map((key, index) => {
            if (key === 'empty') {
              return (
                <div 
                  key={index} 
                  className="w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center pointer-events-none select-none" 
                />
              );
            }
            if (key === 'del') {
              return (
                <button
                  key={index}
                  type="button"
                  onClick={handleDelete}
                  style={{
                    visibility: input.length === 0 ? 'hidden' : 'visible',
                    pointerEvents: input.length === 0 ? 'none' : 'auto'
                  }}
                  className="w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center rounded-full text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors outline-none"
                >
                  <Delete size={20} />
                </button>
              );
            }
            return (
              <button
                key={index}
                type="button"
                onClick={() => handleKeypad(key)}
                className="w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-lg sm:text-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700/60 shadow-xs transition-colors outline-none"
              >
                {key}
              </button>
            );
          })}
        </div>
      </div>
    </BottomSheet>
  );
}
