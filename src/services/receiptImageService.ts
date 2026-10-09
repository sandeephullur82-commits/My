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
 * Generates an ultra-crisp, elegant, professional financial receipt image on an HTML5 canvas.
 * Features a refined luxury fintech color scheme, clean typography, perforated ticket stub,
 * full customer & balance breakdown, and official digital verification seal (NO QR code).
 */
export async function generateReceiptImage(data: ReceiptData): Promise<GeneratedReceiptImage> {
  const { transaction, customer, previousBalance, newBalance } = data;

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

  // Logical dimensions (rendered at 2.5x scale for razor-sharp Retina/OLED mobile clarity)
  const logicalWidth = 600;
  const logicalHeight = wasNP && !isNP ? 890 : 860;
  const scale = 2.5;

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(logicalWidth * scale);
  canvas.height = Math.round(logicalHeight * scale);

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not initialize canvas context');

  ctx.scale(scale, scale);

  // 1. Overall Outer Background
  ctx.fillStyle = '#f1f5f9'; // Slate-100
  ctx.fillRect(0, 0, logicalWidth, logicalHeight);

  // 2. Main Ticket Body Card (White with soft elevation shadow)
  const cardX = 14;
  const cardY = 14;
  const cardWidth = logicalWidth - 28;
  const cardHeight = logicalHeight - 28;
  const cardRadius = 24;

  ctx.save();
  ctx.shadowColor = 'rgba(15, 23, 42, 0.08)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, cardX, cardY, cardWidth, cardHeight, cardRadius);
  ctx.fill();
  ctx.restore();

  // Subtle Outer Border
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1.5;
  roundRect(ctx, cardX, cardY, cardWidth, cardHeight, cardRadius);
  ctx.stroke();

  // 3. Header Section (Refined Deep Emerald or Warm Amber)
  const headerHeight = 142;
  const headerGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardWidth, cardY + headerHeight);

  if (isWithdrawal) {
    headerGrad.addColorStop(0, '#7c2d12'); // orange-900
    headerGrad.addColorStop(0.6, '#c2410c'); // orange-700
    headerGrad.addColorStop(1, '#ea580c'); // orange-600
  } else if (isNP) {
    headerGrad.addColorStop(0, '#78350f'); // amber-900
    headerGrad.addColorStop(0.6, '#b45309'); // amber-700
    headerGrad.addColorStop(1, '#d97706'); // amber-600
  } else {
    headerGrad.addColorStop(0, '#064e3b'); // emerald-900
    headerGrad.addColorStop(0.6, '#047857'); // emerald-700
    headerGrad.addColorStop(1, '#0d9488'); // teal-600
  }

  ctx.save();
  roundRect(ctx, cardX, cardY, cardWidth, headerHeight, { tl: cardRadius, tr: cardRadius, bl: 0, br: 0 });
  ctx.fillStyle = headerGrad;
  ctx.fill();
  ctx.clip();

  // Top Accent Bar (Mint Green or Gold/Orange)
  ctx.fillStyle = isWithdrawal ? '#fdba74' : isNP ? '#fbbf24' : '#34d399';
  ctx.fillRect(cardX, cardY, cardWidth, 3.5);

  // Subtle geometric curve watermarks in header
  ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.beginPath();
  ctx.arc(cardX + cardWidth - 30, cardY + 20, 75, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cardX + 30, cardY + 120, 50, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Brand Logo in Header
  let logoDrawn = false;
  try {
    const logoImg = await loadImage(PIGMY_LOGO_BASE64);
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, cardX + 22, cardY + 22, 48, 48, 13);
    ctx.fill();
    ctx.drawImage(logoImg, cardX + 26, cardY + 26, 40, 40);
    logoDrawn = true;
  } catch (e) {
    console.warn('Fallback emblem for header');
  }

  if (!logoDrawn) {
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, cardX + 22, cardY + 22, 48, 48, 13);
    ctx.fill();
    ctx.fillStyle = isNP ? '#b45309' : '#047857';
    ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PP', cardX + 46, cardY + 46);
  }

  // Header Brand Typography
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 23px system-ui, -apple-system, sans-serif';
  ctx.fillText('PIGMY PRO', cardX + 82, cardY + 44);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.font = 'bold 9.5px system-ui, -apple-system, sans-serif';
  ctx.fillText('DAILY COLLECTION & DIGITAL LEDGER', cardX + 83, cardY + 60);

  // Status Badge Pill (Top Right)
  const statusPillWidth = 140;
  const statusPillHeight = 28;
  const statusPillX = cardX + cardWidth - statusPillWidth - 22;
  const statusPillY = cardY + 32;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
  roundRect(ctx, statusPillX, statusPillY, statusPillWidth, statusPillHeight, 14);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(
    isWithdrawal 
      ? '✓ ADVANCE WITHDRAWAL' 
      : isNP 
        ? '⚠ MISSED INSTALLMENT' 
        : wasNP 
          ? '✓ SETTLED FROM NP' 
          : '✓ OFFICIAL RECEIPT', 
    statusPillX + (statusPillWidth / 2), 
    statusPillY + 18
  );

  // Sub-bar in Header: Receipt No & Date
  const subBarY = cardY + 94;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.fillRect(cardX, subBarY, cardWidth, 48);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px system-ui, -apple-system, monospace';
  ctx.textAlign = 'left';
  ctx.fillText(receiptNo, cardX + 22, subBarY + 30);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.font = '600 11.5px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'right';
  if (wasNP && !isNP && npDateStr) {
    ctx.fillText(`NP: ${npDateStr} | Paid: ${dateStr}`, cardX + cardWidth - 22, subBarY + 30);
  } else {
    ctx.fillText(dateStr, cardX + cardWidth - 22, subBarY + 30);
  }

  // 4. Ticket Perforation Notches on Left & Right
  const notchY = cardY + 172;
  const notchRadius = 14;

  // Left circular notch cutout
  ctx.fillStyle = '#f1f5f9';
  ctx.beginPath();
  ctx.arc(cardX, notchY, notchRadius, -Math.PI / 2, Math.PI / 2);
  ctx.fill();
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Right circular notch cutout
  ctx.beginPath();
  ctx.arc(cardX + cardWidth, notchY, notchRadius, Math.PI / 2, -Math.PI / 2);
  ctx.fill();
  ctx.stroke();

  // Perforated Dashed Line between notches
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([7, 6]);
  ctx.beginPath();
  ctx.moveTo(cardX + notchRadius + 6, notchY);
  ctx.lineTo(cardX + cardWidth - notchRadius - 6, notchY);
  ctx.stroke();
  ctx.setLineDash([]); // Reset dash

  // 5. Hero Amount Card Section
  const heroY = notchY + 20;
  const heroHeight = 132;
  const heroWidth = cardWidth - 44;
  const heroX = cardX + 22;

  ctx.fillStyle = isWithdrawal ? '#fff7ed' : isNP ? '#fffbeb' : '#f0fdf4'; // Orange-50, Amber-50, or Emerald-50
  roundRect(ctx, heroX, heroY, heroWidth, heroHeight, 18);
  ctx.fill();

  ctx.strokeStyle = isWithdrawal ? '#fed7aa' : isNP ? '#fde68a' : '#bbf7d0';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Subtitle
  ctx.fillStyle = isWithdrawal ? '#c2410c' : isNP ? '#b45309' : '#047857';
  ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(
    isWithdrawal
      ? 'ADVANCE DEPOSIT WITHDRAWAL PAYOUT'
      : isNP 
        ? 'RECORDED DUE / UNPAID INSTALLMENT' 
        : 'AMOUNT COLLECTED & CREDITED', 
    logicalWidth / 2, 
    heroY + 30
  );

  // Big Amount Display
  ctx.fillStyle = isNP ? '#9a3412' : '#0f172a';
  ctx.font = '900 42px system-ui, -apple-system, sans-serif';
  ctx.fillText(`₹ ${transaction.amount.toLocaleString('en-IN')}`, logicalWidth / 2, heroY + 78);

  // Payment Mode Badge Pill
  const modePillWidth = 200;
  const modePillHeight = 26;
  const modePillY = heroY + 94;
  ctx.fillStyle = isNP ? '#fed7aa' : isUpi ? '#dbeafe' : '#dcfce7';
  roundRect(ctx, (logicalWidth - modePillWidth) / 2, modePillY, modePillWidth, modePillHeight, 13);
  ctx.fill();

  ctx.fillStyle = isNP ? '#9a3412' : isUpi ? '#1d4ed8' : '#15803d';
  ctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
  ctx.fillText(paymentModeLabel, logicalWidth / 2, modePillY + 17);

  // 6. Customer & Loan Details Card
  let curY = heroY + heroHeight + 22;
  const sectionWidth = cardWidth - 44;
  const sectionX = cardX + 22;

  // Customer Card Box
  const custCardY = curY;
  const custCardHeight = 98;
  ctx.fillStyle = '#f8fafc';
  roundRect(ctx, sectionX, custCardY, sectionWidth, custCardHeight, 16);
  ctx.fill();
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Section Header Label
  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('CUSTOMER & ACCOUNT INFORMATION', sectionX + 16, custCardY + 22);

  // Customer Name
  ctx.fillStyle = '#0f172a';
  ctx.font = '900 15px system-ui, -apple-system, sans-serif';
  ctx.fillText((customer.name || 'Valued Customer').toUpperCase(), sectionX + 16, custCardY + 48);

  // Mobile
  if (customer.phone) {
    ctx.fillStyle = '#475569';
    ctx.font = '500 12px system-ui, -apple-system, sans-serif';
    ctx.fillText(`Phone: ${customer.phone}`, sectionX + 16, custCardY + 70);
  }

  // Account ID Pill (on the right)
  const accPillWidth = 100;
  const accPillHeight = 26;
  const accPillX = sectionX + sectionWidth - accPillWidth - 16;
  const accPillY = custCardY + 26;

  ctx.fillStyle = '#eff6ff';
  roundRect(ctx, accPillX, accPillY, accPillWidth, accPillHeight, 8);
  ctx.fill();
  ctx.strokeStyle = '#bfdbfe';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#1d4ed8';
  ctx.font = 'bold 11px system-ui, -apple-system, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`#${customer.displayId || customer.id}`, accPillX + (accPillWidth / 2), accPillY + 17);

  // Total Loan Info (if available)
  const totalLoanVal = customer.loanAmount || customer.loan || 0;
  if (totalLoanVal > 0) {
    ctx.fillStyle = '#64748b';
    ctx.font = '600 10.5px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`Scheme: ₹${totalLoanVal.toLocaleString('en-IN')}`, sectionX + sectionWidth - 16, custCardY + 70);
  }

  curY += custCardHeight + 16;

  // 7. Financial Balance Breakdown Table
  const balCardY = curY;
  const balCardHeight = 158;
  ctx.fillStyle = '#f8fafc';
  roundRect(ctx, sectionX, balCardY, sectionWidth, balCardHeight, 16);
  ctx.fill();
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Section Header Label
  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('ACCOUNT BALANCE BREAKDOWN', sectionX + 16, balCardY + 22);

  // Row 1: Previous Outstanding / Deposit
  let rowY = balCardY + 46;
  ctx.fillStyle = '#64748b';
  ctx.font = '500 12.5px system-ui, -apple-system, sans-serif';
  ctx.fillText(
    isWithdrawal ? 'Previous Deposit Held' : isNP ? 'Outstanding Balance' : 'Previous Outstanding', 
    sectionX + 16, 
    rowY
  );

  ctx.fillStyle = '#334155';
  ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`₹ ${previousBalance.toLocaleString('en-IN')}`, sectionX + sectionWidth - 16, rowY);

  // Row 2: Amount Credited / Withdrawn
  rowY += 26;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#64748b';
  ctx.font = '500 12.5px system-ui, -apple-system, sans-serif';
  ctx.fillText(
    isWithdrawal ? 'Withdrawn Payout' : isNP ? 'Status' : 'Amount Paid & Credited', 
    sectionX + 16, 
    rowY
  );

  ctx.fillStyle = isWithdrawal ? '#c2410c' : isNP ? '#d97706' : '#059669';
  ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(
    isWithdrawal 
      ? `- ₹ ${transaction.amount.toLocaleString('en-IN')}` 
      : isNP 
        ? 'NP • Due Retained' 
        : `- ₹ ${transaction.amount.toLocaleString('en-IN')}`, 
    sectionX + sectionWidth - 16, 
    rowY
  );

  // Row 3: Remaining Balance Highlight Box
  rowY += 14;
  const remBoxHeight = 44;
  const remBoxWidth = sectionWidth - 32;
  const remBoxX = sectionX + 16;
  const remBoxY = rowY;

  ctx.fillStyle = isWithdrawal ? '#fff7ed' : '#ecfdf5'; // Orange-50 or Emerald-50
  roundRect(ctx, remBoxX, remBoxY, remBoxWidth, remBoxHeight, 12);
  ctx.fill();
  ctx.strokeStyle = isWithdrawal ? '#fed7aa' : '#a7f3d0';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.fillStyle = isWithdrawal ? '#9a3412' : '#065f46';
  ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
  ctx.fillText(isWithdrawal ? 'Remaining Deposit Held' : 'Net Remaining Balance', remBoxX + 14, remBoxY + 27);

  ctx.textAlign = 'right';
  ctx.fillStyle = isWithdrawal ? '#c2410c' : '#047857';
  ctx.font = '900 17px system-ui, -apple-system, sans-serif';
  ctx.fillText(`₹ ${newBalance.toLocaleString('en-IN')}`, remBoxX + remBoxWidth - 14, remBoxY + 28);

  curY += balCardHeight + 20;

  // 8. Official Electronic Verification Strip (NO QR CODE)
  const authCardY = curY;
  const authCardHeight = 64;
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, sectionX, authCardY, sectionWidth, authCardHeight, 14);
  ctx.fill();
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Shield Checkmark Icon on Left
  drawShieldIcon(ctx, sectionX + 14, authCardY + 17, 30, isNP ? '#d97706' : '#059669');

  // Verification Details Text
  ctx.textAlign = 'left';
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 11.5px system-ui, -apple-system, sans-serif';
  ctx.fillText('100% VERIFIED ELECTRONIC VOUCHER', sectionX + 54, authCardY + 28);

  ctx.fillStyle = '#64748b';
  ctx.font = '500 10px system-ui, -apple-system, sans-serif';
  ctx.fillText(`Security Reference: ${(transaction.id || '').toUpperCase().slice(0, 18)} • Cloud Ledger`, sectionX + 54, authCardY + 46);

  // Official Stamp on Right
  drawOfficialStamp(ctx, sectionX + sectionWidth - 44, authCardY + 32, 27, isNP);

  curY += authCardHeight + 16;

  // 9. Polite Footer Watermark
  ctx.textAlign = 'center';
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'italic 10px system-ui, -apple-system, sans-serif';
  ctx.fillText('Thank you for choosing Pigmy Pro Smart Daily Collection!', logicalWidth / 2, curY);

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
