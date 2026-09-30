import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Download, Share2, Printer, ChevronLeft, Loader2, 
  FileText, Smartphone
} from 'lucide-react';
import { sharePDF } from '../lib/pdfExport';
import { toast } from 'sonner';

interface PDFViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: {
    blob: Blob;
    fileName: string;
    title: string;
  } | null;
}

export function PDFViewerModal({ isOpen, onClose, report }: PDFViewerModalProps) {
  const [pdfDataUri, setPdfDataUri] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    
    if (isOpen && report?.blob) {
      if (report.blob.size === 0) {
        toast.error('The generated report is empty.');
        onClose();
        return;
      }
      // 1. Create Blob URL for Download/Share (kept for efficiency in those actions)
      const url = URL.createObjectURL(report.blob);
      setBlobUrl(url);

      // 2. Convert to Base64 for Preview (Fixes Mobile "Open" button issue)
      const reader = new FileReader();
      reader.onloadend = () => {
        if (isMounted) {
          setPdfDataUri(reader.result as string);
        }
      };
      reader.readAsDataURL(report.blob);
    } else if (!isOpen) {
      setPdfDataUri(null);
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        setBlobUrl(null);
      }
    }

    return () => {
      isMounted = false;
    };
  }, [isOpen, report]);

  const handleDownload = () => {
    if (!blobUrl || !report) return;
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = report.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success('Download started');
  };

  const handleShare = async () => {
    if (!report) return;
    const result = await sharePDF(report.blob, report.fileName, report.title);
    if (result === 'shared') {
      toast.success('Report shared successfully');
    } else if (result === 'unsupported') {
      toast.error('Sharing is not supported on this browser/device');
    } else if (result === 'failed') {
      toast.error('Sharing failed');
    }
  };

  const handlePrint = () => {
    if (!pdfDataUri) return;
    const printWindow = window.open(pdfDataUri, '_blank');
    if (printWindow) {
      printWindow.addEventListener('load', () => {
        printWindow.print();
      }, true);
    } else {
      toast.error('Could not open print window. Please allow popups.');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="pdf-viewer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[1000] flex flex-col bg-bg/95 backdrop-blur-xl"
        >
          {/* Header */}
          <div className="px-base py-4 flex items-center justify-between bg-zinc-950 dark:bg-zinc-900 border-b border-white/5 shrink-0 text-white">
            <div className="flex items-center gap-3">
              <button 
                onClick={onClose}
                className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/70 hover:text-white active:scale-90 transition-all"
              >
                <ChevronLeft size={20} />
              </button>
              <div>
                <h1 className="text-[14px] font-black uppercase tracking-tight text-white line-clamp-1">
                  {report?.title || 'Report Preview'}
                </h1>
                <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest leading-none mt-0.5">
                  Secure Digital Ledger
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <motion.button 
                whileTap={{ scale: 0.9 }}
                onClick={handlePrint}
                title="Print Report"
                className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-all hidden sm:flex"
              >
                <Printer size={18} />
              </motion.button>
              <motion.button 
                whileTap={{ scale: 0.9 }}
                onClick={handleShare}
                title="Share Report"
                className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center text-white hover:brightness-110 transition-all shadow-lg shadow-accent/20"
              >
                <Share2 size={18} />
              </motion.button>
              <motion.button 
                whileTap={{ scale: 0.9 }}
                onClick={handleDownload}
                title="Download Report"
                className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-all"
              >
                <Download size={18} />
              </motion.button>
            </div>
          </div>

          {/* PDF Content */}
          <div className="flex-1 min-h-0 p-4 sm:p-6 overflow-hidden relative">
            {!pdfDataUri ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-4">
                <Loader2 className="animate-spin text-accent" size={32} />
                <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Preparing Document...</p>
              </div>
            ) : (
              <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="w-full h-full bg-white rounded-3xl shadow-2xl shadow-black/10 overflow-hidden border border-border/40"
              >
                <iframe 
                  src={pdfDataUri} 
                  className="w-full h-full border-none"
                  title="PDF Preview"
                  loading="lazy"
                />
              </motion.div>
            )}

            {/* Desktop Hint */}
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/80 backdrop-blur-md rounded-full sm:hidden pointer-events-none">
              <p className="text-[8px] font-bold text-white/60 uppercase tracking-widest whitespace-nowrap flex items-center gap-2">
                <Smartphone size={10} />
                Rotate for better ledger visibility
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
