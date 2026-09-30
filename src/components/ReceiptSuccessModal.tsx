import React, { useRef } from 'react';
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
  ShieldCheck,
  Receipt
} from 'lucide-react';
import { format } from 'date-fns';
import { Customer, Transaction } from '../services/firestoreService';

export interface ReceiptData {
  transaction: Transaction;
  customer: Customer;
  previousBalance: number;
  newBalance: number;
}

interface ReceiptSuccessModalProps {
  receipt: ReceiptData | null;
  onClose: () => void;
}

export function ReceiptSuccessModal({ receipt, onClose }: ReceiptSuccessModalProps) {
  const receiptRef = useRef<HTMLDivElement>(null);

  if (!receipt) return null;

  const { transaction, customer, previousBalance, newBalance } = receipt;
  const isUpi = transaction.type === 'phonepe';
  const isUnsettled = transaction.status === 'unsettled';
  const paidTime = format(new Date(transaction.paidAt || transaction.timestamp), 'dd MMM yyyy, hh:mm a');
  const receiptNo = `REC-${(transaction.id || '').slice(0, 8).toUpperCase()}`;

  const handleShare = async () => {
    const text = `*PIGMY DEPOSIT RECEIPT*\n` +
      `Receipt No: ${receiptNo}\n` +
      `Customer: ${customer.name}\n` +
      `Acc / ID: #${customer.displayId || customer.id}\n` +
      `Amount Paid: Rs. ${transaction.amount.toLocaleString('en-IN')}\n` +
      `Payment Mode: ${isUpi ? 'UPI / PhonePe' : isUnsettled ? 'Unsettled (NP)' : 'Cash'}\n` +
      `Date & Time: ${paidTime}\n` +
      `Remaining Balance: Rs. ${newBalance.toLocaleString('en-IN')}\n\n` +
      `Status: Successful & Recorded in Digital Ledger`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Receipt - ${customer.name}`,
          text
        });
      } catch (e: any) {
        if (e.name !== 'AbortError') {
          // fallback to whatsapp web or text
          window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
        }
      }
    } else {
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm pointer-events-auto"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          style={{ width: 'min(92vw, 380px)', minWidth: '280px' }}
          className="bg-card border border-border/70 rounded-[32px] shadow-2xl overflow-hidden flex flex-col shrink-0 relative z-10 select-none"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header Banner */}
          <div className="relative bg-gradient-to-br from-emerald-600 to-teal-700 p-6 text-white text-center flex flex-col items-center">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-all active:scale-90"
              title="Close"
            >
              <X size={16} />
            </button>

            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: 'spring', damping: 15, stiffness: 300 }}
              className="w-14 h-14 rounded-2xl bg-white text-emerald-600 flex items-center justify-center shadow-lg mb-3"
            >
              <CheckCircle2 size={32} strokeWidth={2.5} />
            </motion.div>

            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-100">
              Payment Confirmed
            </p>
            <h2 className="text-3xl font-black tracking-tight mt-1">
              ₹{transaction.amount.toLocaleString('en-IN')}
            </h2>
            <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-[10px] font-black uppercase tracking-wider backdrop-blur-xs">
              {isUpi ? <Smartphone size={12} /> : isUnsettled ? <Clock size={12} /> : <Banknote size={12} />}
              <span>{isUpi ? 'UPI / PhonePe' : isUnsettled ? 'Unsettled' : 'Cash Deposit'}</span>
            </div>
          </div>

          {/* Receipt Body */}
          <div ref={receiptRef} className="p-6 flex flex-col gap-4 text-xs">
            {/* Customer Details */}
            <div className="flex items-center justify-between pb-3 border-b border-border/50">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-text-secondary opacity-50">
                  Customer
                </p>
                <p className="text-sm font-black text-text-primary uppercase tracking-tight mt-0.5">
                  {customer.name}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black uppercase tracking-widest text-text-secondary opacity-50">
                  Account ID
                </p>
                <p className="text-xs font-mono font-bold text-accent mt-0.5">
                  #{customer.displayId || customer.id}
                </p>
              </div>
            </div>

            {/* Financial Balance Summary */}
            <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-muted/30 border border-border/40">
              <div>
                <span className="text-[9px] font-black uppercase tracking-wider text-text-secondary opacity-50 block">
                  Previous Balance
                </span>
                <span className="text-xs font-black text-text-secondary line-through">
                  ₹{previousBalance.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
                  New Balance
                </span>
                <span className="text-sm font-black text-text-primary">
                  ₹{newBalance.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Transaction Metadata */}
            <div className="flex flex-col gap-1.5 text-[10px] text-text-secondary opacity-70">
              <div className="flex justify-between">
                <span>Receipt Number:</span>
                <span className="font-mono font-bold">{receiptNo}</span>
              </div>
              <div className="flex justify-between">
                <span>Date & Time:</span>
                <span>{paidTime}</span>
              </div>
              <div className="flex justify-between">
                <span>Ledger Status:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <ShieldCheck size={11} /> Verified & Saved
                </span>
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="p-4 pt-0 flex items-center gap-2">
            <button
              onClick={handleShare}
              className="flex-1 py-3 px-4 rounded-xl bg-accent text-white font-black text-xs uppercase tracking-wider shadow-md shadow-accent/20 hover:brightness-105 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <Share2 size={14} />
              <span>Share Receipt</span>
            </button>

            <button
              onClick={onClose}
              className="py-3 px-5 rounded-xl bg-muted text-text-secondary font-black text-xs uppercase tracking-wider hover:bg-border active:scale-95 transition-all flex items-center justify-center gap-1.5"
            >
              <span>Done</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
