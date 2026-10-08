import { Customer, Transaction } from './firestoreService';
import { calculateMasterMetrics, generateMasterPDFReport } from '../utils/masterExport';
import { format } from 'date-fns';
import { toast } from 'sonner';

export interface WhatsAppReportSettings {
  enabled: boolean;
  phoneNumber: string; // e.g. 919876543210
  dispatchTime: string; // "06:00"
  lastDispatchedDate?: string;
  autoDownloadPDF: boolean;
}

const STORAGE_KEY = 'pigmy_whatsapp_report_settings_v1';

export const DEFAULT_WHATSAPP_SETTINGS: WhatsAppReportSettings = {
  enabled: true,
  phoneNumber: '',
  dispatchTime: '06:00',
  lastDispatchedDate: '',
  autoDownloadPDF: true
};

export const whatsappReportService = {
  getSettings(): WhatsAppReportSettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        return { ...DEFAULT_WHATSAPP_SETTINGS, ...JSON.parse(raw) };
      }
    } catch (e) {
      console.error('Failed to load WhatsApp report settings', e);
    }
    return DEFAULT_WHATSAPP_SETTINGS;
  },

  saveSettings(settings: Partial<WhatsAppReportSettings>): WhatsAppReportSettings {
    const current = this.getSettings();
    const updated = { ...current, ...settings };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save WhatsApp report settings', e);
    }
    return updated;
  },

  /**
   * Formats the master firestore ledger into a crisp WhatsApp markdown message
   */
  generateStructuredSummary(customers: Customer[], transactions: Transaction[]): string {
    const metrics = calculateMasterMetrics(customers, transactions);
    const now = new Date();
    const dateFormatted = format(now, 'dd MMM yyyy, hh:mm a');

    const lines = [
      `📊 *PIGMY PRO — MASTER FINANCIAL STATEMENT*`,
      `⏱️ Generated: ${dateFormatted}`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `👥 *ACCOUNTS OVERVIEW*`,
      `• Total Borrowers: *${metrics.totalCustomers}*`,
      `• Active Active Accounts: *${metrics.activeCustomers}*`,
      `• Settled Accounts: *${metrics.settledCustomers}*`,
      `• Overdue Accounts: *${metrics.overdueCustomers}*`,
      ``,
      `💰 *COLLECTIONS & CAPITAL*`,
      `• Total Disbursed: *₹${metrics.totalLoansDisbursed.toLocaleString('en-IN')}*`,
      `• Total Collected: *₹${metrics.totalCollected.toLocaleString('en-IN')}*`,
      `• Outstanding Due: *₹${metrics.totalPending.toLocaleString('en-IN')}*`,
      `• Recovery Rate: *${metrics.recoveryRatePercent}*`,
      ``,
      `💳 *CHANNELS BREAKDOWN*`,
      `• Cash Collected: ₹${metrics.totalCash.toLocaleString('en-IN')}`,
      `• UPI / PhonePe: ₹${metrics.totalPhonePe.toLocaleString('en-IN')}`,
      `• Unsettled / NP: ₹${metrics.totalUnsettledAmount.toLocaleString('en-IN')}`,
      `• Total Transactions: ${metrics.totalTransactions}`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `📄 Official Master PDF report generated with complete borrower schedules & transaction audit trails.`
    ];

    return lines.join('\n');
  },

  /**
   * Dispatches the master report to WhatsApp:
   * 1. Generates structured master PDF
   * 2. Uses Web Share API (native WhatsApp file attachment) if available
   * 3. Falls back to wa.me deep link with structured summary & file download
   */
  async sendReportToWhatsApp(
    customers: Customer[],
    transactions: Transaction[],
    overridePhone?: string
  ): Promise<{ success: boolean; method: 'web_share' | 'wa_link' }> {
    const settings = this.getSettings();
    const phone = (overridePhone || settings.phoneNumber || '').trim().replace(/[^0-9]/g, '');
    const summaryText = this.generateStructuredSummary(customers, transactions);

    // 1. Generate Master PDF
    const report = await generateMasterPDFReport(customers, transactions);

    // 2. Try Web Share API (Supported on mobile Chrome/Safari, Android, iOS to directly send PDF to WhatsApp)
    let sharedViaFile = false;
    try {
      const pdfFile = new File([report.blob], report.fileName, { type: 'application/pdf' });
      if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        await navigator.share({
          files: [pdfFile],
          title: report.title,
          text: summaryText
        });
        sharedViaFile = true;
        return { success: true, method: 'web_share' };
      }
    } catch (shareErr: any) {
      // User cancelled share or file sharing rejected, fall back to link
      if (shareErr.name === 'AbortError') {
        return { success: false, method: 'web_share' };
      }
      console.warn('Web Share API file share failed, falling back to WhatsApp link:', shareErr);
    }

    // 3. Fallback: Trigger download of PDF and open wa.me link with complete structured message
    if (settings.autoDownloadPDF) {
      const url = URL.createObjectURL(report.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = report.fileName;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 300);
    }

    const encodedText = encodeURIComponent(summaryText);
    const targetUrl = phone 
      ? `https://api.whatsapp.com/send?phone=${phone}&text=${encodedText}`
      : `https://api.whatsapp.com/send?text=${encodedText}`;

    window.open(targetUrl, '_blank', 'noopener,noreferrer');
    return { success: true, method: 'wa_link' };
  }
};
