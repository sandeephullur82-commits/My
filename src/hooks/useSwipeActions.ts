import { useState, useRef, useEffect, useCallback } from 'react';
import { useMotionValue, useTransform, animate, PanInfo } from 'motion/react';
import { toast } from 'sonner';
import { triggerWhatsApp } from '../lib/whatsapp';

export function useSwipeActions({
  customerName,
  customerPhone,
  customerId,
}: {
  customerName: string;
  customerPhone?: string;
  customerId?: string;
}) {
  const x = useMotionValue(0);
  const leftActionOpacity = useTransform(x, [10, 60], [0, 1]);
  const rightActionOpacity = useTransform(x, [-60, -10], [1, 0]);

  const [swipedAction, setSwipedAction] = useState<'whatsapp' | 'call' | null>(null);
  const [confirmModal, setConfirmModal] = useState<'whatsapp' | 'call' | null>(null);
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);

  const resetSwipe = useCallback(() => {
    animate(x, 0, { type: 'spring', damping: 25, stiffness: 400 });
    setSwipedAction(null);
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
  }, [x]);

  const startInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    inactivityTimerRef.current = setTimeout(() => {
      resetSwipe();
    }, 4000);
  }, [resetSwipe]);

  useEffect(() => {
    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, []);

  const handleActionTap = useCallback(
    (type: 'whatsapp' | 'call') => {
      if (!customerPhone || !customerPhone.trim()) {
        toast.error('No phone number registered for this customer');
        resetSwipe();
        return;
      }
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
      setConfirmModal(type);
    },
    [customerPhone, resetSwipe]
  );

  const handleConfirmAction = useCallback(() => {
    if (confirmModal === 'whatsapp') {
      if (navigator.vibrate) navigator.vibrate(15);
      if (customerPhone) {
        triggerWhatsApp(customerPhone, customerName, undefined, customerId);
      }
    } else if (confirmModal === 'call') {
      if (navigator.vibrate) navigator.vibrate([10, 30]);
      if (customerPhone) {
        const cleaned = String(customerPhone).replace(/[^\d]/g, '');
        const phoneWithCountry = cleaned.length === 10 ? `+91${cleaned}` : (customerPhone.startsWith('+') ? customerPhone : `+${cleaned}`);
        window.location.href = `tel:${phoneWithCountry}`;
      }
    }
    setConfirmModal(null);
    resetSwipe();
  }, [confirmModal, customerName, customerPhone, customerId, resetSwipe]);

  const handleCancelModal = useCallback(() => {
    setConfirmModal(null);
    resetSwipe();
  }, [resetSwipe]);

  const handleDragEnd = useCallback(
    (_e: any, info: PanInfo) => {
      const threshold = 55;
      if (info.offset.x > threshold) {
        // Swiped Right -> Snap open to reveal WhatsApp button without redirecting immediately
        animate(x, 115, { type: 'spring', damping: 22, stiffness: 320 });
        setSwipedAction('whatsapp');
        startInactivityTimer();
        if (navigator.vibrate) navigator.vibrate(10);
      } else if (info.offset.x < -threshold) {
        // Swiped Left -> Snap open to reveal Call button without redirecting immediately
        animate(x, -115, { type: 'spring', damping: 22, stiffness: 320 });
        setSwipedAction('call');
        startInactivityTimer();
        if (navigator.vibrate) navigator.vibrate(10);
      } else {
        resetSwipe();
      }
    },
    [x, startInactivityTimer, resetSwipe]
  );

  const handleDragStart = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
  }, []);

  // Handle subtle haptic feedback when reaching swipe threshold
  useEffect(() => {
    return x.on('change', (latest) => {
      if ((latest > 55 && latest < 60) || (latest < -55 && latest > -60)) {
        if (navigator.vibrate) navigator.vibrate(10);
      }
    });
  }, [x]);

  return {
    x,
    leftActionOpacity,
    rightActionOpacity,
    swipedAction,
    confirmModal,
    resetSwipe,
    handleActionTap,
    handleConfirmAction,
    handleCancelModal,
    handleDragStart,
    handleDragEnd,
  };
}
