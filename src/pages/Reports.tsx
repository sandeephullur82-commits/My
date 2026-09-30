/**
 * @license
 * Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useRealtimeData } from '../hooks/useRealtimeData';
import { auth } from '../lib/firebase';
import { PageContainer } from '../components/PageContainer';
import { 
  FileSpreadsheet, Calendar, Filter, Download, Database, Users, Wallet, Layers, 
  Activity, ChevronDown, User, Ban, Info, ShieldCheck, HelpCircle, CheckCircle, Search, FileText
} from 'lucide-react';
import { format, parseISO, isWithinInterval } from 'date-fns';
import { useFeedback } from '../context/FeedbackContext';
import * as XLSX from 'xlsx';
import { ExportAuditModal } from '../components/ExportAuditModal';
import { PDFViewerModal } from '../components/PDFViewerModal';
import { generateAuditReportPDF } from '../lib/auditPdfExport';

// Types for local preview structures
interface CustomerRow {
  customerId: string;
  name: string;
  phone: string;
  address: string;
  status: string;
}

interface AccountRow {
  accountNumber: string;
  customerName: string;
  openingDate: string;
  currentBalance: number;
}

interface CollectionRow {
  collectionId: string;
  customerName: string;
  amount: number;
  agent: string;
  date: string;
  paymentMode: string;
}

interface TransactionRow {
  transactionId: string;
  customerName: string;
  date: string;
  type: string;
  amount: number;
  status: string;
}

type PreviewTab = 'customers' | 'accounts' | 'collections' | 'transactions';

export function Reports() {
  const { toastSuccess, toastError } = useFeedback();
  const { transactions, customers, loading } = useRealtimeData();
  const [activeSubView, setActiveSubView] = useState<'hub' | 'export'>('hub');
  const [previewTab, setPreviewTab] = useState<PreviewTab>('transactions');

  // Filter States
  const [dateType, setDateType] = useState<'all' | 'custom'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('ALL');
  const [selectedAccountId, setSelectedAccountId] = useState('ALL');
  const [collectionType, setCollectionType] = useState('ALL'); // ALL, Cash, PhonePe
  const [transactionStatus, setTransactionStatus] = useState('ALL'); // ALL, Paid, Pending
  const [agentFilter, setAgentFilter] = useState('ALL'); // ALL, current user

  // PDF Audit Report Modal States
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [previewReport, setPreviewReport] = useState<{ blob: Blob; fileName: string; title: string } | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Customer map helper
  const customerMap = useMemo(() => {
    const map = new Map<string, typeof customers[0]>();
    customers.forEach(c => map.set(c.id, c));
    return map;
  }, [customers]);

  // Current user helper
  const currentUserEmail = useMemo(() => {
    return auth.currentUser?.email || 'operator_agent';
  }, []);

  // Filter calculations
  const filteredCustomers = useMemo(() => {
    let result = customers.filter(c => !c.isDeleted);

    if (selectedCustomerId !== 'ALL') {
      result = result.filter(c => c.id === selectedCustomerId);
    }
    if (selectedAccountId !== 'ALL') {
      result = result.filter(c => c.id === selectedAccountId);
    }

    return result;
  }, [customers, selectedCustomerId, selectedAccountId]);

  const filteredTransactions = useMemo(() => {
    let result = transactions.filter(t => !t.isDeleted);

    // Apply Customer Filter
    if (selectedCustomerId !== 'ALL') {
      result = result.filter(t => t.customerId === selectedCustomerId);
    }

    // Apply Account Filter
    if (selectedAccountId !== 'ALL') {
      result = result.filter(t => t.customerId === selectedAccountId);
    }

    // Apply Date Range
    if (dateType === 'custom' && startDate && endDate) {
      try {
        const start = startDate;
        const end = endDate;
        result = result.filter(t => t.date >= start && t.date <= end);
      } catch (e) {
        console.error('Date parsing error', e);
      }
    }

    // Apply Collection Payment Mode (Cash, PhonePe)
    if (collectionType !== 'ALL') {
      result = result.filter(t => t.type === collectionType.toLowerCase());
    }

    // Apply Transaction Status (Paid, Pending)
    if (transactionStatus !== 'ALL') {
      result = result.filter(t => t.status === transactionStatus.toLowerCase());
    }

    // Apply Agent Filter (Mock filtering: in simple architecture there is only 1 agent)
    if (agentFilter !== 'ALL') {
      // Just showing everything since there is only 1 agent
    }

    return result;
  }, [transactions, selectedCustomerId, selectedAccountId, dateType, startDate, endDate, collectionType, transactionStatus, agentFilter]);

  // Metric displays of matches
  const totalRecords = filteredTransactions.length;
  const totalCustomers = filteredCustomers.length;
  const totalCollections = useMemo(() => {
    return filteredTransactions.filter(t => t.status === 'paid').length;
  }, [filteredTransactions]);

  const totalSavingsAmount = useMemo(() => {
    return filteredTransactions
      .filter(t => t.status === 'paid')
      .reduce((sum, t) => sum + (t.amount || 0), 0);
  }, [filteredTransactions]);

  // Grid / preview table row parsing
  const customerRows = useMemo<CustomerRow[]>(() => {
    return filteredCustomers.map(c => ({
      customerId: c.id,
      name: c.name || 'N/A',
      phone: c.phone || 'N/A',
      address: c.notes || 'N/A',
      status: 'Active'
    }));
  }, [filteredCustomers]);

  const accountRows = useMemo<AccountRow[]>(() => {
    return filteredCustomers.map(c => {
      let dateStr = 'N/A';
      if (c.startDate) {
        try {
          const d = new Date(c.startDate);
          if (!isNaN(d.getTime())) {
            dateStr = d.toISOString().slice(0, 10);
          } else {
            dateStr = String(c.startDate).slice(0, 10);
          }
        } catch (e) {
          console.error("Format error for customer date:", c.startDate, e);
          dateStr = String(c.startDate).slice(0, 10);
        }
      }
      return {
        accountNumber: c.id,
        customerName: c.name || 'N/A',
        openingDate: dateStr,
        currentBalance: c.paid || 0
      };
    });
  }, [filteredCustomers]);

  const collectionRows = useMemo<CollectionRow[]>(() => {
    return filteredTransactions
      .filter(tx => tx.status === 'paid')
      .map(tx => ({
        collectionId: tx.id,
        customerName: customerMap.get(tx.customerId)?.name || 'Unknown',
        amount: tx.amount || 0,
        agent: currentUserEmail,
        date: tx.date || 'N/A',
        paymentMode: tx.type === 'phonepe' ? 'PhonePe' : 'Cash'
      }));
  }, [filteredTransactions, customerMap, currentUserEmail]);

  const transactionRows = useMemo<TransactionRow[]>(() => {
    return filteredTransactions.map(tx => ({
      transactionId: tx.id,
      customerName: customerMap.get(tx.customerId)?.name || 'Unknown',
      date: tx.date || 'N/A',
      type: tx.type === 'phonepe' ? 'PhonePe' : 'Cash',
      amount: tx.amount || 0,
      status: tx.status === 'paid' ? 'Paid' : tx.status === 'pending' ? 'Pending' : 'Unsettled'
    }));
  }, [filteredTransactions, customerMap]);

  // Reset Filters trigger
  const handleResetFilters = () => {
    setDateType('all');
    setStartDate('');
    setEndDate('');
    setSelectedCustomerId('ALL');
    setSelectedAccountId('ALL');
    setCollectionType('ALL');
    setTransactionStatus('ALL');
    setAgentFilter('ALL');
  };

  // Excel generation
  const handleDownloadExcel = () => {
    try {
      toastSuccess("Generating Excel", "Preparing multi-sheet bank audit report...");
      const wb = XLSX.utils.book_new();

      // Sheet 1: Customer Master
      const s1Data = customerRows.map(r => ({
        "Customer ID": r.customerId,
        "Name": r.name,
        "Mobile": r.phone,
        "Address": r.address,
        "Status": r.status
      }));
      const ws1 = XLSX.utils.json_to_sheet(s1Data);
      XLSX.utils.book_append_sheet(wb, ws1, "Customer Master");

      // Sheet 2: Savings Accounts
      const s2Data = accountRows.map(r => ({
        "Account Number": r.accountNumber,
        "Customer": r.customerName,
        "Opening Date": r.openingDate,
        "Current Balance": r.currentBalance
      }));
      const ws2 = XLSX.utils.json_to_sheet(s2Data);
      XLSX.utils.book_append_sheet(wb, ws2, "Savings Accounts");

      // Sheet 3: Collections
      const s3Data = collectionRows.map(r => ({
        "Collection ID": r.collectionId,
        "Customer": r.customerName,
        "Amount": r.amount,
        "Agent": r.agent,
        "Date": r.date,
        "Payment Mode": r.paymentMode
      }));
      const ws3 = XLSX.utils.json_to_sheet(s3Data);
      XLSX.utils.book_append_sheet(wb, ws3, "Collections");

      // Sheet 4: Transactions
      const s4Data = transactionRows.map(r => ({
        "Transaction ID": r.transactionId,
        "Customer": r.customerName,
        "Date": r.date,
        "Type": r.type,
        "Amount": r.amount,
        "Status": r.status
      }));
      const ws4 = XLSX.utils.json_to_sheet(s4Data);
      XLSX.utils.book_append_sheet(wb, ws4, "Transactions");

      // Sheet 5: Summary & Applied Filters
      const summaryData = [
        { "Aspect": "Application", "Details": "Pigmy Pro" },
        { "Aspect": "Version", "Details": "2.0 (Pro Backup)" },
        { "Aspect": "Exported By ID/Email", "Details": currentUserEmail },
        { "Aspect": "Exported At Date", "Details": new Date().toISOString() },
        { "Aspect": "Applied Filters: Date Type", "Details": dateType === 'all' ? 'Complete History' : 'Custom Interval' },
        { "Aspect": "Applied Filters: Custom Date Start", "Details": startDate || 'None' },
        { "Aspect": "Applied Filters: Custom Date End", "Details": endDate || 'None' },
        { "Aspect": "Applied Filters: Customer ID", "Details": selectedCustomerId },
        { "Aspect": "Applied Filters: Account Num", "Details": selectedAccountId },
        { "Aspect": "Applied Filters: Pay Mode Selection", "Details": collectionType },
        { "Aspect": "Applied Filters: Transaction Status", "Details": transactionStatus },
        { "Aspect": "Applied Filters: Agent Operator", "Details": agentFilter },
        { "Aspect": "Calculated Result: Total Records exported", "Details": totalRecords },
        { "Aspect": "Calculated Result: Total Customers exported", "Details": totalCustomers },
        { "Aspect": "Calculated Result: Total Collections logged", "Details": totalCollections },
        { "Aspect": "Calculated Result: Accumulated Savings (INR)", "Details": `₹${totalSavingsAmount}` }
      ];
      const wsSummary = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsSummary, "Export Info & Filters");

      // Output & Save binary
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const dataBlob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(dataBlob);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.href = url;
      downloadAnchor.setAttribute('download', `PigmyPro_AuditExport_${new Date().toISOString().slice(0,10)}.xlsx`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      document.body.removeChild(downloadAnchor);

      toastSuccess("Export Successful", "The excel report workbook has been processed and downloaded.");
    } catch (e: any) {
      console.error('Failed to download excel report', e);
      toastError("Export Failed", "Could not compile excel workbook: " + e.message);
    }
  };

  return (
    <PageContainer>
      <div className="flex flex-col gap-6" id="reports-module-root">
        {/* Header Block with subtitle */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-text-primary">Reports & Insights</h1>
              <p className="text-[11px] font-bold text-text-secondary opacity-40 uppercase tracking-widest mt-1">Audit, Review & Accountants Exports</p>
            </div>
            
            {activeSubView === 'export' && (
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setShowAuditModal(true)}
                  className="px-4 py-2 bg-accent text-white hover:brightness-105 active:scale-95 transition-all text-[11px] font-black uppercase tracking-widest shadow-lg shadow-accent/15 rounded-xl flex items-center gap-2"
                  id="reports-generate-pdf-btn"
                >
                  <FileText size={14} strokeWidth={2.5} />
                  Audit PDF
                </button>
                <button 
                  onClick={handleDownloadExcel}
                  className="px-4 py-2 bg-success text-white hover:brightness-105 active:scale-95 transition-all text-[11px] font-black uppercase tracking-widest shadow-lg shadow-success/15 rounded-xl flex items-center gap-2"
                  id="reports-download-excel-btn"
                >
                  <FileSpreadsheet size={14} strokeWidth={2.5} />
                  Download Excel
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Dynamic hub or export workflow */}
        {activeSubView === 'hub' ? (
          /* Subview 1: Hub Dashboard of reports modules */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-300">
            {/* Main reporting card: Data export */}
            <div 
              onClick={() => setActiveSubView('export')}
              className="bg-card hover:bg-card/80 border border-border/50 rounded-3xl p-6 flex flex-col justify-between gap-5 cursor-pointer shadow-xs group hover:border-success/40 transition-all duration-300 relative overflow-hidden"
              id="reports-tile-data-export"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-success/5 rounded-bl-full flex items-center justify-center pointer-events-none">
                <FileSpreadsheet size={24} className="text-success mr-[-20px] mt-[-20px] opacity-40" />
              </div>
              
              <div className="flex flex-col gap-3">
                <div className="w-12 h-12 rounded-2xl bg-success/10 text-success flex items-center justify-center shrink-0">
                  <FileSpreadsheet size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-text-primary group-hover:text-success transition-colors">Data Export & Backup</h3>
                  <p className="text-xs text-text-secondary/80 mt-1 lines-clamp-2 leading-relaxed">
                    Filter, audit, and extract Pigmy Pro records. Direct multi-sheet Excel compilation conformant to banking audit requirements.
                  </p>
                </div>
              </div>
              
              <div className="flex items-center justify-between border-t border-border/40 pt-4 mt-1">
                <span className="text-[10px] font-black text-success uppercase tracking-widest">Execute Excel Export</span>
                <span className="text-xs font-bold text-text-secondary group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </div>

            {/* Audit PDF Report Card */}
            <div 
              onClick={() => setShowAuditModal(true)}
              className="bg-card hover:bg-card/80 border border-border/50 rounded-3xl p-6 flex flex-col justify-between gap-5 cursor-pointer shadow-xs group hover:border-accent/40 transition-all duration-300 relative overflow-hidden"
              id="reports-tile-audit-pdf"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-accent/5 rounded-bl-full flex items-center justify-center pointer-events-none">
                <FileText size={24} className="text-accent mr-[-20px] mt-[-20px] opacity-40" />
              </div>
              
              <div className="flex flex-col gap-3">
                <div className="w-12 h-12 rounded-2xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
                  <FileText size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-text-primary group-hover:text-accent transition-colors">Audit PDF Report</h3>
                  <p className="text-xs text-text-secondary/80 mt-1 lines-clamp-2 leading-relaxed">
                    Customizable date range PDF reports formatted for financial audits. Includes payment mode breakdowns and signature reconciliation.
                  </p>
                </div>
              </div>
              
              <div className="flex items-center justify-between border-t border-border/40 pt-4 mt-1">
                <span className="text-[10px] font-black text-accent uppercase tracking-widest">Generate Audit PDF</span>
                <span className="text-xs font-bold text-accent group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </div>
          </div>
        ) : (
          /* Subview 2: Interactive Data Export Filter & Previewer */
          <div className="flex flex-col gap-6 animate-in fade-in duration-300">
            {/* Quick back navigation */}
            <div className="flex items-center justify-between bg-muted/20 border border-border/40 p-2.5 rounded-2xl">
              <button 
                onClick={() => setActiveSubView('hub')}
                className="text-xs font-bold text-text-secondary hover:text-text-primary flex items-center gap-2 px-3 py-1 bg-card rounded-xl border border-border/40 active:scale-95 transition-all"
              >
                ← Back to Reports
              </button>
              <button 
                onClick={handleResetFilters}
                className="text-[10px] font-black uppercase text-accent hover:opacity-85 tracking-widest flex items-center gap-1 bg-accent/5 px-3 py-1.5 rounded-xl border border-accent/15"
              >
                Reset All Filters
              </button>
            </div>

            {/* Filter controls section */}
            <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-xs flex flex-col gap-5">
              <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-text-secondary opacity-60">
                <Filter size={14} className="text-accent" /> Configure Search Filters
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {/* Date filter preset */}
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-black text-text-secondary uppercase tracking-widest">Date Range Selection</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => setDateType('all')}
                      className={`py-2 p-1 text-[10px] uppercase font-bold tracking-wider rounded-xl border transition-all ${
                        dateType === 'all' 
                          ? 'bg-accent/15 border-accent text-accent' 
                          : 'bg-transparent border-border/60 text-text-secondary hover:bg-muted/30'
                      }`}
                    >
                      Complete Database
                    </button>
                    <button 
                      onClick={() => setDateType('custom')}
                      className={`py-2 p-1 text-[10px] uppercase font-bold tracking-wider rounded-xl border transition-all ${
                        dateType === 'custom' 
                          ? 'bg-accent/15 border-accent text-accent' 
                          : 'bg-transparent border-border/60 text-text-secondary hover:bg-muted/30'
                      }`}
                    >
                      Custom Interval
                    </button>
                  </div>
                </div>

                {/* Date inputs (If custom is active) */}
                {dateType === 'custom' && (
                  <div className="flex flex-col gap-2 animate-in slide-in-from-top-1 duration-200 sm:col-span-1 md:col-span-2">
                    <label className="text-[11px] font-black text-text-secondary uppercase tracking-widest">Specify custom date interval</label>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="relative">
                        <input 
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="w-full bg-muted/30 border border-border/60 rounded-xl px-3 py-2 text-xs font-bold font-mono focus:border-accent text-text-primary"
                        />
                      </div>
                      <div className="relative">
                        <input 
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="w-full bg-muted/30 border border-border/60 rounded-xl px-3 py-2 text-xs font-bold font-mono focus:border-accent text-text-primary"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Customer dropdown */}
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-black text-text-secondary uppercase tracking-widest">Filter by Customer</label>
                  <div className="relative">
                    <select
                      value={selectedCustomerId}
                      onChange={(e) => {
                        setSelectedCustomerId(e.target.value);
                        if (e.target.value !== 'ALL') {
                          setSelectedAccountId(e.target.value); // Sync Account filter automatically as they map 1-to-1
                        }
                      }}
                      className="w-full bg-muted/20 border border-border/60 text-xs font-bold text-text-primary rounded-xl px-3.5 py-2.5 outline-none focus:border-accent font-sans appearance-none pr-8"
                    >
                      <option value="ALL">All Customers</option>
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({c.id})</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none opacity-40" />
                  </div>
                </div>

                {/* Savings account dropdown */}
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-black text-text-secondary uppercase tracking-widest">Filter by Account</label>
                  <div className="relative">
                    <select
                      value={selectedAccountId}
                      onChange={(e) => {
                        setSelectedAccountId(e.target.value);
                        if (e.target.value !== 'ALL') {
                          setSelectedCustomerId(e.target.value); // Sync Customer filter automatically
                        }
                      }}
                      className="w-full bg-muted/20 border border-border/60 text-xs font-bold text-text-primary rounded-xl px-3.5 py-2.5 outline-none focus:border-accent font-mono appearance-none pr-8"
                    >
                      <option value="ALL">All Accounts (All customers)</option>
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>{c.id} — {c.name}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none opacity-40" />
                  </div>
                </div>

                {/* Collections / Payments Type filter */}
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-black text-text-secondary uppercase tracking-widest">Filter Collections Mode</label>
                  <div className="relative">
                    <select
                      value={collectionType}
                      onChange={(e) => setCollectionType(e.target.value)}
                      className="w-full bg-muted/20 border border-border/60 text-xs font-bold text-text-primary rounded-xl px-3.5 py-2.5 outline-none focus:border-accent appearance-none pr-8"
                    >
                      <option value="ALL">All Payments Modes (Cash & PhonePe)</option>
                      <option value="Cash">Cash Only</option>
                      <option value="PhonePe">PhonePe Only</option>
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none opacity-40" />
                  </div>
                </div>

                {/* Transactions State filter */}
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-black text-text-secondary uppercase tracking-widest">Filter Status</label>
                  <div className="relative">
                    <select
                      value={transactionStatus}
                      onChange={(e) => setTransactionStatus(e.target.value)}
                      className="w-full bg-muted/20 border border-border/60 text-xs font-bold text-text-primary rounded-xl px-3.5 py-2.5 outline-none focus:border-accent appearance-none pr-8"
                    >
                      <option value="ALL">All Statuses (Paid & Pending)</option>
                      <option value="Paid">Paid Only</option>
                      <option value="Pending">Pending Only</option>
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none opacity-40" />
                  </div>
                </div>

                {/* Agents mock filter */}
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-black text-text-secondary uppercase tracking-widest">Filter Agents / Operators</label>
                  <div className="relative">
                    <select
                      value={agentFilter}
                      onChange={(e) => setAgentFilter(e.target.value)}
                      className="w-full bg-muted/20 border border-border/60 text-xs font-bold text-text-primary rounded-xl px-3.5 py-2.5 outline-none focus:border-accent appearance-none pr-8"
                    >
                      <option value="ALL">All Agents ({currentUserEmail})</option>
                      <option value={currentUserEmail}>{currentUserEmail} (Logged in)</option>
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none opacity-40" />
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Summary Counts Stats Block */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4" id="reports-statistics-summary">
              <div className="bg-card border border-border/40 p-4 rounded-2xl flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
                  <Database size={18} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-text-secondary opacity-40 tracking-wider">Total Records</p>
                  <p className="text-base font-black font-mono text-text-primary mt-0.5">{totalRecords}</p>
                </div>
              </div>

              <div className="bg-card border border-border/40 p-4 rounded-2xl flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-success/10 text-success flex items-center justify-center shrink-0">
                  <Users size={18} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-text-secondary opacity-40 tracking-wider">Total Customers</p>
                  <p className="text-base font-black font-mono text-text-primary mt-0.5">{totalCustomers}</p>
                </div>
              </div>

              <div className="bg-card border border-border/40 p-4 rounded-2xl flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0">
                  <Activity size={18} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-text-secondary opacity-40 tracking-wider">Total Collections</p>
                  <p className="text-base font-black font-mono text-text-primary mt-0.5">{totalCollections}</p>
                </div>
              </div>

              <div className="bg-card border border-border/40 p-4 rounded-2xl flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-warning/10 text-warning flex items-center justify-center shrink-0">
                  <Wallet size={18} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-text-secondary opacity-40 tracking-wider">Savings Amount</p>
                  <p className="text-base font-black font-mono text-warning mt-0.5">₹{totalSavingsAmount.toLocaleString('en-IN')}</p>
                </div>
              </div>
            </div>

            {/* Excel Preview Tables block */}
            <div className="bg-card border border-border/50 rounded-2xl overflow-hidden flex flex-col shadow-xs">
              {/* Tab selector mirroring future excel sheets */}
              <div className="px-5 pt-4 bg-muted/10 border-b border-border/40 shrink-0">
                <div className="flex items-center gap-2 mb-3">
                  <FileSpreadsheet size={16} className="text-success" />
                  <span className="text-[11px] font-black uppercase tracking-widest text-text-secondary opacity-60">Interactive Excel Sheets Previews</span>
                </div>
                
                <div className="flex overflow-x-auto gap-1.5 scrollbar-thin pb-px">
                  {(['customers', 'accounts', 'collections', 'transactions'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setPreviewTab(tab)}
                      className={`px-4 py-2.5 text-[10px] font-black uppercase tracking-widest border-t-2 border-x transition-all shrink-0 rounded-t-xl ${
                        previewTab === tab 
                          ? 'bg-card border-x-border/60 border-t-accent text-accent' 
                          : 'bg-transparent border-transparent text-text-secondary opacity-50 hover:bg-muted/10 hover:opacity-100'
                      }`}
                    >
                      {tab === 'customers' && '📁 Customer Master'}
                      {tab === 'accounts' && '💳 Savings Accounts'}
                      {tab === 'collections' && '📦 Collections'}
                      {tab === 'transactions' && '🧾 Transactions'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Data Previews Container */}
              <div className="flex-1 p-4 overflow-y-auto no-scrollbar max-h-[420px]">
                {previewTab === 'customers' && (
                  <div className="overflow-x-auto rounded-xl border border-border/40">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="bg-muted/30 border-b border-border/40 text-[10px] font-black uppercase tracking-wider text-text-secondary">
                          <th className="p-3">Customer ID</th>
                          <th className="p-3">Name</th>
                          <th className="p-3">Mobile ID</th>
                          <th className="p-3">Address</th>
                          <th className="p-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/20 text-text-primary font-medium">
                        {customerRows.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-8 text-center text-text-secondary opacity-50">
                              No records match applied search filters.
                            </td>
                          </tr>
                        ) : (
                          customerRows.slice(0, 30).map((row) => (
                            <tr key={row.customerId} className="hover:bg-muted/10">
                              <td className="p-3 font-mono font-bold text-accent">{row.customerId}</td>
                              <td className="p-3 font-semibold">{row.name}</td>
                              <td className="p-3 font-mono text-[11px]">{row.phone}</td>
                              <td className="p-3 truncate max-w-[150px]" title={row.address}>{row.address}</td>
                              <td className="p-3 text-center">
                                <span className="bg-success/15 text-success text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border border-success/10">
                                  {row.status}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                        {customerRows.length > 30 && (
                          <tr>
                            <td colSpan={5} className="p-2.5 text-center text-[10px] font-bold text-text-secondary/60 bg-muted/10 border-t border-border/20">
                              And {customerRows.length - 30} more rows... Click [Download Excel] to extract complete records
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {previewTab === 'accounts' && (
                  <div className="overflow-x-auto rounded-xl border border-border/40">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="bg-muted/30 border-b border-border/40 text-[10px] font-black uppercase tracking-wider text-text-secondary">
                          <th className="p-3">Account Number</th>
                          <th className="p-3">Customer</th>
                          <th className="p-3">Opening Date</th>
                          <th className="p-3 text-right">Current Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/20 text-text-primary font-medium">
                        {accountRows.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="p-8 text-center text-text-secondary opacity-50">
                              No accounts found.
                            </td>
                          </tr>
                        ) : (
                          accountRows.slice(0, 30).map((row) => (
                            <tr key={row.accountNumber} className="hover:bg-muted/10">
                              <td className="p-3 font-mono font-bold text-indigo-500">{row.accountNumber}</td>
                              <td className="p-3 font-semibold">{row.customerName}</td>
                              <td className="p-3 font-mono">{row.openingDate}</td>
                              <td className="p-3 text-right font-mono font-bold text-success">₹{row.currentBalance.toLocaleString('en-IN')}</td>
                            </tr>
                          ))
                        )}
                        {accountRows.length > 30 && (
                          <tr>
                            <td colSpan={4} className="p-2.5 text-center text-[10px] font-bold text-text-secondary/60 bg-muted/10 border-t border-border/20">
                              And {accountRows.length - 30} more rows available inside full export file...
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {previewTab === 'collections' && (
                  <div className="overflow-x-auto rounded-xl border border-border/40">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="bg-muted/30 border-b border-border/40 text-[10px] font-black uppercase tracking-wider text-text-secondary">
                          <th className="p-3">Collection ID</th>
                          <th className="p-3">Customer Name</th>
                          <th className="p-3 text-right">Amount</th>
                          <th className="p-3">Agent</th>
                          <th className="p-3">Date</th>
                          <th className="p-3 text-center">Payment Mode</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/20 text-text-primary font-medium">
                        {collectionRows.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-8 text-center text-text-secondary opacity-50">
                              No collections logged for these filter options.
                            </td>
                          </tr>
                        ) : (
                          collectionRows.slice(0, 30).map((row) => (
                            <tr key={row.collectionId} className="hover:bg-muted/10">
                              <td className="p-3 font-mono text-[11px] text-purple-500 truncate max-w-[100px]" title={row.collectionId}>{row.collectionId}</td>
                              <td className="p-3 font-semibold">{row.customerName}</td>
                              <td className="p-3 text-right font-mono font-bold text-success">₹{row.amount.toLocaleString('en-IN')}</td>
                              <td className="p-3 text-[11px] opacity-75 truncate max-w-[90px]">{row.agent}</td>
                              <td className="p-3 font-mono text-[11px]">{row.date}</td>
                              <td className="p-3 text-center">
                                <span className={`text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${
                                  row.paymentMode === 'PhonePe' 
                                    ? 'bg-purple-500/10 text-purple-500 border-purple-500/10' 
                                    : 'bg-orange-500/10 text-orange-500 border-orange-500/10'
                                }`}>
                                  {row.paymentMode}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                        {collectionRows.length > 30 && (
                          <tr>
                            <td colSpan={6} className="p-2.5 text-center text-[10px] font-bold text-text-secondary/60 bg-muted/10 border-t border-border/20">
                              And {collectionRows.length - 30} more collection entries... Click download to output full list.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {previewTab === 'transactions' && (
                  <div className="overflow-x-auto rounded-xl border border-border/40">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="bg-muted/30 border-b border-border/40 text-[10px] font-black uppercase tracking-wider text-text-secondary">
                          <th className="p-3">Transaction ID</th>
                          <th className="p-3">Customer</th>
                          <th className="p-3 font-mono">Date</th>
                          <th className="p-3">Type</th>
                          <th className="p-3 text-right">Amount</th>
                          <th className="p-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/20 text-text-primary font-medium">
                        {transactionRows.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-8 text-center text-text-secondary opacity-50">
                              No transactions match applied filters.
                            </td>
                          </tr>
                        ) : (
                          transactionRows.slice(0, 30).map((row) => (
                            <tr key={row.transactionId} className="hover:bg-muted/10">
                              <td className="p-3 font-mono text-[11px] text-text-secondary truncate max-w-[90px]" title={row.transactionId}>{row.transactionId}</td>
                              <td className="p-3 font-semibold">{row.customerName}</td>
                              <td className="p-3 font-mono text-[11px]">{row.date}</td>
                              <td className="p-3 text-[11px]">{row.type}</td>
                              <td className="p-3 text-right font-mono font-bold">₹{row.amount.toLocaleString('en-IN')}</td>
                              <td className="p-3 text-center">
                                <span className={`text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${
                                  row.status === 'Paid' 
                                    ? 'bg-success/15 text-success border-success/10' 
                                    : 'bg-warning/15 text-warning border-warning/10'
                                }`}>
                                  {row.status}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                        {transactionRows.length > 30 && (
                          <tr>
                            <td colSpan={6} className="p-2.5 text-center text-[10px] font-bold text-text-secondary/60 bg-muted/10 border-t border-border/20">
                              And {transactionRows.length - 30} more transactions... Click download to output full file.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Instructions banner */}
              <div className="bg-muted/20 border-t border-border/40 p-4 shrink-0 flex items-start gap-3">
                <Info size={16} className="text-accent shrink-0 mt-0.5" />
                <p className="text-[10px] text-text-secondary/80 leading-relaxed font-sans">
                  The interactive table shows the first 30 entries as a secure, browser-safe preview. Clicking 
                  <strong className="text-success font-black"> [Download Excel]</strong> or <strong className="text-accent font-black">[Audit PDF]</strong> will instantly generate comprehensive production-grade reports 
                  for banking and financial audit compliance.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Audit PDF Export Modal */}
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

        {/* PDF Viewer / Downloader Modal */}
        <PDFViewerModal 
          isOpen={showPreview}
          onClose={() => setShowPreview(false)}
          report={previewReport}
        />
      </div>
    </PageContainer>
  );
}
