import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Customer, Transaction, firestoreService, firestoreUtils } from '../../services/firestoreService';
import { Smartphone, Clock, Loader2, Banknote, CheckCircle2, AlertTriangle, RotateCcw, MessageSquare, Phone, X, ExternalLink, Receipt, Lock, ShieldCheck, ArrowRight, Calendar } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { format, subDays, parseISO, isYesterday } from 'date-fns';
import { toast } from 'sonner';
import { useFeedback } from '../../context/FeedbackContext';
import { useSwipeActions } from '../../hooks/useSwipeActions';
import { SwipeActionBackground } from '../SwipeActionBackground';
import { ContactPermissionModal } from '../ContactPermissionModal';
import { playSuccessSound } from '../../lib/sound';

interface CustomerCardProps {
  customer: Customer;
  allTransactions: Transaction[];
  isHighlighted?: boolean;
  todayStr: string;
  searchTerm?: string;
  onSkip?: () => void;
  onSuccess?: (tx: Transaction, previousBalance: number, newBalance: number) => void;
  onViewReceipt?: (tx: Transaction) => void;
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

export const CustomerCard = React.memo(function CustomerCard({ 
  customer, 
  allTransactions = [],
  lastEntry,
  recentTransactions, // Only a few recent ones for suggestions, or pre-computed suggestions
  balance,
  overdueInfo,
  isHighlighted,
  todayStr,
  searchTerm,
  onSkip,
  onSuccess,
  onViewReceipt
}: CustomerCardProps & { 
  lastEntry?: Transaction, 
  recentTransactions: Transaction[],
  balance: number,
  overdueInfo: { isOverdue: boolean, amount: number }
}) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingType, setProcessingType] = useState<string | null>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);

  // Standard daily installment based on customer duration and loan
  const standardDaily = useMemo(() => {
    const duration = customer.durationDays || 100;
    const loanTotal = customer.loanAmount || customer.loan || 0;
    const calculated = duration > 0 ? Math.round(loanTotal / duration) : 100;
    return calculated > 0 ? calculated : 100;
  }, [customer.durationDays, customer.loanAmount, customer.loan]);

  // Track NP transactions settled locally during the current active card session
  const [settledNPIds, setSettledNPIds] = useState<string[]>([]);

  // Identify all explicitly recorded unsettled NP transactions across ANY past day
  const pendingNPEntries = useMemo(() => {
    return (allTransactions || [])
      .filter(t => 
        t.customerId === customer.id && 
        !t.isDeleted && 
        (t.type === 'NP' || t.type === 'unsettled' || t.status === 'unsettled')
      )
      .sort((a, b) => {
        // Chronological order: Oldest pending NP day first
        const dateComp = (a.date || '').localeCompare(b.date || '');
        if (dateComp !== 0) return dateComp;
        return (a.timestamp || 0) - (b.timestamp || 0);
      });
  }, [allTransactions, customer.id]);

  // Active pending NP entries that have not been settled yet
  const activePendingNPEntries = useMemo(() => {
    return pendingNPEntries.filter(t => !settledNPIds.includes(t.id));
  }, [pendingNPEntries, settledNPIds]);

  // Oldest pending NP record (always prioritized first)
  const currentPendingNP = activePendingNPEntries[0] || null;
  const isNPMode = !!currentPendingNP && balance > 0;

  // Format date label for the current pending NP
  const pendingNPDateLabel = useMemo(() => {
    if (!currentPendingNP) return '';
    try {
      if (currentPendingNP.date) {
        const parsed = parseISO(currentPendingNP.date);
        if (!isNaN(parsed.getTime())) {
          if (isYesterday(parsed)) return 'Yesterday';
          return format(parsed, 'dd MMM yyyy');
        }
      }
    } catch (e) {
      // fallback
    }
    return currentPendingNP.date || 'Past Due';
  }, [currentPendingNP]);

  const currentNPAmount = currentPendingNP?.amount || standardDaily;
  
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

  const { toastTransaction, toastError } = useFeedback();

  // Local drafted amount
  const [amount, setAmount] = useState<number>(() => {
    const draft = localStorage.getItem(`draft_${customer.id}_${todayStr}`);
    return draft ? parseInt(draft) : 100;
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const [userHasTyped, setUserHasTyped] = useState(false);

  // Auto-focus when highlighted
  useEffect(() => {
    if (isHighlighted && inputRef.current) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isHighlighted]);

  useEffect(() => {
    if (amount !== 100) {
      localStorage.setItem(`draft_${customer.id}_${todayStr}`, amount.toString());
    }
  }, [amount, customer.id, todayStr]);

  const handleInputChange = (val: string) => {
    const num = parseInt(val) || 0;
    setAmount(num);
    setUserHasTyped(true);
  };

  const handleInputFocus = () => {
    setIsInputFocused(true);
  };

  // Memoized Suggestions
  const suggestions = useMemo(() => {
    if (userHasTyped && !isInputFocused) return [];
    const list: number[] = [];
    
    if (balance > 0 && balance < 5000 && !list.includes(balance)) {
      list.push(balance);
    }

    if (recentTransactions.length > 0) {
      const lastAmt = recentTransactions[0].amount;
      if (lastAmt && !list.includes(lastAmt)) {
        list.push(lastAmt);
      }
    }

    // Frequent
    if (recentTransactions.length > 2) {
      const frequencies: { [key: number]: number } = {};
      recentTransactions.forEach(t => frequencies[t.amount] = (frequencies[t.amount] || 0) + 1);
      const sortedFreq = Object.entries(frequencies).sort((a, b) => b[1] - a[1]);
      const freqAmt = parseInt(sortedFreq[0][0]);
      if (freqAmt && !list.includes(freqAmt)) {
        list.push(freqAmt);
      }
    }

    // Fallbacks
    [100, 200, 500].forEach(fallback => {
      if (list.length < 3 && !list.includes(fallback)) list.push(fallback);
    });

    return list.slice(0, 3).sort((a, b) => a - b);
  }, [balance, recentTransactions, userHasTyped, isInputFocused]);

  const handleAction = async (type: 'cash' | 'phonepe' | 'unsettled' | 'NP', customAmount?: number) => {
    const targetAmount = customAmount !== undefined ? customAmount : amount;
    if (isProcessing) return;
    
    if (targetAmount < 1) {
      toastError('Invalid Amount', 'Enter an amount greater than ₹0');
      return;
    }

    setIsProcessing(true);
    setProcessingType(type);

    // Record type as NP for Not Paid: captures debt/unpaid record without reducing customer balance
    const isNP = type === 'NP' || type === 'unsettled';
    const actualType: Transaction['type'] = isNP ? 'NP' : type;
    const statusValue: Transaction['status'] = isNP ? 'unsettled' : 'paid';
    
    localStorage.removeItem(`draft_${customer.id}_${todayStr}`);

    const newTx: Transaction = {
      id: uuidv4(),
      customerId: customer.id,
      amount: targetAmount,
      type: actualType,
      status: statusValue,
      date: todayStr,
      timestamp: Date.now(),
      paidAt: isNP ? null : Date.now(),
      unsettledAt: isNP ? Date.now() : null
    };

    const previousBal = balance;
    // When payment type is NP, overall balance is NOT reduced
    const newBal = isNP ? balance : Math.max(0, balance - targetAmount);

    try {
      // Instantly save to Firestore
      await firestoreService.saveTransaction(newTx, customer);

      if (navigator.vibrate) navigator.vibrate(40);
      playSuccessSound();

      if (onSuccess) {
        onSuccess(newTx, previousBal, newBal);
      }
    } catch (error) {
      toastError('Save Failed', 'Could not sync transaction.');
    } finally {
      setIsProcessing(false);
      setProcessingType(null);
    }
  };

  // Settle Oldest Pending NP First
  const handleClearPendingNP = async (payType: 'cash' | 'phonepe') => {
    if (isProcessing || !currentPendingNP) return;
    setIsProcessing(true);
    setProcessingType(payType);

    const targetNP = currentPendingNP;
    const targetAmount = targetNP.amount || standardDaily;
    const previousBal = balance;
    const newBal = Math.max(0, balance - targetAmount);
    const dateLabel = pendingNPDateLabel;

    try {
      // Update existing NP record to paid
      await firestoreService.updateTransaction(
        targetNP.id,
        {
          type: payType,
          status: 'paid',
          amount: targetAmount,
          paidAt: Date.now(),
          notes: `NP for ${targetNP.date || dateLabel} Cleared via ${payType.toUpperCase()}`
        },
        targetNP,
        customer,
        `Clear NP (${targetNP.date})`
      );

      const settlementTx: Transaction = {
        ...targetNP,
        type: payType,
        status: 'paid',
        amount: targetAmount,
        paidAt: Date.now(),
        notes: `NP for ${targetNP.date || dateLabel} Cleared via ${payType.toUpperCase()}`
      };

      if (navigator.vibrate) navigator.vibrate(50);
      playSuccessSound();

      // Show receipt popup immediately for this NP clearance
      if (onSuccess) {
        onSuccess(settlementTx, previousBal, newBal);
      }

      // Mark this specific NP as settled locally
      setSettledNPIds(prev => [...prev, targetNP.id]);

      const remainingAfter = activePendingNPEntries.length - 1;
      if (remainingAfter > 0) {
        toast.success(`Cleared NP for ${dateLabel}! ${remainingAfter} more pending NP queued.`);
      } else {
        toast.success(`Cleared all pending NPs! Now collect today's installment.`);
      }
    } catch (err) {
      toastError('Clear Failed', `Could not clear NP for ${dateLabel}. Please try again.`);
    } finally {
      setIsProcessing(false);
      setProcessingType(null);
    }
  };

  return (
    <div className="relative group select-none">
      {/* Swipe Actions Background */}
      <SwipeActionBackground
        leftActionOpacity={leftActionOpacity}
        rightActionOpacity={rightActionOpacity}
        onActionTap={handleActionTap}
        customerName={customer.name}
        customerId={customer.id}
        roundedClass="rounded-[24px]"
      />

      <motion.div
        layout="position"
        style={{ x }}
        drag="x"
        dragConstraints={{ left: -140, right: 140 }}
        dragElastic={0.05}
        dragMomentum={false}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onClick={(e) => {
          if (swipedAction !== null) {
            e.stopPropagation();
            resetSwipe();
          }
        }}
        className={`relative overflow-hidden rounded-[24px] bg-card border transition-colors duration-300 z-10 touch-pan-y ${
          isHighlighted 
            ? 'border-accent ring-8 ring-accent/10 scale-[1.03] shadow-2xl' 
            : 'border-border shadow-sm'
        }`}
      >
        {/* Overdue Top Strip */}
        {overdueInfo.isOverdue && (
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-danger z-20" />
        )}

        <div className="relative z-10 p-5 bg-card">
          {/* Row 1: Profile + Status */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black relative ${
                overdueInfo.isOverdue 
                  ? 'bg-danger/10 text-danger' 
                  : 'bg-accent/10 text-accent'
              }`}>
                {customer.name ? customer.name.charAt(0) : '👤'}
                {lastEntry?.status === 'paid' && !isNPMode && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-success rounded-full border-2 border-card flex items-center justify-center">
                    <CheckCircle2 size={8} className="text-white" />
                  </div>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-text-primary uppercase tracking-tight">
                    <Highlight text={String(customer.name)} highlight={searchTerm} />
                  </h3>
                  {overdueInfo.isOverdue && (
                    <span className="text-[8px] font-black bg-danger/10 text-danger px-2 py-0.5 rounded-full uppercase tracking-widest border border-danger/20 flex items-center gap-1">
                      <AlertTriangle size={8} /> OVERDUE
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-[9px] font-black text-text-secondary opacity-30 uppercase tracking-widest bg-muted px-1.5 py-0.5 rounded-md">
                    <Highlight text={String(customer.id)} highlight={searchTerm} />
                  </p>
                  <p className="text-[9px] font-bold text-text-secondary opacity-40 uppercase tracking-widest">
                    <Highlight text={String(customer.phone)} highlight={searchTerm} />
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col items-end gap-1.5">
              <div className="flex items-center gap-1.5">
                {(lastEntry || recentTransactions[0]) && onViewReceipt && !isNPMode && (
                  <button 
                    type="button"
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      onViewReceipt(lastEntry || recentTransactions[0]); 
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-accent/10 hover:bg-accent hover:text-white text-accent transition-all border border-accent/20 active:scale-95 shadow-xs"
                    title="View Receipt"
                  >
                    <Receipt size={10} />
                    <span className="text-[8px] font-black uppercase tracking-wider">Receipt</span>
                  </button>
                )}
                {onSkip && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); onSkip(); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted shadow-sm hover:bg-border transition-colors border border-border/10"
                  >
                    <X size={10} className="text-text-secondary" />
                    <span className="text-[8px] font-black text-text-secondary uppercase tracking-widest">Skip</span>
                  </button>
                )}
              </div>
              {overdueInfo.isOverdue && (
                <p className="text-[9px] font-black text-danger uppercase tracking-tighter opacity-80 mt-1">Missing ₹{overdueInfo.amount}</p>
              )}
              <p className="text-[10px] font-bold text-text-secondary opacity-40 uppercase tracking-widest leading-none">
                Bal: <span className="text-accent underline font-black">₹{balance.toLocaleString()}</span>
              </p>
            </div>
          </div>

          {/* If in NP Mode: Render Dedicated Pending NP Card Body */}
          {isNPMode && currentPendingNP ? (
            <div>
              {/* Exact NP Amount To Settle */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 mb-4">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 block">
                      Pending NP Due • {pendingNPDateLabel}
                    </span>
                    {activePendingNPEntries.length > 1 && (
                      <span className="text-[9px] font-black bg-amber-500 text-white px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                        1 of {activePendingNPEntries.length}
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-2xl font-black text-text-primary tracking-tight">
                      ₹{currentNPAmount.toLocaleString('en-IN')}
                    </span>
                    <span className="text-[10px] font-bold text-text-secondary opacity-60 uppercase">
                      (Oldest Due First)
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-card border border-border/40 text-text-secondary text-[10px] font-black uppercase tracking-wider shadow-xs">
                    <Calendar size={12} className="text-amber-500" />
                    <span>{pendingNPDateLabel}</span>
                  </div>
                  {activePendingNPEntries.length > 1 && (
                    <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400">
                      +{activePendingNPEntries.length - 1} more queued
                    </span>
                  )}
                </div>
              </div>

              {/* Settle NP Action Buttons */}
              <div className="flex gap-2">
                <button 
                  type="button"
                  onClick={() => handleClearPendingNP('cash')}
                  disabled={isProcessing}
                  className="flex-1 flex flex-col items-center py-3.5 rounded-2xl bg-success text-white shadow-lg shadow-success/20 hover:bg-success/90 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    {processingType === 'cash' ? <Loader2 className="animate-spin" size={16} /> : <Banknote size={18} />}
                    <span className="text-xs font-black uppercase tracking-widest">PAY CASH</span>
                  </div>
                  <span className="text-[10px] font-bold text-white/80">
                    Settle NP ₹{currentNPAmount.toLocaleString('en-IN')} ({pendingNPDateLabel})
                  </span>
                </button>
                <button 
                  type="button"
                  onClick={() => handleClearPendingNP('phonepe')}
                  disabled={isProcessing}
                  className="flex-1 flex flex-col items-center py-3.5 rounded-2xl bg-accent text-white shadow-lg shadow-accent/20 hover:bg-accent/90 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    {processingType === 'phonepe' ? <Loader2 className="animate-spin" size={16} /> : <Smartphone size={18} />}
                    <span className="text-xs font-black uppercase tracking-widest">PHONEPE / UPI</span>
                  </div>
                  <span className="text-[10px] font-bold text-white/80">
                    Settle NP ₹{currentNPAmount.toLocaleString('en-IN')} ({pendingNPDateLabel})
                  </span>
                </button>
              </div>
            </div>
          ) : (
            <div>
              {/* Just Settled Banner */}
              {settledNPIds.length > 0 && (
                <div className="flex items-center justify-between p-3 rounded-2xl bg-success/10 border border-success/30 text-success text-[11px] font-bold mb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-success shrink-0" />
                    <span>
                      {settledNPIds.length === 1 
                        ? 'Pending NP cleared! Now collect today\'s installment.'
                        : `All ${settledNPIds.length} pending NPs cleared! Now collect today's installment.`
                      }
                    </span>
                  </div>
                  <span className="text-[9px] uppercase tracking-wider bg-success text-white px-2 py-0.5 rounded-md font-black">
                    Today
                  </span>
                </div>
              )}

              {/* Amount Input Area */}
              <div className={`flex flex-col gap-2 mb-4 p-2 rounded-2xl transition-all duration-300 ${isInputFocused ? 'bg-bg border-accent/20 border-2' : 'bg-bg/50 border-border/10 border'}`}>
                <div className="flex items-center gap-2 relative">
                  <span className="text-xl font-bold text-text-secondary opacity-30 ml-2">₹</span>
                  <input 
                    ref={inputRef}
                    type="number"
                    inputMode="numeric"
                    value={amount || ''}
                    onFocus={handleInputFocus}
                    onBlur={() => setTimeout(() => setIsInputFocused(false), 200)}
                    onChange={(e) => handleInputChange(e.target.value)}
                    className="bg-transparent font-black text-text-primary text-2xl focus:outline-none w-full tracking-tighter"
                    placeholder="0"
                  />
                </div>

                <AnimatePresence>
                  {isInputFocused && (
                    <motion.div 
                      key="suggestions"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="flex gap-2 overflow-x-auto scrollbar-hide py-1 px-1">
                        {suggestions.map(val => (
                          <button
                            key={val}
                            onPointerDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setAmount(val);
                              setIsInputFocused(false);
                              inputRef.current?.blur();
                            }}
                            className="px-4 py-1.5 rounded-xl bg-accent/5 border border-accent/10 whitespace-nowrap flex items-center gap-1.5 active:scale-95 transition-all"
                          >
                            {val === balance && <RotateCcw size={10} className="text-accent" />}
                            <span className="text-[11px] font-black text-accent tracking-tighter">₹{val}</span>
                            {val === balance && <span className="text-[8px] opacity-60 font-bold">FULL</span>}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button 
                  onClick={() => handleAction('cash')}
                  disabled={isProcessing}
                  className="flex-1 flex flex-col items-center py-3 rounded-2xl bg-success/10 text-success border border-success/20 hover:bg-success hover:text-white transition-all active:scale-95 disabled:opacity-50"
                >
                  <div className="flex items-center gap-2 mb-1">
                    {processingType === 'cash' ? <Loader2 className="animate-spin" size={14} /> : <Banknote size={16} />}
                    <span className="text-[10px] font-black uppercase tracking-widest">CASH</span>
                  </div>
                  <span className="text-[10px] font-bold opacity-60">Collect</span>
                </button>
                <button 
                  onClick={() => handleAction('phonepe')}
                  disabled={isProcessing}
                  className="flex-1 flex flex-col items-center py-3 rounded-2xl bg-accent/10 text-accent border border-accent/20 hover:bg-accent hover:text-white transition-all active:scale-95 disabled:opacity-50"
                >
                  <div className="flex items-center gap-2 mb-1">
                    {processingType === 'phonepe' ? <Loader2 className="animate-spin" size={14} /> : <Smartphone size={16} />}
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#00aaff] dark:text-[#55ccff]">PHONEPE</span>
                  </div>
                  <span className="text-[10px] font-bold opacity-60">Collect</span>
                </button>
                <button 
                  onClick={() => handleAction('NP')}
                  disabled={isProcessing}
                  className="flex-1 flex flex-col items-center py-3 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 hover:bg-amber-500 hover:text-white transition-all active:scale-95 disabled:opacity-50"
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    {processingType === 'NP' || processingType === 'unsettled' ? <Loader2 className="animate-spin" size={14} /> : <Clock size={16} />}
                    <span className="text-[10px] font-black uppercase tracking-widest">NOT PAID (NP)</span>
                  </div>
                  <span className="text-[10px] font-bold opacity-60">Record Debt</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Permission Confirmation Modal before redirect */}
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
