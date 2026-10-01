import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'motion/react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  IndianRupee, 
  X, 
  ArrowRight, 
  RotateCcw,
  RefreshCw,
  Bell
} from 'lucide-react';

export interface ToastAction {
  label: string;
  onClick: () => void;
  isUndo?: boolean;
}

export interface FintechToastProps {
  id: string | number;
  type: 'success' | 'error' | 'info' | 'transaction' | 'warning' | 'critical' | 'sync';
  priority?: 'high' | 'medium' | 'low';
  title?: string;
  message?: string;
  amount?: number;
  customerName?: string;
  paymentType?: string;
  duration?: number;
  onClose: () => void;
  actions?: ToastAction[];
  action?: ToastAction;
  deepLinkUrl?: string;
  onNavigate?: (url: string) => void;
  timestamp?: number;
}

export function FintechToast({
  type,
  title,
  message,
  amount,
  customerName,
  paymentType,
  duration = 4000,
  onClose,
  action,
  actions,
  deepLinkUrl,
  onNavigate,
}: FintechToastProps) {
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(100);
  const startTimeRef = useRef<number>(Date.now());
  const remainingRef = useRef<number>(duration);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        if (type === 'error' || type === 'critical') {
          navigator.vibrate([50, 40, 50]);
        } else {
          navigator.vibrate([25, 20, 25]);
        }
      }
    } catch {
      // ignore
    }
  }, [type]);

  useEffect(() => {
    if (duration <= 0) return;

    if (!isPaused) {
      startTimeRef.current = Date.now();
      const intervalTime = 40;
      const step = (intervalTime / remainingRef.current) * 100;

      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          const next = Math.max(0, prev - step);
          if (next <= 0) {
            clearInterval(progressInterval);
          }
          return next;
        });
      }, intervalTime);

      timerRef.current = setTimeout(() => {
        clearInterval(progressInterval);
        onClose();
      }, remainingRef.current);

      return () => {
        clearInterval(progressInterval);
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    } else {
      const elapsed = Date.now() - startTimeRef.current;
      remainingRef.current = Math.max(200, remainingRef.current - elapsed);
      if (timerRef.current) clearTimeout(timerRef.current);
    }
  }, [isPaused, duration, onClose]);

  const getTheme = () => {
    switch (type) {
      case 'success':
      case 'transaction':
        return {
          bg: 'bg-slate-900/95 border-emerald-500/40 text-emerald-400',
          iconBg: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400',
          progressBar: 'bg-emerald-500',
          badgeBg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
          glow: 'shadow-emerald-950/40',
          Icon: type === 'transaction' ? IndianRupee : CheckCircle2,
          defaultTitle: type === 'transaction' ? 'Collection Recorded' : 'Success',
        };
      case 'error':
      case 'critical':
        return {
          bg: 'bg-slate-900/95 border-rose-500/40 text-rose-400',
          iconBg: 'bg-rose-500/20 border-rose-500/30 text-rose-400',
          progressBar: 'bg-rose-500',
          badgeBg: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
          glow: 'shadow-rose-950/40',
          Icon: AlertCircle,
          defaultTitle: 'Error Alert',
        };
      case 'warning':
        return {
          bg: 'bg-slate-900/95 border-amber-500/40 text-amber-400',
          iconBg: 'bg-amber-500/20 border-amber-500/30 text-amber-400',
          progressBar: 'bg-amber-500',
          badgeBg: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
          glow: 'shadow-amber-950/40',
          Icon: AlertTriangle,
          defaultTitle: 'Notice',
        };
      case 'sync':
        return {
          bg: 'bg-slate-900/95 border-sky-500/40 text-sky-400',
          iconBg: 'bg-sky-500/20 border-sky-500/30 text-sky-400',
          progressBar: 'bg-sky-500',
          badgeBg: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
          glow: 'shadow-sky-950/40',
          Icon: RefreshCw,
          defaultTitle: 'Cloud Sync Complete',
        };
      case 'info':
      default:
        return {
          bg: 'bg-slate-900/95 border-indigo-500/40 text-indigo-400',
          iconBg: 'bg-indigo-500/20 border-indigo-500/30 text-indigo-400',
          progressBar: 'bg-indigo-500',
          badgeBg: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
          glow: 'shadow-indigo-950/40',
          Icon: Bell,
          defaultTitle: 'Notification',
        };
    }
  };

  const theme = getTheme();
  const IconComponent = theme.Icon;
  const allActions = actions || (action ? [action] : []);

  const handleContainerClick = () => {
    if (deepLinkUrl && onNavigate) {
      onNavigate(deepLinkUrl);
      onClose();
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -25, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95, transition: { duration: 0.15 } }}
      drag="y"
      dragConstraints={{ top: -100, bottom: 0 }}
      onDragEnd={(_e, info) => {
        if (info.offset.y < -30 || info.velocity.y < -200) {
          onClose();
        }
      }}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setIsPaused(false)}
      onClick={handleContainerClick}
      className={`pointer-events-auto relative w-full overflow-hidden rounded-2xl border backdrop-blur-xl shadow-xl ${theme.bg} ${theme.glow} transition-all duration-200 select-none ${deepLinkUrl ? 'cursor-pointer hover:border-slate-500/60' : ''}`}
    >
      <div className="p-3.5 sm:p-4">
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${theme.iconBg}`}>
            <IconComponent className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold tracking-tight text-white line-clamp-1">
                {title || theme.defaultTitle}
              </h4>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
                aria-label="Close notification"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {message && (
              <p className="mt-0.5 text-xs text-slate-300 leading-relaxed line-clamp-2">
                {message}
              </p>
            )}

            {(customerName || amount !== undefined || paymentType) && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                {customerName && (
                  <span className="inline-flex items-center rounded-md bg-slate-800/80 px-2 py-0.5 font-medium text-slate-200 border border-slate-700/60">
                    {customerName}
                  </span>
                )}
                {amount !== undefined && (
                  <span className={`inline-flex items-center gap-0.5 rounded-md px-2 py-0.5 font-bold border ${theme.badgeBg}`}>
                    ₹{amount.toLocaleString('en-IN')}
                  </span>
                )}
                {paymentType && (
                  <span className="inline-flex items-center rounded-md bg-slate-800/80 px-2 py-0.5 text-[11px] font-medium text-slate-300 border border-slate-700/60 uppercase">
                    {paymentType === 'phonepe' ? 'UPI' : paymentType}
                  </span>
                )}
              </div>
            )}

            {allActions.length > 0 && (
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                {allActions.map((act, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      act.onClick();
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                      act.isUndo
                        ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30'
                        : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-bold shadow-sm'
                    }`}
                  >
                    {act.isUndo ? <RotateCcw className="h-3 w-3" /> : <ArrowRight className="h-3 w-3" />}
                    {act.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {duration > 0 && (
        <div className="h-1 w-full bg-slate-800/80 overflow-hidden">
          <motion.div
            className={`h-full ${theme.progressBar}`}
            style={{ width: `${progress}%` }}
            transition={{ ease: 'linear' }}
          />
        </div>
      )}
    </motion.div>
  );
}
