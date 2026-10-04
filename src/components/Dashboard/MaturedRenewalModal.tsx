import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  RotateCcw, 
  AlertTriangle, 
  Calendar, 
  Clock, 
  IndianRupee, 
  Loader2, 
  MessageSquare,
  Percent,
  CheckCircle2
} from 'lucide-react';
import { Customer, firestoreService, MaturedRenewalData } from '../../services/firestoreService';
import { notificationService } from '../../services/notificationService';
import { format, addDays } from 'date-fns';
import { toast } from 'sonner';
import { triggerWhatsApp } from '../../lib/whatsapp';
import { useUI } from '../../context/UIContext';

interface MaturedRenewalModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
  onSuccess?: (updatedCustomer: Customer) => void;
}

export function MaturedRenewalModal({
  isOpen,
  onClose,
  customer,
  onSuccess
}: MaturedRenewalModalProps) {
  const { setIsModalOpen } = useUI();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sendWhatsApp, setSendWhatsApp] = useState(true);

  // Sync modal state with UI context
  useEffect(() => {
    if (isOpen) {
      setIsModalOpen(true);
      return () => setIsModalOpen(false);
    }
  }, [isOpen, setIsModalOpen]);

  const currentCycle = customer?.currentCycle || 1;
  const nextCycle = currentCycle + 1;
  const originalLoan = customer?.loanAmount || customer?.loan || 0;
  const currentPaid = customer?.paid || 0;
  const remainingDue = Math.max(0, customer?.pending !== undefined ? customer.pending : (originalLoan - currentPaid));

  // Form states
  const [interestType, setInterestType] = useState<'percentage' | 'flat'>('percentage');
  const [interestRate, setInterestRate] = useState<number>(10); // default 10%
  const [flatInterest, setFlatInterest] = useState<number>(Math.round(remainingDue * 0.1));
  const [durationDays, setDurationDays] = useState<number>(customer?.durationDays || 60);
  const [startDateStr, setStartDateStr] = useState<string>(() => format(new Date(), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState<string>('');

  // Reset form when customer changes
  useEffect(() => {
    if (customer && isOpen) {
      const pending = Math.max(0, customer.pending !== undefined ? customer.pending : ((customer.loanAmount || customer.loan || 0) - (customer.paid || 0)));
      setInterestType('percentage');
      setInterestRate(10);
      setFlatInterest(Math.round(pending * 0.1));
      setDurationDays(customer.durationDays || 60);
      setStartDateStr(format(new Date(), 'yyyy-MM-dd'));
      setNotes(`Cycle #${(customer.currentCycle || 1) + 1} Matured Balance Renewal`);
    }
  }, [customer, isOpen]);

  // Derived interest amount
  const calculatedInterestAmount = useMemo(() => {
    if (interestType === 'percentage') {
      return Math.max(0, Math.round(remainingDue * (interestRate / 100)));
    }
    return Math.max(0, flatInterest);
  }, [interestType, interestRate, flatInterest, remainingDue]);

  // Total renewed debt = remainingDue + interest
  const newTotalDebt = useMemo(() => {
    return remainingDue + calculatedInterestAmount;
  }, [remainingDue, calculatedInterestAmount]);

  // Derived dates
  const parsedStartDate = useMemo(() => {
    try {
      const d = new Date(startDateStr);
      return isNaN(d.getTime()) ? new Date() : d;
    } catch {
      return new Date();
    }
  }, [startDateStr]);

  const calculatedEndDate = useMemo(() => {
    return addDays(parsedStartDate, durationDays);
  }, [parsedStartDate, durationDays]);

  const dailyInstallment = useMemo(() => {
    if (durationDays <= 0) return 0;
    return Math.ceil(newTotalDebt / durationDays);
  }, [newTotalDebt, durationDays]);

  if (!isOpen || !customer) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (newTotalDebt <= 0) {
      toast.error('Renewed amount must be greater than zero.');
      return;
    }

    if (durationDays < 5) {
      toast.error('Duration must be at least 5 days.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: MaturedRenewalData = {
        interestAmount: calculatedInterestAmount,
        interestType,
        ...(interestType === 'percentage' && typeof interestRate === 'number' ? { interestRate } : {}),
        newTotalDebt,
        durationDays,
        startDate: parsedStartDate.getTime(),
        endDate: calculatedEndDate.getTime(),
        notes: (notes || '').trim() || `Cycle #${nextCycle} Matured Balance Renewal`
      };

      const updatedCustomer = await firestoreService.renewMaturedLoan(customer, payload);

      // Trigger Android System Notification for Loan Renewal
      notificationService.notifyLoanRenewed(
        customer.name,
        nextCycle,
        newTotalDebt,
        durationDays,
        dailyInstallment,
        customer.id,
        customer.phone
      ).catch((e) => console.warn('Could not post renewal notification:', e));

      if (sendWhatsApp && customer.phone) {
        const msg = `📋 Dear ${customer.name}, your Pigmy Pro loan has been renewed for Cycle #${nextCycle} with updated terms:\n\nRemaining Balance: ₹${remainingDue.toLocaleString('en-IN')}\nRenewal Interest: ₹${calculatedInterestAmount.toLocaleString('en-IN')}\nNew Total Balance: ₹${newTotalDebt.toLocaleString('en-IN')}\nDuration: ${durationDays} days\nDaily Installment: ₹${dailyInstallment.toLocaleString('en-IN')}/day\n\nThank you for banking with us!`;
        triggerWhatsApp(customer.phone, customer.name, msg, customer.id);
      }

      toast.success(`Successfully renewed loan for ${customer.name} (Cycle #${nextCycle})!`);
      if (onSuccess) onSuccess(updatedCustomer);
      onClose();
    } catch (err: any) {
      console.error('Failed to renew matured loan:', err);
      toast.error(err?.message || 'Failed to complete loan renewal.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalContent = (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm pointer-events-auto"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="w-full max-w-lg bg-card border border-border/80 rounded-[32px] shadow-2xl flex flex-col max-h-[92vh] overflow-hidden relative select-none"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-border/50 flex items-center justify-between bg-card shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <RotateCcw size={20} strokeWidth={2.5} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-text-primary uppercase tracking-tight truncate">
                    Renew Matured Loan • Cycle #{nextCycle}
                  </h3>
                </div>
                <p className="text-[11px] font-medium text-text-secondary truncate mt-0.5">
                  {customer.name} {customer.displayId ? `(#${customer.displayId})` : ''} · {customer.phone || 'No phone'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="w-8 h-8 rounded-xl bg-muted hover:bg-border/60 text-text-secondary hover:text-text-primary flex items-center justify-center transition-colors active:scale-90"
              title="Close"
            >
              <X size={16} />
            </button>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {/* Matured Debt Card */}
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
                  Expired Loan Balance (Base)
                </span>
                <span className="text-2xl font-black text-text-primary font-mono mt-0.5 block">
                  ₹{remainingDue.toLocaleString('en-IN')}
                </span>
                <span className="text-[10px] text-text-secondary font-medium block mt-0.5">
                  Repaid ₹{currentPaid.toLocaleString('en-IN')} of original ₹{originalLoan.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block">
                  Current Term
                </span>
                <span className="text-xs font-bold text-danger mt-1 block">
                  Matured / Past Due
                </span>
              </div>
            </div>

            {/* Interest Input Mode */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-text-primary uppercase tracking-wider">
                  Renewal Interest
                </label>
                {/* Segmented Mode Selector */}
                <div className="flex items-center p-0.5 rounded-xl bg-muted border border-border/50 text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => setInterestType('percentage')}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      interestType === 'percentage'
                        ? 'bg-card text-text-primary shadow-xs'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    Percentage (%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setInterestType('flat')}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      interestType === 'flat'
                        ? 'bg-card text-text-primary shadow-xs'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    Flat Rupee (₹)
                  </button>
                </div>
              </div>

              {interestType === 'percentage' ? (
                <div className="space-y-2">
                  <div className="relative">
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-text-secondary">
                      %
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={interestRate || ''}
                      onChange={(e) => setInterestRate(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full pl-4 pr-9 py-2.5 rounded-2xl bg-bg border border-border/80 text-text-primary font-mono font-bold text-base focus:outline-none focus:border-amber-500 transition-colors"
                      placeholder="10"
                      min="0"
                      max="100"
                      step="0.5"
                      required
                    />
                  </div>
                  {/* Preset Percentages */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                    {[5, 10, 15, 20, 25].map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => setInterestRate(rate)}
                        className={`px-3 py-1 rounded-xl text-[11px] font-bold transition-all shrink-0 ${
                          interestRate === rate
                            ? 'bg-amber-500 text-white shadow-xs'
                            : 'bg-muted/70 text-text-secondary hover:bg-muted'
                        }`}
                      >
                        +{rate}%
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-text-secondary">
                      ₹
                    </span>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={flatInterest || ''}
                      onChange={(e) => setFlatInterest(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full pl-8 pr-4 py-2.5 rounded-2xl bg-bg border border-border/80 text-text-primary font-mono font-bold text-base focus:outline-none focus:border-amber-500 transition-colors"
                      placeholder="1000"
                      min="0"
                      required
                    />
                  </div>
                  {/* Preset Rupee Amounts */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                    {[500, 1000, 1500, 2000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setFlatInterest(amt)}
                        className={`px-3 py-1 rounded-xl text-[11px] font-bold transition-all shrink-0 ${
                          flatInterest === amt
                            ? 'bg-amber-500 text-white shadow-xs'
                            : 'bg-muted/70 text-text-secondary hover:bg-muted'
                        }`}
                      >
                        +₹{amt}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Duration & Daily Installment */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-primary uppercase tracking-wider block">
                  New Duration (Days)
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={durationDays || ''}
                  onChange={(e) => setDurationDays(Math.max(5, parseInt(e.target.value) || 5))}
                  className="w-full px-3 py-2.5 rounded-2xl bg-bg border border-border/80 text-text-primary font-mono font-bold text-sm focus:outline-none focus:border-amber-500 transition-colors"
                  min="5"
                  max="1000"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider block">
                  Daily Installment
                </label>
                <div className="px-3 py-2.5 rounded-2xl bg-muted/40 border border-border/50 text-text-primary font-mono font-black text-sm flex items-center justify-between">
                  <span>₹{dailyInstallment.toLocaleString('en-IN')}</span>
                  <span className="text-[9px] font-sans font-bold text-text-secondary opacity-60">/ day</span>
                </div>
              </div>
            </div>

            {/* Quick Duration Preset Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
              {[30, 50, 60, 90, 100].map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setDurationDays(days)}
                  className={`px-3 py-1 rounded-xl text-[11px] font-bold transition-all shrink-0 ${
                    durationDays === days
                      ? 'bg-accent text-white shadow-xs'
                      : 'bg-muted/70 text-text-secondary hover:bg-muted'
                  }`}
                >
                  {days} Days
                </button>
              ))}
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-primary uppercase tracking-wider block">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDateStr}
                  onChange={(e) => setStartDateStr(e.target.value)}
                  className="w-full px-3 py-2 rounded-2xl bg-bg border border-border/80 text-text-primary font-mono text-xs focus:outline-none focus:border-amber-500 transition-colors"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider block">
                  New Maturity Date
                </label>
                <div className="px-3 py-2 rounded-2xl bg-muted/40 border border-border/50 text-text-secondary font-mono text-xs truncate">
                  {format(calculatedEndDate, 'dd MMM yyyy')}
                </div>
              </div>
            </div>

            {/* Total Debt Summary Card */}
            <div className="p-4 rounded-2xl bg-card border border-border/80 space-y-2.5 shadow-sm">
              <div className="flex items-center justify-between text-xs text-text-secondary">
                <span>Remaining Expired Balance:</span>
                <span className="font-mono font-bold text-text-primary">₹{remainingDue.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-amber-600 dark:text-amber-400">
                <span>Added Renewal Interest:</span>
                <span className="font-mono font-bold">+₹{calculatedInterestAmount.toLocaleString('en-IN')}</span>
              </div>
              <div className="pt-2 border-t border-border/60 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-text-secondary block">
                    Total Renewed Loan (Cycle #{nextCycle})
                  </span>
                  <span className="text-xl font-black text-text-primary tracking-tight font-mono">
                    ₹{newTotalDebt.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-text-secondary uppercase block">
                    Daily Rate
                  </span>
                  <span className="text-xs font-mono font-bold text-text-primary">
                    ₹{dailyInstallment}/day ({durationDays}d)
                  </span>
                </div>
              </div>
            </div>

            {/* Optional Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase tracking-wider block">
                Renewal Notes (Optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Extended term with 10% penalty interest"
                className="w-full px-3.5 py-2 rounded-xl bg-bg border border-border/80 text-text-primary text-xs focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>

            {/* WhatsApp Checkbox */}
            {customer.phone && (
              <label className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-muted/40 transition-colors cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={sendWhatsApp}
                  onChange={(e) => setSendWhatsApp(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
                />
                <span className="text-xs text-text-primary font-medium flex items-center gap-1.5">
                  <MessageSquare size={13} className="text-[#25D366]" />
                  <span>Send WhatsApp renewal schedule to customer</span>
                </span>
              </label>
            )}

            {/* Submit Action */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 px-4 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-amber-600/25 active:scale-98 transition-all disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Renewing Loan...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw size={16} strokeWidth={2.5} />
                    <span>Confirm & Renew Loan (₹{newTotalDebt.toLocaleString('en-IN')})</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
}
