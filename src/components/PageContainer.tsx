import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { useUI } from '../context/UIContext';
import { cn } from '../lib/utils';

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
  onScroll?: (scrollTop: number) => void;
}

export const PageContainer = forwardRef<HTMLDivElement, PageContainerProps>(({ children, className, onScroll }, ref) => {
  const internalRef = useRef<HTMLDivElement>(null);
  const { isCompact } = useUI();

  useImperativeHandle(ref, () => internalRef.current!);

  // Reset scroll on mount
  useEffect(() => {
    if (internalRef.current) {
      internalRef.current.scrollTop = 0;
    }
  }, []);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (onScroll) {
      onScroll(e.currentTarget.scrollTop);
    }
  };

  return (
    <div 
      ref={internalRef}
      onScroll={handleScroll}
      data-scroll-container="true"
      className={cn(
        "h-full w-full overflow-y-auto scroll-smooth overscroll-contain",
        "[-webkit-overflow-scrolling:touch] isolate",
        "pb-[calc(80px+env(safe-area-inset-bottom))]", 
        isCompact ? 'px-gap pt-gap' : 'px-base pt-base',
        className
      )}
    >
      {children}
    </div>
  );
});
