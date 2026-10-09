import jsPDF from 'jspdf';
import { Customer, Transaction } from './firestoreService';
import { sharePDF } from '../lib/pdfExport';
import { safeFormat } from '../lib/utils';
import { PIGMY_LOGO_BASE64 } from '../assets/logoBase64';
import { isAndroidApp, downloadFileForAndroid, shareFileForAndroid } from '../utils/capacitorDeviceHelper';
import { 
  printViaSystemThermal, 
  printViaBluetoothThermal, 
  isBluetoothPrintSupported,
  printReceipt as universalPrintReceipt 
} from './thermalPrinterService';

export interface ReceiptData {
  transaction: Transaction;
  customer: Customer;
  previousBalance: number;
  newBalance: number;
}

export interface GeneratedReceipt {
  doc: jsPDF;
  blob: Blob;
  fileName: string;
  dataUri: string;
  receiptNo: string;
}

/**
 * Generates a clean, brand-aligned visual PDF receipt template.
 * Includes company logo, transaction ID, date, customer name, payment mode,
 * total amount collected, and account balance breakdown.
 * Sized in standard A6 format (105mm x 148mm) suitable for both standard printers
 * and 80mm thermal receipt printers.
 */
export function generateReceiptPDF(data: ReceiptData): GeneratedReceipt {
  const { transaction, customer, previousBalance, newBalance } = data;
  
  // A6 Dimensions: 105mm x 148mm (Portrait)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a6'
  });

  const receiptNo = `REC-${(transaction.id || '').slice(0, 8).toUpperCase()}`;
  const dateStr = safeFormat(
    transaction.paidAt || transaction.timestamp || transaction.date,
    'dd MMM yyyy, hh:mm a',
    safeFormat(Date.now(), 'dd MMM yyyy, hh:mm a')
  );
  const isUpi = transaction.type === 'phonepe';
  const isWithdrawal = Boolean(transaction.isWithdrawal);
  const isNP = transaction.type === 'NP' || transaction.type === 'unsettled' || transaction.status === 'unsettled';
  const paymentModeLabel = isWithdrawal 
    ? (isUpi ? 'PHONEPE UPI PAYOUT' : 'CASH PAYOUT')
    : isUpi 
      ? 'UPI / PHONEPE' 
      : isNP 
        ? 'NP' 
        : 'CASH DEPOSIT';
  const fileName = `Receipt_${customer.name.replace(/[^a-zA-Z0-9]/g, '_')}_${receiptNo}.pdf`;

  const pageWidth = 105;
  const pageHeight = 148;
  const margin = 8;
  const contentWidth = pageWidth - (margin * 2);

  // Outer border / decorative frame
  doc.setDrawColor(229, 231, 235); // Gray 200
  doc.setLineWidth(0.4);
  doc.roundedRect(4, 4, pageWidth - 8, pageHeight - 8, 3, 3, 'D');

  // Top Accent Bar (Brand Emerald Green or Amber for withdrawal)
  if (isWithdrawal) {
    doc.setFillColor(217, 119, 6); // Amber 600
  } else {
    doc.setFillColor(16, 185, 129); // Emerald 500
  }
  doc.rect(4, 4, pageWidth - 8, 2.5, 'F');

  // 1. Header Section with Company Logo & Brand Name
  let y = 10;
  
  // Render Company Logo
  try {
    doc.addImage(PIGMY_LOGO_BASE64, 'PNG', margin + 1, y, 14, 14);
  } catch (e) {
    // Fallback vector icon if image rendering fails
    doc.setFillColor(16, 185, 129);
    doc.roundedRect(margin + 1, y, 14, 14, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('PP', margin + 8, y + 9.5, { align: 'center' });
  }

  // Brand Name & Tagline
  doc.setTextColor(15, 23, 42); // Slate 900
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('PIGMY PRO', margin + 18, y + 5);

  doc.setTextColor(100, 116, 139); // Slate 500
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text('SMART COLLECTION & DIGITAL LEDGER', margin + 18, y + 9);

  // Receipt Badge on the right
  doc.setFillColor(241, 245, 249); // Slate 100
  doc.setDrawColor(203, 213, 225); // Slate 300
  doc.roundedRect(pageWidth - margin - 28, y + 1, 27, 8, 1.5, 1.5, 'FD');
  
  doc.setTextColor(16, 185, 129); // Emerald 600
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.text('RECEIPT', pageWidth - margin - 14.5, y + 4.5, { align: 'center' });
  doc.setFontSize(5.5);
  doc.setTextColor(71, 85, 105);
  doc.text(receiptNo, pageWidth - margin - 14.5, y + 7.5, { align: 'center' });

  y += 18;

  // Transaction ID & Date Subheader Bar
  doc.setFillColor(248, 250, 252); // Slate 50
  doc.setDrawColor(226, 232, 240); // Slate 200
  doc.roundedRect(margin, y, contentWidth, 9, 1.5, 1.5, 'FD');

  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text('Date & Time:', margin + 3, y + 5.5);

  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.text(dateStr, margin + 17, y + 5.5);

  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.text('Txn ID:', pageWidth - margin - 35, y + 5.5);

  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.text((transaction.id || '').slice(0, 10).toUpperCase(), pageWidth - margin - 3, y + 5.5, { align: 'right' });

  y += 13;

  // 2. Total Amount Box (Hero Visual)
  if (isWithdrawal) {
    doc.setFillColor(254, 243, 199); // Amber 100
    doc.setDrawColor(251, 191, 36); // Amber 400
  } else {
    doc.setFillColor(236, 253, 245); // Emerald 50
    doc.setDrawColor(167, 243, 208); // Emerald 200
  }
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, y, contentWidth, 23, 2.5, 2.5, 'FD');

  if (isWithdrawal) {
    doc.setTextColor(180, 83, 9); // Amber 700
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text('ADVANCE DEPOSIT WITHDRAWAL PAYOUT', margin + contentWidth / 2, y + 5.5, { align: 'center' });

    // Big Amount Display
    doc.setTextColor(180, 83, 9); // Amber 700
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(`Rs. ${transaction.amount.toLocaleString('en-IN')}`, margin + contentWidth / 2, y + 14, { align: 'center' });
  } else {
    doc.setTextColor(5, 150, 105); // Emerald 600
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text('TOTAL AMOUNT COLLECTED', margin + contentWidth / 2, y + 5.5, { align: 'center' });

    // Big Amount Display
    doc.setTextColor(4, 120, 87); // Emerald 700
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(`Rs. ${transaction.amount.toLocaleString('en-IN')}`, margin + contentWidth / 2, y + 14, { align: 'center' });
  }

  // Payment Mode Badge inside box
  doc.setFillColor(isWithdrawal ? (isUpi ? 2 : 217) : (isUpi ? 37 : 16), isWithdrawal ? (isUpi ? 132 : 119) : (isUpi ? 99 : 185), isWithdrawal ? (isUpi ? 199 : 6) : (isUpi ? 235 : 129));
  doc.roundedRect(margin + contentWidth / 2 - 20, y + 16.5, 40, 5, 1, 1, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.text(paymentModeLabel, margin + contentWidth / 2, y + 20, { align: 'center' });

  y += 27;

  // 3. Customer Details Section
  doc.setTextColor(15, 23, 42); // Slate 900
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('CUSTOMER INFORMATION', margin, y);

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(margin, y + 2, margin + contentWidth, y + 2);

  y += 6.5;

  const renderDataRow = (label: string, value: string, boldValue: boolean = false, customColor: number[] = [30, 41, 59]) => {
    doc.setTextColor(100, 116, 139); // Slate 500
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(label, margin + 2, y);

    doc.setTextColor(customColor[0], customColor[1], customColor[2]);
    doc.setFont('helvetica', boldValue ? 'bold' : 'normal');
    doc.setFontSize(7.5);
    doc.text(value, margin + contentWidth - 2, y, { align: 'right' });
    y += 5;
  };

  renderDataRow('Customer Name', customer.name, true, [15, 23, 42]);
  renderDataRow('Account Number', `#${customer.displayId || customer.id}`, true, [37, 99, 235]);
  if (customer.phone) {
    renderDataRow('Contact Phone', customer.phone, false, [51, 65, 85]);
  }

  y += 2;

  // 4. Financial Balance Breakdown Table
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('ACCOUNT BALANCE BREAKDOWN', margin, y);

  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y + 2, margin + contentWidth, y + 2);

  y += 6.5;
  renderDataRow(
    isWithdrawal ? 'Previous Deposit Held' : 'Previous Outstanding', 
    `Rs. ${previousBalance.toLocaleString('en-IN')}`
  );
  renderDataRow(
    isWithdrawal ? 'Withdrawn Payout' : 'Amount Credited / Paid', 
    `- Rs. ${transaction.amount.toLocaleString('en-IN')}`, 
    true, 
    isWithdrawal ? [194, 65, 12] : [5, 150, 105]
  );

  // Outstanding Balance Highlight Box
  y += 1;
  doc.setFillColor(isWithdrawal ? 254 : 241, isWithdrawal ? 243 : 245, isWithdrawal ? 199 : 249);
  doc.setDrawColor(isWithdrawal ? 251 : 203, isWithdrawal ? 191 : 213, isWithdrawal ? 36 : 225);
  doc.roundedRect(margin, y - 3.5, contentWidth, 8, 1.5, 1.5, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text(isWithdrawal ? 'Remaining Deposit Held' : 'Remaining Balance', margin + 3, y + 1.5);

  doc.setTextColor(isWithdrawal ? 180 : 5, isWithdrawal ? 83 : 150, isWithdrawal ? 9 : 105);
  doc.setFontSize(8.5);
  doc.text(`Rs. ${newBalance.toLocaleString('en-IN')}`, margin + contentWidth - 3, y + 1.5, { align: 'right' });

  y += 11;

  // 5. Digital Signature & Verification Footer
  doc.setDrawColor(203, 213, 225);
  doc.setLineDashPattern([1.5, 1.5], 0);
  doc.line(margin, y, margin + contentWidth, y);
  doc.setLineDashPattern([], 0); // reset line dash

  y += 4.5;
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.text('This is an authenticated electronic receipt recorded in Pigmy Pro Digital Ledger.', margin + contentWidth / 2, y, { align: 'center' });

  y += 3.5;
  doc.text(`Authorized Agent Verification • Security Hash: ${(transaction.id || '').slice(0, 16).toUpperCase()}`, margin + contentWidth / 2, y, { align: 'center' });

  y += 3.5;
  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'italic');
  doc.text('Thank you for choosing Pigmy Pro Daily Collection!', margin + contentWidth / 2, y, { align: 'center' });

  // Output blob and URI
  const blob = doc.output('blob');
  const dataUri = doc.output('datauristring');

  return {
    doc,
    blob,
    fileName,
    dataUri,
    receiptNo
  };
}

/**
 * Directly downloads the receipt PDF to the user's device.
 */
export function downloadReceiptPDF(data: ReceiptData, customFileName?: string): string {
  const { blob, fileName } = generateReceiptPDF(data);
  const targetName = customFileName || fileName;
  
  if (isAndroidApp()) {
    downloadFileForAndroid(blob, targetName, 'Payment Receipt PDF');
    return targetName;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = targetName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return targetName;
}

/**
 * Shares the PDF file via Capacitor native share on Android or Web Share API on mobile browsers,
 * with automatic fallback to download if native file sharing is unavailable.
 */
export async function shareReceiptPDF(data: ReceiptData): Promise<'shared' | 'downloaded' | 'cancelled' | 'failed'> {
  const { blob, fileName, receiptNo } = generateReceiptPDF(data);
  const title = `Receipt ${receiptNo} - ${data.customer.name}`;

  if (isAndroidApp()) {
    return shareFileForAndroid(blob, fileName, title);
  }

  const shareResult = await sharePDF(blob, fileName, title);

  if (shareResult === 'shared') {
    return 'shared';
  } else if (shareResult === 'cancelled') {
    return 'cancelled';
  } else {
    // Fallback: trigger download so the user has the file
    downloadReceiptPDF(data);
    return 'downloaded';
  }
}

/**
 * Sends the receipt to a thermal printer (Bluetooth or system print dialog).
 */
export async function printReceipt(
  data: ReceiptData, 
  preferBluetooth: boolean = false
): Promise<'printed_bluetooth' | 'printed_system' | 'cancelled'> {
  return universalPrintReceipt(data, preferBluetooth);
}

export { isBluetoothPrintSupported };

// Export image receipt utilities for image format support
export { 
  generateReceiptImage, 
  downloadReceiptImage, 
  shareReceiptImage 
} from './receiptImageService';
export type { GeneratedReceiptImage } from './receiptImageService';
