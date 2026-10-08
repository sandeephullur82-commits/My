import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, User, ArrowDownAZ, ArrowUpZA, Edit2, Trash2, IndianRupee, Search, Pin, PinOff, Filter, ArrowUp, ArrowDown, History, X, ChevronDown, SlidersHorizontal, ArrowUpDown, Check } from 'lucide-react';
import { firestoreService, Customer, Transaction } from '../services/firestoreService';
import { useRealtimeData } from '../hooks/useRealtimeData';
import { toast } from 'sonner';
import { CustomerCard } from '../components/CustomerCard';
import { CustomerDetails } from '../components/CustomerDetails';
import { CustomerForm } from '../components/CustomerForm';
import { BottomSheet } from '../components/BottomSheet';
import { PageContainer } from '../components/PageContainer';
import { Skeleton } from '../components/Skeleton';
import { useUI } from '../context/UIContext';
import { WithdrawDepositModal } from '../components/WithdrawDepositModal';
import { ReceiptSuccessModal, ReceiptData } from '../components/ReceiptSuccessModal';
import { useFeedback } from '../context/FeedbackContext';

interface CustomersProps {
  onNavigate?: (tab: string, filter?: any, customerId?: string, entryTabVal?: any, dateFilterVal?: any) => void;
}

export function Customers({ onNavigate }: CustomersProps) {
  const location = useLocation();
  const { customers, transactions, loading, error, refreshData } = useRealtimeData();
  const { searchTerm, setSearchTerm, setIsModalOpen, setIsCustomerDetailsOpen } = useUI();
  const [isReady, setIsReady] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchTerm.trim().toLowerCase());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => setIsReady(true), 400);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  const [filter, setFilter] = useState<'all' | 'pending' | 'paid' | 'overdue' | 'high_amount'>(() => {
    return (location.state?.filter as any) || 'all';
  });
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | 'pending_desc' | 'last_payment' | 'name_asc' | 'name_desc'>('asc');
  const [showAdd, setShowAdd] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [newLoanCustomer, setNewLoanCustomer] = useState<Customer | null>(null);
  const [withdrawCustomer, setWithdrawCustomer] = useState<Customer | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptData | null>(null);

  useEffect(() => {
    if (location.state?.filter) {
      setFilter(location.state.filter);
    }
  }, [location.state]);

  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [activeSwipeId, setActiveSwipeId] = useState<string | null>(null);
  const [localDeletedIds, setLocalDeletedIds] = useState<string[]>([]);
  
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [showSortSheet, setShowSortSheet] = useState(false);

  // Sync modal & customer details state with UI context
  useEffect(() => {
    setIsCustomerDetailsOpen(!!selectedCustomer);
    setIsModalOpen(!!selectedCustomer || !!editCustomer || showAdd || !!newLoanCustomer || !!withdrawCustomer || !!selectedReceipt);
    return () => {
       setIsCustomerDetailsOpen(false);
       setIsModalOpen(false);
    };
  }, [selectedCustomer, editCustomer, showAdd, newLoanCustomer, withdrawCustomer, selectedReceipt, setIsModalOpen, setIsCustomerDetailsOpen]);

  const filterOptions = [
    { value: 'all', label: 'All Accounts' },
    { value: 'pending', label: 'Pending' },
    { value: 'paid', label: 'Fully Paid' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'high_amount', label: 'Large Amounts' }
  ];

  const sortOptions = [
    { value: 'asc', label: 'ID Asc' },
    { value: 'desc', label: 'ID Desc' },
    { value: 'name_asc', label: 'Name A-Z' },
    { value: 'name_desc', label: 'Name Z-A' },
    { value: 'pending_desc', label: 'Amount High' },
    { value: 'last_payment', label: 'Recent activity' }
  ];

  // Auto-scroll and Highlight logic & Auto-open details overlay
  useEffect(() => {
    if (isReady && !loading && customers.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const targetId = params.get('customerId') || params.get('id');
      
      if (targetId) {
        const found = customers.find(c => c.id === targetId);
        if (found) {
          setSelectedCustomer(found);
        }

        // Clean URL
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);

        setTimeout(() => {
          const element = document.getElementById(`customer-item-${targetId}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setHighlightedId(targetId);
            setTimeout(() => setHighlightedId(null), 3000);
          }
        }, 500);
      }
    }
  }, [isReady, loading, customers]);

  const { toastAction, toastError, toastSuccess } = useFeedback();

  const counts = useMemo(() => {
    let pending = 0;
    let overdue = 0;
    let paid = 0;
    const now = Date.now();
    customers.forEach(c => {
      if (c.isDeleted || localDeletedIds.includes(c.id)) return;
      const loanAmount = c.loanAmount || c.loan || 0;
      const paidAmount = c.paid || 0;
      const pendingAmount = c.pending !== undefined ? c.pending : (loanAmount - paidAmount);
      if (pendingAmount <= 0) paid++;
      else if (c.endDate < now) overdue++;
      else pending++;
    });
    return {
      all: customers.filter(c => !c.isDeleted && !localDeletedIds.includes(c.id)).length,
      pending,
      overdue,
      paid
    };
  }, [customers, localDeletedIds]);

  // Single O(T) pass to index transactions for all customers
  const { customerActivityMap, paidTodaySet, lastPaymentTimeMap } = useMemo(() => {
    const actMap = new Map<string, Transaction>();
    const paidSet = new Set<string>();
    const lastTimeMap = new Map<string, number>();
    const today = new Date().toISOString().slice(0, 10);

    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i];
      if (tx.isDeleted) continue;
      if (tx.status === 'paid') {
        const existing = actMap.get(tx.customerId);
        if (!existing || tx.timestamp > existing.timestamp) {
          actMap.set(tx.customerId, tx);
          lastTimeMap.set(tx.customerId, tx.timestamp);
        }
        if (tx.date === today) {
          paidSet.add(tx.customerId);
        }
      }
    }
    return { customerActivityMap: actMap, paidTodaySet: paidSet, lastPaymentTimeMap: lastTimeMap };
  }, [transactions]);

  const filteredAndSorted = useMemo(() => {
    const now = Date.now();
    let result = customers.filter(c => {
      if (c.isDeleted || localDeletedIds.includes(c.id)) return false;

      const loanAmount = c.loanAmount || c.loan || 0;
      const paidAmount = c.paid || 0;
      const pendingAmount = c.pending !== undefined ? c.pending : (loanAmount - paidAmount);
      const isOverdue = c.endDate < now && pendingAmount > 0;
      const isFullyPaid = pendingAmount <= 0;

      // Filter chips
      let matchesFilter = true;
      if (filter === 'paid') matchesFilter = isFullyPaid;
      else if (filter === 'overdue') matchesFilter = isOverdue;
      else if (filter === 'pending') matchesFilter = !isFullyPaid && !isOverdue;
      else if (filter === 'high_amount') matchesFilter = loanAmount >= 20000;

      if (!matchesFilter) return false;

      // Smart Search Logic
      if (debouncedQuery) {
        const cleanQuery = debouncedQuery.trim();
        const idPart = String(c.displayId || c.id).toLowerCase();
        const phone = (c.phone || '').replace(/\D/g, '');
        const queryDigits = cleanQuery.replace(/\D/g, '');
        const nameMatch = c.name.toLowerCase().includes(cleanQuery);
        const idMatch = idPart.includes(cleanQuery);
        const phoneMatch = queryDigits.length > 0 && phone.includes(queryDigits);
        return nameMatch || idMatch || phoneMatch;
      }

      return true;
    });

    // Fast O(N log N) Sort using pre-computed O(1) lookups
    return result.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;

      if (sortOrder === 'name_asc') return a.name.localeCompare(b.name);
      if (sortOrder === 'name_desc') return b.name.localeCompare(a.name);

      if (sortOrder === 'pending_desc') {
        const pendingA = (a.loanAmount || a.loan || 0) - (a.paid || 0);
        const pendingB = (b.loanAmount || b.loan || 0) - (b.paid || 0);
        return pendingB - pendingA;
      }

      if (sortOrder === 'last_payment') {
        const lastA = lastPaymentTimeMap.get(a.id) || 0;
        const lastB = lastPaymentTimeMap.get(b.id) || 0;
        return lastB - lastA;
      }

      const idA = String(a.displayId || a.id);
      const idB = String(b.displayId || b.id);
      const numA = parseInt(idA.replace(/\D/g, '')) || 0;
      const numB = parseInt(idB.replace(/\D/g, '')) || 0;
      
      if (numA !== numB) {
        return sortOrder === 'asc' ? numA - numB : numB - numA;
      }
      return sortOrder === 'asc' ? idA.localeCompare(idB) : idB.localeCompare(idA);
    });
  }, [customers, filter, sortOrder, debouncedQuery, localDeletedIds, lastPaymentTimeMap]);

  // Progressive batching for super-smooth 60fps scrolling
  const [displayLimit, setDisplayLimit] = useState(40);
  useEffect(() => {
    setDisplayLimit(40);
  }, [filter, debouncedQuery, sortOrder]);

  const visibleCustomers = useMemo(() => {
    return filteredAndSorted.slice(0, displayLimit);
  }, [filteredAndSorted, displayLimit]);

  const handleTogglePin = async (customer: Customer) => {
    try {
      const newPinned = !customer.isPinned;
      await firestoreService.togglePinCustomer(customer.id, newPinned);
      toastSuccess(newPinned ? 'Pinned Account' : 'Unpinned Account', `${customer.name} moved ${newPinned ? 'to top' : 'back'}.`);
    } catch (error) {
      toastError('Update Failed', 'Failed to update pin status');
    }
  };

  const handleSaveCustomer = async (newCustomer: Partial<Customer> & { id: string }) => {
    const isUpdating = customers.some(c => c.id === newCustomer.id);

    if (isUpdating) {
      // Check if duplicate on a DIFFERENT customer
      const isDuplicate = customers.some(c => 
        c.id !== newCustomer.id &&
        c.name.trim().toLowerCase() === String(newCustomer.name || '').trim().toLowerCase() && 
        c.phone.trim() === String(newCustomer.phone || '').trim()
      );
      if (isDuplicate) {
        toastError('Duplicate Found', 'Another customer already exists with this name and phone');
        return;
      }

      try {
        await firestoreService.saveCustomer(newCustomer);
        toastSuccess('Customer Updated', `${newCustomer.name} has been updated.`);
        setEditCustomer(null);
      } catch (error) {
        toastError('Update Failed', 'Failed to update customer record');
      }
      return;
    }

    // 1. Check ID uniqueness for new customer
    const idExists = customers.some(c => c.id === newCustomer.id);
    if (idExists) {
      toastError('ID Conflict', `ID ${newCustomer.id} is already in use`);
      return;
    }

    // 2. Check Name + Phone Duplicate
    const isDuplicate = customers.some(c => 
      c.name.trim().toLowerCase() === String(newCustomer.name || '').trim().toLowerCase() && 
      c.phone.trim() === String(newCustomer.phone || '').trim()
    );
    if (isDuplicate) {
      toastError('Duplicate Found', 'Customer already exists (same name & phone)');
      return;
    }

    // 3. Check Phone warning
    const phoneInUse = customers.find(c => c.phone.trim() === newCustomer.phone?.trim());
    if (phoneInUse) {
      toastAction({
        title: 'Phone in Use',
        message: `This number is already used by ${phoneInUse.name}. Proceed?`,
        label: 'Okay',
      });
    }

    try {
      await firestoreService.saveCustomer(newCustomer);
      toastSuccess('Registration Successful', `${newCustomer.name} is now active.`);
      setShowAdd(false);
    } catch (error) {
      toastError('Registration Failed', 'Failed to create customer record');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    // Optimistically hide card from UI instantly to avoid lagging list
    setLocalDeletedIds(prev => [...prev, id]);

    toastAction({
      title: 'Customer Deleted',
      message: `${name} has been removed from your list.`,
      label: 'Undo',
      isUndo: true,
      onCommit: async () => {
        try {
          await firestoreService.deleteCustomer(id);
        } catch (error) {
          setLocalDeletedIds(prev => prev.filter(x => x !== id));
          toastError('Delete Failed', `Could not delete ${name}.`);
        }
      },
      onUndo: () => {
        setLocalDeletedIds(prev => prev.filter(x => x !== id));
        toastSuccess('Restored', `${name} is back in place.`);
      }
    });

    if (selectedCustomer?.id === id) setSelectedCustomer(null);
    if (editCustomer?.id === id) setEditCustomer(null);
  };

  return (
    <PageContainer>
      <div 
        className="flex flex-col gap-6 relative" 
        onClick={() => {
          setActiveSwipeId(null);
        }}
      >
        
        {/* Clean Search & Filter Header */}
        <div className="flex flex-col gap-3 sticky top-0 z-40 bg-bg/95 backdrop-blur-md pt-2 pb-2 -mx-2 px-2 border-b border-border/40" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-2">
            {/* Search Bar */}
            <div className="flex-1 relative group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary opacity-50 group-focus-within:opacity-100 group-focus-within:text-accent transition-all" size={17} />
              <input
                id="customers-search-input"
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, phone or ID..."
                className="w-full pl-10 pr-9 py-2.5 bg-card border border-border/80 rounded-xl text-sm font-medium outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all shadow-xs"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center bg-muted text-text-secondary rounded-full hover:text-text-primary transition-colors"
                  title="Clear search"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Sort Selector Trigger */}
            <button
              type="button"
              onClick={() => setShowSortSheet(true)}
              className="h-10 px-3 bg-card border border-border/80 hover:border-accent/40 rounded-xl flex items-center gap-1.5 text-xs font-bold text-text-secondary hover:text-text-primary transition-all active:scale-95 shadow-xs shrink-0"
              title="Change sort order"
            >
              <ArrowUpDown size={14} className="text-accent" />
              <span className="hidden xs:inline">
                {sortOptions.find(o => o.value === sortOrder)?.label.replace(' ', ': ')}
              </span>
            </button>
          </div>

          {/* Segmented Filter Control with Active Badges */}
          <div className="flex items-center gap-1.5 p-1 bg-muted/70 rounded-xl border border-border/50 overflow-x-auto scrollbar-hide">
            <button
              type="button"
              onClick={() => {
                if (navigator.vibrate) navigator.vibrate(5);
                setFilter('all');
              }}
              className={`flex-1 min-w-[70px] py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                filter === 'all'
                  ? 'bg-card text-text-primary shadow-xs border border-border/80 font-black'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <span>All</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-md ${
                filter === 'all' ? 'bg-accent/15 text-accent font-bold' : 'bg-card/50 text-text-secondary'
              }`}>
                {counts.all}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (navigator.vibrate) navigator.vibrate(5);
                setFilter('pending');
              }}
              className={`flex-1 min-w-[80px] py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                filter === 'pending'
                  ? 'bg-card text-text-primary shadow-xs border border-border/80 font-black'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <span>Pending</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-md ${
                filter === 'pending' ? 'bg-warning/20 text-warning font-bold' : 'bg-card/50 text-text-secondary'
              }`}>
                {counts.pending}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (navigator.vibrate) navigator.vibrate(5);
                setFilter('overdue');
              }}
              className={`flex-1 min-w-[80px] py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                filter === 'overdue'
                  ? 'bg-card text-danger shadow-xs border border-danger/30 font-black'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <span>Overdue</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-md ${
                filter === 'overdue' ? 'bg-danger/20 text-danger font-bold' : 'bg-card/50 text-text-secondary'
              }`}>
                {counts.overdue}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (navigator.vibrate) navigator.vibrate(5);
                setFilter('paid');
              }}
              className={`flex-1 min-w-[80px] py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                filter === 'paid'
                  ? 'bg-card text-success shadow-xs border border-success/30 font-black'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <span>Settled</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-md ${
                filter === 'paid' ? 'bg-success/20 text-success font-bold' : 'bg-card/50 text-text-secondary'
              }`}>
                {counts.paid}
              </span>
            </button>
          </div>
        </div>

        <BottomSheet
          isOpen={showSortSheet}
          onClose={() => setShowSortSheet(false)}
          title="Sort By"
          subtitle="Organize loan list"
        >
          <div className="flex flex-col gap-2 pb-6">
            {sortOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  if ('vibrate' in navigator) navigator.vibrate(5);
                  setSortOrder(opt.value as any);
                  setShowSortSheet(false);
                }}
                className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all ${
                  sortOrder === opt.value 
                    ? 'bg-accent/10 border border-accent/20' 
                    : 'bg-card border border-border/5'
                }`}
              >
                <span className={`text-sm font-black uppercase tracking-widest ${sortOrder === opt.value ? 'text-accent' : 'text-text-secondary opacity-60'}`}>
                  {opt.label}
                </span>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                  sortOrder === opt.value ? 'border-accent bg-accent' : 'border-border opacity-20'
                }`}>
                  {sortOrder === opt.value && <div className="w-2.5 h-2.5 bg-white rounded-full shadow-sm" />}
                </div>
              </button>
            ))}
          </div>
        </BottomSheet>

        <BottomSheet
          isOpen={showAdd}
          onClose={() => setShowAdd(false)}
          title="New Customer"
          subtitle="Register a new borrower"
        >
          <CustomerForm 
            onSave={handleSaveCustomer} 
            onCancel={() => setShowAdd(false)} 
          />
        </BottomSheet>

        <div className="flex flex-col gap-3 pb-24">
          {error ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 bg-red-500/10 border border-red-500/20 rounded-[32px] text-center animate-in zoom-in-95 duration-500">
              <div className="w-16 h-16 bg-red-500/20 text-red-500 rounded-2xl flex items-center justify-center mb-4">
                <X size={32} />
              </div>
              <p className="text-[13px] font-black text-red-500 uppercase tracking-[0.1em]">Sync Error</p>
              <p className="text-[10px] font-medium text-text-secondary opacity-80 mt-2 max-w-sm leading-relaxed">
                {error}
              </p>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => refreshData()}
                className="mt-6 px-6 py-3 rounded-xl bg-accent text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-accent/20"
              >
                Retry Connection
              </motion.button>
            </div>
          ) : !isReady ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="bg-card rounded-2xl p-4 border border-border flex items-center gap-4">
                  <Skeleton className="w-12 h-12 rounded-full" />
                  <div className="flex-1 flex flex-col gap-2">
                    <Skeleton className="h-4 w-1/3" />
                     <Skeleton className="h-3 w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : customers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 px-6 bg-card/50 rounded-[32px] border border-dashed border-border/20 text-center animate-in zoom-in-95 duration-500">
              <div className="w-20 h-20 bg-accent/10 text-accent rounded-3xl flex items-center justify-center mb-6">
                <User size={40} className="animate-pulse" />
              </div>
              <p className="text-[15px] font-black text-text-primary uppercase tracking-[0.15em]">No Borrowers Registered</p>
              <p className="text-xs font-semibold text-text-secondary opacity-50 mt-2 max-w-sm mx-auto leading-relaxed">
                Get started by registering your very first client. Click the button below to open the registration form.
              </p>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowAdd(true)}
                className="mt-8 px-8 py-4 rounded-2xl bg-accent text-white text-[11px] font-black uppercase tracking-widest shadow-lg shadow-accent/25 flex items-center gap-2"
              >
                <Plus size={16} strokeWidth={3} /> Register First Customer
              </motion.button>
            </div>
          ) : filteredAndSorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-6 bg-card/40 rounded-[32px] border border-dashed border-border/10 text-center animate-in zoom-in-95 duration-500">
              <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mb-4 opacity-50">
                <User size={32} className="text-text-secondary" />
              </div>
              <p className="text-[13px] font-black text-text-primary uppercase tracking-[0.1em]">No Match Found</p>
              <p className="text-[10px] font-medium text-text-secondary opacity-40 mt-2 leading-relaxed">
                We couldn't find any customers {searchTerm ? `matching "${searchTerm}"` : 'for this filter'}.
              </p>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setSearchTerm('');
                  setFilter('all');
                }}
                className="mt-6 px-6 py-3 rounded-xl bg-accent text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-accent/20"
              >
                Clear All Filters
              </motion.button>
            </div>
          ) : (
            <>
              {visibleCustomers.map((customer) => (
                <div 
                  key={customer.id} 
                  id={`customer-item-${customer.id}`}
                  onClick={e => e.stopPropagation()}
                  className={`transition-all duration-300 rounded-2xl ${highlightedId === customer.id ? 'ring-2 ring-accent ring-offset-4 ring-offset-bg bg-accent/5' : ''}`}
                >
                  <CustomerCard
                    customer={customer}
                    lastActivity={customerActivityMap.get(customer.id)}
                    isPaidToday={paidTodaySet.has(customer.id)}
                    onClick={() => setSelectedCustomer(customer)}
                    onAddEntry={() => onNavigate?.('entry', undefined, customer.id)}
                    onEdit={() => setEditCustomer(customer)}
                    onDelete={() => handleDelete(customer.id, customer.name)}
                    onTogglePin={() => handleTogglePin(customer)}
                    onStartNewLoan={() => setNewLoanCustomer(customer)}
                    onWithdraw={(cust) => setWithdrawCustomer(cust)}
                    activeSwipeId={activeSwipeId}
                    setActiveSwipeId={setActiveSwipeId}
                  />
                </div>
              ))}

              {filteredAndSorted.length > displayLimit && (
                <button
                  type="button"
                  onClick={() => setDisplayLimit(prev => prev + 40)}
                  className="w-full py-3 my-2 rounded-xl bg-card border border-border/80 text-xs font-bold text-accent hover:bg-accent/5 transition-all active:scale-[0.98] shadow-xs cursor-pointer"
                >
                  Load More Borrowers ({filteredAndSorted.length - displayLimit} remaining)
                </button>
              )}
            </>
          )}
        </div>

        <AnimatePresence>
          {selectedCustomer && (
            <CustomerDetails
              key={`customer-details-${selectedCustomer.id}`}
              customer={selectedCustomer}
              transactions={transactions}
              onClose={() => {
                try {
                  const url = new URL(window.location.href);
                  if (url.searchParams.has('customerId') || url.searchParams.has('id')) {
                    url.searchParams.delete('customerId');
                    url.searchParams.delete('id');
                    window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
                  }
                } catch {}

                if (location.state?.from === 'dashboard') {
                  onNavigate?.('dashboard');
                } else {
                  setSelectedCustomer(null);
                }
              }}
              onAddEntry={() => {
                onNavigate?.('entry', undefined, selectedCustomer.id);
                setSelectedCustomer(null);
              }}
              onEdit={() => setEditCustomer(selectedCustomer)}
              onDelete={(id) => handleDelete(id, selectedCustomer.name)}
              onTogglePin={() => handleTogglePin(selectedCustomer)}
            />
          )}
        </AnimatePresence>

        <BottomSheet
          isOpen={!!editCustomer}
          onClose={() => setEditCustomer(null)}
          title="Edit Customer"
          subtitle={`ID: ${editCustomer?.displayId || editCustomer?.id || ''}`}
        >
          {editCustomer && (
            <CustomerForm 
              customer={editCustomer} 
              onSave={handleSaveCustomer}
              onCancel={() => setEditCustomer(null)} 
              onDelete={handleDelete}
            />
          )}
        </BottomSheet>

        {/* New Loan via CustomerForm for Completed / Returning Customers */}
        <BottomSheet
          isOpen={!!newLoanCustomer}
          onClose={() => setNewLoanCustomer(null)}
          title={`New Loan • Cycle #${(newLoanCustomer?.currentCycle || 1) + 1}`}
          subtitle={`Issue new loan cycle for ${newLoanCustomer?.name || ''}`}
        >
          {newLoanCustomer && (
            <CustomerForm
              customer={newLoanCustomer}
              mode="new_loan"
              onCancel={() => setNewLoanCustomer(null)}
              onSuccess={() => {
                setNewLoanCustomer(null);
                refreshData();
              }}
            />
          )}
        </BottomSheet>

        {/* WITHDRAW DEPOSIT MODAL */}
        <WithdrawDepositModal
          isOpen={!!withdrawCustomer}
          onClose={() => setWithdrawCustomer(null)}
          customer={withdrawCustomer}
          onSuccess={(receipt) => {
            setSelectedReceipt(receipt);
            refreshData();
          }}
        />

        {/* DIGITAL RECEIPT MODAL */}
        {selectedReceipt && (
          <ReceiptSuccessModal
            receipt={selectedReceipt}
            onClose={() => setSelectedReceipt(null)}
            onStartNewLoan={() => setNewLoanCustomer(selectedReceipt.customer)}
          />
        )}
      </div>
    </PageContainer>
  );
}
