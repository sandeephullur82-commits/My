import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, User, ArrowDownAZ, ArrowUpZA, Edit2, Trash2, IndianRupee, Search, Pin, PinOff, Filter, ArrowUp, ArrowDown, History, X, ChevronDown, SlidersHorizontal, ArrowUpDown, Check } from 'lucide-react';
import { firestoreService, Customer } from '../services/firestoreService';
import { useRealtimeData } from '../hooks/useRealtimeData';
import { toast } from 'sonner';
import { CustomerCard } from '../components/CustomerCard';
import { CustomerDetails } from '../components/CustomerDetails';
import { CustomerForm } from '../components/CustomerForm';
import { BottomSheet } from '../components/BottomSheet';
import { PageContainer } from '../components/PageContainer';
import { Skeleton } from '../components/Skeleton';
import { useUI } from '../context/UIContext';
import { useFeedback } from '../context/FeedbackContext';
import { useMemo } from 'react';

interface CustomersProps {
  onNavigate?: (tab: string, filter?: any, customerId?: string, entryTabVal?: any, dateFilterVal?: any) => void;
}

export function Customers({ onNavigate }: CustomersProps) {
  const { customers, transactions, loading, error, refreshData } = useRealtimeData();
  const { searchTerm, setSearchTerm, setIsModalOpen } = useUI();
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

  const [filter, setFilter] = useState<'all' | 'pending' | 'paid' | 'overdue' | 'high_amount'>('all');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | 'pending_desc' | 'last_payment' | 'name_asc' | 'name_desc'>('asc');
  const [showAdd, setShowAdd] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [activeSwipeId, setActiveSwipeId] = useState<string | null>(null);
  const [localDeletedIds, setLocalDeletedIds] = useState<string[]>([]);
  
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [showSortSheet, setShowSortSheet] = useState(false);

  // Sync modal state with UI context
  useEffect(() => {
    setIsModalOpen(!!selectedCustomer || !!editCustomer || showAdd);
    return () => {
      setIsModalOpen(false);
    };
  }, [selectedCustomer, editCustomer, showAdd, setIsModalOpen]);

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

  // Auto-scroll and Highlight logic
  useEffect(() => {
    if (isReady && !loading && customers.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const targetId = params.get('customerId') || params.get('id');
      
      if (targetId) {
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

  const filteredAndSorted = useMemo(() => {
    let result = customers.filter(c => {
      if (c.isDeleted || localDeletedIds.includes(c.id)) return false;

      const loanAmount = c.loanAmount || c.loan || 0;
      const paidAmount = c.paid || 0;
      const pendingAmount = c.pending !== undefined ? c.pending : (loanAmount - paidAmount);
      const isOverdue = c.endDate < Date.now() && pendingAmount > 0;
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

    // Sort Logic
    return result.sort((a, b) => {
      // Pinned customers stay top
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
        const lastA = transactions.filter(tx => tx.customerId === a.id && !tx.isDeleted && tx.status === 'paid').sort((x, y) => y.timestamp - x.timestamp)[0]?.timestamp || 0;
        const lastB = transactions.filter(tx => tx.customerId === b.id && !tx.isDeleted && tx.status === 'paid').sort((x, y) => y.timestamp - x.timestamp)[0]?.timestamp || 0;
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
  }, [customers, filter, sortOrder, debouncedQuery, transactions]);

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
    // 1. Check ID uniqueness (usually handled by getNextCustomerId but good for manual types)
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

    // 3. Check Phone warning (optional but helpful)
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
        
        {/* Minimal Search-First Header */}
        <div className="flex flex-col gap-4 sticky top-0 z-50 bg-bg/80 backdrop-blur-md pt-3 pb-1 -mx-2 px-2" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-3">
            <div className="flex-1 relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary opacity-30 group-focus-within:opacity-100 group-focus-within:text-accent transition-all" size={18} />
              <input
                id="customers-search-input"
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search name, ID (003), or phone"
                className="w-full pl-11 pr-10 py-4 bg-card border border-border/10 rounded-[24px] text-[15px] font-medium outline-none focus:border-accent/40 focus:ring-4 focus:ring-accent/5 transition-all shadow-sm"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center bg-muted text-text-secondary rounded-full opacity-40 hover:opacity-100 transition-opacity"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Filter & Sort Controls - Bottom Sheet Selectors */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowFilterSheet(true);
                }}
                className={`w-full flex items-center justify-between bg-card border border-border/10 rounded-2xl px-4 py-3.5 text-[10px] font-black uppercase tracking-widest outline-none transition-all active:scale-[0.98] active:bg-accent/5`}
              >
                <div className="flex items-center gap-2">
                  <Filter size={14} className={filter === 'all' ? 'opacity-40' : 'text-accent'} />
                  <span className={filter === 'all' ? 'text-text-secondary opacity-40' : 'text-text-primary'}>
                    {filterOptions.find(o => o.value === filter)?.label}
                  </span>
                </div>
                <ChevronDown size={14} className="opacity-40" />
              </button>
            </div>

            <div className="relative flex-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSortSheet(true);
                }}
                className={`w-full flex items-center justify-between bg-card border border-border/10 rounded-2xl px-4 py-3.5 text-[10px] font-black uppercase tracking-widest outline-none transition-all active:scale-[0.98] active:bg-accent/5`}
              >
                <div className="flex items-center gap-2">
                  <ArrowUpDown size={14} className="opacity-40" />
                  <span className="text-text-secondary opacity-40">
                    {sortOptions.find(o => o.value === sortOrder)?.label}
                  </span>
                </div>
                <ChevronDown size={14} className="opacity-40" />
              </button>
            </div>
          </div>
        </div>

        <BottomSheet
          isOpen={showFilterSheet}
          onClose={() => setShowFilterSheet(false)}
          title="Filter Customers"
          subtitle="Refine your loan list"
        >
          <div className="flex flex-col gap-2 pb-6">
            {filterOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  if ('vibrate' in navigator) navigator.vibrate(5);
                  setFilter(opt.value as any);
                  setShowFilterSheet(false);
                }}
                className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all ${
                  filter === opt.value 
                    ? 'bg-accent/10 border border-accent/20' 
                    : 'bg-card border border-border/5'
                }`}
              >
                <span className={`text-sm font-black uppercase tracking-widest ${filter === opt.value ? 'text-accent' : 'text-text-secondary opacity-60'}`}>
                  {opt.label}
                </span>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                  filter === opt.value ? 'border-accent bg-accent' : 'border-border opacity-20'
                }`}>
                  {filter === opt.value && <div className="w-2.5 h-2.5 bg-white rounded-full shadow-sm" />}
                </div>
              </button>
            ))}
          </div>
        </BottomSheet>

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
            filteredAndSorted.map((customer) => (
              <div 
                key={customer.id} 
                id={`customer-item-${customer.id}`}
                onClick={e => e.stopPropagation()}
                className={`transition-all duration-1000 rounded-2xl ${highlightedId === customer.id ? 'ring-2 ring-accent ring-offset-4 ring-offset-bg bg-accent/5' : ''}`}
              >
                <CustomerCard
                  customer={customer}
                  transactions={transactions}
                  onClick={() => setSelectedCustomer(customer)}
                  onAddEntry={() => onNavigate?.('entry', undefined, customer.id)}
                  onEdit={() => setEditCustomer(customer)}
                  onDelete={() => handleDelete(customer.id, customer.name)}
                  onTogglePin={() => handleTogglePin(customer)}
                  activeSwipeId={activeSwipeId}
                  setActiveSwipeId={setActiveSwipeId}
                />
              </div>
            ))
          )}
        </div>

        <AnimatePresence>
          {selectedCustomer && (
            <CustomerDetails
              key={`customer-details-${selectedCustomer.id}`}
              customer={selectedCustomer}
              transactions={transactions}
              onClose={() => setSelectedCustomer(null)}
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
      </div>
    </PageContainer>
  );
}
