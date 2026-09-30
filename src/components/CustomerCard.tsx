import React, { useState, useRef, useEffect } from 'react';
import { motion, animate, PanInfo, useMotionValue, useTransform, AnimatePresence } from 'motion/react';
import { Customer, Transaction } from '../services/firestoreService';
import { safeDistanceToNow, safeDifferenceInDays } from '../lib/utils';
import { Plus, Phone, X, IndianRupee, Clock, Pin, MessageCircle, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useUI } from '../context/UIContext';
import { useSwipeActions } from '../hooks/useSwipeActions';
import { SwipeActionBackground } from './SwipeActionBackground';
import { ContactPermissionModal } from './ContactPermissionModal';

interface CustomerCardProps {
  customer: Customer;
  transactions: Transaction[];
  onClick: () => void;
  onAddEntry: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onTogglePin?: () => void;
  activeSwipeId: string | null;
  setActiveSwipeId: (id: string | null) => void;
}

const Highlight = ({ text, highlight }: { text: string, highlight?: string }) => {
  if (!highlight || typeof highlight !== 'string' || !highlight.trim()) return <>{text}</>;
  
  const regex = new RegExp(`(${String(highlight).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = String(text || '').split(regex);
  
  return (
    <>
      {parts.map((part, i) => (
        regex.test(part) ? (
          <span key={i} className="bg-accent/20 text-accent rounded-sm px-0.5">{part}</span>
        ) : (
          <span key={i}>{part}</span>
        )
      ))}
    </>
  );
};

export function CustomerCard({ 
  customer, 
  transactions, 
  onClick, 
  onAddEntry, 
  onEdit, 
  onDelete,
  onTogglePin,
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

  useEffect(() => {
    if (prevIsOpen.current && !isOpen) {
      resetSwipe();
    }
    prevIsOpen.current = isOpen;
  }, [isOpen, resetSwipe]);

  // Hooking the drag end to setActiveSwipeId to maintain parent tracking
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

  const customerTransactions = transactions
    .filter(tx => tx.customerId === customer.id && tx.status === 'paid')
    .sort((a, b) => b.timestamp - a.timestamp);
  
  const lastActivity = customerTransactions[0];

  const displayId = String(customer.displayId || customer.id);
  const loanAmount = customer.loanAmount || customer.loan || 0;
  const pendingAmount = customer.pending !== undefined ? customer.pending : (loanAmount - (customer.paid || 0));
  const paidAmount = customer.paid || 0;

  const isOverdue = customer.endDate < Date.now() && pendingAmount > 0;
  const isFullyPaid = pendingAmount <= 0;

  let statusColor = 'bg-warning';
  let statusText = 'text-warning';
  if (isFullyPaid) {
    statusColor = 'bg-success';
    statusText = 'text-success';
  } else if (isOverdue) {
    statusColor = 'bg-danger';
    statusText = 'text-danger';
  }

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const isPaidToday = transactions.some(
    tx => tx.customerId === customer.id && tx.status === 'paid' && tx.date === todayStr && !tx.isDeleted
  );
  const isEntryDisabled = isPaidToday || isFullyPaid;

  const progress = loanAmount > 0 ? Math.min(100, Math.max(0, (paidAmount / loanAmount) * 100)) : 0;

  const getTag = () => {
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
  };
  const tag = getTag();

  return (
    <div className="relative w-full overflow-hidden rounded-2xl mb-3" ref={containerRef}>
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
        className={`relative bg-card w-full flex items-center gap-3 cursor-pointer z-10 border border-border/80 rounded-2xl shadow-sm transition-all ${isCompact ? 'py-2.5 px-3' : 'p-4'}`}
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
          <div className={`${isCompact ? 'w-10 h-10 text-base' : 'w-12 h-12 text-lg'} rounded-full bg-accent/10 text-accent flex items-center justify-center font-black uppercase tracking-tighter`}>
            {customer.name ? customer.name.charAt(0) : '👤'}
          </div>
          <div className={`absolute -bottom-0.5 -right-0.5 ${isCompact ? 'w-3 h-3 border' : 'w-4 h-4 border-2'} rounded-full border-card ${statusColor}`} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className={`flex justify-between items-center ${isCompact ? 'mb-0' : 'mb-1'}`}>
            <h3 className={`font-black tracking-tight text-text-primary truncate pr-2 ${isCompact ? 'text-[15px]' : 'text-base'}`}>
              <Highlight text={String(customer.name)} highlight={searchTerm} />
            </h3>
            <span className={`font-black text-text-secondary whitespace-nowrap opacity-40 ${isCompact ? 'text-[9px] tracking-widest uppercase' : 'text-xs px-2 py-0.5 rounded-md bg-bg'}`}>
              {tag}
            </span>
          </div>
          
          <div className="flex justify-between items-end gap-2 mt-1">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className={`${isCompact ? 'text-[10px]' : 'text-xs'} font-bold text-text-secondary opacity-50`}>
                  ID: <Highlight text={displayId} highlight={searchTerm} />
                </p>
                {isCompact && (
                  <>
                    <div className="w-1 h-1 rounded-full bg-border" />
                    <p className="text-[10px] font-bold text-text-secondary opacity-50 truncate">
                       {lastActivity ? `Last: ₹${lastActivity.amount}` : 'New'}
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
                {!isCompact && <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest opacity-40 mb-0.5">Pending</p>}
                <p className={`font-black tracking-tighter leading-none ${statusText} ${isCompact ? 'text-lg' : 'text-xl'}`}>
                  <span className={`${isCompact ? 'text-[10px]' : 'text-xs'} mr-0.5 opacity-40 font-bold`}>₹</span>
                  {pendingAmount.toLocaleString()}
                </p>
              </div>

              {/* (+) Entry Button - Disabled if already in Paid section for today or fully paid */}
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
                    : isFullyPaid
                    ? `Account fully settled`
                    : `Add collection entry for ${customer.name}`
                }
                aria-label={`Add entry for ${customer.name}`}
                className={`flex items-center justify-center gap-1 font-black transition-all z-20 ${
                  isEntryDisabled
                    ? 'bg-muted/70 text-text-secondary/40 border border-border/40 cursor-not-allowed shadow-none'
                    : 'bg-accent text-white shadow-sm hover:bg-accent/90 active:scale-95 cursor-pointer'
                } ${
                  isCompact 
                    ? 'h-7 px-2 rounded-lg text-[10px] tracking-wide' 
                    : 'h-8 px-2.5 rounded-xl text-xs shadow-accent/20 shadow-sm'
                }`}
              >
                {isPaidToday ? (
                  <>
                    <CheckCircle2 size={isCompact ? 12 : 14} className="text-emerald-500" strokeWidth={2.5} />
                    <span className="text-emerald-600 dark:text-emerald-400">Paid</span>
                  </>
                ) : (
                  <>
                    <Plus size={isCompact ? 13 : 15} strokeWidth={3} />
                    <span>Entry</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Mini Progress Bar (Show only in Normal mode or very subtle in Compact) */}
          {!isCompact && (
            <div className="w-full h-1.5 bg-bg rounded-full mt-3 overflow-hidden">
              <div 
                className={`h-full rounded-full ${statusColor}`}
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
}
