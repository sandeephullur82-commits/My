import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  CheckSquare, 
  Square, 
  Banknote, 
  Smartphone, 
  Loader2, 
  Layers, 
  Search, 
  Check,
  CheckCircle2,
  Sparkles,
  Zap,
  ArrowRight,
  Filter
} from 'lucide-react';
import { Customer, Transaction, firestoreService } from '../../services/firestoreService';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { playSuccessSound } from '../../lib/sound';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface BulkEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  customers: Customer[];
  todayStr: string;
  todayLoggedCustomerIds: Set<string>;
}

export function BulkEntryModal({ isOpen, onClose, customers, todayStr, todayLoggedCustomerIds }: BulkEntryModalProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'phonepe'>('cash');
  const [customAmounts, setCustomAmounts] = useState<Record<string, number>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [uniformAmountInput, setUniformAmountInput] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const containerRef = useFocusTrap(isOpen);

  // Filter pending customers who haven't logged today
  const pendingList = useMemo(() => {
    return customers.filter(c => {
      if (c.isDeleted) return false;
      if (todayLoggedCustomerIds.has(c.id)) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase().trim();
        const queryDigits = q.replace(/\D/g, '');
        const nameMatch = c.name.toLowerCase().includes(q);
        const phone = (c.phone || '').replace(/\D/g, '');
        const phoneMatch = queryDigits.length > 0 && phone.includes(queryDigits);
        const idMatch = String(c.displayId || c.id).toLowerCase().includes(q);
        return nameMatch || phoneMatch || idMatch;
      }
      return true;
    });
  }, [customers, todayLoggedCustomerIds, searchTerm]);

  useEffect(() => {
    if (isOpen) {
      setSelectedIds([]);
      setCustomAmounts({});
      setSearchTerm('');
      setUniformAmountInput('');
      setPaymentMethod('cash');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleSelectAll = () => {
    if (selectedIds.length === pendingList.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(pendingList.map(c => c.id));
    }
  };

  const selectFirstN = (n: number) => {
    const ids = pendingList.slice(0, n).map(c => c.id);
    setSelectedIds(ids);
    toast.success(`Selected first ${Math.min(n, pendingList.length)} customers`);
  };

  const toggleSelectCustomer = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleAmountChange = (customerId: string, val: number) => {
    setCustomAmounts(prev => ({
      ...prev,
      [customerId]: isNaN(val) ? 0 : val
    }));
  };

  const getCustomerAmount = (customer: Customer) => {
    if (customAmounts[customer.id] !== undefined) {
      return customAmounts[customer.id];
    }
    const loan = customer.loanAmount || customer.loan || 0;
    const duration = customer.durationDays || 100;
    const calcDaily = duration > 0 ? Math.round(loan / duration) : 100;
    return calcDaily > 0 ? calcDaily : 100;
  };

  const applyUniformAmount = () => {
    const val = Number(uniformAmountInput);
    if (isNaN(val) || val <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    const updated: Record<string, number> = { ...customAmounts };
    const targets = selectedIds.length > 0 ? selectedIds : pendingList.map(c => c.id);
    if (targets.length === 0) {
      toast.error('No customers available to update');
      return;
    }
    targets.forEach(id => {
      updated[id] = val;
    });
    setCustomAmounts(updated);
    toast.success(`Applied ₹${val} to ${targets.length} customers`);
    setUniformAmountInput('');
  };

  const totalBulkAmount = selectedIds.reduce((sum, id) => {
    const cust = customers.find(c => c.id === id);
    if (!cust) return sum;
    return sum + getCustomerAmount(cust);
  }, 0);

  const handleProcessBulk = async () => {
    if (selectedIds.length === 0) {
      toast.error('Please select at least one customer for bulk entry');
      return;
    }

    setIsProcessing(true);
    const now = Date.now();

    try {
      for (const id of selectedIds) {
        const cust = customers.find(c => c.id === id);
        if (!cust) continue;

        const amt = getCustomerAmount(cust);
        const loan = cust.loanAmount || cust.loan || 0;
        const paid = cust.paid || 0;
        const currentBalance = cust.pending !== undefined ? cust.pending : (loan - paid);
        const isAdvance = currentBalance <= 0;

        const newTx: Transaction = {
          id: uuidv4(),
          customerId: cust.id,
          amount: amt,
          type: paymentMethod,
          status: 'paid',
          date: todayStr,
          timestamp: now,
          paidAt: now,
          isAdvance,
          notes: isAdvance ? 'Advance Savings Deposit (Bulk Entry)' : 'Bulk Daily Collection Entry'
        };

        await firestoreService.saveTransaction(newTx, cust);
      }

      if (navigator.vibrate) navigator.vibrate(60);
      playSuccessSound();
      toast.success(`Successfully recorded bulk payments for ${selectedIds.length} customers!`);
      onClose();
    } catch (error) {
      console.error('Bulk entry failed:', error);
      toast.error('Failed to process bulk entries. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 overflow-hidden pointer-events-auto"
        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/70 backdrop-blur-md"
          onClick={() => !isProcessing && onClose()}
        />

        <motion.div
          ref={containerRef as any}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 28, stiffness: 340 }}
          className="relative w-full max-w-[720px] max-h-[92vh] bg-card text-text-primary rounded-[32px] p-5 sm:p-7 shadow-2xl border border-border flex flex-col z-10 select-none overflow-hidden outline-none"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-border/60">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-accent/10 text-accent flex items-center justify-center border border-accent/20 shadow-inner">
                <Layers size={24} strokeWidth={2.5} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black uppercase tracking-tight">Bulk Collection Entry</h3>
                  <span className="text-[10px] font-black uppercase bg-accent/15 text-accent px-2 py-0.5 rounded-full">
                    Lightning Mode
                  </span>
                </div>
                <p className="text-xs text-text-secondary font-medium mt-0.5">
                  Record daily collections or savings for multiple customers simultaneously
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={isProcessing}
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded-full text-text-secondary hover:text-text-primary hover:bg-muted transition-colors active:scale-90"
            >
              <X size={18} />
            </button>
          </div>

          {/* Controls: Search, Payment Method, Quick Select, Uniform Amount */}
          <div className="py-4 flex flex-col gap-3.5 border-b border-border/40">
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary opacity-50">
                  <Search size={16} />
                </span>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by name, phone or ID..."
                  className="w-full pl-10 pr-4 py-3 bg-muted/60 border border-border/80 rounded-2xl text-xs font-semibold focus:outline-none focus:border-accent transition-all"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Payment Method Toggle */}
              <div className="flex items-center gap-1.5 bg-muted/80 p-1.5 rounded-2xl border border-border/80 w-full sm:w-auto shrink-0 shadow-inner">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cash')}
                  className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all flex items-center justify-center gap-2 ${
                    paymentMethod === 'cash' ? 'bg-card text-text-primary shadow-md border border-border/60' : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <Banknote size={15} className="text-emerald-500" />
                  <span>Cash</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('phonepe')}
                  className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all flex items-center justify-center gap-2 ${
                    paymentMethod === 'phonepe' ? 'bg-card text-text-primary shadow-md border border-border/60' : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <Smartphone size={15} className="text-blue-500" />
                  <span>PhonePe / UPI</span>
                </button>
              </div>
            </div>

            {/* Uniform Amount Applicator & Quick Select Shortcuts */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-muted/30 p-3 rounded-2xl border border-border/60">
              <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto">
                <span className="text-[11px] font-bold text-text-secondary mr-1 flex items-center gap-1">
                  <Filter size={12} /> Quick:
                </span>
                <button
                  type="button"
                  onClick={() => selectFirstN(10)}
                  className="px-2.5 py-1 rounded-lg bg-card border border-border/70 text-[11px] font-bold hover:bg-muted transition-colors"
                >
                  First 10
                </button>
                <button
                  type="button"
                  onClick={() => selectFirstN(25)}
                  className="px-2.5 py-1 rounded-lg bg-card border border-border/70 text-[11px] font-bold hover:bg-muted transition-colors"
                >
                  First 25
                </button>
                <button
                  type="button"
                  onClick={() => selectFirstN(50)}
                  className="px-2.5 py-1 rounded-lg bg-card border border-border/70 text-[11px] font-bold hover:bg-muted transition-colors"
                >
                  First 50
                </button>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="flex items-center bg-card border border-border/70 rounded-xl px-2.5 py-1 shadow-xs flex-1 sm:flex-initial">
                  <span className="text-xs font-bold text-text-secondary mr-1">₹</span>
                  <input
                    type="number"
                    value={uniformAmountInput}
                    onChange={(e) => setUniformAmountInput(e.target.value)}
                    placeholder="Set uniform amount..."
                    className="w-32 text-xs font-black bg-transparent focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={applyUniformAmount}
                  className="px-3 py-1.5 rounded-xl bg-accent/15 hover:bg-accent/25 text-accent text-xs font-black uppercase tracking-wider transition-all cursor-pointer shrink-0"
                >
                  Apply All
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between px-1 text-xs font-bold text-text-secondary pt-1">
              <button
                type="button"
                onClick={toggleSelectAll}
                className="flex items-center gap-2 hover:text-text-primary transition-colors cursor-pointer"
              >
                {selectedIds.length === pendingList.length && pendingList.length > 0 ? (
                  <CheckSquare size={16} className="text-accent" />
                ) : (
                  <Square size={16} className="opacity-60" />
                )}
                <span>Select All Pending ({pendingList.length})</span>
              </button>
              <span className="font-black text-text-primary bg-accent/10 px-2.5 py-0.5 rounded-full text-[11px]">
                {selectedIds.length} Customers Selected
              </span>
            </div>
          </div>

          {/* Customer Checklist */}
          <div className="flex-1 overflow-y-auto max-h-[380px] divide-y divide-border/40 pr-1 space-y-1 my-2">
            {pendingList.length === 0 ? (
              <div className="py-14 text-center text-xs text-text-secondary flex flex-col items-center justify-center gap-2">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-text-secondary opacity-60">
                  <Sparkles size={20} />
                </div>
                <p className="font-bold">No pending customers found matching your criteria.</p>
              </div>
            ) : (
              pendingList.map(cust => {
                const isSelected = selectedIds.includes(cust.id);
                const amt = getCustomerAmount(cust);
                const loan = cust.loanAmount || cust.loan || 0;
                const paid = cust.paid || 0;
                const pendingBal = cust.pending !== undefined ? cust.pending : (loan - paid);

                return (
                  <div 
                    key={cust.id}
                    onClick={() => toggleSelectCustomer(cust.id)}
                    className={`flex items-center justify-between p-3.5 rounded-2xl transition-all cursor-pointer ${
                      isSelected ? 'bg-accent/10 border border-accent/40 shadow-sm' : 'hover:bg-muted/60 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className={`w-5 h-5 rounded-lg flex items-center justify-center border transition-all shrink-0 ${
                        isSelected ? 'bg-accent border-accent text-white shadow-sm' : 'border-border/80 bg-card'
                      }`}>
                        {isSelected && <Check size={13} strokeWidth={3} />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black truncate">{cust.name}</span>
                          {cust.displayId && (
                            <span className="text-[10px] font-mono font-bold bg-muted px-2 py-0.5 rounded-md text-text-secondary border border-border/50">
                              #{cust.displayId}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-text-secondary font-medium">
                            Pending: <strong className="text-text-primary">₹{pendingBal.toLocaleString('en-IN')}</strong>
                          </span>
                          {cust.phone && (
                            <>
                              <span className="text-text-secondary/40">•</span>
                              <span className="text-[10px] font-mono text-text-secondary">{cust.phone}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1 bg-card border border-border/80 rounded-xl px-2.5 py-1.5 shadow-xs">
                        <span className="text-[11px] font-bold text-text-secondary">₹</span>
                        <input
                          type="number"
                          value={amt}
                          onChange={(e) => handleAmountChange(cust.id, Number(e.target.value))}
                          className="w-20 text-xs font-black bg-transparent focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer / Action */}
          <div className="pt-4 mt-2 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block">Total Bulk Collection</span>
              <span className="text-base font-black text-text-primary tracking-tight">
                ₹{totalBulkAmount.toLocaleString('en-IN')} <span className="text-xs font-medium text-text-secondary">({selectedIds.length} customers)</span>
              </span>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                disabled={isProcessing}
                className="flex-1 sm:flex-initial px-5 py-3 rounded-2xl border border-border text-xs font-bold uppercase tracking-wider hover:bg-muted transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleProcessBulk}
                disabled={isProcessing || selectedIds.length === 0}
                className="flex-1 sm:flex-initial px-6 py-3 rounded-2xl bg-accent text-white text-xs font-black uppercase tracking-wider shadow-xl shadow-accent/25 flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 transition-all cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Processing Entries...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    <span>Record {selectedIds.length} Payments</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
