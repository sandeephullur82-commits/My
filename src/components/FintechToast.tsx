import React, { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
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
  duration = 2400,
  onClose,
  action,
  actions,
  deepLinkUrl,
  onNavigate,
}: FintechToastProps) {
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        if (type === 'error' || type === 'critical') {
          navigator.vibrate([40, 30, 40]);
        } else {
          navigator.vibrate(15);
        }
      }
    } catch {
      // ignore
    }
  }, [type]);

  useEffect(() => {
    if (duration <= 0) return;

    timerRef.current = setTimeout(() => {
      onClose();
    }, duration);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [duration, onClose]);

  const getTheme = () => {
    switch (type) {
      case 'success':
      case 'transaction':
        return {
          bg: 'bg-slate-900/95 border-emerald-500/30 text-emerald-400',
          iconBg: 'bg-emerald-500/15 border-emerald-500/25 text-emerald-400',
          badgeBg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
          glow: 'shadow-lg shadow-emerald-950/30',
          Icon: type === 'transaction' ? IndianRupee : CheckCircle2,
          defaultTitle: type === 'transaction' ? 'Recorded' : 'Success',
        };
      case 'error':
      case 'critical':
        return {
          bg: 'bg-slate-900/95 border-rose-500/30 text-rose-400',
          iconBg: 'bg-rose-500/15 border-rose-500/25 text-rose-400',
          badgeBg: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
          glow: 'shadow-lg shadow-rose-950/30',
          Icon: AlertCircle,
          defaultTitle: 'Error',
        };
      case 'warning':
        return {
          bg: 'bg-slate-900/95 border-amber-500/30 text-amber-400',
          iconBg: 'bg-amber-500/15 border-amber-500/25 text-amber-400',
          badgeBg: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
          glow: 'shadow-lg shadow-amber-950/30',
          Icon: AlertTriangle,
          defaultTitle: 'Notice',
        };
      case 'sync':
        return {
          bg: 'bg-slate-900/95 border-sky-500/30 text-sky-400',
          iconBg: 'bg-sky-500/15 border-sky-500/25 text-sky-400',
          badgeBg: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
          glow: 'shadow-lg shadow-sky-950/30',
          Icon: RefreshCw,
          defaultTitle: 'Synced',
        };
      case 'info':
      default:
        return {
          bg: 'bg-slate-900/95 border-indigo-500/30 text-indigo-400',
          iconBg: 'bg-indigo-500/15 border-indigo-500/25 text-indigo-400',
          badgeBg: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
          glow: 'shadow-lg shadow-indigo-950/30',
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
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.96, transition: { duration: 0.15 } }}
      drag="y"
      dragConstraints={{ top: -40, bottom: 40 }}
      onDragEnd={(_e, info) => {
        if (Math.abs(info.offset.y) > 25 || Math.abs(info.velocity.y) > 150) {
          onClose();
        }
      }}
      onClick={handleContainerClick}
      className={`pointer-events-auto relative w-full overflow-hidden rounded-xl border backdrop-blur-xl ${theme.bg} ${theme.glow} transition-all duration-150 select-none ${deepLinkUrl ? 'cursor-pointer hover:border-slate-500/60' : ''}`}
    >
      <div className="px-3.5 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${theme.iconBg}`}>
            <IconComponent className="h-4 w-4" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold tracking-tight text-white leading-tight">
                {title || theme.defaultTitle}
              </span>
              {message && (
                <span className="text-xs text-slate-300 font-normal leading-tight truncate max-w-[200px] sm:max-w-xs">
                  • {message}
                </span>
              )}
            </div>

            {(customerName || amount !== undefined || paymentType) && (
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                {customerName && (
                  <span className="inline-flex items-center rounded bg-slate-800/90 px-1.5 py-0.2 font-medium text-slate-200 border border-slate-700/60">
                    {customerName}
                  </span>
                )}
                {amount !== undefined && (
                  <span className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.2 font-bold border ${theme.badgeBg}`}>
                    ₹{amount.toLocaleString('en-IN')}
                  </span>
                )}
                {paymentType && (
                  <span className="inline-flex items-center rounded bg-slate-800/90 px-1.5 py-0.2 text-[10px] font-medium text-slate-300 border border-slate-700/60 uppercase">
                    {paymentType === 'phonepe' ? 'UPI' : paymentType}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Action buttons & dismiss */}
          <div className="flex items-center gap-1.5 shrink-0 ml-1">
            {allActions.map((act, idx) => (
              <button
                key={idx}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  act.onClick();
                }}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-xs ${
                  act.isUndo
                    ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                    : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                }`}
              >
                {act.isUndo ? <RotateCcw className="h-3 w-3 stroke-[2.5]" /> : <ArrowRight className="h-3 w-3 stroke-[2.5]" />}
                <span>{act.label}</span>
              </button>
            ))}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
