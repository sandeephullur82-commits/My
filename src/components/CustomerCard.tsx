import React, { useRef, useMemo } from 'react';
import { motion, PanInfo } from 'motion/react';
import { Customer, Transaction } from '../services/firestoreService';
import { safeDistanceToNow, safeDifferenceInDays } from '../lib/utils';
import { Plus, CheckCircle2, RotateCcw, ArrowUpRight } from 'lucide-react';
import { format } from 'date-fns';
import { useUI } from '../context/UIContext';
import { useSwipeActions } from '../hooks/useSwipeActions';
import { SwipeActionBackground } from './SwipeActionBackground';
import { ContactPermissionModal } from './ContactPermissionModal';
import { Highlight } from './Highlight';

interface CustomerCardProps {
  customer: Customer;
  transactions?: Transaction[];
  lastActivity?: Transaction;
  isPaidToday?: boolean;
  onClick: () => void;
  onAddEntry: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onTogglePin?: () => void;
  onStartNewLoan?: () => void;
  onWithdraw?: (customer: Customer) => void;
  activeSwipeId: string | null;
  setActiveSwipeId: (id: string | null) => void;
}

export const CustomerCard = React.memo(function CustomerCard({ 
  customer, 
  transactions = [], 
  lastActivity: propLastActivity,
  isPaidToday: propIsPaidToday,
  onClick, 
  onAddEntry, 
  onEdit, 
  onDelete, 
  onTogglePin, 
  onStartNewLoan, 
  onWithdraw, 
  activeSwipeId, 
  setActiveSwipeId 
}: CustomerCardProps) {
  const { isCompact, searchTerm } = useUI();
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    x,
    leftActionOpacity,
    rightActionOpacity,
    swipedAction,
    confirmModal,
    resetSwipe,
    handleActionTap,
    handleConfirmAction,
    handleCancelModal,
    handleDragStart,
    handleDragEnd,
  } = useSwipeActions({
    customerName: customer.name,
    customerPhone: customer.phone,
    customerId: customer.id,
  });

  const isOpen = activeSwipeId === customer.id;
  const prevIsOpen = useRef(isOpen);

  React.useEffect(() => {
    if (prevIsOpen.current && !isOpen) {
      resetSwipe();
    }
    prevIsOpen.current = isOpen;
  }, [isOpen, resetSwipe]);

  const wrappedDragEnd = (event: any, info: PanInfo) => {
    const threshold = 55;
    handleDragEnd(event, info);
    if (info.offset.x > threshold || info.offset.x < -threshold) {
      setActiveSwipeId(customer.id);
    } else {
      setActiveSwipeId(null);
    }
  };

  const wrappedDragStart = () => {
    handleDragStart();
    setActiveSwipeId(customer.id);
  };

  // High-performance memoized last activity calculation
  const lastActivity = useMemo(() => {
    if (propLastActivity !== undefined) return propLastActivity;
    if (!transactions || transactions.length === 0) return undefined;
    const paid = transactions
      .filter(tx => tx.customerId === customer.id && tx.status === 'paid')
      .sort((a, b) => b.timestamp - a.timestamp);
    return paid[0];
  }, [propLastActivity, transactions, customer.id]);

  const displayId = String(customer.displayId || customer.id);
  const loanAmount = customer.loanAmount || customer.loan || 0;
  const pendingAmount = customer.pending !== undefined ? customer.pending : (loanAmount - (customer.paid || 0));
  const paidAmount = customer.paid || 0;

  const isOverdue = customer.endDate < Date.now() && pendingAmount > 0;
  const isFullyPaid = pendingAmount <= 0;
  const currentCycle = customer.currentCycle || 1;

  let statusColor = 'bg-warning';
  let statusText = 'text-warning';
  if (isFullyPaid) {
    statusColor = 'bg-success';
    statusText = 'text-success';
  } else if (isOverdue) {
    statusColor = 'bg-danger';
    statusText = 'text-danger';
  }

  // High-performance isPaidToday check
  const isPaidToday = useMemo(() => {
    if (propIsPaidToday !== undefined) return propIsPaidToday;
    if (!transactions || transactions.length === 0) return false;
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    return transactions.some(
      tx => tx.customerId === customer.id && tx.status === 'paid' && tx.date === todayStr && !tx.isDeleted
    );
  }, [propIsPaidToday, transactions, customer.id]);

  const isEntryDisabled = isPaidToday || isFullyPaid;
  const progress = loanAmount > 0 ? Math.min(100, Math.max(0, (paidAmount / loanAmount) * 100)) : 0;

  const tag = useMemo(() => {
    if (customer.frequency === 'daily' || customer.frequencyDays === 1) return 'Daily (1d)';
    if (customer.frequency === 'weekly' || customer.frequencyDays === 7) return 'Weekly (7d)';
    if (customer.frequency === 'monthly' || customer.frequencyDays === 30) return 'Monthly (30d)';
    if (customer.frequencyDays && customer.frequencyDays > 0) return `${customer.frequencyDays}d`;

    const dur = safeDifferenceInDays(customer.endDate, customer.startDate) + 1;
    if (dur === 1) return 'Daily (1d)';
    if (dur === 7) return 'Weekly (7d)';
    if (dur === 30) return 'Monthly (30d)';
    if (dur > 100) return 'Monthly';
    if (dur > 40) return 'Weekly';
    return 'Daily';
  }, [customer.frequency, customer.frequencyDays, customer.endDate, customer.startDate]);

  return (
    <div className="relative w-full overflow-hidden rounded-2xl mb-2.5" ref={containerRef}>
      {/* Background Actions */}
      <SwipeActionBackground
        leftActionOpacity={leftActionOpacity}
        rightActionOpacity={rightActionOpacity}
        onActionTap={handleActionTap}
        customerName={customer.name}
        customerId={customer.id}
      />

      {/* Foreground Card */}
      <motion.div
        id={`customer-card-${customer.id}`}
        drag="x"
        dragConstraints={{ left: -140, right: 120 }}
        dragElastic={0.05}
        dragMomentum={false}
        onDragStart={wrappedDragStart}
        onDragEnd={wrappedDragEnd}
        style={{ x }}
        className={`relative bg-card w-full flex items-center gap-3 cursor-pointer z-10 border border-border/80 rounded-2xl shadow-xs transition-colors hover:border-accent/40 ${isCompact ? 'py-2.5 px-3' : 'p-3.5 sm:p-4'}`}
        onClick={(e) => {
          if (swipedAction !== null) {
            e.stopPropagation();
            resetSwipe();
          } else {
            onClick();
          }
        }}
      >
        {/* Left Border Strip */}
        <div className={`absolute left-0 top-0 bottom-0 w-1 ${statusColor}`} />

        {/* Avatar & Status */}
        <div className="relative ml-2">
          <div className={`${isCompact ? 'w-9 h-9 text-sm' : 'w-11 h-11 text-base'} rounded-full bg-accent/10 text-accent flex items-center justify-center font-black uppercase tracking-tight`}>
            {customer.name ? customer.name.charAt(0) : '👤'}
          </div>
          <div className={`absolute -bottom-0.5 -right-0.5 ${isCompact ? 'w-2.5 h-2.5 border' : 'w-3.5 h-3.5 border-2'} rounded-full border-card ${statusColor}`} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className={`flex justify-between items-center ${isCompact ? 'mb-0' : 'mb-0.5'}`}>
            <h3 className={`font-black tracking-tight text-text-primary truncate pr-2 ${isCompact ? 'text-[14px]' : 'text-base'}`}>
              <Highlight text={String(customer.name)} highlight={searchTerm} />
            </h3>
            <div className="flex items-center gap-1.5 shrink-0">
              {currentCycle > 1 && (
                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  C#{currentCycle}
                </span>
              )}
              {customer.renewalStatus === 'rejected' && isOverdue && (
                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md bg-red-500/15 text-red-600 dark:text-red-400">
                  Overdue
                </span>
              )}
              <span className="text-[10px] font-semibold text-text-secondary whitespace-nowrap bg-muted/60 px-2 py-0.5 rounded-md">
                {tag}
              </span>
            </div>
          </div>
          
          <div className="flex justify-between items-end gap-2 mt-1">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className={`${isCompact ? 'text-[10px]' : 'text-xs'} font-bold text-text-secondary`}>
                  ID: <Highlight text={displayId} highlight={searchTerm} />
                </p>
                {isCompact && lastActivity && (
                  <>
                    <div className="w-1 h-1 rounded-full bg-border" />
                    <p className="text-[10px] font-medium text-text-secondary truncate">
                      Last: ₹{lastActivity.amount}
                    </p>
                  </>
                )}
              </div>
              {!isCompact && (
                <p className="text-xs font-medium text-text-secondary truncate mt-0.5">
                  {lastActivity 
                    ? `Last: ₹${lastActivity.amount} • ${safeDistanceToNow(lastActivity.timestamp, { addSuffix: true })}`
                    : 'No recent activity'}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <div className="text-right">
                {!isCompact && (
                  <p className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${
                    isFullyPaid && (customer.advanceBalance || 0) > 0 ? 'text-sky-600 dark:text-sky-400' : 'text-text-secondary'
                  }`}>
                    {isFullyPaid && (customer.advanceBalance || 0) > 0 ? 'Advance' : 'Pending'}
                  </p>
                )}
                <p className={`font-black tracking-tight leading-none ${
                  isFullyPaid && (customer.advanceBalance || 0) > 0 ? 'text-sky-600 dark:text-sky-400' : statusText
                } ${isCompact ? 'text-base' : 'text-lg'}`}>
                  <span className="text-xs mr-0.5 opacity-60 font-bold">₹</span>
                  {isFullyPaid && (customer.advanceBalance || 0) > 0 
                    ? (customer.advanceBalance || 0).toLocaleString('en-IN')
                    : pendingAmount.toLocaleString('en-IN')}
                </p>
              </div>

              {/* Action Button: "New Loan" / "Withdraw" if fully paid, or (+) Entry Button if active */}
              {isFullyPaid ? (
                <div className="flex items-center gap-1.5">
                  {(customer.advanceBalance || 0) > 0 && onWithdraw && (
                    <button
                      id={`customer-withdraw-btn-${customer.id}`}
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (navigator.vibrate) navigator.vibrate(15);
                        onWithdraw(customer);
                      }}
                      title={`Withdraw advance deposit of ₹${(customer.advanceBalance || 0).toLocaleString('en-IN')} for ${customer.name}`}
                      aria-label={`Withdraw advance deposit for ${customer.name}`}
                      className={`flex items-center gap-1 transition-all z-20 bg-amber-600 hover:bg-amber-700 text-white font-black uppercase tracking-wider shadow-xs active:scale-95 cursor-pointer ${
                        isCompact ? 'px-2 py-1 text-[10px] rounded-lg' : 'px-2.5 py-1.5 text-xs rounded-xl'
                      }`}
                    >
                      <ArrowUpRight size={isCompact ? 11 : 13} strokeWidth={2.5} />
                      <span>Withdraw</span>
                    </button>
                  )}

                  <button
                    id={`customer-new-loan-btn-${customer.id}`}
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (navigator.vibrate) navigator.vibrate(15);
                      if (onStartNewLoan) {
                        onStartNewLoan();
                      } else {
                        onClick();
                      }
                    }}
                    title={`Start Cycle #${currentCycle + 1} New Loan for ${customer.name}`}
                    aria-label={`Start New Loan for ${customer.name}`}
                    className={`flex items-center gap-1.5 transition-all z-20 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-wider shadow-xs active:scale-95 cursor-pointer ${
                      isCompact ? 'px-2 py-1 text-[10px] rounded-lg' : 'px-2.5 py-1.5 text-xs rounded-xl'
                    }`}
                  >
                    <RotateCcw size={isCompact ? 11 : 13} strokeWidth={2.5} />
                    <span>New Loan</span>
                  </button>
                </div>
              ) : (
                <button
                  id={`customer-add-entry-btn-${customer.id}`}
                  type="button"
                  disabled={isEntryDisabled}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isEntryDisabled) return;
                    if (navigator.vibrate) navigator.vibrate(12);
                    onAddEntry();
                  }}
                  title={
                    isPaidToday
                      ? `Already collected today in Paid section`
                      : `Add collection entry for ${customer.name}`
                  }
                  aria-label={`Add entry for ${customer.name}`}
                  className={`flex items-center justify-center transition-all z-20 ${
                    isEntryDisabled
                      ? 'bg-muted/70 text-text-secondary/40 border border-border/40 cursor-not-allowed shadow-none'
                      : 'bg-accent text-white shadow-xs hover:bg-accent/90 active:scale-95 cursor-pointer'
                  } ${
                    isCompact ? 'w-7 h-7 rounded-lg' : 'w-8 h-8 rounded-xl shadow-accent/20'
                  }`}
                >
                  {isPaidToday ? (
                    <CheckCircle2 size={isCompact ? 13 : 15} className="text-emerald-500" strokeWidth={2.5} />
                  ) : (
                    <Plus size={isCompact ? 15 : 18} strokeWidth={2.5} />
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Mini Progress Bar */}
          {!isCompact && (
            <div className="w-full h-1.5 bg-muted rounded-full mt-2.5 overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-300 ${statusColor}`}
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
      </motion.div>

      <ContactPermissionModal
        isOpen={confirmModal !== null}
        type={confirmModal}
        customerName={customer.name}
        customerPhone={customer.phone}
        customerId={customer.id}
        onConfirm={handleConfirmAction}
        onCancel={handleCancelModal}
      />
    </div>
  );
});
