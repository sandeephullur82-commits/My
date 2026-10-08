import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { useUI } from '../context/UIContext';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  showCloseButton?: boolean;
  maxWidth?: string;
}

export function BottomSheet({ 
  isOpen, 
  onClose, 
  title, 
  subtitle, 
  children, 
  footer,
  showCloseButton = true,
  maxWidth = 'max-w-xl'
}: BottomSheetProps) {
  const { setIsModalOpen } = useUI();
  const containerRef = useFocusTrap(isOpen);

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
    }
  }, [isOpen, setIsModalOpen, onClose]);


  const content = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          aria-hidden="true"
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99990]"
        />
      )}
      {isOpen && (
        <motion.div
          key="sheet-container"
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? "bottom-sheet-title" : undefined}
          className="fixed inset-0 z-[99995] flex items-end justify-center pointer-events-none"
        >
          <motion.div
            ref={containerRef as any}
            tabIndex={-1}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 20, stiffness: 260 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.2}
            onDragEnd={(_, info) => {
              if (info.offset.y > 100 || info.velocity.y > 500) onClose();
            }}
            className={`w-full ${maxWidth} bg-card rounded-t-[32px] shadow-2xl flex flex-col pointer-events-auto max-h-[90vh] border-t border-border/50 relative overflow-hidden outline-none`}
          >
            {/* Handle */}
            <div className="flex flex-col items-center pt-3 pb-2 shrink-0">
              <div className="w-10 h-1 bg-border rounded-full mb-4 opacity-30" />
              
              {(title || showCloseButton) && (
                <div className="flex items-center justify-between w-full px-6 mb-2">
                  <div className="flex-1">
                    {title && (
                      <h3 id="bottom-sheet-title" className="text-[20px] font-bold text-text-primary tracking-tight uppercase leading-none">{title}</h3>
                    )}
                    {subtitle && (
                      <p className="text-[11px] font-black text-text-secondary opacity-60 uppercase tracking-widest leading-none mt-1.5">
                        {subtitle}
                      </p>
                    )}
                  </div>
                  {showCloseButton && (
                    <motion.button 
                      whileTap={{ scale: 0.96, transition: { duration: 0.08 } }}
                      onClick={onClose}
                      aria-label="Close dialog"
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-text-secondary hover:text-text-primary hover:bg-muted transition-all active:scale-90"
                    >
                      <X size={18} />
                    </motion.button>
                  )}
                </div>
              )}
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto px-6 pt-2 pb-8 scrollbar-hide min-h-0">
              {children}
              {/* Extra spacer if no footer present */}
              {!footer && <div className="h-10 shrink-0" />}
            </div>

            {/* Sticky Footer */}
            {footer && (
              <div className="shrink-0 pt-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] px-6 bg-gradient-to-t from-card via-card to-transparent border-t border-border/10">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
}
