import React, { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Share2, Printer, ChevronLeft, ChevronRight,
  ZoomIn, ZoomOut, Loader2, BookOpen, Layers,
  AlertCircle, MessageCircle
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { toast } from 'sonner';
import { useUI } from '../context/UIContext';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { 
  shareFileForAndroid,
  shareFileToWhatsApp,
  printFileForAndroid
} from '../utils/capacitorDeviceHelper';

// Configure worker for pdfjs-dist
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

interface PDFViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: {
    blob: Blob;
    fileName: string;
    title: string;
  } | null;
}

interface RenderedPage {
  pageNumber: number;
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
}

export function PDFViewerModal({ isOpen, onClose, report }: PDFViewerModalProps) {
  const { setIsModalOpen } = useUI();
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [viewMode, setViewMode] = useState<'single' | 'scroll'>('single');
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [renderedPages, setRenderedPages] = useState<RenderedPage[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const focusTrapRef = useFocusTrap(isOpen);
  const touchStartXRef = useRef<number | null>(null);

  // Sync isModalOpen and handle Escape key for accessibility
  useEffect(() => {
    if (isOpen) {
      setIsModalOpen(true);
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        setIsModalOpen(false);
        window.removeEventListener('keydown', handleKeyDown);
      };
    } else {
      setIsModalOpen(false);
    }
  }, [isOpen, setIsModalOpen, onClose]);

  // Load and render PDF
  useEffect(() => {
    let isCancelled = false;

    if (!isOpen || !report?.blob) {
      setRenderedPages([]);
      setNumPages(0);
      setCurrentPage(1);
      setBlobUrl(null);
      setError(null);
      return;
    }

    if (report.blob.size === 0) {
      toast.error('The generated report is empty.');
      onClose();
      return;
    }

    const url = URL.createObjectURL(report.blob);
    setBlobUrl(url);
    setLoading(true);
    setError(null);

    async function loadPDF() {
      try {
        const arrayBuffer = await report!.blob.arrayBuffer();
        if (isCancelled) return;

        const loadingTask = pdfjsLib.getDocument({
          data: new Uint8Array(arrayBuffer),
          cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@' + pdfjsLib.version + '/cmaps/',
          cMapPacked: true,
        });

        const pdfDoc = await loadingTask.promise;
        if (isCancelled) return;

        setNumPages(pdfDoc.numPages);
        setCurrentPage(1);

        const pagesList: RenderedPage[] = [];
        const dpr = Math.min(window.devicePixelRatio || 1, 2.5);

        for (let i = 1; i <= pdfDoc.numPages; i++) {
          if (isCancelled) return;
          const page = await pdfDoc.getPage(i);
          
          // Base scale 1.5 for high quality rendering
          const baseViewport = page.getViewport({ scale: 1.5 });

          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d', { alpha: false });

          canvas.width = Math.floor(baseViewport.width * dpr);
          canvas.height = Math.floor(baseViewport.height * dpr);
          canvas.style.width = '100%';
          canvas.style.height = 'auto';
          canvas.style.display = 'block';

          if (context) {
            context.imageSmoothingEnabled = true;
            context.imageSmoothingQuality = 'high';
            context.setTransform(dpr, 0, 0, dpr, 0, 0);

            await page.render({
              canvasContext: context,
              viewport: baseViewport,
              canvas: canvas,
            }).promise;
          }

          pagesList.push({
            pageNumber: i,
            canvas,
            width: baseViewport.width,
            height: baseViewport.height,
          });
        }

        if (!isCancelled) {
          setRenderedPages(pagesList);
          setLoading(false);
        }
      } catch (err: any) {
        console.error('PDF rendering failed:', err);
        if (!isCancelled) {
          setError(err?.message || 'Failed to render PDF preview');
          setLoading(false);
        }
      }
    }

    loadPDF();

    return () => {
      isCancelled = true;
      URL.revokeObjectURL(url);
    };
  }, [isOpen, report, onClose]);

  // Direct WhatsApp Share Handler (No download button needed)
  const handleWhatsAppShare = async () => {
    if (!report) return;
    try {
      const summaryText = 
`📊 *PIGMY PRO FINANCIAL REPORT*
━━━━━━━━━━━━━━━━━━
*Report:* ${report.title}
*Document:* ${report.fileName}
*Date:* ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
━━━━━━━━━━━━━━━━━━
Generated from Pigmy Pro Digital Ledger.`;

      const result = await shareFileToWhatsApp(report.blob, report.fileName, '', summaryText);
      if (result === 'shared') {
        toast.success('Report shared via WhatsApp');
      } else {
        toast.info('Opening WhatsApp...');
      }
    } catch (e) {
      console.error('WhatsApp share error:', e);
      toast.error('Could not share to WhatsApp');
    }
  };

  // Native System Share Sheet
  const handleShare = async () => {
    if (!report) return;
    try {
      const result = await shareFileForAndroid(
        report.blob, 
        report.fileName, 
        report.title,
        `Pigmy Pro Audit Report: ${report.title}`
      );
      if (result === 'shared') {
        toast.success('Report shared successfully');
      } else if (result === 'downloaded') {
        toast.success('Report saved to device');
      }
    } catch (e) {
      console.error('Share error:', e);
      toast.error('Sharing failed');
    }
  };

  // Universal System Print Handler
  const handlePrint = async () => {
    if (!report) return;
    try {
      const printed = await printFileForAndroid(report.blob, report.fileName, report.title);
      if (printed) {
        toast.success('Document sent to print spooler');
      }
    } catch (e) {
      console.error('Print error:', e);
      toast.error('Could not open print spooler');
    }
  };

  const handlePrevPage = useCallback(() => {
    setCurrentPage(prev => Math.max(1, prev - 1));
  }, []);

  const handleNextPage = useCallback(() => {
    setCurrentPage(prev => Math.min(numPages, prev + 1));
  }, [numPages]);

  // Touch Swipe for Mobile (Flip pages with swipe gestures)
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartXRef.current - touchEndX;

    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        handleNextPage();
      } else {
        handlePrevPage();
      }
    }
    touchStartXRef.current = null;
  };

  const zoomIn = () => setZoomLevel(prev => Math.min(prev + 0.25, 2.5));
  const zoomOut = () => setZoomLevel(prev => Math.max(prev - 0.25, 0.6));
  const resetZoom = () => setZoomLevel(1.0);

  if (!isOpen) return null;

  const content = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="pdf-viewer-modal"
          ref={focusTrapRef as any}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex flex-col bg-zinc-950 text-white overflow-hidden select-none outline-none"
        >
          {/* Header */}
          <div className="px-3 sm:px-6 py-3 flex items-center justify-between bg-zinc-900 border-b border-zinc-800 shrink-0 z-20">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <button 
                onClick={onClose}
                className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white active:scale-95 transition-all cursor-pointer"
                title="Close"
              >
                <ChevronLeft size={22} />
              </button>
              <div className="min-w-0">
                <h1 className="text-[13px] sm:text-[14px] font-bold text-white tracking-tight truncate max-w-[170px] sm:max-w-md">
                  {report?.title || 'Report Preview'}
                </h1>
                <p className="text-[9px] font-bold text-white/50 uppercase tracking-widest leading-none mt-0.5">
                  {numPages > 0 
                    ? `${numPages} Pages • ${viewMode === 'single' ? `Page ${currentPage}` : 'Continuous'}` 
                    : 'Digital Ledger Report'}
                </p>
              </div>
            </div>
            
            {/* Streamlined Actions: View Mode, Print, WhatsApp, Native Share (Download button removed) */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* View Mode Toggle (Single Page vs Continuous Scroll) */}
              <button
                onClick={() => setViewMode(prev => prev === 'single' ? 'scroll' : 'single')}
                className="h-9 px-2.5 rounded-xl bg-white/10 hover:bg-white/20 flex items-center gap-1.5 text-xs text-white/90 active:scale-95 transition-all cursor-pointer"
                title={viewMode === 'single' ? 'Switch to Continuous Scroll' : 'Switch to One Page at a Time'}
              >
                {viewMode === 'single' ? (
                  <>
                    <BookOpen size={15} className="text-accent" />
                    <span className="hidden sm:inline text-[11px] font-bold">1 Page</span>
                  </>
                ) : (
                  <>
                    <Layers size={15} className="text-emerald-400" />
                    <span className="hidden sm:inline text-[11px] font-bold">Scroll</span>
                  </>
                )}
              </button>

              {/* Print Button */}
              <motion.button 
                whileTap={{ scale: 0.92 }}
                onClick={handlePrint}
                title="Print Report (Thermal / Spooler)"
                className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all cursor-pointer"
              >
                <Printer size={16} />
              </motion.button>

              {/* WhatsApp Direct Share Button */}
              <motion.button 
                whileTap={{ scale: 0.92 }}
                onClick={handleWhatsAppShare}
                title="Send via WhatsApp"
                className="w-9 h-9 rounded-xl bg-emerald-600 hover:bg-emerald-500 flex items-center justify-center text-white transition-all shadow-md shadow-emerald-600/30 cursor-pointer"
              >
                <MessageCircle size={16} strokeWidth={2.4} />
              </motion.button>

              {/* Native System Share Sheet */}
              <motion.button 
                whileTap={{ scale: 0.92 }}
                onClick={handleShare}
                title="Share Report via Android Share Sheet"
                className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center text-white hover:brightness-110 transition-all shadow-md shadow-accent/25 cursor-pointer"
              >
                <Share2 size={16} strokeWidth={2.4} />
              </motion.button>
            </div>
          </div>

          {/* PDF Viewer Body */}
          <div 
            ref={containerRef}
            onTouchStart={viewMode === 'single' ? handleTouchStart : undefined}
            onTouchEnd={viewMode === 'single' ? handleTouchEnd : undefined}
            className="flex-1 min-h-0 overflow-y-auto overflow-x-auto bg-zinc-950 p-2 sm:p-6 flex flex-col items-center justify-start overscroll-contain"
          >
            {loading && (
              <div className="my-auto flex flex-col items-center justify-center gap-3 py-16 text-center">
                <Loader2 className="animate-spin text-accent" size={36} />
                <p className="text-[12px] font-bold text-white/80 uppercase tracking-widest">
                  Loading PDF Document...
                </p>
                <p className="text-[10px] text-white/40">Rendering vector resolution</p>
              </div>
            )}

            {error && (
              <div className="my-auto flex flex-col items-center justify-center gap-4 py-12 px-6 max-w-sm text-center bg-zinc-900 border border-zinc-800 rounded-2xl">
                <AlertCircle className="text-warning" size={36} />
                <div>
                  <h3 className="text-sm font-bold text-white mb-1">Preview Notice</h3>
                  <p className="text-xs text-white/60 mb-4">{error}</p>
                </div>
                <div className="flex gap-2 w-full">
                  <button
                    onClick={handleShare}
                    className="flex-1 py-2.5 rounded-xl bg-accent text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                  >
                    <Share2 size={14} /> Share PDF
                  </button>
                  <button
                    onClick={onClose}
                    className="px-4 py-2.5 rounded-xl bg-zinc-800 text-white font-bold text-xs uppercase tracking-wider active:scale-95 cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}

            {!loading && !error && (
              <div 
                className="w-full flex flex-col items-center transition-transform duration-200"
                style={{ 
                  maxWidth: `${Math.round(100 * zoomLevel)}%`,
                  transformOrigin: 'top center'
                }}
              >
                {/* ONE PAGE AT A TIME MODE */}
                {viewMode === 'single' && renderedPages.length > 0 && (
                  <div className="w-full max-w-4xl flex flex-col items-center gap-3 my-auto">
                    <div 
                      key={`single-page-${currentPage}`}
                      className="w-full bg-white rounded-xl shadow-2xl overflow-hidden border border-zinc-800"
                      ref={(node) => {
                        if (node && renderedPages[currentPage - 1]) {
                          node.innerHTML = '';
                          node.appendChild(renderedPages[currentPage - 1].canvas);
                        }
                      }}
                    />
                  </div>
                )}

                {/* CONTINUOUS SCROLLABLE PDF MODE */}
                {viewMode === 'scroll' && (
                  <div className="w-full max-w-4xl flex flex-col items-center gap-6 py-4">
                    {renderedPages.map((page) => (
                      <div 
                        key={`scroll-page-${page.pageNumber}`}
                        className="w-full flex flex-col items-center gap-2"
                      >
                        <div 
                          className="w-full bg-white rounded-xl shadow-2xl overflow-hidden border border-zinc-800"
                          ref={(node) => {
                            if (node) {
                              node.innerHTML = '';
                              node.appendChild(page.canvas);
                            }
                          }}
                        />
                        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                          Page {page.pageNumber} of {numPages}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bottom Navigation & Zoom Toolbar (No Save/Download Button) */}
          <div className="px-3 sm:px-6 py-2.5 bg-zinc-900 border-t border-zinc-800 flex items-center justify-between shrink-0 z-20">
            {/* Left: Page Navigation (One page at a time) */}
            {viewMode === 'single' && numPages > 1 ? (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  onClick={handlePrevPage}
                  disabled={currentPage <= 1}
                  className="h-8 px-2.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:pointer-events-none text-white text-xs font-bold flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
                >
                  <ChevronLeft size={16} />
                  <span className="hidden sm:inline">Prev</span>
                </button>
                
                <span className="px-2 text-[11px] font-mono font-bold text-white/90">
                  {currentPage} / {numPages}
                </span>

                <button
                  onClick={handleNextPage}
                  disabled={currentPage >= numPages}
                  className="h-8 px-2.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:pointer-events-none text-white text-xs font-bold flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            ) : (
              <span className="text-[11px] font-mono text-white/50 uppercase tracking-wider">
                {numPages > 0 ? `${numPages} Pages` : ''}
              </span>
            )}

            {/* Right: Zoom Controls */}
            <div className="flex items-center gap-1 bg-white/5 rounded-xl border border-white/10 p-0.5">
              <button 
                onClick={zoomOut}
                disabled={zoomLevel <= 0.6}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-white/70 hover:text-white disabled:opacity-30 active:scale-90 transition-all cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut size={14} />
              </button>
              <button 
                onClick={resetZoom}
                className="px-2 text-[10px] font-mono text-white/80 hover:text-white cursor-pointer"
                title="Reset Zoom to 100%"
              >
                {Math.round(zoomLevel * 100)}%
              </button>
              <button 
                onClick={zoomIn}
                disabled={zoomLevel >= 2.5}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-white/70 hover:text-white disabled:opacity-30 active:scale-90 transition-all cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn size={14} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
}
