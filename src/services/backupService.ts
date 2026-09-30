import * as XLSX from 'xlsx';
import { db, auth } from '../lib/firebase';
import { 
  collection, getDocs 
} from 'firebase/firestore';
import { Customer, Transaction } from './firestoreService';

export interface ExportSummary {
  customers: number;
  transactions: number;
  totalCash: number;
  totalPhonePe: number;
  totalPending: number;
}

export interface StandardCustomer {
  id: string;
  name: string;
  phone: string;
  loan: number;
  paid: number;
  pending: number;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  createdDate: string; // ISO
  notes: string;
}

export interface StandardTransaction {
  id: string;
  date: string; // YYYY-MM-DD
  customerId: string;
  customerName: string;
  amount: number;
  type: 'cash' | 'phonepe' | 'unsettled';
  status: 'paid' | 'pending' | 'unsettled';
  createdAt?: string;
}

export interface BackupPayload {
  app: string;
  version: string;
  exportedAt: string;
  userId: string;
  summary: ExportSummary;
  customers: StandardCustomer[];
  transactions: StandardTransaction[];
}

// Helper utilities
function parseNumber(val: any): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return val;
  const str = String(val).replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
}

function formatDateString(dateVal: any): string {
  if (!dateVal) return '';
  if (typeof dateVal === 'number') {
    // Check if Excel serial date
    if (dateVal > 30000 && dateVal < 60000) {
      const d = new Date((dateVal - 25569) * 86400 * 1000);
      return d.toISOString().slice(0, 10);
    }
    // Assume timestamp
    return new Date(dateVal).toISOString().slice(0, 10);
  }
  const str = String(dateVal).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const parsed = Date.parse(str);
  if (!isNaN(parsed)) return new Date(parsed).toISOString().slice(0, 10);
  return '';
}

function formatISOString(dateVal: any): string {
  if (!dateVal) return new Date().toISOString();
  if (typeof dateVal === 'number') {
    if (dateVal > 30000 && dateVal < 60000) {
      return new Date((dateVal - 25569) * 86400 * 1000).toISOString();
    }
    return new Date(dateVal).toISOString();
  }
  const str = String(dateVal).trim();
  const parsed = Date.parse(str);
  if (!isNaN(parsed)) return new Date(parsed).toISOString();
  return new Date().toISOString();
}

function triggerDownload(content: string | ArrayBuffer, fileName: string, contentType: string) {
  const blob = content instanceof ArrayBuffer 
    ? new Blob([content], { type: contentType }) 
    : new Blob([content], { type: `${contentType};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.setAttribute('download', fileName);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export const backupService = {
  /**
   * Fetches active user data and returns a consolidated BackupPayload
   */
  async prepareBackupData(): Promise<BackupPayload> {
    const user = auth.currentUser;
    if (!user) throw new Error('You must be logged in to export data.');

    const uid = user.uid;

    // Fetch customers
    const custSnap = await getDocs(collection(db, 'users', uid, 'customers'));
    const rawCustomers = custSnap.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as Customer))
      .filter(c => !c.isDeleted);

    // Fetch entries (transactions)
    const txSnap = await getDocs(collection(db, 'users', uid, 'entries'));
    const rawTransactions = txSnap.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as Transaction))
      .filter(t => !t.isDeleted);

    // Build customer name map for rich transactions view
    const customerMap = new Map<string, string>();
    rawCustomers.forEach(c => customerMap.set(c.id, c.name));

    // Convert to standard structured export formats (no Timestamp objects)
    const customers: StandardCustomer[] = rawCustomers.map(c => {
      let createdStr = '';
      if (c.createdAt) {
        if (typeof c.createdAt.toDate === 'function') {
          createdStr = c.createdAt.toDate().toISOString();
        } else if (c.createdAt.seconds !== undefined) {
          createdStr = new Date(c.createdAt.seconds * 1000).toISOString();
        } else {
          createdStr = new Date(c.createdAt).toISOString();
        }
      } else {
        createdStr = new Date().toISOString();
      }

      return {
        "id": c.id,
        "name": c.name || '',
        "phone": c.phone || '',
        "loan": Number(c.loan || 0),
        "paid": Number(c.paid || 0),
        "pending": Number(c.pending || 0),
        "startDate": c.startDate ? new Date(c.startDate).toISOString().slice(0, 10) : '',
        "endDate": c.endDate ? new Date(c.endDate).toISOString().slice(0, 10) : '',
        "createdDate": createdStr,
        "notes": c.notes || ''
      };
    });

    const transactions: StandardTransaction[] = rawTransactions.map(t => {
      return {
        "id": t.id,
        "date": t.date || new Date(t.timestamp).toISOString().slice(0, 10),
        "customerId": t.customerId,
        "customerName": customerMap.get(t.customerId) || 'Unknown Customer',
        "amount": Number(t.amount || 0),
        "type": t.type || 'cash',
        "status": t.status || 'paid',
        "createdAt": t.createdAt ? (typeof t.createdAt.toDate === 'function' ? t.createdAt.toDate().toISOString() : new Date(t.createdAt).toISOString()) : new Date(t.timestamp).toISOString()
      };
    });

    // Compute live export summaries
    let totalCash = 0;
    let totalPhonePe = 0;
    let totalPending = 0;

    transactions.forEach(t => {
      if (t.status === 'paid') {
        if (t.type === 'phonepe') totalPhonePe += t.amount;
        else totalCash += t.amount;
      } else if (t.status === 'pending') {
        totalPending += t.amount;
      }
    });

    const summary: ExportSummary = {
      customers: customers.length,
      transactions: transactions.length,
      totalCash,
      totalPhonePe,
      totalPending
    };

    return {
      app: "Pigmy Pro",
      version: "2.0",
      exportedAt: new Date().toISOString(),
      userId: uid,
      summary,
      customers,
      transactions
    };
  },

  /**
   * JSON Export
   */
  async exportToJSON() {
    try {
      const data = await this.prepareBackupData();
      const stringified = JSON.stringify(data, null, 2);
      const fileName = `PigmyPro_Backup_${new Date().toISOString().slice(0, 10)}.json`;
      triggerDownload(stringified, fileName, 'application/json');
      return true;
    } catch (err: any) {
      console.error('JSON export error:', err);
      throw new Error(`Export Failed: ${err.message}`);
    }
  },

  /**
   * CSV Export downloads separate customers.csv and transactions.csv files
   */
  async exportToCSV() {
    try {
      const data = await this.prepareBackupData();
      
      // Map JSON properties to readable CSV headers (matching spec)
      const mappedCustomers = data.customers.map(c => ({
        "Customer ID": c.id,
        "Name": c.name,
        "Phone": c.phone,
        "Loan Amount": c.loan,
        "Paid Amount": c.paid,
        "Pending Amount": c.pending,
        "Start Date": c.startDate,
        "End Date": c.endDate,
        "Created Date": c.createdDate,
        "Notes": c.notes
      }));

      const mappedTransactions = data.transactions.map(t => ({
        "Transaction ID": t.id,
        "Date": t.date,
        "Customer ID": t.customerId,
        "Customer Name": t.customerName,
        "Amount": t.amount,
        "Type": t.type === 'cash' ? 'Cash' : t.type === 'phonepe' ? 'PhonePe' : 'Unsettled',
        "Status": t.status === 'paid' ? 'Paid' : t.status === 'pending' ? 'Pending' : 'Unsettled'
      }));

      // Generate CSVs using SheetJS
      const wc = XLSX.utils.json_to_sheet(mappedCustomers);
      const csvCust = XLSX.utils.sheet_to_csv(wc);
      triggerDownload(csvCust, `customers_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv');

      // Short delay to avoid browser blocking multiple downloads
      await new Promise(resolve => setTimeout(resolve, 300));

      const wt = XLSX.utils.json_to_sheet(mappedTransactions);
      const csvTx = XLSX.utils.sheet_to_csv(wt);
      triggerDownload(csvTx, `transactions_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv');

      return true;
    } catch (err: any) {
      console.error('CSV export error:', err);
      throw new Error(`CSV Export Failed: ${err.message}`);
    }
  },

  /**
   * Excel Multi-Sheet Export
   */
  async exportToExcel() {
    try {
      const data = await this.prepareBackupData();

      // Style structure
      const mappedCustomers = data.customers.map(c => ({
        "Customer ID": c.id,
        "Name": c.name,
        "Phone": c.phone,
        "Loan Amount": c.loan,
        "Paid Amount": c.paid,
        "Pending Amount": c.pending,
        "Start Date": c.startDate,
        "End Date": c.endDate,
        "Created Date": c.createdDate,
        "Notes": c.notes
      }));

      const mappedTransactions = data.transactions.map(t => ({
        "Transaction ID": t.id,
        "Date": t.date,
        "Customer ID": t.customerId,
        "Customer Name": t.customerName,
        "Amount": t.amount,
        "Type": t.type === 'cash' ? 'Cash' : t.type === 'phonepe' ? 'PhonePe' : 'Unsettled',
        "Status": t.status === 'paid' ? 'Paid' : t.status === 'pending' ? 'Pending' : 'Unsettled'
      }));

      const summaryData = [
        { "Metric": "Total Customers", "Value": data.summary.customers },
        { "Metric": "Total Transactions", "Value": data.summary.transactions },
        { "Metric": "Total Cash Payment", "Value": data.summary.totalCash },
        { "Metric": "Total PhonePe Payment", "Value": data.summary.totalPhonePe },
        { "Metric": "Total Pending Installments", "Value": data.summary.totalPending },
        { "Metric": "Exported At", "Value": data.exportedAt }
      ];

      // WorkBook setup
      const wb = XLSX.utils.book_new();

      // Sheet 1: Customers
      const wsCustomers = XLSX.utils.json_to_sheet(mappedCustomers);
      XLSX.utils.book_append_sheet(wb, wsCustomers, "Customers");

      // Sheet 2: Transactions
      const wsTransactions = XLSX.utils.json_to_sheet(mappedTransactions);
      XLSX.utils.book_append_sheet(wb, wsTransactions, "Transactions");

      // Sheet 3: Summary
      const wsSummary = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

      // Write and download
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      triggerDownload(excelBuffer, `PigmyPro_Backup_${new Date().toISOString().slice(0, 10)}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

      return true;
    } catch (err: any) {
      console.error('Excel export error:', err);
      throw new Error(`Excel Export Failed: ${err.message}`);
    }
  }
};
