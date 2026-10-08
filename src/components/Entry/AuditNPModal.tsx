import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  History, 
  Calendar, 
  AlertTriangle, 
  CheckCircle2, 
  Banknote, 
  Smartphone,
  ChevronRight,
  Clock,
  Sparkles
} from 'lucide-react';
import { Customer, Transaction } from '../../services/firestoreService';
import { format, parseISO, isValid } from 'date-fns';
import { safeFormat } from '../../lib/utils';

interface AuditNPModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
  transactions: Transaction[];
  onSettleNP: (npTx: Transaction, customer: Customer, paymentMethod: 'cash' | 'phonepe') => Promise<void>;
  isSettlingNPId: string | null;
}

export function AuditNPModal({
  isOpen,
  onClose,
  customer,
  transactions,
  onSettleNP,
  isSettlingNPId
}: AuditNPModalProps) {
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !customer) return null;

  // Filter all NP transactions for this specific customer
  const customerNPs = transactions
    .filter(t => t.customerId === customer.id && (t.type === 'NP' || t.type === 'unsettled' || t.status === 'unsettled') && !t.isDeleted)
    .sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : a.timestamp || 0;
      const dateB = b.date ? new Date(b.date).getTime() : b.timestamp || 0;
      return dateA - dateB; // Oldest first
    });

  const totalNPAmount = customerNPs.reduce((sum, t) => sum + (t.amount || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="audit-np-title"
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-lg bg-card border border-border/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border/50 flex items-center justify-between bg-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/15 text-purple-400 flex items-center justify-center" aria-hidden="true">
              <History size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 id="audit-np-title" className="text-sm sm:text-base font-bold text-text-primary tracking-tight">{customer.name}</h3>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/30">
                  {customerNPs.length} Unsettled
                </span>
              </div>
              <p className="text-[11px] text-text-secondary opacity-70">
                Pending NP Total: <span className="font-bold text-danger">₹{totalNPAmount.toLocaleString('en-IN')}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close unsettled entries modal"
            className="min-w-[44px] min-h-[44px] rounded-xl bg-muted hover:bg-border/60 text-text-secondary hover:text-text-primary flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {/* List of Pending NP Dates */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {customerNPs.length === 0 ? (
            <div className="p-8 text-center bg-emerald-500/10 rounded-2xl border border-emerald-500/20 text-emerald-400 space-y-2">
              <CheckCircle2 size={32} className="mx-auto" aria-hidden="true" />
              <p className="text-xs font-bold">All missed installments cleared!</p>
              <p className="text-[11px] opacity-75">No outstanding NP entries found for this customer.</p>
            </div>
          ) : (
            customerNPs.map((np, index) => {
              const isSettling = isSettlingNPId === np.id;
              const formattedDate = np.date ? safeFormat(np.date, 'dd MMM yyyy') : safeFormat(np.timestamp, 'dd MMM yyyy');

              return (
                <div 
                  key={np.id}
                  className="p-3.5 rounded-2xl bg-muted/30 border border-border/60 hover:border-purple-500/40 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-purple-500/15 text-purple-400 font-bold text-xs flex items-center justify-center shrink-0" aria-hidden="true">
                      #{index + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <Calendar size={13} className="text-purple-400" aria-hidden="true" />
                        <span className="text-xs font-bold text-text-primary">{formattedDate}</span>
                        <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded bg-rose-500/15 text-rose-400">
                          Missed
                        </span>
                      </div>
                      <p className="text-xs font-black text-danger mt-0.5">
                        ₹{(np.amount || 0).toLocaleString('en-IN')}
                      </p>
                    </div>
                  </div>

                  {/* Settle Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      type="button"
                      disabled={isSettling}
                      aria-label={`Settle missed payment of ₹${np.amount || 0} on ${formattedDate} via Cash`}
                      onClick={() => onSettleNP(np, customer, 'cash')}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all disabled:opacity-50 cursor-pointer min-h-[36px]"
                    >
                      <Banknote size={13} aria-hidden="true" />
                      <span>{isSettling ? '...' : 'Cash'}</span>
                    </button>

                    <button
                      type="button"
                      disabled={isSettling}
                      aria-label={`Settle missed payment of ₹${np.amount || 0} on ${formattedDate} via UPI`}
                      onClick={() => onSettleNP(np, customer, 'phonepe')}
                      className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all disabled:opacity-50 cursor-pointer min-h-[36px]"
                    >
                      <Smartphone size={13} aria-hidden="true" />
                      <span>{isSettling ? '...' : 'UPI'}</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border/50 bg-card/60 flex items-center justify-between">
          <span className="text-xs text-text-secondary">
            Resolves past missed dates in sequence
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-accent text-white text-xs font-bold hover:opacity-90 active:scale-95 transition-all"
          >
            Done
          </button>
        </div>
      </motion.div>
    </div>
  );
}
