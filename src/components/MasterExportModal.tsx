import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  FileSpreadsheet, FileText, Download, Printer, 
  Eye, CheckCircle2, Loader2, Sparkles, Database, 
  Users, Receipt, ShieldCheck, MessageCircle, Send
} from 'lucide-react';
import { Customer, Transaction } from '../services/firestoreService';
import { 
  calculateMasterMetrics, 
  exportMasterToExcel, 
  generateMasterPDFReport 
} from '../utils/masterExport';
import { whatsappReportService } from '../services/whatsappReportService';
import { BottomSheet } from './BottomSheet';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';

interface MasterExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  customers: Customer[];
  transactions: Transaction[];
  onPreviewPDF: (report: { blob: Blob; fileName: string; title: string }) => void;
}

export function MasterExportModal({
  isOpen,
  onClose,
  customers,
  transactions,
  onPreviewPDF
}: MasterExportModalProps) {
  const { user } = useAuth();
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);
  const [customWhatsAppPhone, setCustomWhatsAppPhone] = useState(() => whatsappReportService.getSettings().phoneNumber || '');

  const metrics = calculateMasterMetrics(customers, transactions);

  const handleWhatsAppSend = async () => {
    setIsSendingWhatsApp(true);
    const toastId = toast.loading('Preparing WhatsApp report & PDF statement...');
    try {
      if (customWhatsAppPhone) {
        whatsappReportService.saveSettings({ phoneNumber: customWhatsAppPhone });
      }
      const result = await whatsappReportService.sendReportToWhatsApp(customers, transactions, customWhatsAppPhone);
      if (result.success) {
        toast.success(
          result.method === 'web_share'
            ? 'Master PDF ready in share dialog. Tap WhatsApp to send!'
            : 'WhatsApp opened with structured statement. PDF downloaded for attachment.',
          { id: toastId }
        );
      }
    } catch (err: any) {
      console.error('WhatsApp report error', err);
      toast.error('Failed to dispatch WhatsApp report.', { id: toastId });
    } finally {
      setIsSendingWhatsApp(false);
    }
  };

  const handleExcelExport = async () => {
    setIsExportingExcel(true);
    const toastId = toast.loading('Preparing Master Excel Workbook...');
    try {
      const fileName = await exportMasterToExcel(customers, transactions);
      toast.success(`Exported: ${fileName}`, { id: toastId });
    } catch (err: any) {
      console.error('Master Excel export error', err);
      toast.error('Failed to export Excel file. Please retry.', { id: toastId });
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handlePDFDownload = async () => {
    setIsExportingPDF(true);
    const toastId = toast.loading('Compiling Master PDF Report...');
    try {
      const report = await generateMasterPDFReport(customers, transactions, {
        userEmail: user?.email || undefined
      });

      // Direct download
      const url = URL.createObjectURL(report.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = report.fileName;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);

      toast.success(`Downloaded: ${report.fileName}`, { id: toastId });
    } catch (err: any) {
      console.error('Master PDF generation error', err);
      toast.error('Failed to generate PDF report.', { id: toastId });
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handlePDFPreview = async () => {
    setIsExportingPDF(true);
    const toastId = toast.loading('Generating preview...');
    try {
      const report = await generateMasterPDFReport(customers, transactions, {
        userEmail: user?.email || undefined
      });
      toast.dismiss(toastId);
      onClose();
      onPreviewPDF(report);
    } catch (err: any) {
      console.error('Master PDF preview error', err);
      toast.error('Failed to generate PDF preview.', { id: toastId });
    } finally {
      setIsExportingPDF(false);
    }
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Master Data Export"
      subtitle="Export entire application data across all borrowers and ledgers"
    >
      <div className="flex flex-col gap-4 pb-6">
        
        {/* Realtime Database Scope Overview */}
        <div className="p-4 rounded-2xl bg-card border border-border/50 shadow-xs flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-text-secondary opacity-60 flex items-center gap-1.5">
              <Database size={13} className="text-accent" />
              Full Application Data Scope
            </span>
            <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full uppercase tracking-wider">
              100% Live Sync
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            <div className="bg-bg/60 p-2.5 rounded-xl border border-border/30">
              <p className="text-[9px] font-bold text-text-secondary opacity-60 uppercase">Borrowers</p>
              <p className="text-sm font-black text-text-primary mt-0.5">
                {metrics.totalCustomers} <span className="text-[9px] font-semibold opacity-50">accs</span>
              </p>
            </div>

            <div className="bg-bg/60 p-2.5 rounded-xl border border-border/30">
              <p className="text-[9px] font-bold text-text-secondary opacity-60 uppercase">Transactions</p>
              <p className="text-sm font-black text-text-primary mt-0.5">
                {metrics.totalTransactions} <span className="text-[9px] font-semibold opacity-50">txs</span>
              </p>
            </div>

            <div className="bg-bg/60 p-2.5 rounded-xl border border-border/30">
              <p className="text-[9px] font-bold text-text-secondary opacity-60 uppercase">Collected</p>
              <p className="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                ₹{metrics.totalCollected.toLocaleString('en-IN')}
              </p>
            </div>

            <div className="bg-bg/60 p-2.5 rounded-xl border border-border/30">
              <p className="text-[9px] font-bold text-text-secondary opacity-60 uppercase">Pending Due</p>
              <p className="text-sm font-black text-rose-500 mt-0.5">
                ₹{metrics.totalPending.toLocaleString('en-IN')}
              </p>
            </div>
          </div>
        </div>

        {/* Option 1: Excel Multi-Sheet Export */}
        <div className="p-4 rounded-2xl bg-card border border-border/50 hover:border-emerald-500/40 transition-all shadow-xs flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <FileSpreadsheet size={24} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-sm text-text-primary tracking-tight">Excel Master Workbook</h4>
                <span className="text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-md">
                  .XLSX
                </span>
              </div>
              <p className="text-xs text-text-secondary opacity-70 mt-1 leading-relaxed">
                Multi-tab workbook containing Executive KPI Summary, Complete Customer Master, Full Transactions Ledger, and Audit Trail.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleExcelExport}
            disabled={isExportingExcel}
            className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm shadow-emerald-600/20 active:scale-[0.99] transition-all disabled:opacity-50 cursor-pointer"
          >
            {isExportingExcel ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Exporting Excel...</span>
              </>
            ) : (
              <>
                <Download size={16} />
                <span>Download Excel Workbook (.xlsx)</span>
              </>
            )}
          </button>
        </div>

        {/* Option 2: PDF Master Statement */}
        <div className="p-4 rounded-2xl bg-card border border-border/50 hover:border-accent/40 transition-all shadow-xs flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
              <FileText size={24} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-sm text-text-primary tracking-tight">Official PDF Master Report</h4>
                <span className="text-[9px] font-black uppercase tracking-wider bg-accent/10 text-accent px-1.5 py-0.5 rounded-md">
                  .PDF
                </span>
              </div>
              <p className="text-xs text-text-secondary opacity-70 mt-1 leading-relaxed">
                Print-ready landscape financial report with KPI summary cards, borrower account tables, chronological collection ledgers, and page numbering.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePDFDownload}
              disabled={isExportingPDF}
              className="flex-1 h-11 rounded-xl bg-accent hover:bg-accent/90 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm shadow-accent/20 active:scale-[0.99] transition-all disabled:opacity-50 cursor-pointer"
            >
              {isExportingPDF ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Compiling PDF...</span>
                </>
              ) : (
                <>
                  <Download size={16} />
                  <span>Download PDF</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handlePDFPreview}
              disabled={isExportingPDF}
              className="h-11 px-4 rounded-xl bg-card border border-border/60 hover:border-accent/40 text-text-secondary hover:text-accent font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 active:scale-[0.99] transition-all disabled:opacity-50 cursor-pointer shrink-0"
              title="Preview & Print Report"
            >
              <Eye size={16} />
              <span className="hidden sm:inline">Preview / Print</span>
            </button>
          </div>
        </div>

        {/* Option 3: WhatsApp Master Statement (Free Channel) */}
        <div className="p-4 rounded-2xl bg-card border border-border/50 hover:border-emerald-500/40 transition-all shadow-xs flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <MessageCircle size={24} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-sm text-text-primary tracking-tight">WhatsApp Master Statement</h4>
                <span className="text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-md">
                  Free Channel
                </span>
              </div>
              <p className="text-xs text-text-secondary opacity-70 mt-1 leading-relaxed">
                Dispatch complete structured Firestore data and attach the Master PDF to your WhatsApp number.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
            <div className="relative w-full sm:flex-1">
              <input
                type="tel"
                value={customWhatsAppPhone}
                onChange={(e) => setCustomWhatsAppPhone(e.target.value)}
                placeholder="Custom WhatsApp No. (e.g. 919876543210)"
                className="w-full h-11 px-3.5 bg-bg border border-border/60 rounded-xl text-xs font-semibold focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
            <button
              type="button"
              onClick={handleWhatsAppSend}
              disabled={isSendingWhatsApp}
              className="w-full sm:w-auto h-11 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm shadow-emerald-600/20 active:scale-[0.99] transition-all disabled:opacity-50 cursor-pointer shrink-0"
            >
              {isSendingWhatsApp ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Preparing...</span>
                </>
              ) : (
                <>
                  <Send size={15} />
                  <span>Send to WhatsApp</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Security & Confidentiality note */}
        <div className="p-3 rounded-xl bg-muted/40 border border-border/30 flex items-center gap-2.5">
          <ShieldCheck size={16} className="text-text-secondary opacity-50 shrink-0" />
          <p className="text-[10px] text-text-secondary opacity-60 leading-normal">
            Master exports are processed locally in your browser session and include 100% of current synced data.
          </p>
        </div>

        <button 
          onClick={onClose}
          className="w-full py-3.5 rounded-xl bg-muted text-text-secondary font-black text-xs uppercase tracking-wider active:scale-[0.99] transition-all"
        >
          Cancel
        </button>
      </div>
    </BottomSheet>
  );
}
