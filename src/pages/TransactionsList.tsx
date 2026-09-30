import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useRealtimeData } from '../hooks/useRealtimeData';
import { Transaction, Customer, firestoreService } from '../services/firestoreService';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import { 
  ChevronDown, Banknote, Smartphone, Clock, Search, X, Filter, 
  ChevronRight, Calendar, ArrowUpRight, ArrowDownLeft,
  Loader2, Save, Trash2, Edit3, Check, Share2, Eye, FileText, ShieldCheck
} from 'lucide-react';
import { PageContainer } from '../components/PageContainer';
import { useUI } from '../context/UIContext';
import { toast } from 'sonner';
import { BottomSheet } from '../components/BottomSheet';
import { exportTransactionsPDF } from '../lib/pdfExport';
import { PDFViewerModal } from '../components/PDFViewerModal';
import { ExportAuditModal } from '../components/ExportAuditModal';
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
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState<string>('');
  const [editType, setEditType] = useState<Transaction['type']>('cash');
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [showTypeSheet, setShowTypeSheet] = useState(false);
  const [showExportSheet, setShowExportSheet] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  
  // PDF Preview State
  const [previewReport, setPreviewReport] = useState<{ blob: Blob, fileName: string, title: string } | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  
  // Pagination State
  const [visibleDays, setVisibleDays] = useState(7); // Show 7 days initially

  const handleExport = async (range: 'today' | 'week' | 'month' | 'current' | 'ledger') => {
    let exportData = [...transactions].filter(t => !t.isDeleted);
    let title = 'Transaction Report';
    let rangeStr = 'All Time';

    const now = new Date();
    const todayStart = new Date(now.setHours(0, 0, 0, 0)).getTime();
    
    if (range === 'today') {
      exportData = exportData.filter(t => t.timestamp >= todayStart);
      title = 'Daily Collection Report';
      rangeStr = format(new Date(), 'dd MMM yyyy');
    } else if (range === 'week') {
      const weekStart = todayStart - (7 * 86400000);
      exportData = exportData.filter(t => t.timestamp >= weekStart);
      title = 'Weekly Transaction Summary';
      rangeStr = `${format(weekStart, 'dd MMM')} - ${format(new Date(), 'dd MMM yyyy')}`;
    } else if (range === 'month') {
      const monthStart = todayStart - (30 * 86400000);
      exportData = exportData.filter(t => t.timestamp >= monthStart);
      title = 'Monthly Financial Statement';
      rangeStr = `${format(monthStart, 'dd MMM')} - ${format(new Date(), 'dd MMM yyyy')}`;
    } else if (range === 'ledger') {
      // For ledger, we typically want current filter view but in ledger format
      exportData = filteredTransactions;
      title = 'Horizontal Digital Ledger';
      rangeStr = filter === 'ALL' ? 'Filtered View' : `Mode: ${filter}`;
    } else {
      // Current filtered view
      exportData = filteredTransactions;
      title = filter === 'ALL' ? 'Complete History Report' : `${filter} Transactions Report`;
      rangeStr = searchTerm ? `Search: "${searchTerm}"` : 'Filtered View';
    }

    if (exportData.length === 0) {
      toast.error('No transactions found for this period');
      return;
    }
    
    setShowExportSheet(false);
    setIsExporting(true);
    const toastId = toast.loading('Generating ledger data matrix...');
    
    try {
      const result = await exportTransactionsPDF(exportData, customers, filter, title, rangeStr);
      
      if (!result.blob || result.blob.size === 0) {
        throw new Error('Generated PDF is empty');
      }

      setPreviewReport(result);
      setShowPreview(true);
      
      toast.success('Report ready for preview', { id: toastId });
    } catch (err) {
      console.error('Export failed', err);
      toast.error('Failed to generate ledger data', { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

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

    // Auto-scroll to Today if it exists on load
    setTimeout(() => {
      const el = document.getElementById(`section-${todayKey}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 800);

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
          if (tx.status !== 'unsettled') return false;
        } else {
          if (!tx.type || tx.type.toUpperCase() !== filter) return false;
        }
      }

      // 2. Search Logic
      if (debouncedQuery) {
        const customer = customers.find(c => c.id === tx.customerId);
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
  }, [transactions, customers, filter, debouncedQuery]);

  // Transaction counts for filter tabs
  const filterCounts = useMemo(() => {
    const counts = { ALL: 0, CASH: 0, PHONEPE: 0, UNSETTLED: 0 };
    transactions.forEach(tx => {
      if (tx.isDeleted) return;
      counts.ALL++;
      if (tx.type === 'cash' && tx.status === 'paid') counts.CASH++;
      if (tx.type === 'phonepe' && tx.status === 'paid') counts.PHONEPE++;
      if (tx.status === 'unsettled') counts.UNSETTLED++;
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
    
    // Smooth scroll into view when expanding
    if (newVal) {
      setTimeout(() => {
        const el = document.getElementById(`section-${dateStr}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 300);
    }
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

  const handleEditStart = (tx: Transaction) => {
    setEditingTxId(tx.id);
    setEditAmount(tx.amount.toString());
    setEditType(tx.type);
  };

  const handleSaveEdit = async (tx: Transaction) => {
    if (isSaving) return;
    const amount = parseInt(editAmount);
    if (isNaN(amount) || amount < 1) {
      toast.error('Invalid amount');
      return;
    }

    // Don't save if nothing changed
    if (amount === tx.amount && editType === tx.type) {
      setEditingTxId(null);
      return;
    }

    setIsSaving(true);
    try {
      const customer = customers.find(c => c.id === tx.customerId);
      if (!customer) throw new Error('Customer not found');

      const oldData = { ...tx };
      const updates: Partial<Transaction> = {
        amount,
        type: editType,
        status: editType === 'unsettled' ? 'unsettled' : 'paid'
      };

      await firestoreService.updateTransaction(
        tx.id, 
        updates, 
        tx, 
        customer, 
        'Transactions List Inline Edit'
      );
      
      toast.success('Transaction updated', {
        action: {
          label: 'Undo',
          onClick: async () => {
            try {
              await firestoreService.updateTransaction(tx.id, oldData, { ...tx, ...updates }, customer, 'Edit Undo');
              toast.success('Edit undone');
            } catch (err) {
              toast.error('Failed to undo edit');
            }
          }
        }
      });
      setEditingTxId(null);
    } catch (error) {
      console.error('Update error:', error);
      toast.error('Failed to update transaction');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (tx: Transaction) => {
    let proceed = true;
    try {
      proceed = confirm('Delete this entry? This can be undone.');
    } catch (e) {
      // Safe fallback in sandboxed iframe environment
      proceed = true;
    }
    if (!proceed) return;
    
    try {
      const customer = customers.find(c => c.id === tx.customerId);
      if (!customer) throw new Error('Customer not found');
      
      await firestoreService.deleteTransaction(tx, customer);
      toast.success('Transaction deleted', {
        action: {
          label: 'Undo',
          onClick: async () => {
            try {
              // Restore the deleted transaction using saveTransaction
              await firestoreService.saveTransaction(tx, customer);
              toast.success('Delete undone');
            } catch (err) {
              toast.error('Failed to restore transaction');
            }
          }
        }
      });
      setEditingTxId(null);
    } catch (error) {
      toast.error('Failed to delete transaction');
    }
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
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowAuditModal(true)}
              className="h-12 px-3.5 flex items-center gap-1.5 bg-accent text-white rounded-2xl shadow-sm shadow-accent/20 active:brightness-105 transition-all text-xs font-black uppercase tracking-wider shrink-0"
              title="Audit PDF Report with Customizable Date Ranges"
            >
              <FileText size={16} />
              <span className="hidden sm:inline">Audit PDF</span>
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowExportSheet(true)}
              disabled={isExporting}
              className="h-12 w-12 flex items-center justify-center bg-card border border-border/60 rounded-2xl text-text-secondary hover:text-accent hover:border-accent/40 shadow-sm active:bg-accent/5 transition-all disabled:opacity-50 shrink-0"
              title="Ledger & Quick Export"
            >
              {isExporting ? <Loader2 size={18} className="animate-spin" /> : <Eye size={18} />}
            </motion.button>
          </div>

          {/* Filter Tabs - Horizontal Scrollable */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-2 px-2 pb-1 scroll-smooth">
            {(['ALL', 'CASH', 'PHONEPE', 'UNSETTLED'] as FilterType[]).map((f) => (
              <motion.button
                key={f}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleSetFilter(f)}
                className={`flex-1 min-w-[90px] relative py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap overflow-hidden ${
                  filter === f 
                    ? 'text-white' 
                    : 'bg-card border border-border/10 text-text-secondary opacity-40 hover:opacity-100'
                }`}
              >
                <div className="relative z-10 flex flex-col items-center gap-0.5">
                  <span>{f === 'PHONEPE' ? 'UPI' : f}</span>
                  <span className={`text-[8px] font-bold ${filter === f ? 'text-white/60' : 'text-text-secondary/30'}`}>
                    {filterCounts[f]}
                  </span>
                </div>

                {filter === f && (
                  <motion.div 
                    layoutId="activeHistoryFilter"
                    className="absolute inset-0 bg-accent z-0"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                  />
                )}
              </motion.button>
            ))}
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
                              const customer = customers.find(c => c.id === tx.customerId);
                              const isCash = tx.type === 'cash';
                              const isUPI = tx.type === 'phonepe';
                              const isEditing = editingTxId === tx.id;
                              
                              return (
                                <motion.div
                                  key={tx.id}
                                  layout
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  whileTap={!isEditing ? { scale: 0.98, backgroundColor: 'var(--color-bg)' } : undefined}
                                  className={`group relative flex flex-col p-4 bg-card border rounded-2xl transition-all ${
                                    isEditing ? 'border-accent shadow-lg z-30' : 'border-border/10 hover:border-accent/40 cursor-pointer'
                                  }`}
                                  onClick={(e) => {
                                    if (!isEditing) {
                                      e.stopPropagation();
                                      handleEditStart(tx);
                                    }
                                  }}
                                >
                                  {isEditing ? (
                                    <div className="grid grid-cols-1 gap-2.5 animate-in fade-in slide-in-from-top-1 duration-200">
                                      <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black text-text-secondary uppercase tracking-widest opacity-40">Edit Transaction</span>
                                        <div className="flex items-center gap-1.5">
                                          <button 
                                            onClick={(e) => { e.stopPropagation(); handleDelete(tx); }}
                                            className="p-1.5 rounded-lg bg-danger/5 text-danger border border-danger/10 hover:bg-danger/20 transition-colors"
                                          >
                                            <Trash2 size={14} />
                                          </button>
                                          <button 
                                            onClick={(e) => { e.stopPropagation(); setEditingTxId(null); }}
                                            className="p-1.5 rounded-lg bg-muted text-text-secondary hover:bg-border transition-colors"
                                          >
                                            <X size={14} />
                                          </button>
                                          <button 
                                            onClick={(e) => { e.stopPropagation(); handleSaveEdit(tx); }}
                                            disabled={isSaving}
                                            className="p-1.5 rounded-lg bg-accent text-white shadow-sm hover:shadow-md transition-all active:scale-95"
                                          >
                                            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                          </button>
                                        </div>
                                      </div>

                                      <div className="flex gap-2">
                                        <div className="relative flex-1">
                                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-black opacity-20">₹</span>
                                          <input 
                                            autoFocus
                                            type="number"
                                            value={editAmount}
                                            onChange={(e) => setEditAmount(e.target.value)}
                                            className="w-full pl-6 pr-2 py-2.5 bg-bg border border-border/20 rounded-xl font-black text-[14px] outline-none focus:border-accent transition-colors"
                                            onClick={(e) => e.stopPropagation()}
                                          />
                                        </div>
                                        <button 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setShowTypeSheet(true);
                                          }}
                                          className="px-4 py-2.5 bg-bg border border-border/40 rounded-xl font-black text-[10px] uppercase flex items-center gap-2 active:bg-accent/5 transition-all text-accent"
                                        >
                                          <span>{editType === 'phonepe' ? 'UPI' : editType === 'unsettled' ? 'Unset' : editType}</span>
                                          <ChevronDown size={14} className="opacity-40" />
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                          isCash ? 'bg-success/10 text-success' : 
                                          isUPI ? 'bg-accent/10 text-accent' : 
                                          'bg-warning/10 text-warning'
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
                                              'bg-warning/10 text-warning'
                                            }`}>
                                              {tx.type === 'unsettled' ? 'UNSETTLED' : (tx.type ? tx.type.toUpperCase() : 'PAID')}
                                            </div>
                                          </div>
                                        </div>
                                      </div>

                                      <div className="flex flex-col items-end">
                                        <p className="text-[15px] font-black text-text-primary tracking-tighter">₹{tx.amount}</p>
                                        <div className="flex items-center gap-1 opacity-20 group-hover:opacity-100 transition-opacity">
                                          <span className="text-[8px] font-bold uppercase tracking-widest">Edit</span>
                                          <ChevronRight size={12} />
                                        </div>
                                      </div>
                                    </div>
                                  )}
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

      {/* Payment Type Selector Bottom Sheet */}
      <BottomSheet
        isOpen={showTypeSheet}
        onClose={() => setShowTypeSheet(false)}
        title="Payment Mode"
        subtitle="Select transaction type"
      >
        <div className="flex flex-col gap-3 pb-8">
          {[
            { value: 'cash', label: 'Cash', icon: <Banknote size={18} /> },
            { value: 'phonepe', label: 'UPI (PhonePe)', icon: <Smartphone size={18} /> },
            { value: 'unsettled', label: 'Unsettled', icon: <Clock size={18} /> }
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                if ('vibrate' in navigator) navigator.vibrate(5);
                setEditType(opt.value as any);
                setShowTypeSheet(false);
              }}
              className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all border ${
                editType === opt.value 
                  ? 'bg-accent/10 border-accent/20' 
                  : 'bg-bg border-border/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${editType === opt.value ? 'bg-accent/20 text-accent' : 'bg-muted text-text-secondary opacity-40'}`}>
                  {opt.icon}
                </div>
                <span className={`text-[13px] font-black uppercase tracking-widest ${editType === opt.value ? 'text-accent' : 'text-text-secondary opacity-60'}`}>
                  {opt.label}
                </span>
              </div>
              
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                editType === opt.value ? 'border-accent bg-accent' : 'border-border/30'
              }`}>
                {editType === opt.value && (
                  <div className="w-2.5 h-2.5 bg-white rounded-full shadow-sm" />
                )}
              </div>
            </button>
          ))}

          <button 
            onClick={() => setShowTypeSheet(false)}
            className="w-full py-4 mt-2 rounded-2xl bg-muted text-text-secondary font-black text-[11px] uppercase tracking-widest active:scale-[0.98] transition-all"
          >
            Cancel
          </button>
        </div>
      </BottomSheet>

      {/* Export Options Bottom Sheet */}
      <BottomSheet
        isOpen={showExportSheet}
        onClose={() => setShowExportSheet(false)}
        title="Export Data"
        subtitle="Preview and share professional ledger reports"
      >
        <div className="flex flex-col gap-3 pb-8">
          <p className="text-[10px] font-black uppercase tracking-widest text-text-secondary opacity-40 ml-1 mb-1">
            Select Date Range
          </p>
          
          <button
            onClick={() => {
              setShowExportSheet(false);
              setShowAuditModal(true);
            }}
            className="w-full flex items-center justify-between p-4 rounded-2xl bg-accent/10 border border-accent/30 hover:border-accent/60 active:scale-[0.98] transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-accent text-white shadow-sm">
                <FileText size={18} />
              </div>
              <div className="text-left">
                <span className="text-[13px] font-black uppercase tracking-widest text-accent block">
                  Custom Range Audit PDF
                </span>
                <span className="text-[10px] text-text-secondary opacity-60">
                  Custom date range, payment filter & auditor sign-off
                </span>
              </div>
            </div>
            <ChevronRight size={18} className="text-accent transition-all" />
          </button>

          {[
            { id: 'today', label: 'Today\'s Collection', icon: <ArrowUpRight size={18} /> },
            { id: 'week', label: 'Last 7 Days', icon: <Calendar size={18} /> },
            { id: 'month', label: 'Last 30 Days', icon: <Clock size={18} /> },
            { id: 'current', label: 'Current Filter View', icon: <Filter size={18} /> },
            { id: 'ledger', label: 'Digital Ledger (Landscape)', icon: <Edit3 size={18} /> }
          ].map((opt) => (
            <button
              key={opt.id}
              onClick={() => handleExport(opt.id as any)}
              className="w-full flex items-center justify-between p-4 rounded-2xl bg-bg border border-border/60 hover:border-accent/40 active:scale-[0.98] transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-muted text-text-secondary opacity-40 group-hover:text-accent group-hover:bg-accent/10 transition-colors">
                  {opt.icon}
                </div>
                <span className="text-[13px] font-black uppercase tracking-widest text-text-secondary group-hover:text-text-primary transition-colors">
                  {opt.label}
                </span>
              </div>
              <ChevronRight size={18} className="opacity-20 group-hover:opacity-100 text-accent transition-all" />
            </button>
          ))}

          <div className="mt-4 p-4 rounded-2xl bg-accent/5 border border-accent/10">
            <p className="text-[11px] font-medium text-text-secondary leading-relaxed">
              Reports include branding, totals, and color-coded payment modes for professional use.
            </p>
          </div>

          <button 
            onClick={() => setShowExportSheet(false)}
            className="w-full py-4 mt-2 rounded-2xl bg-muted text-text-secondary font-black text-[11px] uppercase tracking-widest active:scale-[0.98] transition-all"
          >
            Close
          </button>
        </div>
      </BottomSheet>

      <ExportAuditModal
        isOpen={showAuditModal}
        onClose={() => setShowAuditModal(false)}
        transactions={transactions}
        customers={customers}
        onGenerated={(report) => {
          setPreviewReport(report);
          setShowPreview(true);
        }}
      />

      <PDFViewerModal 
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        report={previewReport}
      />
    </PageContainer>
  );
}
