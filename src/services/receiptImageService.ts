import { Customer, Transaction } from './firestoreService';
import { safeFormat } from '../lib/utils';
import { PIGMY_LOGO_BASE64 } from '../assets/logoBase64';
import { isAndroidApp, downloadFileForAndroid, shareFileForAndroid } from '../utils/capacitorDeviceHelper';
import { 
  printReceipt as universalPrintReceipt, 
  isBluetoothPrintSupported 
} from './thermalPrinterService';

export interface ReceiptData {
  transaction: Transaction;
  customer: Customer;
  previousBalance: number;
  newBalance: number;
}

export interface GeneratedReceiptImage {
  blob: Blob;
  dataUrl: string;
  fileName: string;
  receiptNo: string;
}

/**
 * Draws a rounded rectangle path on Canvas 2D
 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number | { tl?: number; tr?: number; br?: number; bl?: number }
) {
  const r = typeof radius === 'number' 
    ? { tl: radius, tr: radius, br: radius, bl: radius }
    : { tl: radius.tl || 0, tr: radius.tr || 0, br: radius.br || 0, bl: radius.bl || 0 };

  ctx.beginPath();
  ctx.moveTo(x + r.tl, y);
  ctx.lineTo(x + width - r.tr, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r.tr);
  ctx.lineTo(x + width, y + height - r.br);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r.br, y + height);
  ctx.lineTo(x + r.bl, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r.bl);
  ctx.lineTo(x, y + r.tl);
  ctx.quadraticCurveTo(x, y, x + r.tl, y);
  ctx.closePath();
}

/**
 * Loads an image from a base64 or URL source into an HTMLImageElement
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

/**
 * Draws an official circular authorization stamp/seal
 */
function drawOfficialStamp(
  ctx: CanvasRenderingContext2D, 
  centerX: number, 
  centerY: number, 
  radius: number, 
  isNP: boolean
) {
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(-7 * (Math.PI / 180)); // -7 degree tilt for authentic hand-stamp feel

  const primaryColor = isNP ? 'rgba(180, 83, 9, 0.85)' : 'rgba(4, 120, 87, 0.88)';

  // Outer solid ring
  ctx.strokeStyle = primaryColor;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();

  // Inner dashed ring
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 2.5]);
  ctx.beginPath();
  ctx.arc(0, 0, radius - 3.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Stamp typography
  ctx.fillStyle = primaryColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.font = 'bold 7.5px system-ui, -apple-system, sans-serif';
  ctx.fillText('PIGMY PRO', 0, -10);

  ctx.font = '900 11px system-ui, -apple-system, sans-serif';
  ctx.fillText(isNP ? 'RECORDED' : 'VERIFIED', 0, 1);

  ctx.font = '600 6.5px system-ui, -apple-system, sans-serif';
  ctx.fillText('LEDGER VOUCHER', 0, 11);

  ctx.restore();
}

/**
 * Draws a shield verification icon on the canvas
 */
function drawShieldIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(size * 0.5, 0);
  ctx.lineTo(size, size * 0.25);
  ctx.lineTo(size, size * 0.6);
  ctx.quadraticCurveTo(size, size * 0.9, size * 0.5, size);
  ctx.quadraticCurveTo(0, size * 0.9, 0, size * 0.6);
  ctx.lineTo(0, size * 0.25);
  ctx.closePath();
  ctx.fill();

  // Inner white checkmark
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = size * 0.12;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(size * 0.3, size * 0.52);
  ctx.lineTo(size * 0.46, size * 0.68);
  ctx.lineTo(size * 0.74, size * 0.36);
  ctx.stroke();

  ctx.restore();
}

/**
 * Helper to get user receipt settings from localStorage
 */
function getReceiptSettings() {
  try {
    const saved = localStorage.getItem('pigmy_receipt_settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        printLogo: parsed.printLogo ?? true,
        includeFooterNotes: parsed.includeFooterNotes ?? true,
        paperSize: parsed.paperSize || 'standard'
      };
    }
  } catch {}
  return { printLogo: true, includeFooterNotes: true, paperSize: 'standard' };
}

/**
 * Generates an ultra-crisp, elegant, professional financial receipt image on an HTML5 canvas.
 * Features a refined luxury fintech color scheme, clean typography, perforated ticket stub,
 * full customer & balance breakdown, and official digital verification seal (NO QR code).
 */
export async function generateReceiptImage(data: ReceiptData): Promise<GeneratedReceiptImage> {
  const { transaction, customer, previousBalance, newBalance } = data;
  const settings = getReceiptSettings();

  let logoImg: HTMLImageElement | null = null;
  if (settings.printLogo) {
    try {
      logoImg = await loadImage(PIGMY_LOGO_BASE64);
    } catch {
      logoImg = null;
    }
  }

  const receiptNo = `REC-${(transaction.id || '').slice(0, 8).toUpperCase()}`;
  const dateStr = safeFormat(
    transaction.paidAt || transaction.timestamp || transaction.date,
    'dd MMM yyyy, hh:mm a',
    safeFormat(Date.now(), 'dd MMM yyyy, hh:mm a')
  );
  const isUpi = transaction.type === 'phonepe';
  const isWithdrawal = Boolean(transaction.isWithdrawal);
  const isNP = transaction.type === 'NP' || transaction.type === 'unsettled' || transaction.status === 'unsettled';
  
  const wasNP = Boolean(
    transaction.convertedFromNP || 
    transaction.npMarkedAt || 
    transaction.settledFromNpId || 
    (transaction as any).originalNpTimestamp || 
    (transaction.notes && transaction.notes.toLowerCase().includes('np'))
  );
  
  const rawNpTime = transaction.npMarkedAt || (transaction as any).originalNpTimestamp || transaction.unsettledAt;
  const npDateStr = rawNpTime 
    ? safeFormat(rawNpTime, 'dd MMM yyyy, hh:mm a', safeFormat(rawNpTime, 'dd MMM yyyy', 'Earlier'))
    : (transaction.npMarkedDate ? safeFormat(transaction.npMarkedDate, 'dd MMM yyyy', transaction.npMarkedDate) : null);

  const paymentModeLabel = isWithdrawal
    ? (isUpi ? 'PHONEPE UPI PAYOUT' : 'CASH PAYOUT')
    : isUpi 
      ? 'UPI / PHONEPE' 
      : isNP 
        ? 'NOT PAID (DUE RECORDED)' 
        : wasNP 
          ? 'CASH (SETTLED FROM NP)' 
          : 'CASH COLLECTION';
  const fileName = `Receipt_${(customer.name || 'Customer').replace(/[^a-zA-Z0-9]/g, '_')}_${receiptNo}.png`;

  // Paper size proportions: 'thermal' (bus ticket size 420), 'standard' (A5 professional business receipt 560), 'a4' (720)
  const paperSize = settings.paperSize || 'standard';
  const logicalWidth = paperSize === 'thermal' ? 420 : paperSize === 'a4' ? 720 : 560;
  const baseHeight = wasNP && !isNP ? 820 : 780;
  const logicalHeight = settings.includeFooterNotes ? baseHeight : baseHeight - 60;
  const scale = 2.5;

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(logicalWidth * scale);
  canvas.height = Math.round(logicalHeight * scale);

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not initialize canvas context');

  ctx.scale(scale, scale);

  // 1. Pure White Background (Thermal Paper style)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, logicalWidth, logicalHeight);

  const margin = 12;
  const contentWidth = logicalWidth - (margin * 2);

  // Helper for dashed lines
  const drawDashedLine = (y: number) => {
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(margin, y);
    ctx.lineTo(logicalWidth - margin, y);
    ctx.stroke();
    ctx.setLineDash([]);
  };

  let curY = margin + 6;

  // 2. Header (Bus Ticket / Thermal Receipt Header)
  if (logoImg) {
    const logoSize = 34;
    ctx.drawImage(logoImg, (logicalWidth - logoSize) / 2, curY, logoSize, logoSize);
    curY += logoSize + 4;
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = '#000000';
  ctx.font = '900 18px monospace, sans-serif';
  ctx.fillText('PIGMY PRO', logicalWidth / 2, curY);
  curY += 16;

  ctx.font = '700 10px monospace, sans-serif';
  ctx.fillText('SMART COLLECTION & DIGITAL LEDGER', logicalWidth / 2, curY);
  curY += 14;

  ctx.font = '600 9px monospace, sans-serif';
  ctx.fillText('OFFICIAL THERMAL VOUCHER', logicalWidth / 2, curY);
  curY += 12;

  drawDashedLine(curY);
  curY += 14;

  // 3. Receipt Meta Info
  ctx.textAlign = 'left';
  ctx.font = 'bold 11px monospace, sans-serif';
  ctx.fillText(`Receipt No: ${receiptNo}`, margin, curY);
  curY += 16;

  if (wasNP && !isNP && npDateStr) {
    ctx.font = '9px monospace, sans-serif';
    ctx.fillText(`NP Recorded: ${npDateStr}`, margin, curY);
    curY += 14;
    ctx.fillText(`Settled At:  ${dateStr}`, margin, curY);
  } else {
    ctx.font = '10px monospace, sans-serif';
    ctx.fillText(`Date: ${dateStr}`, margin, curY);
  }
  curY += 18;

  drawDashedLine(curY);
  curY += 14;

  // 4. Customer Details
  ctx.font = 'bold 10px monospace, sans-serif';
  ctx.fillText('CUSTOMER DETAILS:', margin, curY);
  curY += 16;

  ctx.font = '900 13px monospace, sans-serif';
  ctx.fillText((customer.name || 'Valued Customer').toUpperCase(), margin, curY);
  curY += 16;

  ctx.font = '10px monospace, sans-serif';
  ctx.fillText(`Account ID: #${customer.displayId || customer.id}`, margin, curY);
  if (customer.phone) {
    ctx.fillText(`Phone: ${customer.phone}`, logicalWidth / 2, curY);
  }
  curY += 18;

  drawDashedLine(curY);
  curY += 14;

  // 5. Amount Collected Box (Black outline, bold center text)
  const boxHeight = 68;
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(margin, curY, contentWidth, boxHeight);

  ctx.textAlign = 'center';
  ctx.font = 'bold 9px monospace, sans-serif';
  ctx.fillText(isWithdrawal ? 'AMOUNT WITHDRAWN' : isNP ? 'MISSED DUE (NP)' : 'AMOUNT COLLECTED', logicalWidth / 2, curY + 18);

  ctx.font = '900 24px monospace, sans-serif';
  ctx.fillText(`Rs. ${transaction.amount.toLocaleString('en-IN')}`, logicalWidth / 2, curY + 44);

  ctx.font = 'bold 9px monospace, sans-serif';
  ctx.fillText(`[ ${paymentModeLabel} ]`, logicalWidth / 2, curY + 60);

  curY += boxHeight + 16;

  // 6. Balance Breakdown Table
  ctx.textAlign = 'left';
  ctx.font = 'bold 10px monospace, sans-serif';
  ctx.fillText('ACCOUNT BALANCE SUMMARY', margin, curY);
  curY += 18;

  const renderRow = (label: string, val: string, isBold = false) => {
    ctx.font = `${isBold ? 'bold 11px' : '10px'} monospace, sans-serif`;
    ctx.fillText(label, margin + 4, curY);
    ctx.textAlign = 'right';
    ctx.fillText(val, logicalWidth - margin - 4, curY);
    ctx.textAlign = 'left';
    curY += 16;
  };

  renderRow(isWithdrawal ? 'Previous Deposit:' : isNP ? 'Outstanding:' : 'Previous Balance:', `Rs. ${previousBalance.toLocaleString('en-IN')}`);
  renderRow(isWithdrawal ? 'Withdrawn Payout:' : isNP ? 'Retained Due:' : 'Amount Paid:', `- Rs. ${transaction.amount.toLocaleString('en-IN')}`);

  curY += 4;
  drawDashedLine(curY);
  curY += 14;

  renderRow(isWithdrawal ? 'Remaining Deposit:' : 'Remaining Balance:', `Rs. ${newBalance.toLocaleString('en-IN')}`, true);

  curY += 10;
  drawDashedLine(curY);
  curY += 16;

  // 7. Footer Authentication & Message
  if (settings.includeFooterNotes) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 9.5px monospace, sans-serif';
    ctx.fillText('*** 100% VERIFIED DIGITAL LEDGER ***', logicalWidth / 2, curY);
    curY += 14;

    ctx.font = '8.5px monospace, sans-serif';
    ctx.fillText('Thank you for your daily deposit!', logicalWidth / 2, curY);
    curY += 14;

    ctx.font = '7px monospace, sans-serif';
    ctx.fillText(`Ref: ${(transaction.id || '').toUpperCase().slice(0, 16)}`, logicalWidth / 2, curY);
  }

  // Return generated Image Blob & Data URL
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to create receipt image blob'));
        return;
      }
      const dataUrl = canvas.toDataURL('image/png');
      resolve({
        blob,
        dataUrl,
        fileName,
        receiptNo
      });
    }, 'image/png');
  });
}

/**
 * Downloads the receipt image directly to the user's device/gallery.
 */
export async function downloadReceiptImage(data: ReceiptData, customFileName?: string): Promise<string> {
  const { blob, fileName } = await generateReceiptImage(data);
  const targetName = customFileName || fileName;

  if (isAndroidApp()) {
    await downloadFileForAndroid(blob, targetName, 'Payment Receipt');
    return targetName;
  }

  // Original Web application download
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
 * Shares the Receipt as an IMAGE (PNG) via the Web Share API (native share sheet on mobile),
 * with automatic fallback to download if native file sharing is unavailable.
 * Shares strictly the image file without any accompanying text caption as requested.
 */
export async function shareReceiptImage(
  data: ReceiptData
): Promise<'shared' | 'downloaded' | 'cancelled' | 'failed'> {
  const { blob, fileName } = await generateReceiptImage(data);

  if (isAndroidApp()) {
    const res = await shareFileForAndroid(blob, fileName, 'Payment Receipt');
    return res;
  }

  // Original Web application share
  const imageFile = new File([blob], fileName, { type: 'image/png' });

  if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [imageFile] })) {
    try {
      await navigator.share({
        files: [imageFile]
      });
      return 'shared';
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        return 'cancelled';
      }
      console.warn('Native share failed, falling back to download:', error);
    }
  }

  // Fallback to downloading image on web
  await downloadReceiptImage(data);
  return 'downloaded';
}

/**
 * Universal print handler for receipt (supports thermal printers and system dialog)
 */
export async function printReceipt(
  data: ReceiptData,
  preferBluetooth: boolean = false
): Promise<'printed_bluetooth' | 'printed_system' | 'cancelled'> {
  return universalPrintReceipt(data, preferBluetooth);
}

export { isBluetoothPrintSupported };
