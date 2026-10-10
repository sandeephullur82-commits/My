import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Banknote, 
  Smartphone, 
  ArrowUpRight, 
  Loader2, 
  PiggyBank, 
  ShieldCheck, 
  AlertCircle,
  Check
} from 'lucide-react';
import { Customer, firestoreService } from '../services/firestoreService';
import { ReceiptData } from './ReceiptSuccessModal';
import { playSuccessSound } from '../lib/sound';
import { toast } from 'sonner';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface WithdrawDepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
  onSuccess: (receipt: ReceiptData) => void;
}

export function WithdrawDepositModal({
  isOpen,
  onClose,
  customer,
  onSuccess
}: WithdrawDepositModalProps) {
  const [amountStr, setAmountStr] = useState<string>('');
  const [payoutType, setPayoutType] = useState<'cash' | 'phonepe'>('cash');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const containerRef = useFocusTrap(isOpen);


  const availableBalance = customer?.advanceBalance || 0;

  useEffect(() => {
    if (isOpen) {
      setAmountStr('');
      setPayoutType('cash');
      setErrorMessage(null);
      setIsSubmitting(false);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && !isSubmitting) onClose();
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, customer, isSubmitting, onClose]);

  const numericAmount = useMemo(() => {
    const val = parseFloat(amountStr);
    return isNaN(val) ? 0 : Math.floor(val);
  }, [amountStr]);

  const remainingBalance = Math.max(0, availableBalance - numericAmount);

  // Quick selection chips
  const quickChips = useMemo(() => {
    if (availableBalance <= 0) return [];
    const chips: { label: string; value: number }[] = [
      { label: `Full (₹${availableBalance.toLocaleString('en-IN')})`, value: availableBalance }
    ];
    const presets = [500, 1000, 2000, 5000];
    presets.forEach(p => {
      if (p < availableBalance) {
        chips.push({ label: `₹${p.toLocaleString('en-IN')}`, value: p });
      }
    });
    return chips;
  }, [availableBalance]);

  const isValidAmount = numericAmount > 0 && numericAmount <= availableBalance;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;

    if (numericAmount <= 0) {
      setErrorMessage('Please enter an amount to withdraw');
      return;
    }
    if (numericAmount > availableBalance) {
      setErrorMessage(`Maximum available withdrawal is ₹${availableBalance.toLocaleString('en-IN')}`);
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      const res = await firestoreService.withdrawAdvanceDeposit(
        customer,
        numericAmount,
        payoutType
      );

      playSuccessSound();
      toast.success(
        `₹${numericAmount.toLocaleString('en-IN')} paid out via ${
          payoutType === 'phonepe' ? 'PhonePe UPI' : 'Cash'
        } to ${customer.name}`
      );

      const receiptPayload: ReceiptData = {
        transaction: res.transaction,
        customer: res.updatedCustomer,
        previousBalance: res.previousAdvance,
        newBalance: res.newAdvance
      };

      onClose();
      onSuccess(receiptPayload);
    } catch (err: any) {
      console.error('Failed to process advance withdrawal:', err);
      setErrorMessage(err.message || 'Failed to process withdrawal');
      toast.error(err.message || 'Failed to process withdrawal');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !customer) return null;

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[99990] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-xs pointer-events-auto"
        onClick={onClose}
      >
        <motion.div
          ref={containerRef as any}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby="withdraw-deposit-title"
          initial={{ opacity: 0, y: 30, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.98 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="w-full sm:max-w-md bg-card border border-border/80 rounded-t-[32px] sm:rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] select-none outline-none"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header Banner */}
          <div className="relative bg-gradient-to-br from-amber-600 via-orange-600 to-amber-700 p-5 text-white flex flex-col">
            <div className="absolute top-0 inset-x-0 h-1 bg-amber-300" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center shadow-inner border border-white/20" aria-hidden="true">
                  <ArrowUpRight size={22} className="text-white" strokeWidth={2.5} />
                </div>
                <div>
                  <h3 id="withdraw-deposit-title" className="text-base font-black tracking-tight leading-tight">
                    Withdraw Deposit
                  </h3>
                  <p className="text-[11px] font-bold text-amber-100 uppercase tracking-wider opacity-90">
                    Advance Savings Payout
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close withdrawal dialog"
                className="min-w-[44px] min-h-[44px] rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-all active:scale-95 cursor-pointer"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>

            {/* Customer Snapshot Pill */}
            <div className="mt-3.5 flex items-center justify-between px-3.5 py-2 rounded-2xl bg-black/25 backdrop-blur-xs border border-white/10 text-xs">
              <div className="min-w-0 pr-2">
                <p className="font-black text-white truncate">{customer.name}</p>
                <p className="text-[10px] text-amber-100 font-medium">
                  ID: #{customer.displayId || customer.id} {customer.phone ? `• ${customer.phone}` : ''}
                </p>
              </div>
              <div className="text-right shrink-0">
                <span className="text-[9px] uppercase tracking-wider text-amber-200 block font-bold">
                  Available Deposit
                </span>
                <span className="text-sm font-black font-mono text-white">
                  ₹{availableBalance.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
            {/* Amount Input */}
            <div className="space-y-1.5">
              <label htmlFor="withdraw-amount-input" className="text-xs font-black uppercase tracking-wider text-text-secondary flex items-center justify-between">
                <span>Withdrawal Amount</span>
                <span className="text-[10px] text-text-secondary/60 lowercase font-medium">
                  up to ₹{availableBalance.toLocaleString('en-IN')}
                </span>
              </label>

              <div className="relative flex items-center rounded-2xl bg-muted/40 border border-border/80 focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/20 transition-all p-3">
                <span className="text-2xl font-black text-amber-600 dark:text-amber-400 mr-2" aria-hidden="true">
                  ₹
                </span>
                <input
                  id="withdraw-amount-input"
                  type="number"
                  inputMode="numeric"
                  aria-label="Withdrawal amount in Rupees"
                  value={amountStr}
                  onChange={(e) => {
                    setAmountStr(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="0"
                  autoFocus
                  className="w-full bg-transparent text-2xl font-black font-mono text-text-primary focus:outline-none tracking-tight"
                />
              </div>

              {/* Quick Amount Chips */}
              {quickChips.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap pt-1" role="group" aria-label="Preset withdrawal amounts">
                  {quickChips.map((chip, idx) => (
                    <button
                      key={idx}
                      type="button"
                      aria-label={`Withdraw ${chip.label}`}
                      onClick={() => {
                        setAmountStr(chip.value.toString());
                        if (errorMessage) setErrorMessage(null);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95 min-h-[36px] ${
                        numericAmount === chip.value
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'bg-muted/60 hover:bg-muted text-text-secondary border border-border/40'
                      }`}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Payout Channel Selector */}
            <div className="space-y-1.5 pt-1">
              <label className="text-xs font-black uppercase tracking-wider text-text-secondary">
                Payout Channel
              </label>
              <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="Payout Channel">
                <button
                  type="button"
                  role="radio"
                  aria-checked={payoutType === 'cash'}
                  aria-label="Cash payout handed directly to customer"
                  onClick={() => setPayoutType('cash')}
                  className={`p-3.5 rounded-2xl border flex flex-col items-start gap-1 transition-all cursor-pointer active:scale-98 min-h-[44px] ${
                    payoutType === 'cash'
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 shadow-sm'
                      : 'bg-card border-border/70 text-text-secondary hover:bg-muted/40'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center" aria-hidden="true">
                      <Banknote size={17} strokeWidth={2.5} />
                    </div>
                    {payoutType === 'cash' && (
                      <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]" aria-hidden="true">
                        <Check size={11} strokeWidth={3} />
                      </span>
                    )}
                  </div>
                  <span className="font-black text-xs uppercase tracking-wider mt-1">Cash Payout</span>
                  <span className="text-[10px] text-text-secondary/70">Handed directly to customer</span>
                </button>

                <button
                  type="button"
                  role="radio"
                  aria-checked={payoutType === 'phonepe'}
                  aria-label="PhonePe or UPI payout transferred to customer account"
                  onClick={() => setPayoutType('phonepe')}
                  className={`p-3.5 rounded-2xl border flex flex-col items-start gap-1 transition-all cursor-pointer active:scale-98 min-h-[44px] ${
                    payoutType === 'phonepe'
                      ? 'bg-blue-500/15 border-blue-500/40 text-blue-700 dark:text-blue-300 shadow-sm'
                      : 'bg-card border-border/70 text-text-secondary hover:bg-muted/40'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center" aria-hidden="true">
                      <Smartphone size={17} strokeWidth={2.5} />
                    </div>
                    {payoutType === 'phonepe' && (
                      <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]" aria-hidden="true">
                        <Check size={11} strokeWidth={3} />
                      </span>
                    )}
                  </div>
                  <span className="font-black text-xs uppercase tracking-wider mt-1">PhonePe / UPI</span>
                  <span className="text-[10px] text-text-secondary/70">Transferred to customer account</span>
                </button>
              </div>
            </div>

            {/* Financial Ledger Calculation Summary */}
            <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/60 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-secondary">Current Deposit Balance</span>
                <span className="font-bold text-text-primary">
                  ₹{availableBalance.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-amber-600 dark:text-amber-400 font-bold">Payout Amount</span>
                <span className="font-bold text-amber-600 dark:text-amber-400">
                  - ₹{numericAmount.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs">
                <span className="font-black text-text-primary">Remaining Deposit Held</span>
                <span className={`font-black font-mono text-sm ${remainingBalance > 0 ? 'text-sky-600 dark:text-sky-400' : 'text-text-secondary'}`}>
                  ₹{remainingBalance.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Submission Action */}
            <div className="pt-2 space-y-2">
              <button
                type="submit"
                disabled={!isValidAmount || isSubmitting}
                className="w-full py-3.5 px-4 rounded-2xl bg-amber-600 hover:bg-amber-700 disabled:bg-muted disabled:text-text-secondary/40 text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-amber-600/25 active:scale-98 transition-all cursor-pointer disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Processing Payout...</span>
                  </>
                ) : (
                  <>
                    <ArrowUpRight size={16} strokeWidth={2.5} />
                    <span>Confirm Payout & Issue Receipt</span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-1.5 text-[10px] text-text-secondary/60">
                <ShieldCheck size={12} className="text-emerald-500" />
                <span>Immediate digital receipt with thermal print & instant share</span>
              </div>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
