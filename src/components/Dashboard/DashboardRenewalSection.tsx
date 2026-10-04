import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  RotateCcw, 
  AlertTriangle, 
  X, 
  Phone, 
  Calendar, 
  Check, 
  ArrowRight, 
  Clock, 
  ChevronDown, 
  ChevronUp,
  ShieldAlert,
  Bell
} from 'lucide-react';
import { Customer, firestoreService } from '../../services/firestoreService';
import { notificationService } from '../../services/notificationService';
import { safeDistanceToNow, safeDifferenceInDays, safeFormat } from '../../lib/utils';
import { MaturedRenewalModal } from './MaturedRenewalModal';
import { toast } from 'sonner';

interface DashboardRenewalSectionProps {
  customers: Customer[];
  onNavigate?: (tab: string, filter?: any, customerId?: string) => void;
}

export function DashboardRenewalSection({ customers, onNavigate }: DashboardRenewalSectionProps) {
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [isNotifying, setIsNotifying] = useState(false);

  // Filter accounts whose loan end date is completed (past or today) with remaining unpaid balance, not rejected
  const now = Date.now();
  const maturedCustomers = useMemo(() => {
    return customers.filter(c => {
      if (c.isDeleted) return false;
      if (c.renewalStatus === 'rejected') return false;

      const totalLoan = c.loanAmount || c.loan || 0;
      const paid = c.paid || 0;
      const pending = c.pending !== undefined ? c.pending : (totalLoan - paid);

      // Must have remaining balance AND end date completed
      const isExpired = c.endDate <= now;
      return isExpired && pending > 0;
    }).sort((a, b) => a.endDate - b.endDate); // Oldest expired first
  }, [customers, now]);

  const totalRemainingDebt = useMemo(() => {
    return maturedCustomers.reduce((acc, c) => {
      const totalLoan = c.loanAmount || c.loan || 0;
      const paid = c.paid || 0;
      const pending = c.pending !== undefined ? c.pending : (totalLoan - paid);
      return acc + pending;
    }, 0);
  }, [maturedCustomers]);

  // Automated Android notification for matured loan renewals (dispatched once per day/session)
  useEffect(() => {
    if (maturedCustomers.length > 0) {
      const sessionNotifiedKey = `pigmy_renewals_notified_${new Date().toISOString().slice(0, 10)}`;
      if (!sessionStorage.getItem(sessionNotifiedKey)) {
        sessionStorage.setItem(sessionNotifiedKey, 'true');
        notificationService.notifyRenewalSummary(maturedCustomers.length, totalRemainingDebt).catch(() => {});
      }
    }
  }, [maturedCustomers.length, totalRemainingDebt]);

  if (maturedCustomers.length === 0) return null;

  const handleTriggerRenewalNotification = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsNotifying(true);
    try {
      await notificationService.notifyRenewalSummary(maturedCustomers.length, totalRemainingDebt);
      toast.success('Android Renewal Notification Sent!', {
        description: `${maturedCustomers.length} accounts sent to your Android notification tray.`
      });
    } catch (err) {
      console.warn('Failed to send renewal notification:', err);
      toast.error('Could not deliver Android notification');
    } finally {
      setTimeout(() => setIsNotifying(false), 1000);
    }
  };

  const handleSendCustomerAlert = async (e: React.MouseEvent, customer: Customer, pending: number, daysPastMaturity: number) => {
    e.stopPropagation();
    try {
      await notificationService.notifyRenewalDue({
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        pending,
        endDate: customer.endDate,
        daysOverdue: daysPastMaturity
      });
      toast.success(`Android alert sent for ${customer.name}!`);
    } catch {
      toast.error('Could not send notification');
    }
  };

  const handleRejectRenewal = async (customer: Customer) => {
    try {
      setRejectingId(customer.id);
      await firestoreService.rejectMaturedRenewal(customer.id, customer.docPath);
      const totalLoan = customer.loanAmount || customer.loan || 0;
      const paid = customer.paid || 0;
      const pending = customer.pending !== undefined ? customer.pending : (totalLoan - paid);

      // Trigger Android system notification for rejected renewal
      notificationService.notifyRenewalRejected(customer.name, pending, customer.id).catch(() => {});

      toast.info(`Renewal rejected for ${customer.name}`, {
        description: 'Account kept as Overdue in regular collection list.'
      });
    } catch (err: any) {
      console.error('Failed to reject renewal:', err);
      toast.error('Failed to reject renewal');
    } finally {
      setRejectingId(null);
    }
  };

  return (
    <div className="w-full bg-card border border-amber-500/30 rounded-[28px] overflow-hidden shadow-sm">
      {/* Top Banner Header */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-4 sm:p-5 bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-transparent flex items-center justify-between cursor-pointer select-none gap-2 flex-wrap sm:flex-nowrap"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 shadow-xs">
            <RotateCcw size={20} strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-black text-text-primary uppercase tracking-tight">
                Matured Loan Renewals
              </h3>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/25 text-amber-600 dark:text-amber-400 font-mono">
                {maturedCustomers.length}
              </span>
            </div>
            <p className="text-[11px] text-text-secondary mt-0.5 font-medium truncate">
              ₹{totalRemainingDebt.toLocaleString('en-IN')} pending balance across expired accounts
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-auto sm:ml-0">
          {/* Send Android Notification Button */}
          <button
            type="button"
            onClick={handleTriggerRenewalNotification}
            disabled={isNotifying}
            className="h-8 px-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-700 dark:text-amber-300 font-bold text-[11px] uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95 border border-amber-500/30 cursor-pointer disabled:opacity-50"
            title="Send Android Notification alert for all matured renewals"
          >
            <Bell size={13} strokeWidth={2.5} className={isNotifying ? 'animate-bounce' : ''} />
            <span className="hidden xs:inline">Notify Android</span>
          </button>

          <button 
            type="button" 
            className="w-8 h-8 rounded-xl bg-card border border-border/60 flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors shrink-0"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Matured Cards Feed */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="divide-y divide-border/60 overflow-hidden"
          >
            {maturedCustomers.map((customer) => {
              const originalLoan = customer.loanAmount || customer.loan || 0;
              const paid = customer.paid || 0;
              const pending = customer.pending !== undefined ? customer.pending : (originalLoan - paid);
              const daysPastMaturity = Math.max(0, safeDifferenceInDays(now, customer.endDate));
              const currentCycle = customer.currentCycle || 1;

              return (
                <div 
                  key={customer.id} 
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 hover:bg-muted/20 transition-colors"
                >
                  {/* Customer Info & Matured Meta */}
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black uppercase shrink-0 text-sm mt-0.5">
                      {customer.name ? customer.name.charAt(0) : '👤'}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-sm text-text-primary tracking-tight truncate">
                          {customer.name}
                        </span>
                        <span className="text-[10px] font-bold text-text-secondary opacity-60 font-mono">
                          #{customer.displayId || customer.id}
                        </span>
                        {currentCycle > 1 && (
                          <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded-md bg-muted text-text-secondary">
                            Cycle #{currentCycle}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-text-secondary mt-1 flex-wrap">
                        <span className="text-danger font-semibold flex items-center gap-1">
                          <Clock size={12} />
                          <span>Matured {daysPastMaturity === 0 ? 'today' : `${daysPastMaturity}d ago`}</span>
                        </span>
                        <span aria-hidden="true" className="opacity-40">·</span>
                        <span className="text-text-secondary opacity-80">
                          Repaid ₹{paid.toLocaleString('en-IN')} of ₹{originalLoan.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Financial Balance & Actions */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
                    <div className="text-left sm:text-right">
                      <span className="text-[9px] font-bold text-text-secondary uppercase tracking-wider block">
                        Remaining Due
                      </span>
                      <span className="text-base font-black text-danger font-mono tracking-tight block">
                        ₹{pending.toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Individual Android Notification Alert */}
                      <button
                        type="button"
                        onClick={(e) => handleSendCustomerAlert(e, customer, pending, daysPastMaturity)}
                        className="w-8 h-8 rounded-xl bg-muted hover:bg-amber-500/20 hover:text-amber-600 text-text-secondary flex items-center justify-center transition-colors active:scale-95 cursor-pointer"
                        title="Send Android notification alert for this account"
                      >
                        <Bell size={13} />
                      </button>

                      {/* Reject Button */}
                      <button
                        type="button"
                        disabled={rejectingId === customer.id}
                        onClick={() => handleRejectRenewal(customer)}
                        className="px-3 py-2 rounded-xl bg-muted hover:bg-danger/15 hover:text-danger text-text-secondary font-bold text-xs uppercase tracking-wider transition-colors active:scale-95 disabled:opacity-50 cursor-pointer"
                        title="Dismiss from renewals and keep as overdue"
                      >
                        Reject
                      </button>

                      {/* Renew Button */}
                      <button
                        type="button"
                        onClick={() => setSelectedCustomer(customer)}
                        className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-sm shadow-amber-600/30 active:scale-95 transition-all cursor-pointer"
                        title="Restructure remaining balance with interest"
                      >
                        <RotateCcw size={13} strokeWidth={2.5} />
                        <span>Renew</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Interactive Renewal Modal */}
      <MaturedRenewalModal
        isOpen={!!selectedCustomer}
        onClose={() => setSelectedCustomer(null)}
        customer={selectedCustomer}
        onSuccess={() => {
          setSelectedCustomer(null);
        }}
      />
    </div>
  );
}
