import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Customer, Transaction, firestoreService, firestoreUtils } from '../../services/firestoreService';
import { Smartphone, Clock, Loader2, Banknote, CheckCircle2, AlertTriangle, RotateCcw, MessageSquare, Phone, X, ExternalLink } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
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
  lastEntry,
  recentTransactions, // Only a few recent ones for suggestions, or pre-computed suggestions
  balance,
  overdueInfo,
  isHighlighted,
  todayStr,
  searchTerm,
  onSkip,
  onSuccess
}: CustomerCardProps & { 
  lastEntry?: Transaction, 
  recentTransactions: Transaction[],
  balance: number,
  overdueInfo: { isOverdue: boolean, amount: number }
}) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingType, setProcessingType] = useState<string | null>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);
  
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
    
    if (balance > 0 && balance < 5000) {
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

  const handleAction = async (type: 'cash' | 'phonepe' | 'unsettled', customAmount?: number) => {
    const targetAmount = customAmount !== undefined ? customAmount : amount;
    if (isProcessing) return;
    
    if (targetAmount < 1) {
      toastError('Invalid Amount', 'Enter an amount greater than ₹0');
      return;
    }

    setIsProcessing(true);
    setProcessingType(type);

    const isPaidAction = type === 'cash' || type === 'phonepe';
    const statusValue = isPaidAction ? 'paid' : 'unsettled';
    
    localStorage.removeItem(`draft_${customer.id}_${todayStr}`);

    const newTx: Transaction = {
      id: uuidv4(),
      customerId: customer.id,
      amount: targetAmount,
      type,
      status: statusValue,
      date: todayStr,
      timestamp: Date.now(),
      paidAt: Date.now()
    };

    const previousBal = balance;
    const newBal = Math.max(0, balance - targetAmount);

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
        className={`relative overflow-hidden rounded-[24px] bg-card border transition-colors duration-300 z-10 touch-pan-y ${isHighlighted ? 'border-accent ring-8 ring-accent/10 scale-[1.03] shadow-2xl' : 'border-border shadow-sm'}`}
      >
        {/* Skip Hint / Swipe Hint Overlay (Optional - shown on first card or similar) */}
        
        {/* Overdue Strip */}
        {overdueInfo.isOverdue && (
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-danger z-20" />
        )}

        <div className="relative z-10 p-5 bg-card">
          {/* Row 1: Profile + Status */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black relative ${overdueInfo.isOverdue ? 'bg-danger/10 text-danger' : 'bg-accent/10 text-accent'}`}>
                {customer.name ? customer.name.charAt(0) : '👤'}
                {lastEntry?.status === 'paid' && (
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
              {onSkip && (
                <button 
                  onClick={(e) => { e.stopPropagation(); onSkip(); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted shadow-sm hover:bg-border transition-colors border border-border/10"
                >
                  <X size={10} className="text-text-secondary" />
                  <span className="text-[8px] font-black text-text-secondary uppercase tracking-widest">Skip</span>
                </button>
              )}
              {overdueInfo.isOverdue && (
                <p className="text-[9px] font-black text-danger uppercase tracking-tighter opacity-80 mt-1">Missing ₹{overdueInfo.amount}</p>
              )}
              <p className="text-[10px] font-bold text-text-secondary opacity-40 uppercase tracking-widest leading-none">
                Bal: <span className="text-accent underline font-black">₹{balance.toLocaleString()}</span>
              </p>
            </div>
          </div>

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
                onClick={() => handleAction('unsettled')}
                disabled={isProcessing}
                className="flex-1 flex flex-col items-center py-3 rounded-2xl bg-warning/10 text-warning border border-warning/20 hover:bg-warning hover:text-white transition-all active:scale-95 disabled:opacity-50"
              >
                <div className="flex items-center gap-2 mb-1">
                  {processingType === 'unsettled' ? <Loader2 className="animate-spin" size={14} /> : <Clock size={16} />}
                  <span className="text-[10px] font-black uppercase tracking-widest">NOT PAID</span>
                </div>
                <span className="text-[10px] font-bold opacity-60">Later</span>
              </button>
            </div>
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
