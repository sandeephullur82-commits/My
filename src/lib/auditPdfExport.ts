import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { Transaction, Customer } from '../services/firestoreService';

export interface AuditReportOptions {
  startDate?: string; // 'YYYY-MM-DD'
  endDate?: string;   // 'YYYY-MM-DD'
  filterMode?: 'ALL' | 'CASH' | 'PHONEPE' | 'UNSETTLED';
  customerId?: string; // 'ALL' or specific customer ID
  generatedBy?: string;
}

/**
 * Generates an official, comprehensive Transaction Audit PDF Report
 * with customizable date ranges, detailed chronological ledger,
 * payment mode breakdowns, financial reconciliation, and audit verification signature section.
 */
export async function generateAuditReportPDF(
  transactions: Transaction[],
  customers: Customer[],
  options: AuditReportOptions = {}
) {
  const {
    startDate,
    endDate,
    filterMode = 'ALL',
    customerId = 'ALL',
    generatedBy = 'Authorized Auditor'
  } = options;

  // Filter out soft-deleted transactions
  let filtered = transactions.filter(t => !t.isDeleted);

  // Apply Date Range
  if (startDate && endDate) {
    filtered = filtered.filter(t => t.date >= startDate && t.date <= endDate);
  } else if (startDate) {
    filtered = filtered.filter(t => t.date >= startDate);
  } else if (endDate) {
    filtered = filtered.filter(t => t.date <= endDate);
  }

  // Apply Payment Mode Filter
  if (filterMode === 'CASH') {
    filtered = filtered.filter(t => t.type === 'cash' && t.status === 'paid');
  } else if (filterMode === 'PHONEPE') {
    filtered = filtered.filter(t => t.type === 'phonepe' && t.status === 'paid');
  } else if (filterMode === 'UNSETTLED') {
    filtered = filtered.filter(t => t.status === 'unsettled');
  }

  // Apply Customer Filter
  if (customerId && customerId !== 'ALL') {
    filtered = filtered.filter(t => t.customerId === customerId);
  }

  // Sort chronological descending (most recent first)
  filtered.sort((a, b) => b.timestamp - a.timestamp);

  // Customer map
  const customerMap = new Map<string, Customer>();
  customers.forEach(c => customerMap.set(c.id, c));

  // Initialize jsPDF (Portrait A4)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const now = new Date();
  const generationTimestamp = format(now, 'dd MMM yyyy, hh:mm:ss a');
  const auditDocId = `AUD-${format(now, 'yyyyMMdd')}-${Math.floor(1000 + Math.random() * 9000)}`;

  // Calculate Metrics
  let totalCash = 0;
  let totalUPI = 0;
  let totalUnsettled = 0;
  let totalCollections = 0;
  const uniqueCustomerIds = new Set<string>();

  filtered.forEach(tx => {
    uniqueCustomerIds.add(tx.customerId);
    if (tx.status === 'unsettled') {
      totalUnsettled += tx.amount;
    } else if (tx.type === 'phonepe') {
      totalUPI += tx.amount;
      totalCollections += tx.amount;
    } else {
      totalCash += tx.amount;
      totalCollections += tx.amount;
    }
  });

  const periodLabel = (startDate && endDate)
    ? `${format(new Date(startDate + 'T00:00:00'), 'dd MMM yyyy')} to ${format(new Date(endDate + 'T00:00:00'), 'dd MMM yyyy')}`
    : startDate
    ? `From ${format(new Date(startDate + 'T00:00:00'), 'dd MMM yyyy')}`
    : endDate
    ? `Up to ${format(new Date(endDate + 'T00:00:00'), 'dd MMM yyyy')}`
    : 'All Time History';

  const singleCustomer = customerId !== 'ALL' ? customerMap.get(customerId) : null;

  // --- BRAND HEADER ---
  // Top Banner
  doc.setFillColor(15, 23, 42); // Slate 900
  doc.rect(0, 0, pageWidth, 32, 'F');

  // Accent Line
  doc.setFillColor(67, 97, 238); // Pigmy Primary Accent
  doc.rect(0, 32, pageWidth, 2, 'F');

  // Company / App Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text('PIGMY COLLECTOR', 14, 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184); // Slate 400
  doc.text('Microfinance Daily Deposit & Digital Ledger Audit', 14, 21);
  doc.text('Statutory & Compliance Financial Verification Statement', 14, 26);

  // Document Badge on Right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('OFFICIAL AUDIT REPORT', pageWidth - 14, 13, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(203, 213, 225);
  doc.text(`Ref ID: ${auditDocId}`, pageWidth - 14, 18, { align: 'right' });
  doc.text(`Generated: ${generationTimestamp}`, pageWidth - 14, 23, { align: 'right' });
  doc.text(`Auditor: ${generatedBy}`, pageWidth - 14, 28, { align: 'right' });

  // --- REPORT SCOPE & PARAMETERS BLOCK ---
  let cursorY = 42;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text('TRANSACTION AUDIT REPORT', 14, cursorY);

  cursorY += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);

  doc.text(`Audit Period: `, 14, cursorY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(periodLabel, 34, cursorY);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Payment Mode Filter: `, 115, cursorY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(filterMode, 150, cursorY);

  cursorY += 5;
  if (singleCustomer) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Customer Scope: `, 14, cursorY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`${singleCustomer.name} (ID: ${singleCustomer.displayId || singleCustomer.id})`, 38, cursorY);
    cursorY += 5;
  }

  // --- FINANCIAL SUMMARY CARDS ---
  cursorY += 3;
  const cardWidth = (pageWidth - 28 - 9) / 4;
  const cardHeight = 17;

  // Card 1: Total Collections
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(14, cursorY, cardWidth, cardHeight, 2, 2, 'F');
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('TOTAL COLLECTED', 18, cursorY + 5.5);
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(`INR ${totalCollections.toLocaleString('en-IN')}`, 18, cursorY + 12.5);

  // Card 2: Cash Collections
  const card2X = 14 + cardWidth + 3;
  doc.setFillColor(236, 253, 245); // Emerald 50
  doc.roundedRect(card2X, cursorY, cardWidth, cardHeight, 2, 2, 'F');
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(16, 185, 129); // Emerald 600
  doc.text('CASH DEPOSITS', card2X + 4, cursorY + 5.5);
  doc.setFontSize(11);
  doc.setTextColor(6, 95, 70);
  doc.text(`INR ${totalCash.toLocaleString('en-IN')}`, card2X + 4, cursorY + 12.5);

  // Card 3: UPI / PhonePe Collections
  const card3X = card2X + cardWidth + 3;
  doc.setFillColor(238, 242, 255); // Indigo 50
  doc.roundedRect(card3X, cursorY, cardWidth, cardHeight, 2, 2, 'F');
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(99, 102, 241); // Indigo 500
  doc.text('UPI / PHONEPE', card3X + 4, cursorY + 5.5);
  doc.setFontSize(11);
  doc.setTextColor(49, 46, 129);
  doc.text(`INR ${totalUPI.toLocaleString('en-IN')}`, card3X + 4, cursorY + 12.5);

  // Card 4: Unsettled / Total Records
  const card4X = card3X + cardWidth + 3;
  doc.setFillColor(255, 247, 237); // Amber 50
  doc.roundedRect(card4X, cursorY, cardWidth, cardHeight, 2, 2, 'F');
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(217, 119, 6); // Amber 600
  doc.text('UNSETTLED / NP', card4X + 4, cursorY + 5.5);
  doc.setFontSize(11);
  doc.setTextColor(146, 64, 14);
  doc.text(`INR ${totalUnsettled.toLocaleString('en-IN')}`, card4X + 4, cursorY + 12.5);

  cursorY += cardHeight + 8;

  // Secondary Summary row: Volume metrics
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Audited Transactions: ${filtered.length} entries | Customers Involved: ${uniqueCustomerIds.size} accounts | Settlement Ratio: ${
      filtered.length > 0
        ? `${Math.round(((filtered.length - filtered.filter(t => t.status === 'unsettled').length) / filtered.length) * 100)}%`
        : '0%'
    }`,
    14,
    cursorY
  );

  cursorY += 4;

  // --- AUDIT TABLE ---
  const tableHead = [
    [
      'Sl',
      'Tx ID',
      'Date & Time',
      'Customer Name',
      'Acc / Mob',
      'Mode',
      'Status',
      'Amount (INR)'
    ]
  ];

  const tableRows = filtered.map((tx, index) => {
    const cust = customerMap.get(tx.customerId);
    const dateFormatted = format(new Date(tx.timestamp || tx.date), 'dd/MM/yyyy hh:mm a');
    const custName = cust?.name || 'Unknown';
    const accOrMob = cust?.displayId ? `#${cust.displayId}` : cust?.phone || '-';
    const modeLabel = tx.type === 'phonepe' ? 'UPI / PhonePe' : tx.type === 'cash' ? 'Cash' : tx.type;
    const statusLabel = tx.status === 'unsettled' ? 'Unsettled' : 'Paid';
    const amountStr = tx.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 });

    return [
      String(index + 1),
      tx.id.slice(0, 10),
      dateFormatted,
      custName,
      accOrMob,
      modeLabel,
      statusLabel,
      amountStr
    ];
  });

  const totalRow = [
    '',
    '',
    '',
    'AUDIT TOTAL RECONCILIATION',
    '',
    `Cash: INR ${totalCash.toLocaleString('en-IN')} | UPI: INR ${totalUPI.toLocaleString('en-IN')}`,
    `Rec: ${filtered.length}`,
    `INR ${totalCollections.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
  ];

  autoTable(doc, {
    startY: cursorY,
    head: tableHead,
    body: tableRows,
    foot: [totalRow],
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      font: 'helvetica',
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.15
    },
    headStyles: {
      fillColor: [30, 41, 59], // Slate 800
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'left'
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'right'
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 18, font: 'courier', fontSize: 6.5 },
      2: { cellWidth: 26, fontSize: 7 },
      3: { cellWidth: 'auto', fontStyle: 'bold' },
      4: { cellWidth: 20, fontSize: 7, halign: 'center' },
      5: { cellWidth: 22, halign: 'center' },
      6: { cellWidth: 16, halign: 'center' },
      7: { cellWidth: 24, halign: 'right', fontStyle: 'bold' }
    },
    didParseCell: (data) => {
      // Color-code Mode & Status
      if (data.section === 'body') {
        if (data.column.index === 5) {
          const val = String(data.cell.text[0] || '');
          if (val.includes('UPI')) {
            data.cell.styles.textColor = [79, 70, 229]; // Indigo
          } else if (val.includes('Cash')) {
            data.cell.styles.textColor = [5, 150, 105]; // Green
          }
        }
        if (data.column.index === 6) {
          const val = String(data.cell.text[0] || '');
          if (val.includes('Unsettled')) {
            data.cell.styles.textColor = [220, 38, 38]; // Red
            data.cell.styles.fontStyle = 'bold';
          } else {
            data.cell.styles.textColor = [22, 101, 52]; // Green
          }
        }
      }
      if (data.section === 'foot') {
        if (data.column.index === 3) {
          data.cell.styles.halign = 'left';
        }
        if (data.column.index === 5) {
          data.cell.styles.halign = 'left';
          data.cell.styles.fontSize = 6.5;
        }
      }
    },
    didDrawPage: (data) => {
      const currentPage = (doc as any).internal.getNumberOfPages();

      // Footer divider
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(14, pageHeight - 14, pageWidth - 14, pageHeight - 14);

      // Audit Verification Note
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text(
        'CONFIDENTIAL & PROPRIETARY — Pigmy Microfinance System. For regulatory, audit & tax reconciliation purposes only.',
        14,
        pageHeight - 9
      );

      const pageStr = `Page ${currentPage} of {total_pages_count_string}`;
      doc.text(pageStr, pageWidth - 14, pageHeight - 9, { align: 'right' });
    }
  });

  // Calculate final page signature block
  let finalY = (doc as any).lastAutoTable?.finalY || 180;

  // If table ended close to bottom, add new page for signature block
  if (finalY > pageHeight - 45) {
    doc.addPage();
    finalY = 25;
  } else {
    finalY += 12;
  }

  // --- STATUTORY AUDIT ATTESTATION & SIGNATURE BLOCK ---
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, finalY, pageWidth - 28, 28, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text('AUDIT ATTESTATION & SETTLEMENT RECONCILIATION', 18, finalY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'I hereby certify that the transaction records listed above have been extracted verbatim from the immutable encrypted digital ledger',
    18,
    finalY + 11
  );
  doc.text(
    'and match the cash and electronic UPI reconciliations maintained for the specified accounting timeframe.',
    18,
    finalY + 15
  );

  // Signatures
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);

  // Agent / Collector
  doc.text('_________________________________', 20, finalY + 23);
  doc.text('Authorized Field Collector / Agent', 20, finalY + 26);

  // Branch Manager / Auditor
  doc.text('_________________________________', 125, finalY + 23);
  doc.text('Branch Auditor / Manager Verification', 125, finalY + 26);

  // Replace total pages placeholder
  if (typeof (doc as any).putTotalPages === 'function') {
    (doc as any).putTotalPages('{total_pages_count_string}');
  }

  const fileNameDate = `${startDate || 'Start'}_to_${endDate || 'End'}`;
  const fileName = `AuditReport_${fileNameDate}_${format(now, 'yyyyMMdd_HHmm')}.pdf`;
  const pdfBlob = doc.output('blob');

  return {
    blob: pdfBlob,
    fileName,
    title: `Audit Report (${periodLabel})`
  };
}
