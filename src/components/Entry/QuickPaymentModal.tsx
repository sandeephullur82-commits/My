import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Banknote, 
  Smartphone, 
  Loader2, 
  PlusCircle, 
  Wallet,
  Sparkles,
  RotateCcw
} from 'lucide-react';
import { Customer, Transaction, firestoreService } from '../../services/firestoreService';
import { ReceiptData } from '../ReceiptSuccessModal';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { playSuccessSound } from '../../lib/sound';

interface QuickPaymentModalProps {
  customer: Customer | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (receipt: ReceiptData) => void;
}

export function QuickPaymentModal({ customer, isOpen, onClose, onSuccess }: QuickPaymentModalProps) {
  const [amount, setAmount] = useState<number>(100);
  const [note, setNote] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingType, setProcessingType] = useState<'cash' | 'phonepe' | null>(null);

  const loan = customer ? (customer.loanAmount || customer.loan || 0) : 0;
  const paid = customer ? (customer.paid || 0) : 0;
  const currentBalance = customer ? (customer.pending !== undefined ? customer.pending : (loan - paid)) : 0;

  const isAdvance = currentBalance <= 0;

  useEffect(() => {
    if (customer) {
      // Calculate suggested installment amount
      const duration = customer.durationDays || 100;
      const calculatedDaily = duration > 0 ? Math.round(loan / duration) : 100;
      const defaultAmt = calculatedDaily > 0 ? calculatedDaily : 100;
      setAmount(currentBalance > 0 ? Math.min(defaultAmt, currentBalance) : (defaultAmt || 100));
      setNote('');
    }
  }, [customer, loan, currentBalance, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isProcessing) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isProcessing, onClose]);

  if (!isOpen || !customer) return null;

  const handlePayment = async (type: 'cash' | 'phonepe') => {
    if (amount <= 0) {
      toast.error('Please enter a valid payment amount');
      return;
    }

    if (isProcessing) return;

    setIsProcessing(true);
    setProcessingType(type);

    try {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const now = Date.now();
      const prevBal = currentBalance;
      const newBal = Math.max(0, currentBalance - amount);

      const newTx: Transaction = {
        id: uuidv4(),
        customerId: customer.id,
        amount,
        type,
        status: 'paid',
        date: todayStr,
        timestamp: now,
        paidAt: now,
        isAdvance,
        notes: note.trim() ? note.trim() : (isAdvance ? 'Advance Savings Deposit' : 'Additional payment')
      };

      await firestoreService.saveTransaction(newTx, customer);

      if (navigator.vibrate) navigator.vibrate(40);
      playSuccessSound();

      if (isAdvance) {
        toast.success(`Deposited ₹${amount.toLocaleString('en-IN')} ${type === 'cash' ? 'Cash' : 'UPI'} advance savings for ${customer.name}`);
      } else {
        toast.success(`Recorded ₹${amount.toLocaleString('en-IN')} ${type === 'cash' ? 'Cash' : 'UPI'} payment for ${customer.name}`);
      }

      onClose();
      onSuccess({
        transaction: newTx,
        customer,
        previousBalance: prevBal,
        newBalance: isAdvance ? 0 : newBal
      });
    } catch (error) {
      console.error('Quick payment failed:', error);
      toast.error('Failed to record payment. Please try again.');
    } finally {
      setIsProcessing(false);
      setProcessingType(null);
    }
  };

  const suggestions = [
    50,
    100,
    200,
    500,
    ...(currentBalance > 0 && ![50, 100, 200, 500].includes(currentBalance) ? [currentBalance] : [])
  ].filter(v => v > 0);

  const modalContent = (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[99999] flex items-center justify-center p-4 overflow-hidden pointer-events-auto"
        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
      >
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          aria-hidden="true"
          className="fixed inset-0 bg-black/65 backdrop-blur-sm"
          onClick={() => !isProcessing && onClose()}
        />

        {/* Modal Card */}
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="quick-payment-title"
          initial={{ scale: 0.94, opacity: 0, y: 14 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.94, opacity: 0, y: 14 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="relative w-full max-w-[390px] bg-card text-text-primary rounded-[30px] p-6 shadow-2xl border border-border flex flex-col z-10 select-none overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-2xl ${isAdvance ? 'bg-sky-500/10 text-sky-600 border-sky-500/20' : 'bg-accent/10 text-accent border-accent/20'} flex items-center justify-center border shrink-0`} aria-hidden="true">
                <PlusCircle size={22} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 id="quick-payment-title" className="text-base font-black text-text-primary uppercase tracking-tight truncate">
                    {customer.name}
                  </h3>
                  {customer.displayId && (
                    <span className="text-[10px] font-mono font-bold bg-muted px-1.5 py-0.5 rounded text-text-secondary">
                      #{customer.displayId}
                    </span>
                  )}
                </div>
                <p className={`text-[11px] font-bold ${isAdvance ? 'text-sky-600 dark:text-sky-400' : 'text-accent'} uppercase tracking-wider flex items-center gap-1 mt-0.5`}>
                  <Sparkles size={11} aria-hidden="true" />
                  <span>{isAdvance ? 'Advance Savings Deposit' : 'Record Additional Payment'}</span>
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={isProcessing}
              onClick={onClose}
              aria-label="Close payment dialog"
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-text-secondary hover:text-text-primary hover:bg-muted transition-colors active:scale-90 cursor-pointer"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          {/* Current Balance / Advance Pill */}
          <div className={`p-3 ${isAdvance ? 'bg-sky-500/10 border-sky-500/20' : 'bg-muted/60 border-border/70'} border rounded-2xl mb-4 flex items-center justify-between text-xs`}>
            <div className="flex items-center gap-2 text-text-secondary font-medium">
              <Wallet size={15} className={isAdvance ? 'text-sky-600' : 'text-accent'} aria-hidden="true" />
              <span>{isAdvance ? 'Accumulated Advance Savings:' : 'Current Pending Balance:'}</span>
            </div>
            <span className={`font-black tracking-tight font-mono ${isAdvance ? 'text-sky-600 dark:text-sky-400' : 'text-text-primary'}`}>
              ₹{(isAdvance ? (customer.advanceBalance || 0) : currentBalance).toLocaleString('en-IN')}
            </span>
          </div>

          {/* Amount Input */}
          <div className="flex flex-col gap-2 mb-4">
            <label htmlFor="quick-payment-amount-input" className="text-[10px] font-black uppercase tracking-widest text-text-secondary">
              Payment Amount (₹)
            </label>
            <div className="relative flex items-center bg-bg border border-border focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/10 rounded-2xl px-4 py-3 transition-all">
              <span className="text-xl font-bold text-text-secondary mr-2" aria-hidden="true">₹</span>
              <input
                id="quick-payment-amount-input"
                type="number"
                inputMode="numeric"
                aria-label="Payment amount in Rupees"
                value={amount || ''}
                onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
                placeholder="0"
                className="bg-transparent font-black text-2xl text-text-primary focus:outline-none w-full tracking-tight"
                autoFocus
              />
              {amount > 0 && currentBalance > 0 && (
                <span className="text-[10px] font-bold text-text-secondary opacity-70 shrink-0" aria-live="polite">
                  New Bal: ₹{Math.max(0, currentBalance - amount).toLocaleString('en-IN')}
                </span>
              )}
            </div>

            {/* Quick Suggestions */}
            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide py-1" role="group" aria-label="Preset payment amounts">
              {suggestions.map((val) => (
                <button
                  key={val}
                  type="button"
                  aria-label={`Pay ₹${val.toLocaleString('en-IN')}`}
                  onClick={() => setAmount(val)}
                  className={`px-3 py-1.5 rounded-xl border text-[11px] font-black whitespace-nowrap active:scale-95 transition-all flex items-center gap-1 cursor-pointer min-h-[36px] ${
                    amount === val 
                      ? 'bg-accent text-white border-accent shadow-xs' 
                      : 'bg-muted/50 border-border hover:bg-muted text-text-primary'
                  }`}
                >
                  {val === currentBalance && <RotateCcw size={10} aria-hidden="true" />}
                  <span>₹{val}</span>
                  {val === currentBalance && <span className="text-[8px] opacity-75">FULL</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Optional Note */}
          <div className="flex flex-col gap-1.5 mb-5">
            <label htmlFor="quick-payment-note-input" className="text-[10px] font-black uppercase tracking-widest text-text-secondary">
              Note (Optional)
            </label>
            <input
              id="quick-payment-note-input"
              type="text"
              aria-label="Optional payment note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Evening installment, advance payment..."
              className="bg-bg border border-border focus:outline-none focus:border-accent rounded-xl px-3 py-2 text-xs font-medium text-text-primary"
            />
          </div>

          {/* Actions: Cash & UPI */}
          <div className="flex gap-2.5">
            {/* CASH */}
            <button
              type="button"
              disabled={isProcessing || amount <= 0}
              onClick={() => handlePayment('cash')}
              aria-label={`Collect ₹${amount.toLocaleString('en-IN')} in Cash for ${customer.name}`}
              className="flex-1 py-3 px-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex flex-col items-center justify-center gap-1 active:scale-95 transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50 cursor-pointer min-h-[44px]"
            >
              <div className="flex items-center gap-1.5">
                {processingType === 'cash' ? <Loader2 size={16} className="animate-spin" /> : <Banknote size={16} strokeWidth={2.5} />}
                <span className="text-xs uppercase tracking-wider">Cash</span>
              </div>
              <span className="text-[9px] font-medium opacity-80">Collect ₹{amount.toLocaleString('en-IN')}</span>
            </button>

            {/* UPI / PHONEPE */}
            <button
              type="button"
              disabled={isProcessing || amount <= 0}
              onClick={() => handlePayment('phonepe')}
              aria-label={`Collect ₹${amount.toLocaleString('en-IN')} via UPI for ${customer.name}`}
              className="flex-1 py-3 px-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex flex-col items-center justify-center gap-1 active:scale-95 transition-all shadow-md shadow-blue-600/20 disabled:opacity-50 cursor-pointer min-h-[44px]"
            >
              <div className="flex items-center gap-1.5">
                {processingType === 'phonepe' ? <Loader2 size={16} className="animate-spin" /> : <Smartphone size={16} strokeWidth={2.5} />}
                <span className="text-xs uppercase tracking-wider">UPI</span>
              </div>
              <span className="text-[9px] font-medium opacity-80">Collect ₹{amount.toLocaleString('en-IN')}</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
}
