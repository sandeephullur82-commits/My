import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { FintechToast, FintechToastProps } from '../components/FintechToast';
import { AnimatePresence } from 'motion/react';
import { createPortal } from 'react-dom';
import { firestoreService, NotificationRecord } from '../services/firestoreService';

interface FeedbackContextType {
  toastSuccess: (title: string, message?: string, saveToHistory?: boolean) => void;
  toastError: (title: string, message?: string, onRetry?: () => void, saveToHistory?: boolean) => void;
  toastTransaction: (params: {
    amount: number;
    customerName: string;
    paymentType: 'cash' | 'phonepe' | 'unsettled';
    onUndo?: () => void;
    onCommit?: () => void;
  }) => string | number;
  toastAction: (params: {
    title: string;
    message: string;
    label: string;
    isUndo?: boolean;
    onUndo?: () => void;
    onCommit?: () => void;
    priority?: 'high' | 'medium' | 'low';
    type?: FintechToastProps['type'];
    saveToHistory?: boolean;
  }) => string | number;
  toastAdvanced: (params: Omit<FintechToastProps, 'onClose' | 'id'>) => string | number;
  dismissToast: (id: string | number) => void;
  history: NotificationRecord[];
  clearHistory: () => void;
  deleteNotification: (id: string) => void;
  markAsRead: (id: string) => void;
  isCenterOpen: boolean;
  setCenterOpen: (open: boolean) => void;
}

const FeedbackContext = createContext<FeedbackContextType | null>(null);

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<FintechToastProps[]>([]);
  const [history, setHistory] = useState<NotificationRecord[]>([]);
  const [isCenterOpen, setCenterOpen] = useState(false);
  const timeoutsMap = useRef<Map<string | number, NodeJS.Timeout>>(new Map());

  useEffect(() => {
    const unsubNotify = firestoreService.subscribeNotifications((data) => {
      setHistory(data);
    });
    return () => unsubNotify();
  }, []);

  const saveToStore = useCallback(async (toast: Omit<FintechToastProps, 'onClose' | 'id'>) => {
    try {
      const recordType: NotificationRecord['type'] = toast.type === 'sync' ? 'info' : (toast.type || 'info');
      await firestoreService.addNotification({
        type: recordType,
        priority: toast.priority || 'medium',
        title: toast.title || 'Notification',
        message: toast.message,
        amount: toast.amount,
        customerName: toast.customerName,
        paymentType: toast.paymentType,
        timestamp: Date.now()
      });
    } catch (e) {
      // Background notifications save shouldn't throw
      console.warn('Notification history save warning:', e);
    }
  }, []);

  const dismissToast = useCallback((id: string | number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    if (timeoutsMap.current.has(id)) {
      clearTimeout(timeoutsMap.current.get(id)!);
      timeoutsMap.current.delete(id);
    }
  }, []);

  const addToast = useCallback((toast: Omit<FintechToastProps, 'onClose'>) => {
    const id = toast.id;
    const newToast: FintechToastProps = {
      ...toast,
      timestamp: toast.timestamp || Date.now(),
      onClose: () => dismissToast(id)
    };

    setHistory(prev => [newToast, ...prev].slice(0, 50)); // Keep last 50

    setToasts(prev => {
      const next = [...prev, newToast];
      const priorityMap = { high: 0, medium: 1, low: 2 };
      next.sort((a, b) => (priorityMap[a.priority || 'medium'] || 1) - (priorityMap[b.priority || 'medium'] || 1));
      
      // Keep only top 2 active toasts for a clean, non-obtrusive UI
      if (next.length > 2) return next.slice(0, 2);
      return next;
    });

    return id;
  }, [dismissToast]);

  const toastSuccess = useCallback((title: string, message?: string, saveToHistory = false) => {
    const toastData: Omit<FintechToastProps, 'onClose' | 'id'> = {
      type: 'success',
      priority: 'low',
      title,
      message,
      duration: 1800 // Ultra-fast 1.8s auto-fade
    };
    addToast({ ...toastData, id: Math.random().toString(36).substr(2, 9) });
    if (saveToHistory) saveToStore(toastData);
  }, [addToast, saveToStore]);

  const toastError = useCallback((title: string, message?: string, onRetry?: () => void, saveToHistory = false) => {
    const toastData: Omit<FintechToastProps, 'onClose' | 'id'> = {
      type: 'error',
      priority: 'high',
      title,
      message,
      duration: 2800,
      action: onRetry ? {
        label: 'Retry',
        onClick: () => onRetry()
      } : undefined
    };
    addToast({ ...toastData, id: Math.random().toString(36).substr(2, 9) });
    if (saveToHistory) saveToStore(toastData);
  }, [addToast, saveToStore]);

  /**
   * Instant non-blocking transaction toast with immediate persistence and quick undo.
   * Zero waiting delay.
   */
  const toastTransaction = useCallback((params: {
    amount: number;
    customerName: string;
    paymentType: 'cash' | 'phonepe' | 'unsettled';
    onUndo?: () => void;
    onCommit?: () => void;
  }) => {
    const id = Math.random().toString(36).substr(2, 9);
    const duration = 2200; // Snappy 2.2s display window

    // Commit operation IMMEDIATELY without artificial waiting delay
    if (params.onCommit) {
      params.onCommit();
    }
    
    // Save to history immediately
    saveToStore({
      type: 'transaction',
      priority: 'medium',
      amount: params.amount,
      customerName: params.customerName,
      paymentType: params.paymentType,
      title: 'Payment Received'
    });

    addToast({
      id,
      type: 'transaction',
      priority: 'medium',
      amount: params.amount,
      customerName: params.customerName,
      paymentType: params.paymentType,
      duration,
      action: params.onUndo ? {
        label: 'Undo',
        isUndo: true,
        onClick: () => {
          params.onUndo?.();
          dismissToast(id);
          if ('vibrate' in navigator) navigator.vibrate([10, 20]);
        }
      } : undefined
    });

    if ('vibrate' in navigator) navigator.vibrate(15);
    return id;
  }, [addToast, dismissToast, saveToStore]);

  /**
   * Action toast with immediate commit and instant undo.
   * Eliminates the artificial 2.8s-4s countdown delay.
   */
  const toastAction = useCallback((params: {
    title: string;
    message: string;
    label: string;
    isUndo?: boolean;
    onUndo?: () => void;
    onCommit?: () => void;
    priority?: 'high' | 'medium' | 'low';
    type?: FintechToastProps['type'];
    saveToHistory?: boolean;
  }) => {
    const id = Math.random().toString(36).substr(2, 9);
    const duration = 2200; // Compact, fast 2.2s window

    // Execute commit IMMEDIATELY - no waiting delay
    if (params.onCommit) {
      params.onCommit();
    }

    if (params.saveToHistory) {
      saveToStore({
        type: params.type || 'info',
        priority: params.priority || 'medium',
        title: params.title,
        message: params.message
      });
    }

    addToast({
      id,
      type: params.type || 'info',
      priority: params.priority || 'medium',
      title: params.title,
      message: params.message,
      duration,
      action: {
        label: params.label,
        isUndo: params.isUndo ?? true,
        onClick: () => {
          if (params.onUndo) params.onUndo();
          dismissToast(id);
          if ('vibrate' in navigator) navigator.vibrate([10, 20]); 
        }
      }
    });

    if ('vibrate' in navigator) navigator.vibrate(15);
    return id;
  }, [addToast, dismissToast, saveToStore]);

  const toastAdvanced = useCallback((params: Omit<FintechToastProps, 'onClose' | 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    return addToast({ ...params, id });
  }, [addToast]);

  const deleteNotification = useCallback(async (id: string) => {
    await firestoreService.deleteNotification(id);
  }, []);

  const markAsRead = useCallback(async (id: string) => {
    await firestoreService.markNotificationRead(id);
  }, []);

  const clearHistory = useCallback(async () => {
    await firestoreService.clearNotifications();
  }, []);

  return (
    <FeedbackContext.Provider value={{ 
      toastSuccess, 
      toastError, 
      toastTransaction, 
      toastAction, 
      toastAdvanced,
      dismissToast,
      history,
      clearHistory,
      deleteNotification,
      markAsRead,
      isCenterOpen,
      setCenterOpen
    }}>
      {children}

      {/* Floating Visual Toast Portal: positioned above bottom nav so it never blocks top search & filters */}
      {typeof document !== 'undefined' && createPortal(
        <div 
          aria-live="polite" 
          className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[9999] w-full max-w-md px-3 pointer-events-none flex flex-col gap-2"
        >
          <AnimatePresence mode="popLayout">
            {toasts.map((toast) => (
              <FintechToast key={toast.id} {...toast} />
            ))}
          </AnimatePresence>
        </div>,
        document.body
      )}
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const context = useContext(FeedbackContext);
  if (!context) {
    throw new Error('useFeedback must be used within a FeedbackProvider');
  }
  return context;
}
