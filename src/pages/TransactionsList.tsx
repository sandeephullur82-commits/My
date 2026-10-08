import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { useRealtimeData } from '../hooks/useRealtimeData';
import { Transaction, Customer, firestoreService } from '../services/firestoreService';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import { 
  ChevronDown, Banknote, Smartphone, Clock, Search, X, Filter, 
  ChevronRight, Calendar, ArrowUpRight, ArrowDownLeft,
  Loader2, Edit3, Share2, Eye, FileText, ShieldCheck, Receipt, Download
} from 'lucide-react';
import { PageContainer } from '../components/PageContainer';
import { useUI } from '../context/UIContext';
import { toast } from 'sonner';
import { PDFViewerModal } from '../components/PDFViewerModal';
import { MasterExportModal } from '../components/MasterExportModal';
import { ReceiptSuccessModal, ReceiptData } from '../components/ReceiptSuccessModal';
import { safeFormat } from '../lib/utils';

type FilterType = 'ALL' | 'CASH' | 'PHONEPE' | 'UNSETTLED';

export function TransactionsList() {
  const { transactions, customers, loading } = useRealtimeData();
  const { searchTerm, setSearchTerm } = useUI();
  const location = useLocation();
  const navigate = useNavigate();
  const todayKey = format(new Date(), 'yyyy-MM-dd');
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ [todayKey]: true });
  const [filter, setFilter] = useState<FilterType>('ALL');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [showMasterExportModal, setShowMasterExportModal] = useState(false);
  
  // PDF Preview State
  const [previewReport, setPreviewReport] = useState<{ blob: Blob, fileName: string, title: string } | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  
  // Receipt Modal State
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptData | null>(null);

  // Fast O(1) customer map to eliminate repeated O(C) array scans
  const customerMap = useMemo(() => {
    const map = new Map<string, Customer>();
    for (let i = 0; i < customers.length; i++) {
      map.set(customers[i].id, customers[i]);
    }
    return map;
  }, [customers]);

  const handleOpenReceipt = (tx: Transaction) => {
    const customer = customerMap.get(tx.customerId);
    const targetCustomer: Customer = customer || ({
      id: tx.customerId,
      name: 'Unknown Customer',
      phone: '',
      loanAmount: tx.amount,
      paid: tx.amount,
      pending: 0,
      installments: 100,
      startDate: tx.date
    } as unknown as Customer);

    const isNP = tx.type === 'NP' || tx.type === 'unsettled' || tx.status === 'unsettled';
    const currentBalance = targetCustomer.pending !== undefined 
      ? targetCustomer.pending 
      : ((targetCustomer.loanAmount || targetCustomer.loan || 0) - (targetCustomer.paid || 0));

    const previousBalance = isNP ? currentBalance : currentBalance + tx.amount;
    const newBalance = currentBalance;

    setSelectedReceipt({
      transaction: tx,
      customer: targetCustomer,
      previousBalance,
      newBalance
    });
  };
  
  // Pagination State
  const [visibleDays, setVisibleDays] = useState(7); // Show 7 days initially

  // No filter syncing needed anymore as it's local
  const handleSetFilter = (f: FilterType) => {
    setFilter(f);
    // Reset sections when filter changes
    setOpenSections({ [todayKey]: true });
  };

  // Handle Navigation State and Filter Initialization
  useEffect(() => {
    const state = location.state as { filter?: FilterType, from?: string, fromTab?: boolean } | null;
    
    // PRIORITY 1: Direct Filter Intent (from Dashboard)
    if (state?.filter) {
      handleSetFilter(state.filter);
    } 
    // PRIORITY 2: Bottom Tab Navigation Intent
    else if (state?.fromTab) {
      handleSetFilter('ALL');
      setSearchTerm('');
    } 
    // PRIORITY 3: Default Fallback
    else {
      handleSetFilter('ALL');
      setSearchTerm('');
    }

    // CLEANUP: Clear state to prevent sticky behavior on refresh/back
    // Using window.history instead of navigate to avoid triggering this effect again
    window.history.replaceState({}, document.title);
  }, [location.key]); // Logic runs on every navigation change

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchTerm.trim().toLowerCase());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      if (tx.isDeleted) return false;

      // 1. Status/Type Filter
      if (filter !== 'ALL') {
        if (filter === 'UNSETTLED') {
          const isNP = tx.type === 'NP' || tx.type === 'unsettled' || tx.status === 'unsettled';
          if (!isNP) return false;
        } else {
          if (!tx.type || tx.type.toUpperCase() !== filter) return false;
        }
      }

      // 2. Search Logic
      if (debouncedQuery) {
        const customer = customerMap.get(tx.customerId);
        if (!customer) return false;
        
        const nameMatch = customer.name.toLowerCase().includes(debouncedQuery);
        const phoneMatch = customer.phone.includes(debouncedQuery);
        const isNumeric = /^\d+$/.test(debouncedQuery);
        
        if (isNumeric) {
          if (debouncedQuery.length <= 3) {
            const idPart = customer.id.split('-').pop() || '';
            const idMatch = idPart.endsWith(debouncedQuery);
            return idMatch || nameMatch;
          }
          return phoneMatch || nameMatch;
        }
        return nameMatch;
      }

      return true;
    });
  }, [transactions, customerMap, filter, debouncedQuery]);

  // Transaction counts for filter tabs
  const filterCounts = useMemo(() => {
    const counts = { ALL: 0, CASH: 0, PHONEPE: 0, UNSETTLED: 0 };
    transactions.forEach(tx => {
      if (tx.isDeleted) return;
      counts.ALL++;
      if (tx.type === 'cash' && tx.status === 'paid') counts.CASH++;
      if (tx.type === 'phonepe' && tx.status === 'paid') counts.PHONEPE++;
      if (tx.status === 'unsettled' || tx.type === 'NP' || tx.type === 'unsettled') counts.UNSETTLED++;
    });
    return counts;
  }, [transactions]);


  // Group transactions by date with totals
  const groupedTransactions = useMemo(() => {
    const groups: Record<string, { transactions: Transaction[], total: number }> = {};
    
    filteredTransactions.forEach(tx => {
      const date = tx.date; // YYYY-MM-DD
      if (!groups[date]) {
        groups[date] = { transactions: [], total: 0 };
      }
      groups[date].transactions.push(tx);
      groups[date].total += tx.amount;
    });

    // Sort dates descending
    const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a));
    
    const allGroups = sortedDates.map(date => ({
      date,
      total: groups[date].total,
      count: groups[date].transactions.length,
      isPlaceholder: false,
      transactions: groups[date].transactions.sort((a, b) => b.timestamp - a.timestamp)
    }));

    return {
      visibleGroups: allGroups.slice(0, visibleDays),
      totalGroups: allGroups.length,
      hasMore: allGroups.length > visibleDays
    };
  }, [filteredTransactions, visibleDays]);

  const toggleSection = (dateStr: string) => {
    const newVal = !openSections[dateStr];
    setOpenSections(prev => ({
      ...prev,
      [dateStr]: newVal
    }));
  };

  const getDateHeader = (dateStr: string) => {
    try {
      const date = parseISO(dateStr);
      if (!isNaN(date.getTime())) {
        if (isToday(date)) return 'Today';
        if (isYesterday(date)) return 'Yesterday';
        return safeFormat(date, 'dd MMM, yyyy', dateStr);
      }
    } catch (e) {
      // fallback
    }
    return dateStr || '—';
  };

  return (
    <PageContainer>
      <div className="flex flex-col gap-4 animate-in fade-in duration-500 pb-20">
        
        {/* Sticky Header Section: Search & Filters */}
        <div className="sticky top-0 z-50 bg-bg/80 backdrop-blur-md -mx-2 px-2 pt-2 pb-3 flex flex-col gap-4 border-b border-border/5">
          {/* Search & Export */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary opacity-30 group-focus-within:opacity-100 group-focus-within:text-accent transition-all">
                <Search size={18} />
              </div>
              <input 
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search transactions..."
                className="w-full pl-11 pr-12 py-3.5 bg-card border border-border/50 rounded-2xl text-sm font-medium focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/5 transition-all shadow-sm"
              />
              <AnimatePresence>
                {searchTerm && (
                  <motion.button
                    key="clear-search"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    onClick={() => setSearchTerm('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-7 h-7 bg-muted flex items-center justify-center rounded-full text-text-secondary hover:bg-border transition-colors"
                  >
                    <X size={14} />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowMasterExportModal(true)}
              className="h-12 px-4 flex items-center gap-2 bg-accent text-white rounded-2xl shadow-sm shadow-accent/20 hover:bg-accent/90 active:scale-95 transition-all text-xs font-black uppercase tracking-wider shrink-0 cursor-pointer"
              title="Master Application Data Export (Excel & PDF)"
            >
              <Download size={16} strokeWidth={2.5} />
              <span className="hidden sm:inline">Master Export</span>
              <span className="sm:hidden">Export</span>
            </motion.button>
          </div>

          {/* Filter Tabs - Clean Segmented Control */}
          <div className="flex items-center gap-1.5 p-1 bg-muted/70 rounded-xl border border-border/50 overflow-x-auto scrollbar-hide">
            {(['ALL', 'CASH', 'PHONEPE', 'UNSETTLED'] as FilterType[]).map((f) => {
              const label = f === 'PHONEPE' ? 'UPI' : f === 'UNSETTLED' ? 'Unsettled / NP' : f === 'ALL' ? 'All' : 'Cash';
              const isActive = filter === f;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => {
                    if (navigator.vibrate) navigator.vibrate(5);
                    handleSetFilter(f);
                  }}
                  className={`flex-1 min-w-[70px] py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
                    isActive 
                      ? 'bg-card text-text-primary shadow-xs border border-border/80 font-black' 
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <span>{label}</span>
                  <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-md ${
                    isActive ? 'bg-accent/15 text-accent font-bold' : 'bg-card/50 text-text-secondary'
                  }`}>
                    {filterCounts[f]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Transaction List */}
        <div className="flex flex-col gap-4">
          {loading ? (
            <div className="flex flex-col gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-card rounded-3xl p-4 border border-border/5 animate-pulse">
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-border/20" />
                      <div className="flex flex-col gap-2">
                        <div className="h-3 w-20 bg-border/20 rounded" />
                        <div className="h-2 w-12 bg-border/10 rounded" />
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="h-4 w-16 bg-border/20 rounded" />
                      <div className="h-2 w-10 bg-border/10 rounded" />
                    </div>
                  </div>
                  <div className="flex flex-col gap-3">
                    {[1, 2].map(j => (
                      <div key={j} className="h-16 bg-border/5 rounded-2xl" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : groupedTransactions.visibleGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-card/40 rounded-[32px] border border-dashed border-border/10">
               <Calendar size={48} className="opacity-10 mb-4" />
               <p className="text-[11px] font-black text-text-primary uppercase tracking-widest text-center px-4">
                 {filter === 'ALL' ? 'No transactions found' : `No ${filter.charAt(0) + filter.slice(1).toLowerCase()} transactions found`}
               </p>
               <p className="text-[9px] font-medium text-text-secondary opacity-40 mt-1">Try refining your search or filters</p>
            </div>
          ) : (
            <>
              {groupedTransactions.visibleGroups.map((group) => {
                const isOpen = !!openSections[group.date];
                const isTodayGroup = group.date === todayKey;
                
                return (
                  <div 
                    key={group.date} 
                    id={`section-${group.date}`}
                    className={`flex flex-col rounded-3xl overflow-hidden border transition-all duration-300 ${
                      isTodayGroup ? 'border-accent/30 bg-accent/[0.02]' : 'border-border/10 bg-card/30'
                    }`}
                  >
                    {/* Collapsible Header */}
                    <div 
                      onClick={() => toggleSection(group.date)}
                      className={`sticky top-0 z-20 flex items-center justify-between p-4 cursor-pointer transition-colors backdrop-blur-md ${
                        isOpen ? 'bg-accent/10 border-b border-border/10' : 'bg-card/80'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <motion.div
                          animate={{ rotate: isOpen ? 180 : 0 }}
                          className={isTodayGroup ? "text-accent" : "text-text-secondary opacity-40"}
                        >
                          <ChevronDown size={18} />
                        </motion.div>
                        <div className="flex flex-col">
                          <span className={`text-[14px] font-black tracking-tight ${isTodayGroup ? 'text-accent' : 'text-text-primary'}`}>
                            {getDateHeader(group.date)}
                          </span>
                          <span className="text-[9px] font-black text-accent uppercase tracking-widest leading-none">
                            {group.count} {group.count === 1 ? 'entry' : 'entries'}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end">
                        <span className="text-[16px] font-black text-text-primary tracking-tighter">
                          ₹{group.total.toLocaleString()}
                        </span>
                        <span className="text-[8px] font-black text-text-secondary opacity-40 uppercase tracking-[0.2em] leading-none">
                          Total Amount
                        </span>
                      </div>
                    </div>

                    {/* List Content */}
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          key="content"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3, ease: 'easeInOut' }}
                          className="overflow-hidden"
                        >
                          <div className="flex flex-col p-3 gap-2">
                            {group.transactions.map((tx) => {
                              const customer = customerMap.get(tx.customerId);
                              const isCash = tx.type === 'cash';
                              const isUPI = tx.type === 'phonepe';
                              const isNP = tx.type === 'NP' || tx.type === 'unsettled';
                              
                              return (
                                <motion.div
                                  key={tx.id}
                                  layout
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  whileTap={{ scale: 0.98 }}
                                  onClick={() => handleOpenReceipt(tx)}
                                  className="group relative flex items-center justify-between p-4 bg-card border border-border/10 rounded-2xl transition-all shadow-2xs cursor-pointer hover:border-accent/40 active:bg-muted/40 hover:shadow-xs"
                                >
                                  <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                      isCash ? 'bg-success/10 text-success' : 
                                      isUPI ? 'bg-accent/10 text-accent' : 
                                      'bg-amber-500/10 text-amber-500'
                                    }`}>
                                      {isCash ? <Banknote size={20} /> : 
                                       isUPI ? <Smartphone size={20} /> : 
                                       <Clock size={20} />}
                                    </div>
                                    
                                    <div>
                                      <p className="font-bold text-[15px] text-text-primary tracking-tight leading-tight">
                                        {customer?.name || 'Unknown'}
                                      </p>
                                      <div className="flex items-center gap-2 mt-1">
                                        <span className="text-[9px] font-bold text-text-secondary opacity-40 uppercase tracking-wider">
                                          {safeFormat(tx.timestamp, 'hh:mm a')}
                                        </span>
                                        <div className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-[0.1em] ${
                                          isCash ? 'bg-success/10 text-success' : 
                                          isUPI ? 'bg-accent/10 text-accent' : 
                                          'bg-amber-500/10 text-amber-500'
                                        }`}>
                                          {isNP ? 'NP' : (tx.type ? tx.type.toUpperCase() : 'PAID')}
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2.5 shrink-0">
                                    <div className="flex flex-col items-end">
                                      <p className="text-[15px] font-black text-text-primary tracking-tighter">
                                        ₹{tx.amount.toLocaleString('en-IN')}
                                      </p>
                                      <span className="text-[8px] font-bold text-accent uppercase tracking-wider flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                                        <Receipt size={9} /> Receipt
                                      </span>
                                    </div>
                                  </div>
                                </motion.div>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}

              {groupedTransactions.hasMore && (
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setVisibleDays(prev => prev + 15)}
                  className="w-full py-6 mt-4 rounded-[32px] bg-card border border-border/10 flex flex-col items-center justify-center gap-2 group hover:border-accent/30 transition-all"
                >
                  <Clock size={24} className="text-accent opacity-40 group-hover:opacity-100 transition-opacity" />
                  <span className="text-[11px] font-black uppercase tracking-[0.2em] text-text-secondary">Load More History</span>
                  <span className="text-[8px] font-bold text-text-secondary opacity-20">
                    Showing {groupedTransactions.visibleGroups.length} of {groupedTransactions.totalGroups} days
                  </span>
                </motion.button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Master Data Export Modal (Excel & PDF for Entire App) */}
      <MasterExportModal
        isOpen={showMasterExportModal}
        onClose={() => setShowMasterExportModal(false)}
        customers={customers}
        transactions={transactions}
        onPreviewPDF={(report) => {
          setPreviewReport(report);
          setShowPreview(true);
        }}
      />

      <PDFViewerModal 
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        report={previewReport}
      />

      {/* Transaction Receipt Modal */}
      {selectedReceipt && typeof document !== 'undefined' && createPortal(
        <ReceiptSuccessModal
          receipt={selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
        />,
        document.body
      )}
    </PageContainer>
  );
}
