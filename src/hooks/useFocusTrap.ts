import { useEffect, useRef } from 'react';

/**
 * A custom React hook to trap focus within an active container (like a modal or drawer).
 * Ensures full WCAG 2.4.3 (Focus Order) compliance.
 */
export function useFocusTrap(isOpen: boolean) {
  const containerRef = useRef<HTMLElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Capture the element that was focused before opening the dialog
    previousFocusRef.current = document.activeElement as HTMLElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !containerRef.current) return;

      const selectors = 'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex="0"], [contenteditable]';
      const focusableElements = Array.from(containerRef.current.querySelectorAll(selectors)) as HTMLElement[];

      if (focusableElements.length === 0) {
        e.preventDefault();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        // Shift + Tab (navigating backward)
        if (document.activeElement === firstElement || document.activeElement === containerRef.current) {
          lastElement.focus();
          e.preventDefault();
        }
      } else {
        // Tab (navigating forward)
        if (document.activeElement === lastElement) {
          firstElement.focus();
          e.preventDefault();
        }
      }
    };

    // Auto-focus first input or button in the container
    const timer = setTimeout(() => {
      if (containerRef.current) {
        const selectors = 'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex="0"], [contenteditable]';
        const focusableElements = Array.from(containerRef.current.querySelectorAll(selectors)) as HTMLElement[];
        
        // Find if there's any autoFocus field first, or fall back to the first interactive element
        const autoFocusEl = focusableElements.find(el => el.hasAttribute('autofocus')) || focusableElements[0];
        
        if (autoFocusEl) {
          autoFocusEl.focus();
        } else {
          containerRef.current.focus();
        }
      }
    }, 100);

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
      
      // Delay focus restoration slightly to prevent layout jumps or immediate re-trigger events
      const restoreTimer = setTimeout(() => {
        if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
          previousFocusRef.current.focus();
        }
      }, 50);

      return () => clearTimeout(restoreTimer);
    };
  }, [isOpen]);

  return containerRef;
}
