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
  ShieldCheck,
  Loader2,
  Bluetooth,
  Receipt
} from 'lucide-react';
import { safeFormat } from '../lib/utils';
import { 
  shareReceiptImage, 
  ReceiptData,
  printReceipt,
  isBluetoothPrintSupported
} from '../services/receiptImageService';
import { PIGMY_LOGO_BASE64 } from '../assets/logoBase64';
import { toast } from 'sonner';

export type { ReceiptData };

interface ReceiptSuccessModalProps {
  receipt: ReceiptData | null;
  onClose: () => void;
}

export function ReceiptSuccessModal({ receipt, onClose }: ReceiptSuccessModalProps) {
  const [isSharingImage, setIsSharingImage] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  if (!receipt) return null;

  const { transaction, customer, previousBalance, newBalance } = receipt;
  const isUpi = transaction.type === 'phonepe';
  const isNP = transaction.type === 'NP' || transaction.type === 'unsettled' || transaction.status === 'unsettled';
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

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm pointer-events-auto"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          style={{ width: 'min(92vw, 390px)', minWidth: '280px' }}
          className="bg-card border border-border/80 rounded-[32px] shadow-2xl overflow-hidden flex flex-col shrink-0 relative z-10 select-none max-h-[92vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header Banner */}
          <div className={`relative ${isNP ? 'bg-gradient-to-br from-amber-700 via-amber-600 to-amber-800' : 'bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-800'} p-5 text-white text-center flex flex-col items-center shadow-inner`}>
            {/* Top gold/emerald trim line */}
            <div className={`absolute top-0 inset-x-0 h-1 ${isNP ? 'bg-amber-400' : 'bg-emerald-400'}`} />

            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-all active:scale-90 cursor-pointer"
              title="Close"
            >
              <X size={16} />
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

            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center mb-2 shadow-inner border border-white/10">
              <CheckCircle2 size={26} className="text-white" strokeWidth={2.5} />
            </div>

            <p className="text-[10px] font-black uppercase tracking-widest opacity-85 mb-0.5">
              {isNP ? 'Debt / Missed Due Recorded' : 'Payment Recorded Successfully'}
            </p>
            <h2 className="text-3xl font-black tracking-tight drop-shadow-xs">
              ₹{transaction.amount.toLocaleString('en-IN')}
            </h2>

            <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-white/15 text-[10px] font-black uppercase tracking-wider backdrop-blur-xs border border-white/10">
              {isUpi ? <Smartphone size={12} /> : isNP ? <Clock size={12} /> : <Banknote size={12} />}
              <span>{isUpi ? 'UPI / PhonePe' : isNP ? 'NP (Debt Recorded)' : 'Cash Deposit'}</span>
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
                  {isNP ? 'Recorded Debt' : 'Previous Balance'}
                </span>
                <span className={`text-xs font-black ${isNP ? 'text-amber-600 dark:text-amber-400' : 'text-text-secondary line-through'}`}>
                  ₹{isNP ? transaction.amount.toLocaleString('en-IN') : previousBalance.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
                  {isNP ? 'Remaining Balance' : 'Updated Balance'}
                </span>
                <span className="text-base font-black text-text-primary">
                  ₹{newBalance.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Transaction Metadata */}
            <div className="flex flex-col gap-1.5 text-[10px] text-text-secondary opacity-80 px-1">
              <div className="flex justify-between">
                <span>Receipt Number:</span>
                <span className="font-mono font-bold">{receiptNo}</span>
              </div>
              <div className="flex justify-between">
                <span>Date & Time:</span>
                <span>{paidTime}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Ledger Security:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <ShieldCheck size={12} /> 100% Verified Ledger Record
                </span>
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="p-4 pt-1 flex flex-col gap-2.5">
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
