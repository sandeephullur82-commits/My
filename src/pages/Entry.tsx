import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { useRealtimeData } from '../hooks/useRealtimeData';
import { Customer, Transaction, firestoreService, firestoreUtils } from '../services/firestoreService';
import { format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import { SyncStatus } from '../components/Dashboard/SyncStatus';
import { CustomerCard } from '../components/Entry/CustomerCard';
import { 
  CheckCircle2, 
  Smartphone, 
  Banknote, 
  Clock, 
  X, 
  Loader2, 
  Search, 
  Zap as ZapIcon, 
  Trash2, 
  AlertTriangle, 
  ArrowRight,
  TrendingUp,
  Receipt
} from 'lucide-react';
import { CustomerCardSkeleton } from '../components/Skeleton';
import { toast } from 'sonner';
import { useUI } from '../context/UIContext';
import { PageContainer } from '../components/PageContainer';
import { safeFormat, toSafeMillis } from '../lib/utils';
import { ReceiptSuccessModal, ReceiptData } from '../components/ReceiptSuccessModal';

export function Entry() {
  const { transactions, customers, loading } = useRealtimeData();
  const { entryTab, setEntryTab, paymentFilter, searchTerm: globalSearch, setSearchTerm: setGlobalSearch } = useUI();
  const [localSearch, setLocalSearch] = useState(globalSearch);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  const urlFilter = searchParams.get('filter') || searchParams.get('tab');

  // Active section tab: PENDING | PAID
  const [activeTab, setActiveTab] = useState<'PENDING' | 'PAID'>(() => {
    if (urlFilter?.toLowerCase() === 'paid') return 'PAID';
    if (urlFilter?.toLowerCase() === 'pending') return 'PENDING';
    if (entryTab === 'PAID') return 'PAID';
    return 'PENDING';
  });

  const [isReady, setIsReady] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  
  // Deletion modal state
  const [deleteModalTx, setDeleteModalTx] = useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Receipt success modal state
  const [activeReceipt, setActiveReceipt] = useState<ReceiptData | null>(null);
  
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [debouncedQuery, setDebouncedQuery] = useState(globalSearch);

  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<any>(null);

  // Sync tab with external navigation or URL filter
  useEffect(() => {
    if (urlFilter) {
      const lower = urlFilter.toLowerCase();
      if (lower === 'paid') setActiveTab('PAID');
      else if (lower === 'pending') setActiveTab('PENDING');
    } else if (entryTab && (entryTab === 'PAID' || entryTab === 'PENDING')) {
      setActiveTab(entryTab as 'PENDING' | 'PAID');
    }
  }, [urlFilter, entryTab]);

  const handleTabChange = (tab: 'PENDING' | 'PAID') => {
    setActiveTab(tab);
    setEntryTab(tab);
  };

  // Sync local search with global if changed externally or from URL params
  useEffect(() => {
    const q = searchParams.get('search') || searchParams.get('q');
    const custId = searchParams.get('customerId') || searchParams.get('id');
    if (q) {
      setLocalSearch(q);
      setDebouncedQuery(q.trim().toLowerCase());
    } else if (custId) {
      setHighlightedId(custId);
    } else {
      setLocalSearch(globalSearch);
    }
  }, [globalSearch, searchParams]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(localSearch.trim().toLowerCase());
      setGlobalSearch(localSearch);
    }, 200);
    return () => clearTimeout(timer);
  }, [localSearch, setGlobalSearch]);

  // Midnight Refresh Logic
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const currentToday = new Date(currentTime);
      if (now.getDate() !== currentToday.getDate()) {
        setCurrentTime(Date.now());
      }
    }, 60000); 
    return () => clearInterval(interval);
  }, [currentTime]);

  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => setIsReady(true), 150);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  const todayStr = useMemo(() => safeFormat(currentTime, 'yyyy-MM-dd', format(new Date(), 'yyyy-MM-dd')), [currentTime]);
  
  const [skippedIds, setSkippedIds] = useState<string[]>([]);

  // Customer IDs that have a paid entry for today
  const todayPaidCustomerIds = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach(tx => {
      if (tx.date === todayStr && !tx.isDeleted && (tx.status === 'paid' || tx.type === 'NP')) {
        set.add(tx.customerId);
      }
    });
    return set;
  }, [transactions, todayStr]);

  // PENDING SECTION: All cards start in pending, and move to paid once entered!
  const pendingCustomers = useMemo(() => {
    let list = customers.filter(c => {
      if (c.isDeleted) return false;
      
      // If customer has already had an entry entered today, they move to the paid section!
      if (todayPaidCustomerIds.has(c.id)) {
        return false;
      }

      // Customer must have pending balance or active loan
      const loan = c.loanAmount || c.loan || 0;
      const paid = c.paid || 0;
      const balance = c.pending !== undefined ? c.pending : (loan - paid);
      return balance > 0;
    });

    if (debouncedQuery) {
      const cleanQuery = debouncedQuery.trim();
      const queryDigits = cleanQuery.replace(/\D/g, '');
      list = list.filter(c => {
        const nameMatch = c.name.toLowerCase().includes(cleanQuery);
        const phone = (c.phone || '').replace(/\D/g, '');
        const phoneMatch = queryDigits.length > 0 && phone.includes(queryDigits);
        const idPart = String(c.displayId || c.id).toLowerCase();
        const idMatch = idPart.includes(cleanQuery);
        return nameMatch || phoneMatch || idMatch;
      });
    }
    
    return list.sort((a, b) => {
      const aSkipped = skippedIds.includes(a.id);
      const bSkipped = skippedIds.includes(b.id);
      if (aSkipped && !bSkipped) return 1;
      if (!aSkipped && bSkipped) return -1;
      return a.name.localeCompare(b.name);
    });
  }, [customers, todayPaidCustomerIds, debouncedQuery, skippedIds]);

  // PAID SECTION: Today's paid entries
  const todayEntries = useMemo(() => {
    return transactions
      .filter(tx => {
        const isTodayPaid = (tx.status === 'paid' || tx.type === 'NP') && tx.date === todayStr && !tx.isDeleted;
        if (!isTodayPaid) return false;

        if (debouncedQuery) {
          const customer = customers.find(c => c.id === tx.customerId);
          if (!customer) return false;
          
          const cleanQuery = debouncedQuery.trim();
          const queryDigits = cleanQuery.replace(/\D/g, '');
          const nameMatch = customer.name.toLowerCase().includes(cleanQuery);
          const phone = (customer.phone || '').replace(/\D/g, '');
          const phoneMatch = queryDigits.length > 0 && phone.includes(queryDigits);
          const idPart = String(customer.displayId || customer.id).toLowerCase();
          const idMatch = idPart.includes(cleanQuery);
          if (!nameMatch && !phoneMatch && !idMatch) return false;
        }

        if (paymentFilter !== 'ALL' && paymentFilter !== 'OVERDUE') {
          return tx.type.toLowerCase() === paymentFilter.toLowerCase();
        }

        return true;
      })
      .sort((a, b) => {
        const timeA = toSafeMillis(a.paidAt) || toSafeMillis(a.timestamp);
        const timeB = toSafeMillis(b.paidAt) || toSafeMillis(b.timestamp);
        return timeB - timeA;
      });
  }, [transactions, todayStr, paymentFilter, debouncedQuery, customers]);

  const cashTotal = useMemo(() => {
    return todayEntries.filter(t => t.type === 'cash' && t.status === 'paid').reduce((sum, tx) => sum + (tx.amount || 0), 0);
  }, [todayEntries]);

  const upiTotal = useMemo(() => {
    return todayEntries.filter(t => t.type === 'phonepe' && t.status === 'paid').reduce((sum, tx) => sum + (tx.amount || 0), 0);
  }, [todayEntries]);

  const npTotal = useMemo(() => {
    return todayEntries.filter(t => t.type === 'NP' || t.type === 'unsettled' || t.status === 'unsettled').reduce((sum, tx) => sum + (tx.amount || 0), 0);
  }, [todayEntries]);

  // Actual cash & UPI money collected today (NP is recorded debt, not collected cash)
  const totalCollectedToday = useMemo(() => {
    return cashTotal + upiTotal;
  }, [cashTotal, upiTotal]);

  const totalPendingBalance = useMemo(() => {
    return pendingCustomers.reduce((sum, c) => {
      const loan = c.loanAmount || c.loan || 0;
      const paid = c.paid || 0;
      return sum + Math.max(0, (c.pending !== undefined ? c.pending : (loan - paid)));
    }, 0);
  }, [pendingCustomers]);

  // Handle URL Redirect & Highlight
  useEffect(() => {
    if (isReady && !loading && customers.length > 0) {
      const targetId = searchParams.get('focus') || searchParams.get('customerId');

      if (targetId) {
        navigate(location.pathname, { replace: true });
        
        const targetIndex = pendingCustomers.findIndex(c => c.id === targetId);
        if (targetIndex !== -1) {
           listRef.current?.scrollToIndex({
             index: targetIndex,
             align: 'center',
             behavior: 'smooth'
           });
           
           setHighlightedId(targetId);
           const timer = setTimeout(() => setHighlightedId(null), 3000);
           return () => clearTimeout(timer);
        }
      }
    }
  }, [isReady, loading, customers, pendingCustomers]);

  const handleSkip = (customerId: string) => {
    setSkippedIds(prev => [...prev.filter(id => id !== customerId), customerId]);
    toast.info('Customer moved to bottom');
  };

  // DELETE ENTRY ACTION (Strictly delete only, no edit)
  const handleDeleteEntry = async () => {
    if (!deleteModalTx || isDeleting) return;
    const tx = deleteModalTx;
    const customer = customers.find(c => c.id === tx.customerId);
    if (!customer) {
      toast.error('Customer not found');
      setDeleteModalTx(null);
      return;
    }

    setIsDeleting(true);
    try {
      await firestoreService.deleteTransaction(tx, customer);
      toast.success(`Entry of ₹${tx.amount.toLocaleString('en-IN')} deleted. ${customer.name} moved back to Pending.`);
      setDeleteModalTx(null);
    } catch (error) {
      console.error('Delete transaction failed:', error);
      toast.error('Failed to delete entry');
    } finally {
      setIsDeleting(false);
    }
  };

  // SETTLE NP ENTRY ACTION (Method 3: Records new Cash/UPI payment, preserving NP in audit history)
  const [isSettlingNPId, setIsSettlingNPId] = useState<string | null>(null);

  const handleSettleNP = async (npTx: Transaction, customer: Customer, paymentMethod: 'cash' | 'phonepe') => {
    if (isSettlingNPId) return;
    setIsSettlingNPId(npTx.id);

    try {
      const loan = customer.loanAmount || customer.loan || 0;
      const paid = customer.paid || 0;
      const currentBalance = customer.pending !== undefined ? customer.pending : (loan - paid);

      const newPaymentTx: Transaction = {
        id: uuidv4(),
        customerId: customer.id,
        amount: npTx.amount,
        type: paymentMethod,
        status: 'paid',
        date: todayStr,
        timestamp: Date.now(),
        paidAt: Date.now(),
        notes: `Payment collected for NP due on ${npTx.date}`
      };

      // 1. Save new Cash/UPI payment transaction to credit customer balance
      await firestoreService.saveTransaction(newPaymentTx, customer);

      // 2. Mark the original NP record as settled in audit log while preserving it in history
      try {
        await firestoreService.updateTransaction(npTx.id, {
          notes: `Settled via ${paymentMethod === 'cash' ? 'Cash' : 'UPI'} (${newPaymentTx.id.slice(0, 8)})`
        }, 'settle_np_entry');
      } catch (e) {
        console.warn('Could not update NP note:', e);
      }

      const newBal = Math.max(0, currentBalance - npTx.amount);

      // 3. Open receipt with Share Image button
      setActiveReceipt({
        transaction: newPaymentTx,
        customer,
        previousBalance: currentBalance,
        newBalance: newBal
      });

      toast.success(`Recorded ₹${npTx.amount.toLocaleString('en-IN')} ${paymentMethod === 'cash' ? 'Cash' : 'UPI'} payment for ${customer.name}`);
    } catch (error) {
      console.error('Failed to collect NP as payment:', error);
      toast.error('Failed to record payment');
    } finally {
      setIsSettlingNPId(null);
    }
  };

  // Prepare data for CustomerCard in a stable way
  const customerDataMap = useMemo(() => {
    const map = new Map();
    pendingCustomers.forEach(c => {
      const loan = c.loanAmount || c.loan || 0;
      const paid = c.paid || 0;
      const balance = loan - paid;
      const overdueInfo = firestoreUtils.calculateOverdue(c);
      
      const lastEntry = transactions.find(t => t.customerId === c.id && t.date === todayStr && !t.isDeleted);
      const recentTransactions = transactions.filter(t => t.customerId === c.id && !t.isDeleted).sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);

      map.set(c.id, { balance, overdueInfo, lastEntry, recentTransactions });
    });
    return map;
  }, [pendingCustomers, transactions, todayStr]);

  if (!isReady) {
    return (
      <PageContainer>
        <div className="flex flex-col gap-6">
          <SyncStatus customTitle="Daily Collection" />
          <div className="grid grid-cols-1 gap-4">
             {[1, 2, 3].map(i => (
               <div key={i}><CustomerCardSkeleton /></div>
             ))}
          </div>
        </div>
      </PageContainer>
    );
  }

  const deleteCustomer = deleteModalTx ? customers.find(c => c.id === deleteModalTx.customerId) : null;

  return (
    <PageContainer ref={containerRef}>
      <div className="flex flex-col gap-5 animate-in fade-in duration-300 pb-safe-bottom relative">
        
        {/* TWO SECTION TABS (Pending & Paid) */}
        <div className="sticky top-0 z-[40] bg-bg/90 backdrop-blur-md pt-2 pb-3 -mx-1 px-1 flex flex-col gap-3 border-b border-border/40">
          <div className="flex items-center gap-1.5 p-1 bg-muted/70 rounded-2xl border border-border/50">
            <button
              id="entry-tab-pending"
              type="button"
              onClick={() => handleTabChange('PENDING')}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                activeTab === 'PENDING'
                  ? 'bg-card text-text-primary shadow-sm border border-border/80 scale-[1.01]'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <Clock size={14} className={activeTab === 'PENDING' ? 'text-accent' : 'opacity-60'} />
              <span>Pending</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === 'PENDING' ? 'bg-accent/15 text-accent' : 'bg-bg text-text-secondary'
              }`}>
                {pendingCustomers.length}
              </span>
            </button>

            <button
              id="entry-tab-paid"
              type="button"
              onClick={() => handleTabChange('PAID')}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                activeTab === 'PAID'
                  ? 'bg-card text-text-primary shadow-sm border border-border/80 scale-[1.01]'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <CheckCircle2 size={14} className={activeTab === 'PAID' ? 'text-success' : 'opacity-60'} />
              <span>Paid</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === 'PAID' ? 'bg-success/15 text-success' : 'bg-bg text-text-secondary'
              }`}>
                {todayEntries.length}
              </span>
            </button>
          </div>

          {/* SEARCH BAR */}
          <div className="relative group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary opacity-40 group-focus-within:opacity-100 group-focus-within:text-accent transition-all">
              <Search size={16} />
            </div>
            <input 
              id="entry-search-input"
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Search Name, ID (003), or Phone..."
              className="w-full pl-10 pr-10 py-3 bg-card border border-border/60 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all shadow-sm"
            />
            <AnimatePresence>
              {localSearch && (
                <motion.button
                  key="clear-search"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  onClick={() => setLocalSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-muted flex items-center justify-center rounded-full text-text-secondary hover:bg-border transition-colors"
                >
                  <X size={12} />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* SECTION 1: PENDING COLLECTION */}
        {activeTab === 'PENDING' && (
          <div className="flex flex-col gap-3.5">
            <div className="flex items-center justify-between px-1">
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <h2 className="text-xs font-black text-text-primary uppercase tracking-widest flex items-center gap-2">
                    <Clock size={14} className="text-accent" />
                    <span>Pending Section</span>
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-accent/10 text-accent border border-accent/20">
                    {pendingCustomers.length} Cards
                  </span>
                  {todayEntries.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const latestTx = todayEntries[0];
                        const cust = customers.find(c => c.id === latestTx.customerId);
                        if (cust) {
                          const loan = cust.loanAmount || cust.loan || 0;
                          const paid = cust.paid || 0;
                          const bal = cust.pending !== undefined ? cust.pending : (loan - paid);
                          setActiveReceipt({
                            transaction: latestTx,
                            customer: cust,
                            previousBalance: bal + latestTx.amount,
                            newBalance: bal
                          });
                        }
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-600/10 hover:bg-emerald-600 hover:text-white text-emerald-600 dark:text-emerald-400 border border-emerald-600/20 text-[9px] font-black uppercase tracking-wider transition-all active:scale-95 shadow-xs"
                      title="View most recent receipt"
                    >
                      <Receipt size={11} />
                      <span>Last Receipt (₹{todayEntries[0].amount.toLocaleString('en-IN')})</span>
                    </button>
                  )}
                </div>
                {pendingCustomers.length > 0 && (
                  <p className="text-[9px] font-bold text-accent/70 uppercase tracking-widest flex items-center gap-1.5 mt-0.5">
                    <ZapIcon size={10} className="text-accent animate-pulse" />
                    <span>Swipe card left to call • right for WhatsApp</span>
                  </p>
                )}
              </div>

              {pendingCustomers.length > 0 && (
                <div className="text-right">
                  <span className="text-[9px] font-bold text-text-secondary opacity-60 uppercase block tracking-wider">To Collect</span>
                  <span className="text-xs font-black text-text-primary tracking-tight">
                    ₹{totalPendingBalance.toLocaleString('en-IN')}
                  </span>
                </div>
              )}
            </div>

            {pendingCustomers.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center py-14 px-6 bg-card rounded-[28px] border border-border/60 text-center"
              >
                <div className="w-14 h-14 bg-success/10 flex items-center justify-center rounded-2xl text-success mb-3 shadow-inner">
                  <CheckCircle2 size={28} />
                </div>
                <h3 className="font-black text-base tracking-tight text-text-primary uppercase mb-1">
                  All Collections Completed
                </h3>
                <p className="text-xs text-text-secondary max-w-xs mb-4">
                  Every active pending customer has been entered for today! All recorded entries are now in the Paid section.
                </p>
                {todayEntries.length > 0 && activeTab === 'PENDING' && (
                  <button
                    onClick={() => handleTabChange('PAID')}
                    className="py-2.5 px-5 rounded-xl bg-success text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-success/20 active:scale-95 transition-all"
                  >
                    <span>View Paid Section ({todayEntries.length})</span>
                    <ArrowRight size={14} />
                  </button>
                )}
              </motion.div>
            ) : (
              <div className="flex flex-col gap-3">
                {pendingCustomers.map((customer) => {
                  const data = customerDataMap.get(customer.id);
                  return (
                    <div id={`customer-${customer.id}`} key={customer.id}>
                      <CustomerCard 
                        customer={customer} 
                        allTransactions={transactions}
                        lastEntry={data?.lastEntry}
                        recentTransactions={data?.recentTransactions || []}
                        balance={data?.balance || 0}
                        overdueInfo={data?.overdueInfo || { isOverdue: false, amount: 0 }}
                        isHighlighted={highlightedId === customer.id}
                        todayStr={todayStr}
                        searchTerm={debouncedQuery}
                        onSkip={() => handleSkip(customer.id)}
                        onSuccess={(tx, prevBal, newBal) => {
                          setActiveReceipt({
                            transaction: tx,
                            customer,
                            previousBalance: prevBal,
                            newBalance: newBal
                          });
                          toast.success(`₹${tx.amount.toLocaleString('en-IN')} collected for ${customer.name}`);
                        }}
                        onViewReceipt={(tx) => {
                          const loan = customer.loanAmount || customer.loan || 0;
                          const paid = customer.paid || 0;
                          const bal = customer.pending !== undefined ? customer.pending : (loan - paid);
                          setActiveReceipt({
                            transaction: tx,
                            customer,
                            previousBalance: bal + tx.amount,
                            newBalance: bal
                          });
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* SECTION 2: PAID COLLECTION (Delete only, no edit) */}
        {activeTab === 'PAID' && (
          <div className="flex flex-col gap-3.5">
            <div className="flex items-center justify-between px-1">
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <h2 className="text-xs font-black text-text-primary uppercase tracking-widest flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-success" />
                    <span>Paid Section</span>
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-success/10 text-success border border-success/20">
                    {todayEntries.length} Entries
                  </span>
                </div>
                <p className="text-[9px] font-bold text-text-secondary opacity-60 uppercase tracking-widest">
                  Entries entered today • Delete to move back to pending
                </p>
              </div>

              {todayEntries.length > 0 && (
                <div className="text-right">
                  <span className="text-[9px] font-bold text-text-secondary opacity-60 uppercase block tracking-wider">Total Collected</span>
                  <span className="text-sm font-black text-success tracking-tight">
                    ₹{totalCollectedToday.toLocaleString('en-IN')}
                  </span>
                </div>
              )}
            </div>

            {/* Collected Breakdown Summary */}
            {todayEntries.length > 0 && (
              <div className="grid grid-cols-4 gap-2 p-3 rounded-2xl bg-card border border-border/70 text-center">
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold text-text-secondary uppercase opacity-60">Collected</span>
                  <span className="text-xs sm:text-sm font-black text-text-primary">₹{totalCollectedToday.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex flex-col border-l border-border/50">
                  <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">Cash</span>
                  <span className="text-xs sm:text-sm font-black text-emerald-600 dark:text-emerald-400">₹{cashTotal.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex flex-col border-l border-border/50">
                  <span className="text-[9px] font-bold text-accent uppercase">UPI</span>
                  <span className="text-xs sm:text-sm font-black text-accent">₹{upiTotal.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex flex-col border-l border-border/50">
                  <span className="text-[9px] font-bold text-amber-500 uppercase">NP (Debt)</span>
                  <span className="text-xs sm:text-sm font-black text-amber-500">₹{npTotal.toLocaleString('en-IN')}</span>
                </div>
              </div>
            )}

            {todayEntries.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center py-12 px-6 bg-card rounded-[28px] border border-border/60 text-center"
              >
                <div className="w-12 h-12 bg-muted flex items-center justify-center rounded-2xl text-text-secondary mb-3">
                  <Receipt size={24} />
                </div>
                <h3 className="font-black text-sm tracking-tight text-text-primary uppercase mb-1">
                  No Entries Entered Yet
                </h3>
                <p className="text-xs text-text-secondary max-w-xs mb-4">
                  As you enter collection cards in the Pending section, they will automatically move here.
                </p>
                {activeTab === 'PAID' && (
                  <button
                    onClick={() => handleTabChange('PENDING')}
                    className="py-2.5 px-4 rounded-xl bg-accent text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 active:scale-95 transition-all shadow-md shadow-accent/20"
                  >
                    <span>Go to Pending ({pendingCustomers.length})</span>
                    <ArrowRight size={14} />
                  </button>
                )}
              </motion.div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {todayEntries.map((tx) => {
                  const customer = customers.find(c => c.id === tx.customerId);
                  const isUpi = tx.type === 'phonepe';
                  const isNP = tx.type === 'NP' || tx.type === 'unsettled';
                  const customerLoan = customer ? (customer.loanAmount || customer.loan || 0) : 0;
                  const customerPaid = customer ? (customer.paid || 0) : 0;
                  const customerBalance = customer ? (customer.pending !== undefined ? customer.pending : (customerLoan - customerPaid)) : 0;

                  return (
                    <motion.div
                      key={tx.id}
                      layout="position"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3.5 sm:p-4 bg-card border border-border/70 rounded-2xl shadow-sm flex items-center justify-between gap-3 hover:border-border transition-all"
                    >
                      {/* Left: Icon & Customer Info */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          isNP
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                            : isUpi 
                            ? 'bg-blue-600/10 text-blue-600 dark:text-blue-400 border border-blue-600/20' 
                            : 'bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 border border-emerald-600/20'
                        }`}>
                          {isNP ? <Clock size={18} /> : isUpi ? <Smartphone size={18} /> : <Banknote size={18} />}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-black text-text-primary uppercase tracking-tight truncate">
                              {customer?.name || 'Customer'}
                            </h4>
                            {customer?.displayId && (
                              <span className="text-[9px] font-mono font-bold bg-muted px-1.5 py-0.5 rounded text-text-secondary">
                                #{customer.displayId}
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] font-medium text-text-secondary">
                            <span className={`font-bold uppercase tracking-wider ${
                              isNP ? 'text-amber-600 dark:text-amber-400' : 'text-text-primary/70'
                            }`}>
                              {isNP ? 'NP • UNPAID' : isUpi ? 'UPI' : 'CASH'}
                            </span>
                            <span>•</span>
                            <span>{safeFormat(tx.paidAt || tx.timestamp, 'hh:mm a', 'Today')}</span>
                            {customer && (
                              <>
                                <span>•</span>
                                <span className="opacity-75">Bal: ₹{customerBalance.toLocaleString('en-IN')}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Amount & Actions */}
                      <div className="flex items-center gap-2.5 shrink-0">
                        <div className="text-right">
                          <span className={`text-base font-black tracking-tight block ${
                            isNP ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                          }`}>
                            {isNP ? '' : '+'}₹{tx.amount.toLocaleString('en-IN')}
                          </span>
                        </div>

                        {/* Quick Collect Payment (Method 3: Cash / UPI) for NP */}
                        {isNP && customer && (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={isSettlingNPId === tx.id}
                              onClick={() => handleSettleNP(tx, customer, 'cash')}
                              className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 text-[10px] font-black uppercase tracking-wider active:scale-95 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                              title="Record Cash Payment for this NP installment"
                            >
                              {isSettlingNPId === tx.id ? <Loader2 size={12} className="animate-spin" /> : <Banknote size={12} strokeWidth={2.5} />}
                              <span>Cash</span>
                            </button>

                            <button
                              type="button"
                              disabled={isSettlingNPId === tx.id}
                              onClick={() => handleSettleNP(tx, customer, 'phonepe')}
                              className="px-2.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1 text-[10px] font-black uppercase tracking-wider active:scale-95 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                              title="Record UPI/PhonePe Payment for this NP installment"
                            >
                              {isSettlingNPId === tx.id ? <Loader2 size={12} className="animate-spin" /> : <Smartphone size={12} strokeWidth={2.5} />}
                              <span>UPI</span>
                            </button>
                          </div>
                        )}

                        {/* VIEW RECEIPT BUTTON */}
                        {customer && (
                          <button
                            type="button"
                            onClick={() => {
                              const prev = customerBalance + tx.amount;
                              setActiveReceipt({
                                transaction: tx,
                                customer,
                                previousBalance: prev,
                                newBalance: customerBalance
                              });
                            }}
                            className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl bg-accent/10 hover:bg-accent text-accent hover:text-white border border-accent/20 transition-all flex items-center gap-1.5 text-xs font-bold active:scale-90"
                            title="View / Share Receipt"
                          >
                            <Receipt size={14} />
                            <span className="hidden sm:inline text-[11px] uppercase tracking-wider">Receipt</span>
                          </button>
                        )}

                        {/* DELETE BUTTON: Only delete, no edit */}
                        <button
                          id={`delete-entry-${tx.id}`}
                          type="button"
                          onClick={() => setDeleteModalTx(tx)}
                          className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl bg-danger/10 hover:bg-danger text-danger hover:text-white border border-danger/20 transition-all flex items-center gap-1.5 text-xs font-bold active:scale-90"
                          title="Delete this entry and move card back to Pending"
                        >
                          <Trash2 size={14} />
                          <span className="hidden sm:inline text-[11px] uppercase tracking-wider">Delete</span>
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>

      {/* DELETE CONFIRMATION MODAL (Centered on screen, no scrolling) */}
      {deleteModalTx && typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          <div 
            className="fixed inset-0 z-[99999] flex items-center justify-center p-4 overflow-hidden pointer-events-auto"
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
          >
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/65 backdrop-blur-sm"
              onClick={() => !isDeleting && setDeleteModalTx(null)}
            />

            {/* Centered Modal Card */}
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 12 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="relative w-full max-w-[360px] bg-card text-text-primary rounded-[28px] p-6 shadow-2xl border border-border flex flex-col items-center text-center z-10 select-none overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteModalTx(null)}
                className="absolute top-4 right-4 p-1.5 rounded-full text-text-secondary hover:text-text-primary hover:bg-muted transition-colors active:scale-90"
              >
                <X size={18} />
              </button>

              {/* Danger Trash Icon */}
              <div className="w-14 h-14 rounded-2xl bg-danger/10 text-danger flex items-center justify-center mb-3.5 ring-4 ring-danger/10">
                <Trash2 size={26} strokeWidth={2.2} />
              </div>

              <h3 className="text-lg font-black text-text-primary uppercase tracking-tight mb-1">
                Delete Today's Entry?
              </h3>

              <p className="text-xs text-text-secondary leading-relaxed mb-4">
                Are you sure you want to delete this payment entry?
              </p>

              {/* Entry Details Box */}
              <div className="w-full bg-muted/60 border border-border rounded-xl p-3 mb-4 text-left flex flex-col gap-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-text-secondary font-medium">Customer:</span>
                  <span className="font-bold text-text-primary">{deleteCustomer?.name || 'Customer'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary font-medium">Amount:</span>
                  <span className="font-bold text-danger font-mono">₹{deleteModalTx.amount.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary font-medium">Method:</span>
                  <span className="font-bold text-text-primary uppercase">{deleteModalTx.type === 'phonepe' ? 'UPI' : 'Cash'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary font-medium">Recorded at:</span>
                  <span className="font-mono text-text-secondary">{safeFormat(deleteModalTx.paidAt || deleteModalTx.timestamp, 'hh:mm a', 'Today')}</span>
                </div>
              </div>

              <p className="text-[11px] text-text-secondary opacity-75 mb-5 leading-normal">
                This will reverse the customer's balance and return their card back to the <strong>Pending</strong> section.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2.5 w-full">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleDeleteEntry}
                  className="w-full py-3.5 px-4 rounded-2xl font-bold flex items-center justify-center gap-2 text-white bg-danger hover:bg-danger/90 active:scale-98 transition-all shadow-lg shadow-danger/25 disabled:opacity-50 text-sm"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Deleting Entry...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} />
                      <span>Delete Entry & Return to Pending</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setDeleteModalTx(null)}
                  className="w-full py-3 px-4 rounded-2xl bg-bg border border-border text-text-secondary font-bold hover:bg-muted active:scale-98 transition-all text-xs uppercase tracking-wider"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        </AnimatePresence>,
        document.body
      )}

      {/* RECEIPT SUCCESS MODAL (Centered on screen) */}
      {activeReceipt && typeof document !== 'undefined' && createPortal(
        <ReceiptSuccessModal
          receipt={activeReceipt}
          onClose={() => setActiveReceipt(null)}
        />,
        document.body
      )}

    </PageContainer>
  );
}
