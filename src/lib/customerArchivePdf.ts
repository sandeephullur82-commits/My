import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { Customer, Transaction } from '../services/firestoreService';
import { safeFormat } from './utils';
import { downloadFileForAndroid } from '../utils/capacitorDeviceHelper';

export interface CustomerArchivePDFResult {
  doc: jsPDF;
  blob: Blob;
  fileName: string;
}

/**
 * Generates an official, comprehensive statutory archive PDF containing
 * the complete identity, financial status, cycle history, and transaction ledger
 * of a customer prior to permanent deletion from Firebase collections.
 */
export async function generateCustomerArchivePDF(
  customer: Customer,
  transactions: Transaction[]
): Promise<CustomerArchivePDFResult> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const now = new Date();
  const generationTimestamp = format(now, 'dd MMM yyyy, hh:mm:ss a');
  const archiveRefId = `ARCH-${customer.id}-${format(now, 'yyyyMMdd_HHmmss')}`;

  const loanAmount = customer.loanAmount || customer.loan || 0;
  const paidAmount = customer.paid || 0;
  const pendingAmount = customer.pending !== undefined ? customer.pending : Math.max(0, loanAmount - paidAmount);

  // Filter and sort transactions belonging to this customer
  const customerTxs = (transactions || [])
    .filter(t => t.customerId === customer.id && !t.isDeleted)
    .sort((a, b) => {
      const timeA = a.timestamp || new Date(a.date).getTime() || 0;
      const timeB = b.timestamp || new Date(b.date).getTime() || 0;
      return timeA - timeB; // Chronological order for complete ledger audit
    });

  let totalCash = 0;
  let totalUPI = 0;
  let totalUnsettled = 0;
  let totalCollected = 0;

  customerTxs.forEach(tx => {
    if (tx.status === 'unsettled') {
      totalUnsettled += tx.amount || 0;
    } else if (tx.type === 'phonepe') {
      totalUPI += tx.amount || 0;
      totalCollected += tx.amount || 0;
    } else {
      totalCash += tx.amount || 0;
      totalCollected += tx.amount || 0;
    }
  });

  // --- BRAND HEADER ---
  // Slate 900 Banner
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 32, 'F');

  // Primary Accent Line (Blue 600)
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 32, pageWidth, 2.5, 'F');

  // App Name & Subtitle
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(255, 255, 255);
  doc.text('PIGMY COLLECTOR', 14, 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184); // Slate 400
  doc.text('Daily Deposit & Microfinance Ledger Management System', 14, 20);
  doc.text('Statutory Customer Pre-Deletion Permanent Data Archive', 14, 25);

  // Right-side badge
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(239, 68, 68); // Red 500
  doc.text('PERMANENT DELETION ARCHIVE', pageWidth - 14, 13, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(203, 213, 225);
  doc.text(`Ref: ${archiveRefId}`, pageWidth - 14, 18, { align: 'right' });
  doc.text(`Archived: ${generationTimestamp}`, pageWidth - 14, 23, { align: 'right' });
  doc.text(`Account ID: ${customer.id}`, pageWidth - 14, 28, { align: 'right' });

  let cursorY = 41;

  // Document Heading
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text('CUSTOMER MASTER ARCHIVE RECORD', 14, cursorY);

  cursorY += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'This document contains the complete customer profile, financial parameters, and transaction ledger archived immediately before permanent removal from Firebase.',
    14,
    cursorY
  );

  cursorY += 6;

  // --- FINANCIAL STAT CARDS (4-Column) ---
  const cardWidth = (pageWidth - 28 - 9) / 4;
  const cardHeight = 16;

  // Card 1: Principal / Target
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(14, cursorY, cardWidth, cardHeight, 2, 2, 'F');
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('LOAN PRINCIPAL', 18, cursorY + 5);
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`INR ${loanAmount.toLocaleString('en-IN')}`, 18, cursorY + 11.5);

  // Card 2: Total Paid / Collected
  const card2X = 14 + cardWidth + 3;
  doc.setFillColor(236, 253, 245); // Emerald 50
  doc.roundedRect(card2X, cursorY, cardWidth, cardHeight, 2, 2, 'F');
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(16, 185, 129); // Emerald 600
  doc.text('TOTAL PAID', card2X + 4, cursorY + 5);
  doc.setFontSize(10.5);
  doc.setTextColor(6, 95, 70);
  doc.text(`INR ${paidAmount.toLocaleString('en-IN')}`, card2X + 4, cursorY + 11.5);

  // Card 3: Pending Balance
  const card3X = card2X + cardWidth + 3;
  doc.setFillColor(254, 242, 242);
  doc.roundedRect(card3X, cursorY, cardWidth, cardHeight, 2, 2, 'F');
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(239, 68, 68);
  doc.text('PENDING BALANCE', card3X + 4, cursorY + 5);
  doc.setFontSize(10.5);
  doc.setTextColor(153, 27, 27);
  doc.text(`INR ${pendingAmount.toLocaleString('en-IN')}`, card3X + 4, cursorY + 11.5);

  // Card 4: Ledger Entries Count
  const card4X = card3X + cardWidth + 3;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(card4X, cursorY, cardWidth, cardHeight, 2, 2, 'F');
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('TOTAL ENTRIES', card4X + 4, cursorY + 5);
  doc.setFontSize(10.5);
  doc.setTextColor(30, 41, 59);
  doc.text(`${customerTxs.length} Transactions`, card4X + 4, cursorY + 11.5);

  cursorY += cardHeight + 6;

  // --- SECTION 1: CUSTOMER PROFILE & KYC SPECIFICATION TABLE ---
  const startDateStr = customer.startDate ? safeFormat(customer.startDate, 'dd MMM yyyy') : 'N/A';
  const endDateStr = customer.endDate ? safeFormat(customer.endDate, 'dd MMM yyyy') : 'N/A';
  const durationStr = customer.durationDays ? `${customer.durationDays} Days` : 'N/A';
  const freqStr = customer.frequency ? customer.frequency.toUpperCase() : 'DAILY';

  const profileRows = [
    [
      { content: 'Customer Name', styles: { fontStyle: 'bold' } },
      customer.name || 'N/A',
      { content: 'Customer ID', styles: { fontStyle: 'bold' } },
      customer.id || 'N/A',
    ],
    [
      { content: 'System ID', styles: { fontStyle: 'bold' } },
      customer.id || 'N/A',
      { content: 'Primary Phone', styles: { fontStyle: 'bold' } },
      customer.phone || 'N/A',
    ],
    [
      { content: 'Account Type', styles: { fontStyle: 'bold' } },
      'Microfinance Daily Loan',
      { content: 'Account Status', styles: { fontStyle: 'bold' } },
      'Active',
    ],
    [
      { content: 'Commencement Date', styles: { fontStyle: 'bold' } },
      startDateStr,
      { content: 'Maturity / End Date', styles: { fontStyle: 'bold' } },
      endDateStr,
    ],
    [
      { content: 'Term & Frequency', styles: { fontStyle: 'bold' } },
      `${durationStr} • ${freqStr}`,
      { content: 'Opening Balance', styles: { fontStyle: 'bold' } },
      customer.hasOpeningBalance ? `INR ${(customer.openingBalance || 0).toLocaleString('en-IN')}` : 'Nil',
    ],
    [
      { content: 'Residential Address', styles: { fontStyle: 'bold' } },
      (customer as any).address || 'Not specified',
      { content: 'Aadhaar / ID', styles: { fontStyle: 'bold' } },
      (customer as any).aadhaar || 'N/A',
    ],
    [
      { content: 'PAN Number', styles: { fontStyle: 'bold' } },
      (customer as any).pan || 'N/A',
      { content: 'Guarantor Details', styles: { fontStyle: 'bold' } },
      (customer as any).guarantorName
        ? `${(customer as any).guarantorName} (${(customer as any).guarantorPhone || 'No phone'})`
        : 'None recorded',
    ],
    [
      { content: 'Notes / Remarks', styles: { fontStyle: 'bold' } },
      { content: customer.notes || 'None recorded', colSpan: 3 },
    ],
  ];

  autoTable(doc, {
    startY: cursorY,
    head: [[{ content: 'CUSTOMER IDENTITY & ACCOUNT SPECIFICATION', colSpan: 4, styles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' } }]],
    body: profileRows as any,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2,
      textColor: [15, 23, 42],
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    columnStyles: {
      0: { cellWidth: 42, fillColor: [248, 250, 252] },
      1: { cellWidth: 50 },
      2: { cellWidth: 42, fillColor: [248, 250, 252] },
      3: { cellWidth: 48 },
    },
    margin: { left: 14, right: 14 },
  });

  cursorY = (doc as any).lastAutoTable.finalY + 6;

  // --- SECTION 3: COMPLETE TRANSACTION LEDGER TABLE ---
  const txTableBody = customerTxs.map((tx, idx) => {
    const dateFormatted = tx.date ? safeFormat(tx.timestamp || tx.date, 'dd/MM/yyyy hh:mm a', tx.date) : 'N/A';
    const modeLabel = tx.type === 'phonepe' ? 'PhonePe / UPI' : (tx.type === 'NP' || tx.type === 'unsettled') ? 'NP / Unsettled' : 'Cash';
    const statusLabel = tx.status === 'unsettled' ? 'UNSETTLED' : 'PAID';

    return [
      String(idx + 1),
      dateFormatted,
      (tx as any).receiptId || tx.id.slice(-8),
      modeLabel,
      `INR ${(tx.amount || 0).toLocaleString('en-IN')}`,
      statusLabel,
      tx.notes || '-',
    ];
  });

  if (txTableBody.length === 0) {
    txTableBody.push([
      '1',
      'N/A',
      'No transactions recorded',
      '-',
      'INR 0',
      '-',
      'No collection entries were logged for this customer account.',
    ]);
  }

  // Add Grand Total row
  txTableBody.push([
    { content: 'GRAND TOTAL', colSpan: 4, styles: { fontStyle: 'bold', halign: 'right', fillColor: [241, 245, 249] } } as any,
    { content: `INR ${totalCollected.toLocaleString('en-IN')}`, styles: { fontStyle: 'bold', fillColor: [236, 253, 245], textColor: [6, 95, 70] } } as any,
    { content: `Unsettled: INR ${totalUnsettled.toLocaleString('en-IN')}`, colSpan: 2, styles: { fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [100, 116, 139] } } as any,
  ]);

  autoTable(doc, {
    startY: cursorY,
    head: [
      [
        { content: `COMPLETE TRANSACTION LEDGER AUDIT (${customerTxs.length} TOTAL RECORDS)`, colSpan: 7, styles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' } },
      ],
      ['#', 'Date & Time', 'Receipt / ID', 'Payment Mode', 'Amount', 'Status', 'Notes / Narration'],
    ],
    body: txTableBody,
    theme: 'striped',
    styles: {
      fontSize: 7.2,
      cellPadding: 2,
      textColor: [15, 23, 42],
      lineColor: [226, 232, 240],
      lineWidth: 0.15,
    },
    headStyles: {
      fillColor: [37, 99, 235], // Blue 600
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 32 },
      2: { cellWidth: 24 },
      3: { cellWidth: 24 },
      4: { cellWidth: 22, fontStyle: 'bold' },
      5: { cellWidth: 18, halign: 'center' },
      6: { cellWidth: 12, halign: 'center' },
      7: { cellWidth: 42 },
    },
    margin: { left: 14, right: 14 },
    showHead: 'everyPage',
  });

  cursorY = (doc as any).lastAutoTable.finalY + 7;

  // --- STATUTORY CERTIFICATION SECTION ---
  if (cursorY > pageHeight - 35) {
    doc.addPage();
    cursorY = 20;
  }

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, cursorY, pageWidth - 28, 20, 2, 2, 'FD');

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('STATUTORY VERIFICATION & PRE-DELETION AUDIT CERTIFICATION', 18, cursorY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `This archive serves as the immutable digital record of ${customer.name} (Account ID: ${customer.id}). All associated ledger lines, daily deposits, and contact information have been preserved in this PDF prior to the permanent deletion of customer documents and collections in Firebase.`,
    18,
    cursorY + 10,
    { maxWidth: pageWidth - 36 }
  );
  doc.text(
    `Archive Hash: ${archiveRefId} | Generated by Pigmy Collector Microfinance Ledger System | Certified Clean Archive`,
    18,
    cursorY + 16
  );

  // --- FOOTER FOR ALL PAGES ---
  const totalPages = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);

    // Bottom border
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(14, pageHeight - 10, pageWidth - 14, pageHeight - 10);

    doc.text(
      `Pigmy Collector • Pre-Deletion Archive Record: ${customer.name} (${customer.id})`,
      14,
      pageHeight - 6
    );
    doc.text(
      `Page ${i} of ${totalPages}`,
      pageWidth - 14,
      pageHeight - 6,
      { align: 'right' }
    );
  }

  const safeName = (customer.name || 'Customer').replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `Customer_Archive_${safeName}_${customer.id}_${format(now, 'yyyyMMdd_HHmmss')}.pdf`;
  const blob = doc.output('blob');

  return { doc, blob, fileName };
}

/**
 * Generates and immediately downloads/saves the complete customer archive PDF.
 * Compatible with mobile Android (Capacitor) and desktop/web browsers.
 */
export async function downloadCustomerArchivePDF(
  customer: Customer,
  transactions: Transaction[]
): Promise<{ blob: Blob; fileName: string }> {
  const result = await generateCustomerArchivePDF(customer, transactions);
  await downloadFileForAndroid(result.blob, result.fileName, `${customer.name} Complete Archive`);
  return { blob: result.blob, fileName: result.fileName };
}
