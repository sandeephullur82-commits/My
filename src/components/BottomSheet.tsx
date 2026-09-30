import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

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
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1999]"
        />
      )}
      {isOpen && (
        <motion.div
          key="sheet-container"
          className="fixed inset-0 z-[2000] flex items-end justify-center pointer-events-none"
        >
          <motion.div
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
            className={`w-full ${maxWidth} bg-card rounded-t-[32px] shadow-2xl flex flex-col pointer-events-auto max-h-[90vh] border-t border-border/50 relative overflow-hidden`}
          >
            {/* Handle */}
            <div className="flex flex-col items-center pt-3 pb-2 shrink-0">
              <div className="w-10 h-1 bg-border rounded-full mb-4 opacity-30" />
              
              {(title || showCloseButton) && (
                <div className="flex items-center justify-between w-full px-6 mb-2">
                  <div className="flex-1">
                    {title && (
                      <h3 className="text-[20px] font-bold text-text-primary tracking-tight uppercase leading-none">{title}</h3>
                    )}
                    {subtitle && (
                      <p className="text-[11px] font-black text-text-secondary opacity-30 uppercase tracking-widest leading-none mt-1.5">
                        {subtitle}
                      </p>
                    )}
                  </div>
                  {showCloseButton && (
                    <motion.button 
                      whileTap={{ scale: 0.96, transition: { duration: 0.08 } }}
                      onClick={onClose}
                      className="p-1.5 rounded-full bg-bg text-text-secondary hover:text-text-primary transition-all border border-border/50"
                    >
                      <X size={16} />
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
}
