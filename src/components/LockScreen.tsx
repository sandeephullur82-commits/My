import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Delete, ShieldCheck } from 'lucide-react';
import { useSecurity } from '../context/SecurityContext';
import { toast } from 'sonner';

export function LockScreen() {
  const { verifyPin, cooldownUntil, setIsLocked, setPin } = useSecurity();
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);

  const handleKeypad = (val: string) => {
    if (cooldownUntil && Date.now() < cooldownUntil) {
      const wait = Math.ceil((cooldownUntil - Date.now()) / 1000);
      toast.error(`Too many attempts. Wait ${wait}s`);
      return;
    }

    if (input.length >= 4) return;
    const newInput = input + val;
    setInput(newInput);
    
    if (newInput.length === 4) {
      const result = verifyPin(newInput);
      if (result.success) {
        if (navigator.vibrate) navigator.vibrate(20);
      } else {
        setError(true);
        if (result.cooldown) {
          toast.error(`Blocked: Too many failed attempts. Wait ${result.cooldown}s`);
        }
        setTimeout(() => {
          setError(false);
          setInput('');
        }, 500);
        if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
      }
    }
  };

  const handleDelete = () => {
    setInput(prev => prev.slice(0, -1));
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-between py-6 sm:py-12 px-6 relative overflow-hidden">
      {/* Background Glow - Premium visual cue */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-accent/5 rounded-full blur-[100px] pointer-events-none" />

      <motion.div 
        animate={error ? { x: [-8, 8, -6, 6, -3, 3, 0] } : {}}
        transition={{ duration: 0.4 }}
        className="flex flex-col items-center gap-5 sm:gap-8 w-full max-w-sm z-10 my-auto"
      >
        <div className="flex flex-col items-center gap-2 sm:gap-3">
          <motion.div 
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-tr from-accent to-blue-500 rounded-2xl flex items-center justify-center shadow-md shadow-accent/10"
          >
            <span className="text-white text-lg sm:text-xl font-bold tracking-wider">PP</span>
          </motion.div>
          <div className="text-center mt-1">
            <h1 className="text-base sm:text-lg font-bold text-text-primary uppercase tracking-wider">Pigmy Pro</h1>
            <p className="text-[9px] sm:text-[10px] font-bold text-text-secondary opacity-40 uppercase tracking-[0.2em] mt-1">Authorized Access Only</p>
          </div>
        </div>

        <div className="flex flex-col items-center gap-5 sm:gap-6 w-full mt-2">
          {/* PIN Indicators */}
          <div className="flex gap-4">
            {[0, 1, 2, 3].map(i => (
              <motion.div 
                key={i}
                animate={input.length > i ? { scale: [1, 1.15, 1] } : { scale: 1 }}
                className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-300 ${
                  input.length > i 
                    ? 'bg-accent border-accent shadow-[0_0_8px_rgba(37,99,235,0.5)]' 
                    : 'border-slate-300 dark:border-slate-700 bg-transparent'
                }`} 
              />
            ))}
          </div>

          <div 
            id="pin-keypad-grid"
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
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'empty', '0', 'del'].map((key, i) => {
              if (key === 'empty') {
                return (
                  <div 
                    key={i} 
                    className="w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center pointer-events-none select-none" 
                  />
                );
              }
              if (key === 'del') {
                return (
                  <button 
                    key={i} 
                    type="button"
                    onClick={handleDelete}
                    style={{
                      visibility: input.length === 0 ? 'hidden' : 'visible',
                      pointerEvents: input.length === 0 ? 'none' : 'auto'
                    }}
                    className="w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center rounded-full text-text-primary/70 dark:text-text-primary/80 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors outline-none"
                    aria-label="Delete"
                  >
                    <Delete size={20} strokeWidth={2} />
                  </button>
                );
              }
              return (
                <button 
                  key={i} 
                  type="button"
                  onClick={() => handleKeypad(key)}
                  className="w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center rounded-full bg-slate-200/60 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-lg sm:text-xl font-bold border border-slate-300/80 dark:border-slate-700/60 shadow-xs hover:bg-slate-300/80 dark:hover:bg-slate-700 outline-none transition-colors"
                >
                  {key}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              setPin(null);
              setIsLocked(false);
              toast.info('PIN security reset. Session unlocked.');
            }}
            className="text-[11px] font-bold text-accent hover:opacity-80 uppercase tracking-wider mt-4 active:scale-95 transition-all"
          >
            Reset PIN / Direct Unlock
          </button>
        </div>
      </motion.div>

      <div className="flex flex-col items-center gap-2 z-10 mt-auto">
        <div className="flex items-center gap-1.5 text-[9px] font-black text-text-secondary opacity-30 uppercase tracking-[0.2em]">
           <ShieldCheck size={12} />
           AES-256 Secured
        </div>
      </div>
    </div>
  );
}
