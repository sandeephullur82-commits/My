import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { Customer, Transaction } from '../services/firestoreService';
import { safeFormat } from '../lib/utils';
import { isAndroidApp, downloadFileForAndroid } from './capacitorDeviceHelper';

export interface MasterExportMetrics {
  totalCustomers: number;
  activeCustomers: number;
  overdueCustomers: number;
  settledCustomers: number;
  totalLoansDisbursed: number;
  totalCollected: number;
  totalPending: number;
  totalCash: number;
  totalPhonePe: number;
  totalUnsettledAmount: number;
  totalTransactions: number;
  paidTransactionsCount: number;
  recoveryRatePercent: string;
}

export function calculateMasterMetrics(
  customers: Customer[],
  transactions: Transaction[]
): MasterExportMetrics {
  const activeCusts = customers.filter(c => !c.isDeleted);
  const activeTxs = transactions.filter(t => !t.isDeleted);

  let totalLoansDisbursed = 0;
  let totalPending = 0;
  let overdueCustomers = 0;
  let settledCustomers = 0;

  activeCusts.forEach(c => {
    const loan = c.loanAmount || c.loan || 0;
    const paid = c.paid || 0;
    const pending = c.pending !== undefined ? c.pending : Math.max(0, loan - paid);
    
    totalLoansDisbursed += loan;
    totalPending += pending;

    const isOverdue = c.endDate < Date.now() && pending > 0;
    if (pending <= 0) {
      settledCustomers++;
    } else if (isOverdue) {
      overdueCustomers++;
    }
  });

  const activeCustomersCount = activeCusts.length - settledCustomers;

  let totalCollected = 0;
  let totalCash = 0;
  let totalPhonePe = 0;
  let totalUnsettledAmount = 0;
  let paidTransactionsCount = 0;

  activeTxs.forEach(t => {
    if (t.status === 'paid') {
      paidTransactionsCount++;
      totalCollected += t.amount || 0;
      if (t.type === 'cash') totalCash += t.amount || 0;
      else if (t.type === 'phonepe') totalPhonePe += t.amount || 0;
    } else if (t.status === 'unsettled' || t.type === 'unsettled' || t.type === 'NP') {
      totalUnsettledAmount += t.amount || 0;
    }
  });

  const recoveryRate = totalLoansDisbursed > 0 
    ? ((totalCollected / totalLoansDisbursed) * 100).toFixed(1)
    : '0.0';

  return {
    totalCustomers: activeCusts.length,
    activeCustomers: activeCustomersCount,
    overdueCustomers,
    settledCustomers,
    totalLoansDisbursed,
    totalCollected,
    totalPending,
    totalCash,
    totalPhonePe,
    totalUnsettledAmount,
    totalTransactions: activeTxs.length,
    paidTransactionsCount,
    recoveryRatePercent: `${recoveryRate}%`
  };
}

/**
 * Triggers a client-side file download
 */
function downloadFile(blob: Blob, fileName: string) {
  if (isAndroidApp()) {
    downloadFileForAndroid(blob, fileName, 'Master Excel Workbook');
    return;
  }
  // Standard web download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

/**
 * Generates and downloads the comprehensive multi-sheet Excel Workbook (.xlsx)
 */
export async function exportMasterToExcel(
  customers: Customer[],
  transactions: Transaction[]
): Promise<string> {
  const metrics = calculateMasterMetrics(customers, transactions);
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const nowFormatted = format(new Date(), 'dd MMM yyyy, hh:mm a');
  const customerMap = new Map<string, Customer>();
  customers.forEach(c => customerMap.set(c.id, c));

  // 1. Executive Summary Sheet Data
  const summaryRows = [
    { "Category": "Report Header", "Metric": "Application Name", "Value": "Pigmy Pro Finance" },
    { "Category": "Report Header", "Metric": "Report Type", "Value": "Entire Application Master Financial Export" },
    { "Category": "Report Header", "Metric": "Generated Timestamp", "Value": nowFormatted },
    { "Category": "Report Header", "Metric": "Scope", "Value": "All Customers, All Transactions & System History" },
    { "Category": "Overview", "Metric": "Total Registered Borrowers", "Value": metrics.totalCustomers },
    { "Category": "Overview", "Metric": "Active Loan Accounts", "Value": metrics.activeCustomers },
    { "Category": "Overview", "Metric": "Overdue Loan Accounts", "Value": metrics.overdueCustomers },
    { "Category": "Overview", "Metric": "Fully Settled Accounts", "Value": metrics.settledCustomers },
    { "Category": "Financials", "Metric": "Total Loan Book Value (Disbursed)", "Value": `₹${metrics.totalLoansDisbursed.toLocaleString('en-IN')}` },
    { "Category": "Financials", "Metric": "Total Recovered / Collected", "Value": `₹${metrics.totalCollected.toLocaleString('en-IN')}` },
    { "Category": "Financials", "Metric": "Total Outstanding / Pending Balance", "Value": `₹${metrics.totalPending.toLocaleString('en-IN')}` },
    { "Category": "Financials", "Metric": "Portfolio Recovery Rate", "Value": metrics.recoveryRatePercent },
    { "Category": "Payment Modes", "Metric": "Total Cash Collections", "Value": `₹${metrics.totalCash.toLocaleString('en-IN')}` },
    { "Category": "Payment Modes", "Metric": "Total PhonePe / UPI Collections", "Value": `₹${metrics.totalPhonePe.toLocaleString('en-IN')}` },
    { "Category": "Payment Modes", "Metric": "Total Unsettled (NP) Recorded", "Value": `₹${metrics.totalUnsettledAmount.toLocaleString('en-IN')}` },
    { "Category": "Activity", "Metric": "Total Recorded Transactions", "Value": metrics.totalTransactions },
    { "Category": "Activity", "Metric": "Total Successful Paid Entries", "Value": metrics.paidTransactionsCount }
  ];

  // 2. Customer Master Sheet Data
  const customerRows = customers
    .filter(c => !c.isDeleted)
    .sort((a, b) => {
      const idA = a.displayId || a.id;
      const idB = b.displayId || b.id;
      return String(idA).localeCompare(String(idB), undefined, { numeric: true });
    })
    .map(c => {
      const loan = c.loanAmount || c.loan || 0;
      const paid = c.paid || 0;
      const pending = c.pending !== undefined ? c.pending : Math.max(0, loan - paid);
      const isOverdue = c.endDate < Date.now() && pending > 0;
      const isSettled = pending <= 0;
      const status = isSettled ? 'Fully Settled' : isOverdue ? 'Overdue' : 'Active';

      return {
        "Customer ID": c.id,
        "Display ID": c.displayId || c.id,
        "Customer Name": c.name,
        "Phone Number": c.phone || '—',
        "Loan Amount (₹)": loan,
        "Total Paid (₹)": paid,
        "Pending Balance (₹)": pending,
        "Status": status,
        "Duration (Days)": c.durationDays || (c.startDate && c.endDate ? Math.max(1, Math.round((c.endDate - c.startDate) / 86400000)) : '—'),
        "Frequency": c.frequency || (c.frequencyDays ? `${c.frequencyDays}d` : 'Daily'),
        "Start Date": c.startDate ? format(new Date(c.startDate), 'yyyy-MM-dd') : '—',
        "Maturity Date": c.endDate ? format(new Date(c.endDate), 'yyyy-MM-dd') : '—',
        "Pinned": c.isPinned ? 'Yes' : 'No',
        "Notes": c.notes || ''
      };
    });

  // 3. Transactions Ledger Sheet Data
  const sortedTransactions = [...transactions]
    .filter(t => !t.isDeleted)
    .sort((a, b) => b.timestamp - a.timestamp);

  const transactionRows = sortedTransactions.map(t => {
    const cust = customerMap.get(t.customerId);
    const dateFormatted = t.date || (t.timestamp ? format(new Date(t.timestamp), 'yyyy-MM-dd') : '—');
    const timeFormatted = t.timestamp ? format(new Date(t.timestamp), 'hh:mm:ss a') : '—';
    const modeFormatted = t.type === 'phonepe' ? 'PhonePe / UPI' : t.type === 'cash' ? 'Cash' : String(t.type).toUpperCase();
    const statusFormatted = t.status === 'paid' ? 'Paid' : t.status === 'unsettled' ? 'Unsettled (NP)' : String(t.status || 'Pending');

    return {
      "Transaction ID": t.id,
      "Date": dateFormatted,
      "Time": timeFormatted,
      "Customer Display ID": cust?.displayId || cust?.id || t.customerId,
      "Customer Name": cust?.name || 'Unknown Borrower',
      "Phone": cust?.phone || '—',
      "Amount (₹)": t.amount,
      "Payment Mode": modeFormatted,
      "Collection Status": statusFormatted,
      "Notes / Reference": t.notes || ''
    };
  });

  // 4. Audit Trail & Changes Sheet Data
  const auditRows: any[] = [];
  sortedTransactions.forEach(t => {
    if (t.history && Array.isArray(t.history) && t.history.length > 0) {
      const cust = customerMap.get(t.customerId);
      t.history.forEach((h, idx) => {
        auditRows.push({
          "Audit ID": `${t.id}-${idx + 1}`,
          "Timestamp": h.timestamp ? format(new Date(h.timestamp), 'yyyy-MM-dd hh:mm a') : '—',
          "Transaction ID": t.id,
          "Customer Name": cust?.name || 'Unknown Borrower',
          "Action": h.action || 'Modification',
          "Old Value": typeof h.oldValue === 'object' ? JSON.stringify(h.oldValue) : String(h.oldValue ?? '—'),
          "New Value": typeof h.newValue === 'object' ? JSON.stringify(h.newValue) : String(h.newValue ?? '—')
        });
      });
    }
  });

  // Create Workbook
  const wb = XLSX.utils.book_new();

  // Sheet 1: Executive Summary
  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 18 }, { wch: 38 }, { wch: 28 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, "Executive Summary");

  // Sheet 2: Customers Master
  const wsCustomers = XLSX.utils.json_to_sheet(customerRows);
  wsCustomers['!cols'] = [
    { wch: 24 }, { wch: 14 }, { wch: 26 }, { wch: 16 },
    { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 16 },
    { wch: 15 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
    { wch: 10 }, { wch: 25 }
  ];
  XLSX.utils.book_append_sheet(wb, wsCustomers, "Customer Master");

  // Sheet 3: Transactions Ledger
  const wsTransactions = XLSX.utils.json_to_sheet(transactionRows);
  wsTransactions['!cols'] = [
    { wch: 24 }, { wch: 14 }, { wch: 14 }, { wch: 20 },
    { wch: 26 }, { wch: 16 }, { wch: 14 }, { wch: 18 },
    { wch: 18 }, { wch: 25 }
  ];
  XLSX.utils.book_append_sheet(wb, wsTransactions, "Transactions Ledger");

  // Sheet 4: Audit Trail (if exists or template)
  if (auditRows.length > 0) {
    const wsAudit = XLSX.utils.json_to_sheet(auditRows);
    wsAudit['!cols'] = [
      { wch: 20 }, { wch: 22 }, { wch: 24 }, { wch: 24 },
      { wch: 20 }, { wch: 25 }, { wch: 25 }
    ];
    XLSX.utils.book_append_sheet(wb, wsAudit, "Audit Trail");
  }

  const fileName = `PigmyPro_Master_Data_${todayStr}.xlsx`;
  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
  downloadFile(blob, fileName);

  return fileName;
}

/**
 * Generates the official, high-fidelity PDF Master Report for the entire application.
 * Returns { blob, fileName, title } for instant download or previewing via PDFViewerModal.
 */
export async function generateMasterPDFReport(
  customers: Customer[],
  transactions: Transaction[],
  options: { userEmail?: string } = {}
): Promise<{ blob: Blob; fileName: string; title: string }> {
  const metrics = calculateMasterMetrics(customers, transactions);
  const now = new Date();
  const todayStr = format(now, 'yyyy-MM-dd');
  const generationTimestamp = format(now, 'dd MMM yyyy, hh:mm:ss a');
  const reportDocId = `MSTR-${format(now, 'yyyyMMdd')}-${Math.floor(1000 + Math.random() * 9000)}`;

  // Landscape A4 for wide table presentation
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const customerMap = new Map<string, Customer>();
  customers.forEach(c => customerMap.set(c.id, c));

  // --- BRAND HEADER ---
  doc.setFillColor(15, 23, 42); // Slate-900
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Title & Subtitle
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('PIGMY PRO FINANCIAL SYSTEM', 14, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184); // Slate-400
  doc.text('MASTER APPLICATION & FINANCIAL AUDIT STATEMENT (100% COMPLETE DATA)', 14, 18);

  // Top-Right Doc Meta
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text(`DOC REF: ${reportDocId}`, pageWidth - 14, 10, { align: 'right' });
  doc.setTextColor(148, 163, 184);
  doc.text(`Generated: ${generationTimestamp}`, pageWidth - 14, 16, { align: 'right' });
  if (options.userEmail) {
    doc.text(`Audited By: ${options.userEmail}`, pageWidth - 14, 22, { align: 'right' });
  }

  // --- EXECUTIVE SUMMARY KPI BOXES ---
  let currentY = 34;

  const cardWidth = (pageWidth - 28 - (3 * 4)) / 4;
  const cardHeight = 16;
  const cards = [
    { label: 'TOTAL LOAN DISBURSED', val: `Rs. ${metrics.totalLoansDisbursed.toLocaleString('en-IN')}`, color: [30, 41, 59] },
    { label: 'TOTAL COLLECTED TO DATE', val: `Rs. ${metrics.totalCollected.toLocaleString('en-IN')}`, color: [16, 185, 129] },
    { label: 'TOTAL OUTSTANDING (DUE)', val: `Rs. ${metrics.totalPending.toLocaleString('en-IN')}`, color: [239, 68, 68] },
    { label: 'RECOVERY RATE', val: `${metrics.recoveryRatePercent} (${metrics.settledCustomers} Settled)`, color: [99, 102, 241] }
  ];

  cards.forEach((card, idx) => {
    const x = 14 + idx * (cardWidth + 4);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, currentY, cardWidth, cardHeight, 2, 2, 'FD');

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text(card.label, x + 4, currentY + 5);

    doc.setFontSize(10.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(card.color[0], card.color[1], card.color[2]);
    doc.text(card.val, x + 4, currentY + 12);
  });

  currentY += cardHeight + 6;

  // Secondary Micro KPI bar (Modes & counts)
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(14, currentY, pageWidth - 28, 7, 1.5, 1.5, 'F');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  doc.text(
    `Borrowers: ${metrics.totalCustomers} (${metrics.activeCustomers} Active, ${metrics.overdueCustomers} Overdue)  |  Transactions: ${metrics.totalTransactions}  |  Cash: Rs. ${metrics.totalCash.toLocaleString('en-IN')}  |  PhonePe / UPI: Rs. ${metrics.totalPhonePe.toLocaleString('en-IN')}  |  Unsettled: Rs. ${metrics.totalUnsettledAmount.toLocaleString('en-IN')}`,
    pageWidth / 2,
    currentY + 4.8,
    { align: 'center' }
  );

  currentY += 12;

  // --- SECTION 1: CUSTOMERS MASTER TABLE ---
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('1. COMPLETE CUSTOMER MASTER & LOAN ACCOUNTS', 14, currentY);
  currentY += 3;

  const customerRows = customers
    .filter(c => !c.isDeleted)
    .sort((a, b) => {
      const idA = a.displayId || a.id;
      const idB = b.displayId || b.id;
      return String(idA).localeCompare(String(idB), undefined, { numeric: true });
    })
    .map(c => {
      const loan = c.loanAmount || c.loan || 0;
      const paid = c.paid || 0;
      const pending = c.pending !== undefined ? c.pending : Math.max(0, loan - paid);
      const isOverdue = c.endDate < Date.now() && pending > 0;
      const isSettled = pending <= 0;
      const status = isSettled ? 'SETTLED' : isOverdue ? 'OVERDUE' : 'ACTIVE';
      const duration = c.durationDays || (c.startDate && c.endDate ? Math.max(1, Math.round((c.endDate - c.startDate) / 86400000)) : '—');

      return [
        c.displayId || c.id.slice(0, 8),
        c.name,
        c.phone || '—',
        `Rs. ${loan.toLocaleString('en-IN')}`,
        `Rs. ${paid.toLocaleString('en-IN')}`,
        `Rs. ${pending.toLocaleString('en-IN')}`,
        `${duration}d (${c.frequency || 'Daily'})`,
        c.startDate ? format(new Date(c.startDate), 'dd/MM/yy') : '—',
        c.endDate ? format(new Date(c.endDate), 'dd/MM/yy') : '—',
        status
      ];
    });

  autoTable(doc, {
    startY: currentY,
    head: [['ID', 'Customer Name', 'Phone', 'Loan', 'Total Paid', 'Pending Balance', 'Frequency', 'Start', 'Maturity', 'Status']],
    body: customerRows,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'left',
      cellPadding: 2
    },
    styles: {
      fontSize: 7,
      cellPadding: 2,
      textColor: [30, 41, 59],
      overflow: 'linebreak'
    },
    columnStyles: {
      0: { cellWidth: 16, fontStyle: 'bold' },
      1: { cellWidth: 44, fontStyle: 'bold' },
      2: { cellWidth: 26 },
      3: { cellWidth: 24, halign: 'right' },
      4: { cellWidth: 24, halign: 'right', textColor: [16, 185, 129] },
      5: { cellWidth: 24, halign: 'right', fontStyle: 'bold', textColor: [239, 68, 68] },
      6: { cellWidth: 24 },
      7: { cellWidth: 20 },
      8: { cellWidth: 20 },
      9: { cellWidth: 22, halign: 'center', fontStyle: 'bold' }
    },
    margin: { left: 14, right: 14 },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 9) {
        if (data.cell.raw === 'SETTLED') {
          data.cell.styles.textColor = [16, 185, 129];
        } else if (data.cell.raw === 'OVERDUE') {
          data.cell.styles.textColor = [239, 68, 68];
        } else {
          data.cell.styles.textColor = [59, 130, 246];
        }
      }
    }
  });

  // --- SECTION 2: TRANSACTIONS LEDGER TABLE (Starts on new page) ---
  doc.addPage();
  currentY = 20;

  // Header for Ledger page
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('2. COMPLETE CHRONOLOGICAL TRANSACTIONS LEDGER', 14, currentY);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Total Records: ${transactions.length} entries  |  Verified Ledger`, 14, currentY + 5);
  currentY += 9;

  const sortedTransactions = [...transactions]
    .filter(t => !t.isDeleted)
    .sort((a, b) => b.timestamp - a.timestamp);

  const transactionRows = sortedTransactions.map(t => {
    const cust = customerMap.get(t.customerId);
    const dateFormatted = t.date || (t.timestamp ? format(new Date(t.timestamp), 'yyyy-MM-dd') : '—');
    const timeFormatted = t.timestamp ? format(new Date(t.timestamp), 'hh:mm a') : '—';
    const mode = t.type === 'phonepe' ? 'PhonePe' : t.type === 'cash' ? 'Cash' : String(t.type).toUpperCase();
    const status = t.status === 'paid' ? 'PAID' : t.status === 'unsettled' ? 'UNSETTLED' : String(t.status || 'PENDING').toUpperCase();

    return [
      dateFormatted,
      timeFormatted,
      t.id.slice(0, 10),
      cust?.displayId || cust?.id.slice(0, 6) || '—',
      cust?.name || 'Unknown Borrower',
      mode,
      status,
      t.notes || '—',
      `Rs. ${t.amount.toLocaleString('en-IN')}`
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [['Date', 'Time', 'Ref ID', 'Cust ID', 'Customer Name', 'Mode', 'Status', 'Notes', 'Amount']],
    body: transactionRows,
    theme: 'striped',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'left',
      cellPadding: 2
    },
    styles: {
      fontSize: 7,
      cellPadding: 2,
      textColor: [30, 41, 59]
    },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 18 },
      2: { cellWidth: 22, fontStyle: 'bold' },
      3: { cellWidth: 18 },
      4: { cellWidth: 50, fontStyle: 'bold' },
      5: { cellWidth: 22 },
      6: { cellWidth: 24, halign: 'center', fontStyle: 'bold' },
      7: { cellWidth: 46 },
      8: { cellWidth: 26, halign: 'right', fontStyle: 'bold', textColor: [15, 23, 42] }
    },
    margin: { left: 14, right: 14 },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 6) {
        if (data.cell.raw === 'PAID') {
          data.cell.styles.textColor = [16, 185, 129];
        } else {
          data.cell.styles.textColor = [239, 68, 68];
        }
      }
    }
  });

  // --- FOOTER ON ALL PAGES ---
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text('Pigmy Pro Financial System • Confidential Official Record • Tamper-Evident Export', 14, pageHeight - 7);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - 14, pageHeight - 7, { align: 'right' });
  }

  const fileName = `PigmyPro_Master_Report_${todayStr}.pdf`;
  const pdfBlob = doc.output('blob');

  return {
    blob: pdfBlob,
    fileName,
    title: 'Master Application Data & Financial Report'
  };
}
