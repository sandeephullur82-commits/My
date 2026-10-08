import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckCircle2, 
  Smartphone, 
  Banknote, 
  Clock, 
  Share2, 
  Printer, 
  X, 
  ArrowRight,
  ArrowUpRight,
  ShieldCheck,
  Loader2,
  Bluetooth,
  Receipt,
  Sparkles,
  PiggyBank
} from 'lucide-react';
import { safeFormat } from '../lib/utils';
import { 
  shareReceiptImage, 
  ReceiptData,
  printReceipt,
  isBluetoothPrintSupported
} from '../services/receiptImageService';
import { Customer } from '../services/firestoreService';
import { PIGMY_LOGO_BASE64 } from '../assets/logoBase64';
import { toast } from 'sonner';
import { useFocusTrap } from '../hooks/useFocusTrap';

export type { ReceiptData };

interface ReceiptSuccessModalProps {
  receipt: ReceiptData | null;
  onClose: () => void;
  onStartNewLoan?: (customer: Customer) => void;
}

export function ReceiptSuccessModal({ receipt, onClose, onStartNewLoan }: ReceiptSuccessModalProps) {
  const [isSharingImage, setIsSharingImage] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const containerRef = useFocusTrap(Boolean(receipt));

  if (!receipt) return null;


  const { transaction, customer, previousBalance, newBalance } = receipt;
  const isUpi = transaction.type === 'phonepe';
  const isWithdrawal = Boolean(transaction.isWithdrawal);
  const isNP = transaction.type === 'NP' || transaction.type === 'unsettled' || transaction.status === 'unsettled';
  const isAdvance = Boolean(
    !isWithdrawal && (
      transaction.isAdvance || 
      (previousBalance <= 0 && !isNP) ||
      (transaction.notes && transaction.notes.toLowerCase().includes('advance'))
    )
  );
  const isLoanCompleted = !isNP && !isWithdrawal && newBalance <= 0 && !isAdvance;
  const currentAdvanceBalance = (customer.advanceBalance !== undefined && customer.advanceBalance > 0)
    ? customer.advanceBalance
    : (isAdvance ? (newBalance > 0 ? newBalance : transaction.amount) : 0);
  
  // Track if this receipt was converted / settled from a previous NP record
  const wasNP = Boolean(
    transaction.convertedFromNP || 
    transaction.npMarkedAt || 
    transaction.settledFromNpId || 
    (transaction as any).originalNpTimestamp || 
    (transaction.notes && transaction.notes.toLowerCase().includes('np'))
  );
  
  const rawNpTime = transaction.npMarkedAt || (transaction as any).originalNpTimestamp || transaction.unsettledAt;
  const npMarkedTimeStr = rawNpTime 
    ? safeFormat(rawNpTime, 'dd MMM yyyy, hh:mm a', safeFormat(rawNpTime, 'dd MMM yyyy', 'Recorded'))
    : (transaction.npMarkedDate ? safeFormat(transaction.npMarkedDate, 'dd MMM yyyy', transaction.npMarkedDate) : null);

  const paidTime = safeFormat(
    transaction.paidAt || transaction.timestamp || transaction.date, 
    'dd MMM yyyy, hh:mm a', 
    safeFormat(Date.now(), 'dd MMM yyyy, hh:mm a')
  );
  const receiptNo = `REC-${(transaction.id || '').slice(0, 8).toUpperCase()}`;
  const hasBluetooth = isBluetoothPrintSupported();

  const handleShareImage = async () => {
    try {
      setIsSharingImage(true);
      const res = await shareReceiptImage(receipt);
      if (res === 'shared') {
        toast.success('Receipt image shared successfully');
      } else if (res === 'downloaded') {
        toast.info('Receipt image saved to device');
      }
    } catch (error) {
      console.error('Failed to share image receipt:', error);
      toast.error('Failed to share image receipt');
    } finally {
      setIsSharingImage(false);
    }
  };

  const handlePrint = async (preferBluetooth: boolean = false) => {
    try {
      setIsPrinting(true);
      const res = await printReceipt(receipt, preferBluetooth);
      if (res === 'printed_bluetooth') {
        toast.success('Receipt printed via Bluetooth Thermal Printer');
      } else if (res === 'printed_system') {
        toast.success('Sent to printer dialog');
      }
    } catch (error) {
      console.error('Print error:', error);
      toast.error('Printing failed. Please check printer connection.');
    } finally {
      setIsPrinting(false);
    }
  };

  React.useEffect(() => {
    if (!receipt) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [receipt, onClose]);

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm pointer-events-auto"
        onClick={onClose}
      >
        <motion.div
          ref={containerRef as any}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby="receipt-success-title"
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          style={{ width: 'min(92vw, 390px)', minWidth: '280px' }}
          className="bg-card border border-border/80 rounded-[32px] shadow-2xl overflow-hidden flex flex-col shrink-0 relative z-10 select-none max-h-[92vh] overflow-y-auto outline-none"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header Banner */}
          <div className={`relative ${
            isWithdrawal
              ? 'bg-gradient-to-br from-amber-700 via-orange-600 to-rose-700'
              : isNP 
                ? 'bg-gradient-to-br from-amber-700 via-amber-600 to-amber-800' 
                : isAdvance
                  ? 'bg-gradient-to-br from-sky-800 via-sky-700 to-indigo-900'
                  : 'bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-800'
          } p-5 text-white text-center flex flex-col items-center shadow-inner`}>
            {/* Top gold/sky/emerald trim line */}
            <div className={`absolute top-0 inset-x-0 h-1 ${isWithdrawal ? 'bg-amber-300' : isNP ? 'bg-amber-400' : isAdvance ? 'bg-sky-400' : 'bg-emerald-400'}`} />

            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 min-w-[44px] min-h-[44px] rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-all active:scale-90 cursor-pointer"
              title="Close"
              aria-label="Close receipt dialog"
            >
              <X size={16} aria-hidden="true" />
            </button>

            {/* Brand Logo & Name */}
            <div className="flex items-center gap-2 mb-2 bg-black/25 px-3 py-1 rounded-full backdrop-blur-xs border border-white/10 shadow-xs">
              <img 
                src={PIGMY_LOGO_BASE64} 
                alt="Pigmy Pro" 
                className="w-5 h-5 rounded-md object-contain bg-white p-0.5 shadow-xs" 
              />
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-100">
                Pigmy Pro Ledger
              </span>
            </div>

            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center mb-2 shadow-inner border border-white/10" aria-hidden="true">
              {isWithdrawal ? (
                <ArrowUpRight size={26} className="text-white" strokeWidth={2.5} />
              ) : isAdvance ? (
                <PiggyBank size={26} className="text-white" strokeWidth={2.3} />
              ) : (
                <CheckCircle2 size={26} className="text-white" strokeWidth={2.5} />
              )}
            </div>

            <p id="receipt-success-title" className="text-[10px] font-black uppercase tracking-widest opacity-85 mb-0.5">
              {isWithdrawal 
                ? 'Advance Deposit Payout Successful' 
                : isNP 
                  ? 'Debt / Missed Due Recorded' 
                  : isAdvance 
                    ? 'Advance Savings Deposit Recorded' 
                    : 'Payment Recorded Successfully'}
            </p>
            <h2 className="text-3xl font-black tracking-tight drop-shadow-xs">
              ₹{transaction.amount.toLocaleString('en-IN')}
            </h2>

            <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-white/15 text-[10px] font-black uppercase tracking-wider backdrop-blur-xs border border-white/10">
              {isWithdrawal ? (
                isUpi ? <Smartphone size={12} /> : <Banknote size={12} />
              ) : isUpi ? (
                <Smartphone size={12} />
              ) : isNP ? (
                <Clock size={12} />
              ) : isAdvance ? (
                <PiggyBank size={12} />
              ) : (
                <Banknote size={12} />
              )}
              <span>
                {isWithdrawal
                  ? isUpi ? 'PhonePe UPI Payout' : 'Cash Payout'
                  : isUpi 
                    ? (isAdvance ? 'UPI Advance Deposit' : 'UPI / PhonePe') 
                    : isNP 
                      ? 'NP (Debt Recorded)' 
                      : (isAdvance ? 'Cash Advance Deposit' : 'Cash Deposit')}
              </span>
            </div>
          </div>

          {/* Ticket Perforation Notch Graphic */}
          <div className="relative h-4 bg-card flex items-center justify-between overflow-hidden">
            <div className="w-3 h-6 -ml-1.5 rounded-r-full bg-black/75 border-r border-border/80" />
            <div className="flex-1 border-b border-dashed border-border/80 mx-2" />
            <div className="w-3 h-6 -mr-1.5 rounded-l-full bg-black/75 border-l border-border/80" />
          </div>

          {/* Receipt Body */}
          <div className="p-5 pt-1 flex flex-col gap-3.5 text-xs">
            {/* Customer Details Box */}
            <div className="p-3.5 rounded-2xl bg-muted/25 border border-border/50 flex items-center justify-between">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-text-secondary opacity-60">
                  Customer
                </p>
                <p className="text-sm font-black text-text-primary uppercase tracking-tight mt-0.5">
                  {customer.name}
                </p>
                {customer.phone && (
                  <p className="text-[10px] font-semibold text-text-secondary opacity-75 mt-0.5">
                    {customer.phone}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-[9px] font-black uppercase tracking-widest text-text-secondary opacity-60">
                  Account ID
                </p>
                <span className="inline-block mt-0.5 px-2 py-0.5 rounded-md bg-accent/10 text-accent font-mono font-bold text-xs">
                  #{customer.displayId || customer.id}
                </span>
              </div>
            </div>

            {/* Financial Balance Summary */}
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-muted/40 border border-border/50">
              <div>
                <span className="text-[9px] font-black uppercase tracking-wider text-text-secondary opacity-60 block">
                  {isWithdrawal ? 'Previous Deposit' : isNP ? 'Recorded Debt' : isAdvance ? 'Previous Advance' : 'Previous Balance'}
                </span>
                <span className={`text-xs font-black ${isNP ? 'text-amber-600 dark:text-amber-400' : 'text-text-secondary line-through'}`}>
                  ₹{isWithdrawal ? previousBalance.toLocaleString('en-IN') : isNP ? transaction.amount.toLocaleString('en-IN') : isAdvance ? Math.max(0, currentAdvanceBalance - transaction.amount).toLocaleString('en-IN') : previousBalance.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="text-right">
                <span className={`text-[9px] font-black uppercase tracking-wider block ${isWithdrawal ? 'text-amber-600 dark:text-amber-400' : isAdvance ? 'text-sky-600 dark:text-sky-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {isWithdrawal ? 'Remaining Deposit Held' : isNP ? 'Remaining Balance' : isAdvance ? 'Total Advance Savings' : 'Updated Balance'}
                </span>
                <span className="text-base font-black text-text-primary">
                  ₹{(isWithdrawal ? newBalance : isAdvance ? currentAdvanceBalance : newBalance).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Transaction Metadata */}
            <div className="flex flex-col gap-2 p-3 rounded-2xl bg-muted/30 border border-border/50 text-[11px] text-text-secondary">
              <div className="flex justify-between items-center">
                <span className="font-medium text-text-secondary/70">Receipt Number:</span>
                <span className="font-mono font-bold text-text-primary">{receiptNo}</span>
              </div>

              {/* If previously NP and now paid, explicitly show both dates */}
              {wasNP && !isNP ? (
                <div className="flex flex-col gap-1.5 py-1.5 px-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-text-primary">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <Clock size={11} /> NP Due Recorded:
                    </span>
                    <span className="font-mono font-semibold">{npMarkedTimeStr || 'Earlier'}</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 size={11} /> Payment Settled:
                    </span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{paidTime}</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="font-semibold text-text-secondary">Settled Via:</span>
                    <span className="font-bold">{isUpi ? 'Phone (UPI / PhonePe)' : 'Cash'}</span>
                  </div>
                </div>
              ) : (
                <div className="flex justify-between items-center">
                  <span className="font-medium text-text-secondary/70">{isNP ? 'NP Recorded Date:' : 'Date & Time:'}</span>
                  <span className="font-mono font-bold text-text-primary">{paidTime}</span>
                </div>
              )}

              <div className="flex justify-between items-center text-[10px] pt-0.5 border-t border-border/30">
                <span className="text-text-secondary/60">Ledger Security:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <ShieldCheck size={12} /> Verified Smart Ledger Record
                </span>
              </div>
            </div>

            {/* Withdrawal Payout Info Banner */}
            {isWithdrawal && (
              <div className="flex items-center justify-between p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-300">
                <div className="flex items-center gap-2">
                  <ArrowUpRight size={18} className="text-amber-600 dark:text-amber-400 shrink-0" />
                  <div>
                    <p className="font-bold text-xs leading-none">Advance Savings Payout Released</p>
                    <p className="text-[10px] text-text-secondary mt-0.5">
                      Paid out via {isUpi ? 'PhonePe UPI' : 'Cash'} • Remaining deposit: ₹{newBalance.toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
                  Paid Out
                </span>
              </div>
            )}

            {/* Celebratory Advance Savings Banner */}
            {isAdvance && (
              <div className="flex items-center justify-between p-3 rounded-2xl bg-sky-500/15 border border-sky-500/30 text-sky-700 dark:text-sky-300">
                <div className="flex items-center gap-2">
                  <PiggyBank size={18} className="text-sky-500 shrink-0" />
                  <div>
                    <p className="font-bold text-xs leading-none">Advance Savings Credit Held</p>
                    <p className="text-[10px] text-text-secondary mt-0.5">₹{currentAdvanceBalance.toLocaleString('en-IN')} ready to offset Cycle #{(customer.currentCycle || 1) + 1} New Loan</p>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-black uppercase px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-600 dark:text-sky-400 shrink-0">
                  Advance Credit
                </span>
              </div>
            )}

            {/* Celebratory Completed Loan Banner */}
            {isLoanCompleted && (
              <div className="flex items-center justify-between p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-emerald-500 shrink-0" />
                  <div>
                    <p className="font-bold text-xs leading-none">Loan Completed & Settled</p>
                    <p className="text-[10px] text-text-secondary mt-0.5">Eligible for instant Cycle #{(customer.currentCycle || 1) + 1} repeat credit</p>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shrink-0">
                  Fully Paid
                </span>
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="p-4 pt-1 flex flex-col gap-2.5">
            {/* If Loan is Completed or has Advance: Direct New Loan issuance button */}
            {(isLoanCompleted || (isAdvance && currentAdvanceBalance > 0)) && onStartNewLoan && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onStartNewLoan(customer);
                }}
                className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-600/30 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles size={16} strokeWidth={2.5} />
                <span>
                  {isAdvance && currentAdvanceBalance > 0 
                    ? `Issue New Loan • Apply ₹${currentAdvanceBalance.toLocaleString('en-IN')} Advance` 
                    : `Issue New Loan • Cycle #${(customer.currentCycle || 1) + 1}`}
                </span>
              </button>
            )}

            {/* Primary Action: Share Image (for WhatsApp / Messaging) */}
            <button
              type="button"
              disabled={isSharingImage}
              onClick={handleShareImage}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-600/30 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              title="Share receipt image on WhatsApp or system share"
            >
              {isSharingImage ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Share2 size={16} strokeWidth={2.5} />
              )}
              <span>Share Receipt Image</span>
            </button>

            {/* Secondary Actions: Print & Done */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isPrinting}
                onClick={() => handlePrint(hasBluetooth)}
                className="flex-1 py-2.5 px-3 rounded-xl bg-card border border-border hover:bg-muted font-bold text-xs text-text-primary uppercase tracking-wider active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-2xs disabled:opacity-50 cursor-pointer"
                title={hasBluetooth ? "Print to Bluetooth Thermal or System Printer" : "Print via System Printer Dialog"}
              >
                {isPrinting ? <Loader2 size={13} className="animate-spin" /> : <Printer size={13} strokeWidth={2.2} />}
                <span>Print</span>
                {hasBluetooth && (
                  <span className="inline-flex items-center text-[8px] font-bold text-emerald-500">
                    <Bluetooth size={9} />
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 px-4 rounded-xl bg-muted text-text-secondary font-black text-xs uppercase tracking-wider hover:bg-border active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Done</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
