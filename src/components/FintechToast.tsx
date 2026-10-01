import React from 'react';

export interface ToastAction {
  label: string;
  onClick: () => void;
  isUndo?: boolean;
}

export interface FintechToastProps {
  id: string | number;
  type: 'success' | 'error' | 'info' | 'transaction' | 'warning' | 'critical';
  priority?: 'high' | 'medium' | 'low';
  title?: string;
  message?: string;
  amount?: number;
  customerName?: string;
  paymentType?: 'cash' | 'phonepe' | 'unsettled';
  timestamp?: number;
  duration?: number;
  onClose: () => void;
  actions?: ToastAction[];
  action?: ToastAction;
}

export function FintechToast(_props: FintechToastProps) {
  // All toast popups completely disabled and removed
  return null;
}
