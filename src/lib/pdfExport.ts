import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { Transaction, Customer } from '../services/firestoreService';
import { safeFormat } from './utils';
import { isAndroidApp, shareFileForAndroid } from '../utils/capacitorDeviceHelper';

export async function exportTransactionsPDF(
  transactions: Transaction[], 
  customers: Customer[],
  filterType: string,
  reportTitle: string = 'Transaction Report',
  dateRangeStr: string = 'All Time'
) {
  // Use landscape for ledger style as requested for comparison
  const doc = new jsPDF({ orientation: 'landscape' });
  const today = format(new Date(), 'dd MMM yyyy, hh:mm a');

  // Unique sorted dates (ascending)
  const uniqueDates = Array.from(new Set(transactions.map(t => t.date))).sort((a, b) => a.localeCompare(b));
  
  // App Branding Header (Landscape)
  doc.setFillColor(67, 97, 238); // Brand blue
  doc.rect(0, 0, 297, 35, 'F');
  
  doc.setFontSize(24);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('PIGMY COLLECTOR', 14, 20);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Digital Ledger & Daily Collection', 14, 27);
  
  // Header Info
  doc.setTextColor(40, 44, 52);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(reportTitle, 14, 50);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(`Report Period: ${dateRangeStr}`, 14, 57);
  doc.text(`Filter: ${filterType}`, 14, 62);
  doc.text(`Generated: ${today}`, 240, 50);

  // Prepare Table Data (Matrix format: Name | Date1 | Date2 ...)
  // Aggregate transactions by Customer Name (normalized) AND Date
  // User requested cleanup: Trim spaces, lowercase for grouping
  const aggregatedData: Record<string, { name: string, dates: Record<string, { amount: number, type: 'cash' | 'phonepe' | 'unsettled' | 'NP' }> }> = {};
  
  transactions.forEach(tx => {
    const customer = customers.find(c => c.id === tx.customerId);
    if (!customer) return;
    
    const cleanNameKey = customer.name.trim().toLowerCase();
    
    if (!aggregatedData[cleanNameKey]) {
      aggregatedData[cleanNameKey] = {
        name: customer.name.trim(), // Keep original casing for display
        dates: {}
      };
    }
    
    if (!aggregatedData[cleanNameKey].dates[tx.date]) {
      aggregatedData[cleanNameKey].dates[tx.date] = { amount: 0, type: 'cash' };
    }
    
    const dayData = aggregatedData[cleanNameKey].dates[tx.date];
    dayData.amount += tx.amount;
    
    // Priority logic for type labels: Unsettled/NP > PhonePe > Cash
    if (tx.status === 'unsettled' || tx.type === 'unsettled' || tx.type === 'NP') {
      dayData.type = 'unsettled';
    } else if (tx.type === 'phonepe' && dayData.type !== 'unsettled') {
      dayData.type = 'phonepe';
    }
  });

  const sortedCustomerNames = Object.keys(aggregatedData).sort();

  // Handle column chunking (Increased limit to 20 as requested: 15-30 range)
  const COL_LIMIT = 20;
  const dateChunks: string[][] = [];
  for (let i = 0; i < uniqueDates.length; i += COL_LIMIT) {
    dateChunks.push(uniqueDates.slice(i, i + COL_LIMIT));
  }

  dateChunks.forEach((chunk, chunkIndex) => {
    if (chunkIndex > 0) doc.addPage();
    
    // Sl No | Customer Name | Date Cols...
    const head = [['Sl No', 'Customer Name', ...chunk.map(d => safeFormat(d, 'dd/MM', String(d)))]];
    const rows = sortedCustomerNames.map((nameKey, index) => {
      const data = aggregatedData[nameKey];
      return [
        index + 1, // Strictly sequential numbering
        data.name,
        ...chunk.map(date => {
          const entry = data.dates[date];
          if (!entry) return '-';
          
          if (entry.type === 'phonepe') return `${entry.amount}(PP)`;
          if (entry.type === 'unsettled' || entry.type === 'NP') return `${entry.amount}(NP)`;
          return `${entry.amount}`;
        })
      ];
    });

    // Calculate column totals for this specific chunk
    const chunkTotals = chunk.map(date => {
      let sum = 0;
      Object.values(aggregatedData).forEach(cust => {
        if (cust.dates[date]) sum += cust.dates[date].amount;
      });
      return sum;
    });

    const footerRow = ['', 'DAILY TOTAL', ...chunkTotals.map(t => `₹${t.toLocaleString()}`)];

    autoTable(doc, {
      startY: chunkIndex === 0 ? 70 : 20,
      head: head,
      body: rows,
      foot: [footerRow],
      theme: 'grid',
      styles: { 
        fontSize: 7, 
        cellPadding: 1.5,
        textColor: [40, 40, 40],
        font: 'helvetica',
        halign: 'center',
        overflow: 'linebreak'
      },
      headStyles: {
        fillColor: [240, 240, 240],
        textColor: [60, 60, 60],
        fontStyle: 'bold',
        halign: 'center'
      },
      footStyles: {
        fillColor: [248, 250, 252],
        textColor: [40, 40, 40],
        fontStyle: 'bold',
        fontSize: 7,
        halign: 'center'
      },
      columnStyles: {
        0: { cellWidth: 10 }, // Sl No width
        1: { cellWidth: 'auto', fontStyle: 'bold', halign: 'left' }
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index >= 2) {
          const text = data.cell.text[0] || '';
          if (text.includes('(PP)')) {
            data.cell.styles.textColor = [67, 97, 238];
          } else if (text.includes('(NP)')) {
            data.cell.styles.textColor = [234, 88, 12];
          }
        }
        if (data.section === 'foot' && data.column.index === 1) {
          data.cell.styles.halign = 'right';
        }
      },
      didDrawPage: (data) => {
        const pageHeight = doc.internal.pageSize.getHeight();
        const legendY = pageHeight - 12;
        
        doc.setFontSize(7);
        doc.setTextColor(100, 100, 100);
        doc.setFont('helvetica', 'bold');
        doc.text('LEGEND:', 14, legendY);
        
        doc.setTextColor(67, 97, 238);
        doc.text('PP = PhonePe', 30, legendY);
        
        doc.setTextColor(234, 88, 12);
        doc.text('NP = Unsettled', 55, legendY);
        
        doc.setTextColor(100, 100, 100);
        doc.setFont('helvetica', 'normal');
        doc.text('(Black = Cash)', 85, legendY);
        
        const str = `Part ${chunkIndex + 1} of ${dateChunks.length} | Page ${(doc as any).internal.getNumberOfPages()}`;
        doc.text(str, data.settings.margin.left, pageHeight - 7);
        doc.text('Pigmy Collector - Digital Ledger', 240, pageHeight - 7);
      }
    });
  });

  const fileName = `pigmy_ledger_${filterType.toLowerCase()}_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`;
  const pdfBlob = doc.output('blob');
  
  return { 
    blob: pdfBlob, 
    fileName, 
    title: reportTitle 
  };
}

export const exportLedgerPDF = exportTransactionsPDF;

/**
 * Specifically handles sharing a PDF Blob using Capacitor on Android or Web Share API on Web.
 * Ensures a File object is used as per modern browser requirements.
 */
export async function sharePDF(blob: Blob, fileName: string, title: string) {
  if (isAndroidApp()) {
    return shareFileForAndroid(blob, fileName, title);
  }

  if (!navigator.share) return 'unsupported';

  try {
    const file = new File([blob], fileName, { type: 'application/pdf' });
    
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: title,
        text: `Sharing ${title} from Pigmy Collector.`
      });
      return 'shared';
    }
  } catch (error: any) {
    if (error.name === 'AbortError') return 'cancelled';
    console.warn('Share feature failed:', error);
  }
  
  return 'failed';
}
