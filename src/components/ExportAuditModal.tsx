import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar, FileText, Download, Filter, 
  ChevronRight, ArrowUpRight, Clock, User, Check, AlertCircle,
  ShieldCheck, Eye
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, startOfYear } from 'date-fns';
import { Transaction, Customer } from '../services/firestoreService';
import { generateAuditReportPDF } from '../lib/auditPdfExport';
import { BottomSheet } from './BottomSheet';

interface ExportAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  customers: Customer[];
  onGenerated: (report: { blob: Blob; fileName: string; title: string }) => void;
}

type QuickRange = 'today' | '7days' | '30days' | 'thisMonth' | 'all' | 'custom';

export function ExportAuditModal({
  isOpen,
  onClose,
  transactions,
  customers,
  onGenerated
}: ExportAuditModalProps) {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  
  // Custom Date States
  const [rangePreset, setRangePreset] = useState<QuickRange>('30days');
  const [startDate, setStartDate] = useState<string>(() => format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState<string>(() => todayStr);
  const [filterMode, setFilterMode] = useState<'ALL' | 'CASH' | 'PHONEPE' | 'UNSETTLED'>('ALL');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('ALL');
  const [isGenerating, setIsGenerating] = useState(false);

  // Handle Preset selection
  const handleSelectPreset = (preset: QuickRange) => {
    setRangePreset(preset);
    const now = new Date();
    
    if (preset === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === '7days') {
      setStartDate(format(subDays(now, 7), 'yyyy-MM-dd'));
      setEndDate(todayStr);
    } else if (preset === '30days') {
      setStartDate(format(subDays(now, 30), 'yyyy-MM-dd'));
      setEndDate(todayStr);
    } else if (preset === 'thisMonth') {
      setStartDate(format(startOfMonth(now), 'yyyy-MM-dd'));
      setEndDate(format(endOfMonth(now), 'yyyy-MM-dd'));
    } else if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    }
  };

  // Preview counts based on current filters
  const previewData = useMemo(() => {
    let list = transactions.filter(t => !t.isDeleted);

    if (startDate && endDate) {
      list = list.filter(t => t.date >= startDate && t.date <= endDate);
    } else if (startDate) {
      list = list.filter(t => t.date >= startDate);
    } else if (endDate) {
      list = list.filter(t => t.date <= endDate);
    }

    if (filterMode === 'CASH') {
      list = list.filter(t => t.type === 'cash' && t.status === 'paid');
    } else if (filterMode === 'PHONEPE') {
      list = list.filter(t => t.type === 'phonepe' && t.status === 'paid');
    } else if (filterMode === 'UNSETTLED') {
      list = list.filter(t => t.status === 'unsettled');
    }

    if (selectedCustomerId !== 'ALL') {
      list = list.filter(t => t.customerId === selectedCustomerId);
    }

    const totalAmount = list
      .filter(t => t.status === 'paid')
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      count: list.length,
      totalAmount,
      filtered: list
    };
  }, [transactions, startDate, endDate, filterMode, selectedCustomerId]);

  const handleGenerateReport = async () => {
    if (previewData.count === 0) return;
    
    setIsGenerating(true);
    try {
      const result = await generateAuditReportPDF(transactions, customers, {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        filterMode,
        customerId: selectedCustomerId,
        generatedBy: 'System Auditor'
      });

      onClose();
      onGenerated(result);
    } catch (e) {
      console.error('Failed to generate audit report', e);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Export Audit Report"
      subtitle="PDF report with customizable date ranges for audit"
      maxWidth="max-w-xl"
    >
      <div className="flex flex-col gap-5 pb-8 px-1">
        {/* Quick Date Range Selector */}
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary opacity-60 mb-2 flex items-center gap-1.5">
            <Calendar size={13} className="text-accent" /> Date Range Preset
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'today', label: 'Today' },
              { id: '7days', label: 'Last 7 Days' },
              { id: '30days', label: 'Last 30 Days' },
              { id: 'thisMonth', label: 'This Month' },
              { id: 'all', label: 'All History' },
              { id: 'custom', label: 'Custom Range' },
            ].map(p => (
              <button
                key={p.id}
                onClick={() => handleSelectPreset(p.id as QuickRange)}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border text-center ${
                  rangePreset === p.id
                    ? 'bg-accent/15 border-accent text-accent font-black shadow-xs'
                    : 'bg-card border-border/40 text-text-secondary hover:bg-muted/40'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Date Pickers (Editable in all modes or highlighted when custom) */}
        <div className="bg-card border border-border/50 rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-text-secondary opacity-50">
              Custom Range Boundaries
            </span>
            {startDate && endDate && (
              <span className="text-[10px] font-mono text-accent font-bold">
                {startDate} → {endDate}
              </span>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[9px] font-black uppercase text-text-secondary opacity-40 mb-1 block">From Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setRangePreset('custom');
                }}
                className="w-full bg-muted/20 border border-border/60 rounded-xl px-3 py-2.5 text-xs font-bold font-mono focus:border-accent outline-none text-text-primary"
              />
            </div>
            <div>
              <label className="text-[9px] font-black uppercase text-text-secondary opacity-40 mb-1 block">To Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setRangePreset('custom');
                }}
                className="w-full bg-muted/20 border border-border/60 rounded-xl px-3 py-2.5 text-xs font-bold font-mono focus:border-accent outline-none text-text-primary"
              />
            </div>
          </div>
        </div>

        {/* Filter Selectors: Payment Mode & Customer Scope */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Payment Mode */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary opacity-60">
              Payment Mode
            </label>
            <select
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value as any)}
              className="bg-card border border-border/50 rounded-xl px-3 py-2.5 text-xs font-bold text-text-primary outline-none focus:border-accent"
            >
              <option value="ALL">All Modes (Cash, UPI, NP)</option>
              <option value="CASH">Cash Only</option>
              <option value="PHONEPE">UPI / PhonePe Only</option>
              <option value="UNSETTLED">Unsettled / NP Only</option>
            </select>
          </div>

          {/* Customer Scope */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary opacity-60">
              Customer Scope
            </label>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="bg-card border border-border/50 rounded-xl px-3 py-2.5 text-xs font-bold text-text-primary outline-none focus:border-accent truncate"
            >
              <option value="ALL">All Customers</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.displayId ? `#${c.displayId}` : c.phone || c.id.slice(0, 6)})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Audit Matching Summary Banner */}
        <div className="bg-accent/5 border border-accent/15 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center font-black">
              <ShieldCheck size={20} />
            </div>
            <div>
              <p className="text-xs font-black text-text-primary">
                {previewData.count} Records Match Filter
              </p>
              <p className="text-[10px] font-bold text-text-secondary opacity-60">
                Audited Volume: ₹{previewData.totalAmount.toLocaleString('en-IN')}
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[9px] font-black uppercase tracking-wider text-accent bg-accent/10 px-2.5 py-1 rounded-full border border-accent/20">
              A4 Format
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 mt-2">
          <button
            onClick={onClose}
            className="flex-1 py-3.5 rounded-2xl bg-muted text-text-secondary font-black text-xs uppercase tracking-widest active:scale-[0.98] transition-all"
          >
            Cancel
          </button>
          
          <button
            onClick={handleGenerateReport}
            disabled={previewData.count === 0 || isGenerating}
            className="flex-2 py-3.5 px-6 rounded-2xl bg-accent text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-accent/20 hover:brightness-105 active:scale-[0.98] transition-all disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {isGenerating ? (
              <>Generating PDF...</>
            ) : (
              <>
                <FileText size={16} />
                Generate Audit PDF
              </>
            )}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
