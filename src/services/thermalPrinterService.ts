import { safeFormat } from '../lib/utils';
import { ReceiptData } from './receiptPdfService';
import { PIGMY_LOGO_BASE64 } from '../assets/logoBase64';

/**
 * Helper to get user receipt settings from localStorage
 */
function getReceiptSettings() {
  try {
    const saved = localStorage.getItem('pigmy_receipt_settings');
    if (saved) return JSON.parse(saved);
  } catch {}
  return { printLogo: true, includeFooterNotes: true };
}

/**
 * Checks if the browser environment supports the Web Bluetooth API.
 */
export function isBluetoothPrintSupported(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}

/**
 * Encodes text and ESC/POS commands into an ArrayBuffer for thermal printers.
 */
function buildEscPosData(data: ReceiptData): Uint8Array {
  const { transaction, customer, previousBalance, newBalance } = data;
  const receiptNo = `REC-${(transaction.id || '').slice(0, 8).toUpperCase()}`;
  const dateStr = safeFormat(
    transaction.paidAt || transaction.timestamp || transaction.date,
    'dd/MM/yyyy hh:mm a',
    safeFormat(Date.now(), 'dd/MM/yyyy hh:mm a')
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
    ? safeFormat(rawNpTime, 'dd/MM/yyyy hh:mm a', 'Earlier') 
    : (transaction.npMarkedDate || null);

  const modeStr = isWithdrawal 
    ? (isUpi ? 'PHONEPE UPI PAYOUT' : 'CASH PAYOUT')
    : isUpi 
      ? 'UPI / PHONEPE' 
      : isNP 
        ? 'NP' 
        : wasNP 
          ? 'CASH (NP SETTLED)' 
          : 'CASH';

  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];

  const addCmd = (bytes: number[]) => {
    parts.push(new Uint8Array(bytes));
  };

  const addText = (str: string) => {
    parts.push(encoder.encode(str));
  };

  // 1. Initialize printer: ESC @
  addCmd([0x1b, 0x40]);

  // 2. Center align: ESC a 1
  addCmd([0x1b, 0x61, 0x01]);

  // Double height & width for header: GS ! 0x11
  addCmd([0x1d, 0x21, 0x11]);
  addText('PIGMY PRO\n');

  // Normal text: GS ! 0x00
  addCmd([0x1d, 0x21, 0x00]);
  addText('SMART COLLECTION SYSTEM\n');
  addText('Digital Ledger Deposit Slip\n');
  addText('--------------------------------\n');

  // 3. Left align: ESC a 0
  addCmd([0x1b, 0x61, 0x00]);
  addText(`Receipt No : ${receiptNo}\n`);
  if (wasNP && !isNP && npDateStr) {
    addText(`NP Recorded: ${npDateStr}\n`);
    addText(`Payment Rec: ${dateStr}\n`);
  } else {
    addText(`Date & Time: ${dateStr}\n`);
  }
  addText(`Txn ID     : ${(transaction.id || '').slice(0, 16)}\n`);
  addText('--------------------------------\n');

  // Customer Details
  addCmd([0x1b, 0x45, 0x01]); // Bold on
  addText(`Customer   : ${customer.name}\n`);
  addCmd([0x1b, 0x45, 0x00]); // Bold off
  addText(`Account ID : #${customer.displayId || customer.id}\n`);
  if (customer.phone) {
    addText(`Phone      : ${customer.phone}\n`);
  }
  addText('--------------------------------\n');

  // Amount - Center, Double Size, Bold
  addCmd([0x1b, 0x61, 0x01]); // Center
  addText(isWithdrawal ? 'AMOUNT PAID OUT\n' : 'AMOUNT RECEIVED\n');
  addCmd([0x1d, 0x21, 0x11]); // Double size
  addCmd([0x1b, 0x45, 0x01]); // Bold on
  addText(`Rs. ${transaction.amount.toLocaleString('en-IN')}\n`);
  addCmd([0x1d, 0x21, 0x00]); // Normal
  addCmd([0x1b, 0x45, 0x00]); // Bold off
  addText(`[ ${modeStr} ]\n`);
  addText('--------------------------------\n');

  // Financial Breakdown - Left align
  addCmd([0x1b, 0x61, 0x00]);
  addText(
    isWithdrawal
      ? `Prev Deposit: Rs. ${previousBalance.toLocaleString('en-IN')}\n`
      : `Previous Bal: Rs. ${previousBalance.toLocaleString('en-IN')}\n`
  );
  addText(
    isWithdrawal
      ? `Withdrawn   : Rs. ${transaction.amount.toLocaleString('en-IN')}\n`
      : `Amount Paid : Rs. ${transaction.amount.toLocaleString('en-IN')}\n`
  );
  addCmd([0x1b, 0x45, 0x01]); // Bold on
  addText(
    isWithdrawal
      ? `Remaining Dp: Rs. ${newBalance.toLocaleString('en-IN')}\n`
      : `Remaining   : Rs. ${newBalance.toLocaleString('en-IN')}\n`
  );
  addCmd([0x1b, 0x45, 0x00]); // Bold off
  addText('--------------------------------\n');

  // Footer - Center
  addCmd([0x1b, 0x61, 0x01]);
  addText('Verified & Recorded Digitally\n');
  addText('Thank you for your payment!\n');
  addText('================================\n');

  // Line feeds & paper cut: GS V 66 0
  addText('\n\n\n');
  addCmd([0x1d, 0x56, 0x42, 0x00]);

  // Combine parts
  const totalLength = parts.reduce((acc, p) => acc + p.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    combined.set(part, offset);
    offset += part.length;
  }

  return combined;
}

/**
 * Attempts to connect directly to a Bluetooth ESC/POS thermal printer via Web Bluetooth.
 */
export async function printViaBluetoothThermal(
  data: ReceiptData
): Promise<'printed' | 'unsupported' | 'cancelled' | 'failed'> {
  if (!isBluetoothPrintSupported()) {
    return 'unsupported';
  }

  try {
    const nav = navigator as any;
    // Request thermal printer device with standard serial / printer service UUIDs
    const device = await nav.bluetooth.requestDevice({
      filters: [
        { services: ['000018f0-0000-1000-8000-00805f9b34fb'] }, // Standard ESC/POS printer service
        { services: ['e7810a71-73ae-499d-8c15-faa9aef0c3f2'] }, // POS printer service
        { services: ['49535343-fe7d-4ae5-8fa9-9fafd205e455'] }  // ISSC Transparent UART
      ],
      optionalServices: [
        '000018f0-0000-1000-8000-00805f9b34fb',
        'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
        '49535343-fe7d-4ae5-8fa9-9fafd205e455'
      ]
    });

    if (!device || !device.gatt) {
      return 'failed';
    }

    const server = await device.gatt.connect();
    const services = await server.getPrimaryServices();
    
    if (services.length === 0) {
      device.gatt.disconnect();
      return 'failed';
    }

    // Find writable characteristic
    let writeChar: any = null;
    for (const service of services) {
      const chars = await service.getCharacteristics();
      for (const char of chars) {
        if (char.properties.write || char.properties.writeWithoutResponse) {
          writeChar = char;
          break;
        }
      }
      if (writeChar) break;
    }

    if (!writeChar) {
      device.gatt.disconnect();
      return 'failed';
    }

    // Send ESC/POS data in chunks (BLE standard max packet size ~20-100 bytes)
    const rawData = buildEscPosData(data);
    const chunkSize = 64;
    for (let i = 0; i < rawData.length; i += chunkSize) {
      const chunk = rawData.slice(i, i + chunkSize);
      if (writeChar.writeValueWithResponse) {
        await writeChar.writeValueWithResponse(chunk);
      } else {
        await writeChar.writeValueWithoutResponse(chunk);
      }
    }

    // Disconnect after slight delay to ensure buffer flushed
    setTimeout(() => {
      try {
        device.gatt.disconnect();
      } catch (e) {
        // ignore
      }
    }, 1000);

    return 'printed';
  } catch (error: any) {
    if (error.name === 'NotFoundError' || error.name === 'AbortError') {
      return 'cancelled';
    }
    console.warn('Bluetooth thermal print error:', error);
    return 'failed';
  }
}

/**
 * Triggers printing using a dedicated thermal receipt layout via the system print dialog.
 * This works natively on Android (including Bluetooth print spoolers like RawBT/ESC POS Print Service),
 * iOS AirPrint, and desktop print dialogs.
 */
export function printViaSystemThermal(data: ReceiptData): void {
  const { transaction, customer, previousBalance, newBalance } = data;
  const settings = getReceiptSettings();
  const receiptNo = `REC-${(transaction.id || '').slice(0, 8).toUpperCase()}`;
  const dateStr = safeFormat(
    transaction.paidAt || transaction.timestamp || transaction.date,
    'dd MMM yyyy, hh:mm a',
    safeFormat(Date.now(), 'dd MMM yyyy, hh:mm a')
  );
  const isUpi = transaction.type === 'phonepe';
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
    ? safeFormat(rawNpTime, 'dd MMM yyyy, hh:mm a', 'Earlier') 
    : (transaction.npMarkedDate || null);

  const paymentModeLabel = isUpi ? 'UPI / PhonePe' : isNP ? 'NP' : wasNP ? 'Cash (Settled from NP)' : 'Cash Deposit';

  // 1. Direct native Android PrintManager hook
  if ((window as any).AndroidNativeApp?.printCurrentPage) {
    (window as any).AndroidNativeApp.printCurrentPage(`Receipt_${receiptNo}`);
    return;
  }

  // Create isolated print content

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Receipt_${receiptNo}</title>
        <meta charset="utf-8">
        <style>
          @page {
            size: 80mm auto;
            margin: 1mm 2mm;
          }
          @media print {
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          body {
            font-family: monospace, sans-serif;
            width: 72mm;
            max-width: 100%;
            margin: 0 auto;
            padding: 2mm 1mm;
            color: #000000;
            background: #ffffff;
            font-size: 11px;
            line-height: 1.3;
          }
          .header {
            text-align: center;
            border-bottom: 1.5px dashed #000000;
            padding-bottom: 6px;
            margin-bottom: 6px;
          }
          .title {
            font-size: 16px;
            font-weight: 900;
            letter-spacing: -0.3px;
            text-transform: uppercase;
          }
          .subtitle {
            font-size: 9px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .meta-row {
            display: flex;
            justify-content: space-between;
            font-size: 10px;
            margin-top: 2px;
          }
          .meta-label {
            font-weight: 600;
          }
          .meta-value {
            font-weight: 700;
          }
          .divider {
            border-top: 1px dashed #000000;
            margin: 6px 0;
          }
          .amount-box {
            text-align: center;
            border: 1.5px solid #000000;
            padding: 6px 4px;
            margin: 6px 0;
          }
          .amount-label {
            font-size: 9px;
            font-weight: 800;
            letter-spacing: 0.5px;
            text-transform: uppercase;
          }
          .amount-value {
            font-size: 20px;
            font-weight: 900;
            margin: 2px 0;
          }
          .badge {
            display: inline-block;
            padding: 1px 6px;
            border: 1px solid #000000;
            font-size: 8.5px;
            font-weight: 800;
            text-transform: uppercase;
          }
          .section-title {
            font-size: 9.5px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 3px;
          }
          .balance-box {
            border: 1px dashed #000000;
            padding: 5px 6px;
            margin-top: 5px;
          }
          .footer {
            text-align: center;
            margin-top: 8px;
            padding-top: 5px;
            border-top: 1.5px dashed #000000;
            font-size: 8.5px;
            line-height: 1.3;
          }
        </style>
      </head>
      <body>
        <div class="header">
          ${settings.printLogo ? `<div style="margin-bottom: 4px;"><img src="${PIGMY_LOGO_BASE64}" style="width: 30px; height: 30px; object-fit: contain;" /></div>` : ''}
          <div class="title">PIGMY PRO</div>
          <div class="subtitle">Smart Collection System</div>
          <div style="font-size: 8px; margin-top: 2px;">Official Thermal Voucher</div>
        </div>

        <div class="meta-row">
          <span class="meta-label">Receipt ID:</span>
          <span class="meta-value">${receiptNo}</span>
        </div>
        ${wasNP && !isNP && npDateStr ? `
        <div class="meta-row">
          <span class="meta-label">NP Recorded:</span>
          <span class="meta-value">${npDateStr}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Payment Settled:</span>
          <span class="meta-value" style="font-weight: bold;">${dateStr}</span>
        </div>
        ` : `
        <div class="meta-row">
          <span class="meta-label">Date & Time:</span>
          <span class="meta-value">${dateStr}</span>
        </div>
        `}
        <div class="meta-row">
          <span class="meta-label">Transaction:</span>
          <span class="meta-value" style="font-family: monospace;">${(transaction.id || '').slice(0, 14)}</span>
        </div>

        <div class="divider"></div>

        <div class="section-title">Customer Details</div>
        <div class="meta-row">
          <span class="meta-label">Name:</span>
          <span class="meta-value" style="font-size: 11px;">${customer.name}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Account / ID:</span>
          <span class="meta-value">#${customer.displayId || customer.id}</span>
        </div>
        ${customer.phone ? `
          <div class="meta-row">
            <span class="meta-label">Phone:</span>
            <span class="meta-value">${customer.phone}</span>
          </div>
        ` : ''}

        <div class="amount-box">
          <div class="amount-label">Amount Collected</div>
          <div class="amount-value">Rs. ${transaction.amount.toLocaleString('en-IN')}</div>
          <div class="badge">${paymentModeLabel}</div>
        </div>

        <div class="divider"></div>

        <div class="section-title">Account Balance Summary</div>
        <div class="meta-row">
          <span class="meta-label">Previous Balance:</span>
          <span class="meta-value">Rs. ${previousBalance.toLocaleString('en-IN')}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Amount Credited:</span>
          <span class="meta-value">- Rs. ${transaction.amount.toLocaleString('en-IN')}</span>
        </div>
        
        <div class="balance-box">
          <div class="meta-row" style="margin: 0; align-items: center;">
            <span style="font-weight: 800; font-size: 10px;">Net Remaining:</span>
            <span style="font-weight: 900; font-size: 12px;">Rs. ${newBalance.toLocaleString('en-IN')}</span>
          </div>
        </div>

        ${settings.includeFooterNotes ? `
        <div class="footer">
          <div>*** VERIFIED DIGITAL LEDGER ***</div>
          <div>Authorized Agent • Thank You!</div>
          <div style="font-size: 7px; margin-top: 2px;">PIGMY PRO THERMAL TICKET</div>
        </div>
        ` : ''}
      </body>
    </html>
  `;

  const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  if (isMobile) {
    const printWin = window.open('', '_blank');
    if (printWin) {
      printWin.document.open();
      printWin.document.write(htmlContent);
      printWin.document.close();
      printWin.focus();
      setTimeout(() => {
        try {
          printWin.print();
        } catch {
          window.print();
        }
      }, 350);
      return;
    }
    window.print();
    return;
  }

  // Desktop print via isolated iframe
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    window.print();
    return;
  }

  doc.open();
  doc.write(htmlContent);
  doc.close();

  // Wait for images and styling to load before triggering print
  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (e) {
      window.print();
    } finally {
      setTimeout(() => {
        try {
          document.body.removeChild(iframe);
        } catch (e) {
          // ignore
        }
      }, 5000);
    }
  }, 250);
}

/**
 * Universal print handler that can print to Bluetooth thermal printers
 * or through the system print dialog (which connects to all Bluetooth, USB, Wi-Fi & thermal printers).
 */
export async function printReceipt(
  data: ReceiptData,
  tryBluetoothFirst: boolean = false
): Promise<'printed_bluetooth' | 'printed_system' | 'cancelled'> {
  if (tryBluetoothFirst && isBluetoothPrintSupported()) {
    const btResult = await printViaBluetoothThermal(data);
    if (btResult === 'printed') {
      return 'printed_bluetooth';
    }
    if (btResult === 'cancelled') {
      return 'cancelled';
    }
  }

  // Use system thermal print dialog
  printViaSystemThermal(data);
  return 'printed_system';
}
