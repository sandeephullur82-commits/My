import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Customer, Transaction, firestoreService } from '../services/firestoreService';
import { 
  ChevronLeft, IndianRupee, Smartphone, Clock, 
  ArrowRight, Check, X, Loader2, Search,
  Zap as ZapIcon
} from 'lucide-react';
import { format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { getSmartDefaultAmount } from '../lib/smartAmounts';
import { playSuccessSound } from '../lib/sound';

interface CollectionModeProps {
  customers: Customer[];
  transactions: Transaction[];
  onClose: () => void;
}

export function CollectionMode({ customers, transactions, onClose }: CollectionModeProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [amount, setAmount] = useState<number>(0);
  const [paymentType, setPaymentType] = useState<'cash' | 'phonepe'>('cash');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const today = format(new Date(), 'yyyy-MM-dd');
  
  // High-speed list: only pending customers who haven't paid today
  const pendingCustomers = useMemo(() => {
    const todayTXs = transactions.filter(tx => tx.date === today && !tx.isDeleted);
    return customers
      .filter(c => {
        const hasPaidToday = todayTXs.some(tx => tx.customerId === c.id);
        const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                             (c.displayId && String(c.displayId).toLowerCase().includes(searchTerm.toLowerCase()));
        return !hasPaidToday && c.pending > 0 && matchesSearch;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [customers, transactions, today, searchTerm]);

  const currentCustomer = pendingCustomers[currentIndex];

  useEffect(() => {
    if (currentCustomer) {
      const smartDefault = getSmartDefaultAmount(currentCustomer, transactions);
      setAmount(smartDefault);
      
      // Auto-select last used payment mode for this customer or default to cash
      const lastTx = transactions
        .filter(t => t.customerId === currentCustomer.id && !t.isDeleted)
        .sort((a, b) => b.timestamp - a.timestamp)[0];
        
      if (lastTx && (lastTx.type === 'phonepe' || lastTx.type === 'cash')) {
        setPaymentType(lastTx.type);
      }
    }
  }, [currentCustomer, transactions]);

  const handleCollect = async () => {
    if (!currentCustomer || isProcessing || amount < 1) return;
    
    setIsProcessing(true);
    try {
      const txId = uuidv4();
      const prevBal = currentCustomer.pending !== undefined ? currentCustomer.pending : (currentCustomer.loanAmount || 0);
      const newBal = Math.max(0, prevBal - amount);

      const newTx: Transaction = {
        id: txId,
        customerId: currentCustomer.id,
        amount,
        type: paymentType,
        status: 'paid',
        date: today,
        timestamp: Date.now(),
        paidAt: Date.now()
      };

      const success = await firestoreService.saveTransaction(newTx, currentCustomer);

      if (success) {
        if (navigator.vibrate) navigator.vibrate(50);
        playSuccessSound();
        
        // Move to next if not filtered by search specifically to one item
        if (pendingCustomers.length > 1) {
          //currentIndex will technically "point" to the next one because 
          //current one will disappear from the pending list
          //but we reset amount just in case
        } else if (pendingCustomers.length === 1) {
          // Goal completed
        }
      }
    } catch (error) {
      // Collection failed
    } finally {
      setIsProcessing(false);
    }
  };

  if (!currentCustomer && searchTerm === '') {
    return (
      <div className="fixed inset-0 z-[200] bg-bg flex flex-col items-center justify-center p-8 text-center">
        <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center text-success mb-6">
          <Check size={40} />
        </div>
        <h2 className="text-2xl font-black text-text-primary uppercase tracking-tight mb-2">Daily Goal Done</h2>
        <p className="text-text-secondary opacity-60 mb-8 font-medium">No more pending collections for today.</p>
        <button 
          onClick={onClose}
          className="px-8 py-4 bg-accent text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-accent/20"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] bg-bg flex flex-col font-sans">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <button onClick={onClose} className="p-2 -ml-2 text-text-secondary">
          <ChevronLeft size={24} />
        </button>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-accent/5 border border-accent/10 rounded-full">
          <ZapIcon size={14} className="text-accent fill-accent" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-accent">Collection Mode</span>
        </div>
        <div className="w-10" />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col px-4 overflow-hidden">
        {/* Search Bar */}
        <div className="relative mt-2 mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary opacity-30" size={18} />
          <input
            type="text"
            placeholder="jump to customer..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentIndex(0);
            }}
            className="w-full bg-card border border-border rounded-2xl py-4 pl-12 pr-4 text-sm font-bold placeholder:text-text-secondary/30 focus:outline-none focus:border-accent/50 transition-all shadow-sm"
          />
        </div>

        {currentCustomer ? (
          <motion.div 
            key={currentCustomer.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex-1 flex flex-col max-w-lg mx-auto w-full"
          >
            {/* Customer Header */}
            <div className="flex flex-col items-center text-center mb-10 pt-4">
              <div className="w-20 h-20 rounded-[28px] bg-accent/10 text-accent flex items-center justify-center font-black text-3xl mb-4 shadow-xl shadow-accent/5">
                {currentCustomer.name ? currentCustomer.name.charAt(0).toUpperCase() : '👤'}
              </div>
              <h2 className="text-3xl font-black text-text-primary uppercase tracking-tight px-4 line-clamp-1">{currentCustomer.name}</h2>
              <p className="text-[12px] font-black text-text-secondary opacity-30 uppercase tracking-[0.3em] mt-2">
                BAL: <span className="text-text-primary opacity-100">₹{currentCustomer.pending.toLocaleString()}</span>
              </p>
            </div>

            {/* Amount Field */}
            <div className="flex-1 overflow-y-auto scrollbar-hide py-4 px-2">
              <div className="flex flex-col justify-center gap-12 min-h-full">
                <div className="relative group text-center">
                  <span className="text-3xl font-black text-text-secondary opacity-20 absolute -left-4 top-1/2 -translate-y-1/2">₹</span>
                  <input
                    type="number"
                    value={amount || ''}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-full bg-transparent text-center border-none focus:outline-none text-[80px] font-black tracking-tighter text-text-primary"
                  />
                  <div className="mt-4 flex justify-center gap-3">
                    {[100, 200, 500, 1000].map(val => (
                      <button
                        key={val}
                        onClick={() => setAmount(val)}
                        className={`px-4 py-2 rounded-xl text-[12px] font-black transition-all ${amount === val ? 'bg-accent text-white' : 'bg-card border border-border text-text-secondary opacity-60'}`}
                      >
                        ₹{val}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Payment Mode Selector */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setPaymentType('cash')}
                    className={`flex items-center justify-center gap-3 py-5 rounded-2xl border-2 transition-all ${paymentType === 'cash' ? 'bg-success text-white border-success shadow-lg shadow-success/20' : 'bg-card border-border text-text-secondary opacity-60'}`}
                  >
                    <IndianRupee size={22} strokeWidth={2.5} />
                    <span className="font-black uppercase tracking-widest text-[13px]">Cash</span>
                  </button>
                  <button
                    onClick={() => setPaymentType('phonepe')}
                    className={`flex items-center justify-center gap-3 py-5 rounded-2xl border-2 transition-all ${paymentType === 'phonepe' ? 'bg-accent text-white border-accent shadow-lg shadow-accent/20' : 'bg-card border-border text-text-secondary opacity-60'}`}
                  >
                    <Smartphone size={22} strokeWidth={2.5} />
                    <span className="font-black uppercase tracking-widest text-[13px]">PhonePe</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Final Action - Sticky Footer */}
            <div className="shrink-0 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-4 px-2 border-t border-border/10 bg-gradient-to-t from-bg via-bg/95 to-transparent">
              <button
                onClick={handleCollect}
                disabled={isProcessing || amount < 1}
                className="w-full py-6 bg-text-primary text-bg rounded-3xl font-black uppercase tracking-[0.3em] flex items-center justify-center gap-3 shadow-2xl active:scale-95 transition-all disabled:opacity-20"
              >
                {isProcessing ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <>
                    CONFIRM COLLECTION <ArrowRight size={20} strokeWidth={3} />
                  </>
                )}
              </button>
              
              <div className="mt-6 flex items-center justify-between px-4">
                 <button 
                   onClick={() => setCurrentIndex(prev => (prev + 1) % pendingCustomers.length)}
                   className="text-[10px] font-black text-text-secondary opacity-30 uppercase tracking-[0.2em]"
                 >
                   SKIP CUSTOMER
                 </button>
                 <p className="text-[10px] font-black text-text-secondary opacity-30 uppercase tracking-[0.2em]">
                   {currentIndex + 1} / {pendingCustomers.length} REMAINING
                 </p>
              </div>
            </div>
          </motion.div>
        ) : (
           <div className="flex-1 flex flex-col items-center justify-center text-center p-8 opacity-40">
             <Search size={48} className="mb-4" />
             <p className="font-black uppercase tracking-[0.2em] text-[12px]">No customers match your search</p>
           </div>
        )}
      </div>
    </div>
  );
}
