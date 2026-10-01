import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { FintechToast, FintechToastProps } from '../components/FintechToast';
import { AnimatePresence } from 'motion/react';
import { createPortal } from 'react-dom';
import { firestoreService, NotificationRecord } from '../services/firestoreService';
import { auth } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

interface FeedbackContextType {
  toastSuccess: (title: string, message?: string, saveToHistory?: boolean) => void;
  toastError: (title: string, message?: string, onRetry?: () => void, saveToHistory?: boolean) => void;
  toastSync: (title: string, message?: string, onAction?: () => void) => void;
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
    deepLinkUrl?: string;
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
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        const unsubNotify = firestoreService.subscribeNotifications(user.uid, (data) => {
          setHistory(data);
        });
        return () => unsubNotify();
      } else {
        setHistory([]);
      }
    });
    return () => unsubAuth();
  }, []);

  const saveToStore = useCallback(async (toast: Omit<FintechToastProps, 'onClose' | 'id'>) => {
    if (!auth.currentUser) return;
    const recordType: NotificationRecord['type'] = toast.type === 'sync' ? 'info' : (toast.type || 'info');
    await firestoreService.addNotification(auth.currentUser.uid, {
      type: recordType,
      priority: toast.priority || 'medium',
      title: toast.title || 'Notification',
      message: toast.message,
      amount: toast.amount,
      customerName: toast.customerName,
      paymentType: toast.paymentType,
      timestamp: Date.now()
    });
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

    setHistory(prev => [newToast as any, ...prev].slice(0, 50));

    setToasts(prev => {
      const next = [newToast, ...prev.filter(t => t.id !== id)];
      // Keep only top 3 most recent notifications on screen
      return next.slice(0, 3);
    });

    return id;
  }, [dismissToast]);

  const toastSuccess = useCallback((title: string, message?: string, saveToHistory = false) => {
    const toastData: Omit<FintechToastProps, 'onClose' | 'id'> = {
      type: 'success',
      priority: 'low',
      title,
      message,
      duration: 4000
    };
    addToast({ ...toastData, id: Math.random().toString(36).substring(2, 9) });
    if (saveToHistory) saveToStore(toastData);
  }, [addToast, saveToStore]);

  const toastSync = useCallback((title: string, message?: string, onAction?: () => void) => {
    const toastData: Omit<FintechToastProps, 'onClose' | 'id'> = {
      type: 'sync',
      priority: 'medium',
      title,
      message,
      duration: 4000,
      action: onAction ? {
        label: 'View',
        onClick: onAction
      } : undefined
    };
    addToast({ ...toastData, id: Math.random().toString(36).substring(2, 9) });
  }, [addToast]);

  const toastError = useCallback((title: string, message?: string, onRetry?: () => void, saveToHistory = false) => {
    const toastData: Omit<FintechToastProps, 'onClose' | 'id'> = {
      type: 'error',
      priority: 'high',
      title,
      message,
      duration: 6000,
      action: onRetry ? {
        label: 'Retry',
        onClick: () => onRetry()
      } : undefined
    };
    addToast({ ...toastData, id: Math.random().toString(36).substring(2, 9) });
    if (saveToHistory) saveToStore(toastData);
  }, [addToast, saveToStore]);

  const toastTransaction = useCallback((params: {
    amount: number;
    customerName: string;
    paymentType: 'cash' | 'phonepe' | 'unsettled';
    onUndo?: () => void;
    onCommit?: () => void;
  }) => {
    const id = Math.random().toString(36).substring(2, 9);
    const duration = 4000;

    if (params.onCommit) {
      params.onCommit();
    }
    
    // Save transaction notification to history
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
      title: 'Payment Collected',
      message: `₹${params.amount.toLocaleString('en-IN')} received via ${params.paymentType === 'phonepe' ? 'UPI' : 'Cash'}`,
      duration,
      action: params.onUndo ? {
        label: 'Undo',
        isUndo: true,
        onClick: () => {
          if (params.onUndo) params.onUndo();
          dismissToast(id);
        }
      } : undefined
    });

    return id;
  }, [addToast, dismissToast, saveToStore]);

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
    deepLinkUrl?: string;
  }) => {
    const id = Math.random().toString(36).substring(2, 9);
    const duration = 4000;
    let isCancelled = false;

    const commitTimeout = setTimeout(async () => {
      if (!isCancelled && params.onCommit) params.onCommit();
      
      if (!isCancelled && params.saveToHistory) {
        await saveToStore({
          type: params.type || 'info',
          priority: params.priority || 'medium',
          title: params.title,
          message: params.message
        });
      }
      
      timeoutsMap.current.delete(id);
    }, duration);

    timeoutsMap.current.set(id, commitTimeout);

    addToast({
      id,
      type: params.type || 'info',
      priority: params.priority || 'medium',
      title: params.title,
      message: params.message,
      duration,
      deepLinkUrl: params.deepLinkUrl,
      action: {
        label: params.label,
        isUndo: params.isUndo,
        onClick: () => {
          isCancelled = true;
          if (params.onUndo) params.onUndo();
          dismissToast(id);
        }
      }
    });

    return id;
  }, [addToast, dismissToast, saveToStore]);

  const toastAdvanced = useCallback((params: Omit<FintechToastProps, 'onClose' | 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    return addToast({ ...params, id });
  }, [addToast]);

  const deleteNotification = useCallback(async (id: string) => {
    if (auth.currentUser) await firestoreService.deleteNotification(auth.currentUser.uid, id);
  }, []);

  const markAsRead = useCallback(async (id: string) => {
    if (auth.currentUser) await firestoreService.markNotificationRead(auth.currentUser.uid, id);
  }, []);

  const clearHistory = useCallback(async () => {
    if (auth.currentUser) await firestoreService.clearNotifications(auth.currentUser.uid);
  }, []);

  return (
    <FeedbackContext.Provider value={{ 
      toastSuccess, 
      toastError, 
      toastSync,
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

      {/* Top-Floating Visual Toast Portal */}
      {typeof document !== 'undefined' && createPortal(
        <div 
          aria-live="polite" 
          className="fixed top-3 left-1/2 -translate-x-1/2 z-[9999] w-full max-w-md px-3 pointer-events-none flex flex-col gap-2"
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
