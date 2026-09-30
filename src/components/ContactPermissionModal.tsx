import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, Phone, Copy, Check, ShieldCheck, X } from 'lucide-react';

export interface ContactPermissionModalProps {
  isOpen: boolean;
  type: 'whatsapp' | 'call' | null;
  customerName: string;
  customerPhone?: string;
  customerId?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ContactPermissionModal({
  isOpen,
  type,
  customerName,
  customerPhone,
  customerId,
  onConfirm,
  onCancel,
}: ContactPermissionModalProps) {
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scrolling when modal is open to keep it fixed in the center without page scrolling
  useEffect(() => {
    if (isOpen && type) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [isOpen, type]);

  // Handle Escape key to dismiss
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (customerPhone) {
      navigator.clipboard.writeText(customerPhone);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!mounted || typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && type && (
        <div 
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 overflow-hidden pointer-events-auto"
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
        >
          {/* Dark Blurred Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 bg-black/65 backdrop-blur-sm"
            onClick={onCancel}
          />

          {/* Centered Permission Box (No internal scrolling, fixed in screen center) */}
          <motion.div
            key="modal-card"
            initial={{ scale: 0.92, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 12 }}
            transition={{ type: 'spring', damping: 25, stiffness: 360 }}
            className="relative w-full max-w-[360px] bg-card text-text-primary rounded-[28px] p-6 shadow-2xl border border-border flex flex-col items-center text-center z-10 select-none overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Close Button */}
            <button
              type="button"
              onClick={onCancel}
              className="absolute top-4 right-4 p-1.5 rounded-full text-text-secondary hover:text-text-primary hover:bg-muted transition-colors active:scale-90"
              aria-label="Close"
            >
              <X size={18} />
            </button>

            {/* Icon Header with Badge */}
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-3.5 shadow-md ${
                type === 'whatsapp'
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-4 ring-emerald-500/10'
                  : 'bg-blue-500/15 text-blue-600 dark:text-blue-400 ring-4 ring-blue-500/10'
              }`}
            >
              {type === 'whatsapp' ? (
                <MessageSquare size={30} strokeWidth={2.4} />
              ) : (
                <Phone size={30} strokeWidth={2.4} />
              )}
            </div>

            {/* Permission Required Pill */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-muted text-text-secondary mb-2.5">
              <ShieldCheck size={12} className="text-text-secondary opacity-75" />
              <span>Permission Required</span>
            </div>

            {/* Title */}
            <h3 className="text-xl font-black text-text-primary tracking-tight mb-2 whitespace-normal break-normal">
              {type === 'whatsapp' ? 'Open WhatsApp?' : 'Call Customer?'}
            </h3>

            {/* Body Explanation */}
            <p className="text-sm text-text-secondary leading-relaxed max-w-[280px] mx-auto mb-3 whitespace-normal break-normal">
              {type === 'whatsapp' ? (
                <>
                  Do you want to send a WhatsApp reminder to{' '}
                  <span className="font-bold text-text-primary">{customerName}</span>?
                </>
              ) : (
                <>
                  Do you want to initiate a phone call to{' '}
                  <span className="font-bold text-text-primary">{customerName}</span>?
                </>
              )}
            </p>

            {/* Phone Number Pill with Copy Action */}
            {customerPhone && (
              <div className="mb-5 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-muted/60 border border-border text-xs font-mono font-bold text-text-primary">
                <span className="text-text-secondary opacity-70 font-sans font-medium text-[11px]">Phone:</span>
                <span>{customerPhone}</span>
                <button
                  type="button"
                  onClick={handleCopy}
                  title="Copy Phone Number"
                  className="ml-1 p-1 rounded hover:bg-card text-text-secondary hover:text-text-primary transition-colors active:scale-90"
                >
                  {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                </button>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col gap-2.5 w-full">
              <button
                id={`confirm-contact-${type}-${customerId || 'target'}`}
                type="button"
                onClick={onConfirm}
                className={`w-full py-3.5 px-4 rounded-2xl font-bold flex items-center justify-center gap-2 text-white shadow-lg active:scale-98 transition-all ${
                  type === 'whatsapp'
                    ? 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 shadow-emerald-600/25'
                    : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 shadow-blue-600/25'
                }`}
              >
                {type === 'whatsapp' ? (
                  <>
                    <MessageSquare size={18} strokeWidth={2.4} />
                    <span>Allow & Open WhatsApp</span>
                  </>
                ) : (
                  <>
                    <Phone size={18} strokeWidth={2.4} />
                    <span>Allow & Call Now</span>
                  </>
                )}
              </button>

              <button
                id={`cancel-contact-${type}-${customerId || 'target'}`}
                type="button"
                onClick={onCancel}
                className="w-full py-3 px-4 rounded-2xl bg-bg border border-border text-text-secondary font-bold hover:bg-muted hover:text-text-primary active:scale-98 transition-all text-sm"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
