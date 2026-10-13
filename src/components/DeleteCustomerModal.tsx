import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AlertTriangle, Trash2, Download, FileText, 
  FileSpreadsheet, CheckCircle2, X, Loader2, ShieldAlert 
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Customer, Transaction } from '../services/firestoreService';
import { generateAuditReportPDF } from '../lib/auditPdfExport';
import { downloadCustomerArchivePDF } from '../lib/customerArchivePdf';
import { downloadFileForAndroid } from '../utils/capacitorDeviceHelper';
import { safeFormat } from '../lib/utils';
import { toast } from 'sonner';

interface DeleteCustomerModalProps {
  isOpen: boolean;
  customer: Customer | null;
  transactions: Transaction[];
  onClose: () => void;
  onConfirmDelete: (customer: Customer, knownTxIds: string[]) => Promise<void> | void;
}

export function DeleteCustomerModal({
  isOpen,
  customer,
  transactions,
  onClose,
  onConfirmDelete,
}: DeleteCustomerModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingCsv, setDownloadingCsv] = useState(false);
  const [hasDownloadedPdf, setHasDownloadedPdf] = useState(false);
  const [hasDownloadedCsv, setHasDownloadedCsv] = useState(false);

  // Reset state when closing / customer change
  React.useEffect(() => {
    if (!isOpen) {
      setIsDeleting(false);
      setDownloadingPdf(false);
      setDownloadingCsv(false);
      setHasDownloadedPdf(false);
      setHasDownloadedCsv(false);
    }
  }, [isOpen, customer?.id]);

  if (!isOpen || !customer) return null;

  // Filter transactions for this customer
  const customerTransactions = transactions.filter(
    tx => tx.customerId === customer.id && !tx.isDeleted
  ).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  const knownTxIds = customerTransactions.map(t => t.id);

  const isSaving = customer.accountType === 'saving';
  const loanAmount = isSaving ? (customer.targetDeposit || 0) : (customer.loanAmount || customer.loan || 0);
  const paidAmount = customer.paid || 0;
  const pendingAmount = isSaving ? 0 : (customer.pending !== undefined ? customer.pending : Math.max(0, loanAmount - paidAmount));
  const advanceBalance = customer.advanceBalance || 0;

  // Handle Download PDF Statement (Comprehensive Archive)
  const handleDownloadPDF = async () => {
    setDownloadingPdf(true);
    const toastId = toast.loading(`Generating complete PDF archive for ${customer.name}...`);
    try {
      await downloadCustomerArchivePDF(customer, customerTransactions);
      setHasDownloadedPdf(true);
      toast.success('Complete PDF archive downloaded successfully!', { id: toastId });
    } catch (err: any) {
      console.error('PDF export error:', err);
      toast.error('Failed to download PDF archive', { id: toastId });
    } finally {
      setDownloadingPdf(false);
    }
  };

  // Handle Download Excel / CSV
  const handleDownloadCSV = async () => {
    setDownloadingCsv(true);
    const toastId = toast.loading(`Generating CSV report for ${customer.name}...`);
    try {
      // 1. Customer Profile details
      const profileData = [
        { "Section": "CUSTOMER PROFILE", "Field": "Customer Name", "Value": customer.name },
        { "Section": "CUSTOMER PROFILE", "Field": "Customer ID", "Value": customer.id },
        { "Section": "CUSTOMER PROFILE", "Field": "Display ID", "Value": customer.displayId ? `#${customer.displayId}` : 'N/A' },
        { "Section": "CUSTOMER PROFILE", "Field": "Phone Number", "Value": customer.phone || 'N/A' },
        { "Section": "CUSTOMER PROFILE", "Field": "Account Type", "Value": isSaving ? 'Saving' : 'Loan' },
        { "Section": "CUSTOMER PROFILE", "Field": isSaving ? "Target Deposit (₹)" : "Loan Amount (₹)", "Value": loanAmount },
        { "Section": "CUSTOMER PROFILE", "Field": "Total Paid (₹)", "Value": paidAmount },
        { "Section": "CUSTOMER PROFILE", "Field": isSaving ? "Advance Savings (₹)" : "Pending Balance (₹)", "Value": isSaving ? advanceBalance : pendingAmount },
        { "Section": "CUSTOMER PROFILE", "Field": "Loan Cycle", "Value": customer.currentCycle || 1 },
        { "Section": "CUSTOMER PROFILE", "Field": "Start Date", "Value": customer.startDate ? safeFormat(customer.startDate, 'dd/MM/yyyy', '') : 'N/A' },
        { "Section": "CUSTOMER PROFILE", "Field": "End Date", "Value": customer.endDate ? safeFormat(customer.endDate, 'dd/MM/yyyy', '') : 'N/A' },
        { "Section": "CUSTOMER PROFILE", "Field": "Address", "Value": (customer as any).address || 'N/A' },
        { "Section": "CUSTOMER PROFILE", "Field": "Total Transactions", "Value": customerTransactions.length },
      ];

      // 2. Transaction Records
      const txRows = customerTransactions.map((tx, idx) => ({
        "Sl": idx + 1,
        "Transaction ID": tx.id,
        "Date": tx.date,
        "Date Time": safeFormat(tx.timestamp || tx.date, 'dd/MM/yyyy hh:mm a', tx.date),
        "Payment Mode": tx.type === 'phonepe' ? 'PhonePe / UPI' : (tx.type === 'NP' || tx.type === 'unsettled') ? 'NP / Unsettled' : 'Cash',
        "Amount (₹)": tx.amount,
        "Status": tx.status === 'unsettled' ? 'Unsettled' : 'Paid',
        "Receipt ID": (tx as any).receiptId || 'N/A',
        "Cycle": (tx as any).loanCycle || customer.currentCycle || 1,
        "Notes": tx.notes || ''
      }));

      // Create workbook with multiple sheets
      const wb = XLSX.utils.book_new();

      const wsProfile = XLSX.utils.json_to_sheet(profileData);
      XLSX.utils.book_append_sheet(wb, wsProfile, "Borrower Summary");

      const wsTx = XLSX.utils.json_to_sheet(txRows.length > 0 ? txRows : [{ "Status": "No transactions logged" }]);
      XLSX.utils.book_append_sheet(wb, wsTx, "All Transactions");

      const csvContent = XLSX.utils.sheet_to_csv(wsTx);
      const csvBlob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

      const safeName = customer.name.replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `Customer_Data_${safeName}_${customer.id}_${new Date().toISOString().slice(0, 10)}.csv`;

      await downloadFileForAndroid(csvBlob, filename, `${customer.name} Data`);
      setHasDownloadedCsv(true);
      toast.success('CSV data downloaded successfully!', { id: toastId });
    } catch (err: any) {
      console.error('CSV export error:', err);
      toast.error('Failed to download CSV data', { id: toastId });
    } finally {
      setDownloadingCsv(false);
    }
  };

  // Permanently delete customer from Firebase
  const handleDelete = async () => {
    setIsDeleting(true);
    const toastId = toast.loading(`Permanently deleting ${customer.name}...`);
    try {
      await onConfirmDelete(customer, knownTxIds);
      toast.success(`Customer ${customer.name} permanently deleted`, { id: toastId });
      onClose();
    } catch (err: any) {
      console.error('Failed to delete customer:', err);
      toast.error(err?.message || 'Failed to delete customer', { id: toastId });
      setIsDeleting(false);
    }
  };

  const hasAnyDownloaded = hasDownloadedPdf || hasDownloadedCsv;

  const modalContent = (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => !isDeleting && onClose()}
        className="fixed inset-0"
        aria-hidden="true"
      />

      <motion.div
        initial={{ scale: 0.94, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.94, opacity: 0, y: 10 }}
        transition={{ type: "spring", duration: 0.3 }}
        className="relative bg-card border border-border/90 rounded-3xl p-5 sm:p-6 max-w-lg w-full shadow-2xl z-10 flex flex-col max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-danger/10 text-danger flex items-center justify-center shrink-0">
              <ShieldAlert size={22} strokeWidth={2.3} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-text-primary tracking-tight">
                Permanently Delete Customer & All Data
              </h3>
              <p className="text-xs font-semibold text-danger/90">
                Permanently wipes all customer records and transactions
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="w-8 h-8 rounded-full bg-muted/60 text-text-secondary hover:text-text-primary flex items-center justify-center transition-colors disabled:opacity-50"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
          {/* Customer Summary Card */}
          <div className="bg-bg/80 border border-border/80 rounded-2xl p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-base font-black text-text-primary">
                  {customer.name}
                </h4>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-text-secondary font-medium">
                  {customer.displayId && <span>ID: #{customer.displayId}</span>}
                  <span>•</span>
                  <span>{customer.phone || 'No phone'}</span>
                </div>
              </div>
              <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${
                isSaving 
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' 
                  : 'bg-primary/10 text-primary'
              }`}>
                {isSaving ? 'Savings Account' : 'Loan Account'}
              </span>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-border/40">
              <div className="bg-card/70 p-2.5 rounded-xl border border-border/40">
                <span className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                  {isSaving ? 'Target' : 'Loan Amount'}
                </span>
                <span className="text-xs sm:text-sm font-black text-text-primary">
                  ₹{loanAmount.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="bg-card/70 p-2.5 rounded-xl border border-border/40">
                <span className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                  Total Paid
                </span>
                <span className="text-xs sm:text-sm font-black text-emerald-600 dark:text-emerald-400">
                  ₹{paidAmount.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="bg-card/70 p-2.5 rounded-xl border border-border/40">
                <span className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                  {isSaving ? 'Advance' : 'Pending'}
                </span>
                <span className="text-xs sm:text-sm font-black text-danger">
                  ₹{pendingAmount.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="bg-card/70 p-2.5 rounded-xl border border-border/40">
                <span className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                  Entries
                </span>
                <span className="text-xs sm:text-sm font-black text-accent">
                  {customerTransactions.length} txs
                </span>
              </div>
            </div>
          </div>

          {/* Download Customer Data Section */}
          <div className="rounded-2xl border border-border/80 bg-muted/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-text-primary font-black text-xs uppercase tracking-wider">
                <Download size={15} strokeWidth={2.5} className="text-accent" />
                <span>Backup Customer Data (Optional)</span>
              </div>
              {hasAnyDownloaded && (
                <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                  <CheckCircle2 size={13} />
                  <span>Backup Saved</span>
                </span>
              )}
            </div>

            <p className="text-xs text-text-secondary font-medium leading-relaxed">
              You can optionally download an official PDF archive or CSV spreadsheet of customer profile data and all transaction history for your records before deleting.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              {/* PDF Download Button */}
              <button
                type="button"
                onClick={handleDownloadPDF}
                disabled={downloadingPdf || isDeleting}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-bold text-xs transition-all border active:scale-95 cursor-pointer ${
                  hasDownloadedPdf
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-card hover:bg-muted text-text-primary border-border hover:border-accent/40 shadow-xs'
                }`}
              >
                {downloadingPdf ? (
                  <Loader2 size={15} className="animate-spin text-accent" />
                ) : hasDownloadedPdf ? (
                  <CheckCircle2 size={15} />
                ) : (
                  <FileText size={15} className="text-accent" />
                )}
                <span>{hasDownloadedPdf ? 'PDF Archive Saved ✓' : 'Download Complete PDF Archive'}</span>
              </button>

              {/* CSV Download Button */}
              <button
                type="button"
                onClick={handleDownloadCSV}
                disabled={downloadingCsv || isDeleting}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-bold text-xs transition-all border active:scale-95 cursor-pointer ${
                  hasDownloadedCsv
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-card hover:bg-muted text-text-primary border-border hover:border-accent/40 shadow-xs'
                }`}
              >
                {downloadingCsv ? (
                  <Loader2 size={15} className="animate-spin text-emerald-600" />
                ) : hasDownloadedCsv ? (
                  <CheckCircle2 size={15} />
                ) : (
                  <FileSpreadsheet size={15} className="text-emerald-600" />
                )}
                <span>{hasDownloadedCsv ? 'CSV Data Saved ✓' : 'Download CSV / Excel'}</span>
              </button>
            </div>
          </div>

          {/* Deletion Warning Box */}
          <div className="bg-danger/10 border border-danger/25 rounded-2xl p-3.5 flex items-start gap-3">
            <AlertTriangle size={18} className="text-danger shrink-0 mt-0.5" />
            <div className="text-xs text-danger font-medium leading-relaxed">
              <p className="font-bold mb-0.5">Permanent Deletion Notice:</p>
              Deleting will permanently remove <strong>{customer.name}</strong> from Firebase customer collections along with all <strong>{customerTransactions.length} related transactions</strong>. This action cannot be undone.
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-border/60 flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="flex-1 py-3 px-4 rounded-xl bg-muted/70 hover:bg-muted border border-border text-xs font-bold text-text-primary uppercase tracking-wider transition-all active:scale-95 cursor-pointer disabled:opacity-50"
          >
            Cancel / Keep
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex-1 py-3 px-4 rounded-xl bg-danger hover:bg-danger/90 text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-danger/20 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
          >
            {isDeleting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Deleting Customer...</span>
              </>
            ) : (
              <>
                <Trash2 size={16} />
                <span>Permanently Delete</span>
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
}
