import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Calendar, 
  Clock, 
  AlertTriangle, 
  Banknote, 
  Smartphone, 
  Loader2, 
  MessageSquare, 
  CheckCircle2, 
  History,
  ShieldAlert,
  ArrowRight,
  TrendingDown
} from 'lucide-react';
import { Customer, Transaction } from '../../services/firestoreService';
import { safeFormat, safeDistanceToNow } from '../../lib/utils';
import { parseISO, isValid, format } from 'date-fns';
import { triggerWhatsApp } from '../../lib/whatsapp';

interface AuditNPModalProps {
  customer: Customer | null;
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  onSettleNP: (tx: Transaction, customer: Customer, method: 'cash' | 'phonepe') => void;
  isSettlingNPId: string | null;
}

export function AuditNPModal({
  customer,
  isOpen,
  onClose,
  transactions,
  onSettleNP,
  isSettlingNPId,
}: AuditNPModalProps) {
  const [activeView, setActiveView] = useState<'unpaid' | 'recent_paid'>('unpaid');

  // Customer loan balances
  const loan = customer ? (customer.loanAmount || customer.loan || 0) : 0;
  const paid = customer ? (customer.paid || 0) : 0;
  const currentBalance = customer ? (customer.pending !== undefined ? customer.pending : (loan - paid)) : 0;

  // Filter all unsettled NP entries for this customer, sorted chronological (oldest first)
  const npRecords = useMemo(() => {
    if (!customer) return [];
    return transactions
      .filter(t => 
        t.customerId === customer.id && 
        (t.type === 'NP' || t.type === 'unsettled' || t.status === 'unsettled') && 
        !t.isDeleted
      )
      .sort((a, b) => {
        const dateA = a.date || '';
        const dateB = b.date || '';
        if (dateA !== dateB) return dateA.localeCompare(dateB);
        return (a.timestamp || 0) - (b.timestamp || 0);
      });
  }, [customer, transactions]);

  // Filter recent paid entries for this customer to give full audit context
  const recentPaidRecords = useMemo(() => {
    if (!customer) return [];
    return transactions
      .filter(t => 
        t.customerId === customer.id && 
        t.status === 'paid' && 
        t.type !== 'NP' && 
        t.type !== 'unsettled' && 
        !t.isDeleted
      )
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      .slice(0, 10);
  }, [customer, transactions]);

  const totalNPAmount = useMemo(() => {
    return npRecords.reduce((sum, r) => sum + (r.amount || 0), 0);
  }, [npRecords]);

  if (!isOpen || !customer) return null;

  // Format date helper with day of week
  const formatDetailedDate = (dateStr?: string, timestamp?: number) => {
    if (dateStr) {
      try {
        const parsed = parseISO(dateStr);
        if (isValid(parsed)) {
          return {
            fullDate: format(parsed, 'dd MMMM yyyy'),
            dayName: format(parsed, 'EEEE'),
            relative: safeDistanceToNow(parsed.getTime()),
            short: format(parsed, 'dd MMM'),
          };
        }
      } catch {
        // fallback
      }
    }
    const ts = timestamp || Date.now();
    return {
      fullDate: safeFormat(ts, 'dd MMMM yyyy', 'Recorded Date'),
      dayName: safeFormat(ts, 'EEEE', ''),
      relative: safeDistanceToNow(ts),
      short: safeFormat(ts, 'dd MMM', 'NP'),
    };
  };

  const handleSendAuditWhatsApp = () => {
    if (!customer.phone) return;
    const dateList = npRecords
      .map(r => {
        const { short } = formatDetailedDate(r.date, r.timestamp);
        return `${short} (₹${r.amount})`;
      })
      .join(', ');

    const msg = `Hello ${customer.name}, your Pigmy account (#${customer.displayId || customer.id}) has ${npRecords.length} missed installment(s) pending for dates: [${dateList}]. Total unpaid due: ₹${totalNPAmount.toLocaleString('en-IN')}. Current loan balance: ₹${currentBalance.toLocaleString('en-IN')}. Please keep cash ready or pay via UPI.`;
    triggerWhatsApp(customer.phone, customer.name, msg, customer.id);
  };

  return createPortal(
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 overflow-hidden pointer-events-auto"
        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
      >
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/65 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="w-full max-w-lg bg-card border border-border/80 rounded-[32px] shadow-2xl overflow-hidden relative z-10 flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-5 sm:p-6 pb-4 border-b border-border/60 bg-gradient-to-b from-purple-500/10 via-card to-card shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-purple-500/15 border border-purple-500/30 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 shadow-xs">
                  <ShieldAlert size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-600 dark:text-purple-400">
                      Audit Trail
                    </span>
                    {customer.displayId && (
                      <span className="text-[9px] font-mono font-bold bg-muted px-1.5 py-0.5 rounded text-text-secondary">
                        #{customer.displayId}
                      </span>
                    )}
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-text-primary tracking-tight truncate max-w-[240px] sm:max-w-xs">
                    {customer.name}
                  </h3>
                  <p className="text-[11px] font-medium text-text-secondary opacity-75">
                    {customer.phone || 'No phone registered'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-muted/80 hover:bg-muted text-text-secondary hover:text-text-primary flex items-center justify-center active:scale-95 transition-all cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Metrics Ribbon */}
            <div className="grid grid-cols-3 gap-2 mt-4">
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-2.5 text-center">
                <span className="text-[9px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 block">
                  Missed Days
                </span>
                <span className="text-base font-black text-text-primary">
                  {npRecords.length} {npRecords.length === 1 ? 'Day' : 'Days'}
                </span>
              </div>

              <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl p-2.5 text-center">
                <span className="text-[9px] font-black uppercase tracking-wider text-purple-600 dark:text-purple-400 block">
                  Total NP Debt
                </span>
                <span className="text-base font-black text-text-primary">
                  ₹{totalNPAmount.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="bg-muted border border-border/60 rounded-2xl p-2.5 text-center">
                <span className="text-[9px] font-black uppercase tracking-wider text-text-secondary block">
                  Loan Bal
                </span>
                <span className="text-base font-black text-text-primary">
                  ₹{currentBalance.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* View Switcher: Unpaid NP vs Recent Paid */}
            <div className="flex items-center gap-1 mt-3.5 bg-muted/70 p-1 rounded-xl border border-border/50 text-xs font-black">
              <button
                type="button"
                onClick={() => setActiveView('unpaid')}
                className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all uppercase tracking-wider text-[10px] ${
                  activeView === 'unpaid'
                    ? 'bg-card text-purple-600 dark:text-purple-400 shadow-xs'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <AlertTriangle size={12} />
                <span>Pending NP Dates ({npRecords.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveView('recent_paid')}
                className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all uppercase tracking-wider text-[10px] ${
                  activeView === 'recent_paid'
                    ? 'bg-card text-emerald-600 dark:text-emerald-400 shadow-xs'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <CheckCircle2 size={12} />
                <span>Recent Paid ({recentPaidRecords.length})</span>
              </button>
            </div>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
            {activeView === 'unpaid' ? (
              npRecords.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-center px-4">
                  <div className="w-12 h-12 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center mb-2.5">
                    <CheckCircle2 size={24} />
                  </div>
                  <h4 className="font-black text-sm text-text-primary uppercase tracking-tight">
                    No Pending NP Dates
                  </h4>
                  <p className="text-xs text-text-secondary max-w-xs mt-1">
                    This customer currently has no unpaid or missed installments.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between px-1 text-[11px] font-bold text-text-secondary">
                    <span>Chronological Missed Dates ({npRecords.length})</span>
                    <span className="text-[10px] uppercase tracking-wider text-purple-600 dark:text-purple-400">
                      Convert to Settle
                    </span>
                  </div>

                  {npRecords.map((r, index) => {
                    const dateInfo = formatDetailedDate(r.date, r.timestamp);
                    const isProcessing = isSettlingNPId === r.id;

                    return (
                      <div
                        key={r.id}
                        className="p-3 sm:p-3.5 bg-muted/40 hover:bg-muted/70 border border-border/80 rounded-2xl transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                      >
                        {/* Left: Date details */}
                        <div className="flex items-center gap-3">
                          {/* Calendar block */}
                          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/25 flex flex-col items-center justify-center shrink-0">
                            <span className="text-[8px] font-black uppercase text-amber-600 dark:text-amber-400 leading-tight">
                              Day #{index + 1}
                            </span>
                            <span className="text-xs font-black text-text-primary leading-tight mt-0.5">
                              {dateInfo.short}
                            </span>
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <h5 className="font-black text-xs sm:text-sm text-text-primary tracking-tight">
                                {dateInfo.fullDate}
                              </h5>
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400">
                                {dateInfo.dayName}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-text-secondary font-medium">
                              <span>Recorded: {safeFormat(r.unsettledAt || r.timestamp, 'hh:mm a')}</span>
                              <span>•</span>
                              <span className="text-amber-600 dark:text-amber-400 font-bold">{dateInfo.relative}</span>
                            </div>
                            {r.notes && (
                              <p className="text-[10px] italic text-text-secondary opacity-75 mt-0.5">
                                {r.notes}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Right: Amount & Convert actions */}
                        <div className="flex items-center justify-between sm:justify-end gap-2.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40 shrink-0">
                          <div className="text-left sm:text-right">
                            <span className="text-sm sm:text-base font-black text-amber-600 dark:text-amber-400 block leading-tight">
                              ₹{r.amount.toLocaleString('en-IN')}
                            </span>
                            <span className="text-[8px] font-bold uppercase tracking-wider text-text-secondary opacity-60">
                              Missed
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {/* Convert to Cash */}
                            <button
                              type="button"
                              disabled={isProcessing || isSettlingNPId !== null}
                              onClick={() => onSettleNP(r, customer, 'cash')}
                              className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 text-[10px] font-black uppercase tracking-wider active:scale-95 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                              title={`Convert NP for ${dateInfo.short} to Cash`}
                            >
                              {isProcessing ? (
                                <Loader2 size={11} className="animate-spin" />
                              ) : (
                                <Banknote size={11} strokeWidth={2.5} />
                              )}
                              <span>Cash</span>
                            </button>

                            {/* Convert to UPI */}
                            <button
                              type="button"
                              disabled={isProcessing || isSettlingNPId !== null}
                              onClick={() => onSettleNP(r, customer, 'phonepe')}
                              className="px-2.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1 text-[10px] font-black uppercase tracking-wider active:scale-95 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                              title={`Convert NP for ${dateInfo.short} to UPI`}
                            >
                              {isProcessing ? (
                                <Loader2 size={11} className="animate-spin" />
                              ) : (
                                <Smartphone size={11} strokeWidth={2.5} />
                              )}
                              <span>UPI</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              /* Recent Paid Records View */
              <div className="space-y-2">
                <p className="text-[11px] font-bold text-text-secondary px-1">
                  Recently Verified Collections ({recentPaidRecords.length})
                </p>

                {recentPaidRecords.length === 0 ? (
                  <div className="py-8 text-center text-xs text-text-secondary">
                    No payment history recorded yet.
                  </div>
                ) : (
                  recentPaidRecords.map((p) => (
                    <div
                      key={p.id}
                      className="p-3 bg-card border border-border/70 rounded-xl flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                          {p.type === 'cash' ? <Banknote size={16} /> : <Smartphone size={16} />}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-text-primary capitalize">
                              {p.type === 'phonepe' ? 'UPI' : p.type} Payment
                            </span>
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600">
                              Paid
                            </span>
                          </div>
                          <p className="text-[10px] text-text-secondary">
                            {safeFormat(p.paidAt || p.timestamp, 'dd MMM yyyy, hh:mm a')}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="font-black text-emerald-600 dark:text-emerald-400">
                          ₹{p.amount.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Footer Action Bar */}
          <div className="p-4 sm:p-5 border-t border-border/60 bg-muted/30 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2">
              {customer.phone && npRecords.length > 0 && (
                <button
                  type="button"
                  onClick={handleSendAuditWhatsApp}
                  className="px-3 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500 text-emerald-600 hover:text-white border border-emerald-500/30 flex items-center gap-1.5 text-xs font-bold transition-all active:scale-95 cursor-pointer"
                  title="Send full list of missed dates to customer via WhatsApp"
                >
                  <MessageSquare size={14} />
                  <span>Send NP Report</span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-card border border-border/80 hover:bg-muted text-text-primary font-bold text-xs uppercase tracking-wider active:scale-95 transition-all cursor-pointer"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
