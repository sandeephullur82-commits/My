import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useFeedback } from '../context/FeedbackContext';
import { useNotificationCenter } from '../context/NotificationContext';
import { 
  ChevronLeft, Trash2, CheckCheck, 
  Banknote, Smartphone, AlertCircle, 
  Info, CheckCircle2, XCircle, Clock,
  Calendar, Phone, MessageSquare, ArrowRight, BellRing, Check, ShieldCheck, HelpCircle, X
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format, isToday, isYesterday } from 'date-fns';
import { cn, safeFormat } from '../lib/utils';
import { triggerWhatsApp } from '../lib/whatsapp';

type FilterType = 'all' | 'unread' | 'due_soon' | 'overdue' | 'payments';

export function Notifications() {
  const { history, clearHistory, deleteNotification, markAsRead } = useFeedback();
  const { preferences, alerts, triggerScanAndNotify } = useNotificationCenter();
  const [searchParams] = useSearchParams();
  const initialFilter = (searchParams.get('filter') as FilterType) || 'all';
  const [filter, setFilter] = useState<FilterType>(
    ['all', 'unread', 'due_soon', 'overdue', 'payments'].includes(initialFilter) ? initialFilter : 'all'
  );
  const [isScanning, setIsScanning] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const navigate = useNavigate();

  React.useEffect(() => {
    const urlFilter = searchParams.get('filter') as FilterType;
    if (urlFilter && ['all', 'unread', 'due_soon', 'overdue', 'payments'].includes(urlFilter)) {
      setFilter(urlFilter);
    }
  }, [searchParams]);

  // Premium haptic callback
  const triggerHaptic = useCallback((intensity = 15) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(intensity);
    }
  }, []);

  const filteredNotifications = useMemo(() => {
    return history.filter(item => {
      if (filter === 'unread') return !item.isRead;
      if (filter === 'payments') return item.type === 'transaction';
      if (filter === 'due_soon') {
        return item.alertCategory === 'upcoming' || item.alertCategory === 'due_today' || 
               item.title?.toLowerCase().includes('due') || (item.diffDays !== undefined && item.diffDays >= 0);
      }
      if (filter === 'overdue') {
        return item.alertCategory === 'overdue' || item.title?.toLowerCase().includes('overdue') || 
               (item.diffDays !== undefined && item.diffDays < 0);
      }
      return true;
    });
  }, [history, filter]);

  const groupedNotifications = useMemo(() => {
    const groups: { [key: string]: typeof history } = {
      Today: [],
      Yesterday: [],
      Older: []
    };

    filteredNotifications.forEach(item => {
      const date = new Date(item.timestamp);
      if (isToday(date)) groups['Today'].push(item);
      else if (isYesterday(date)) groups['Yesterday'].push(item);
      else groups['Older'].push(item);
    });

    return Object.entries(groups).filter(([_, items]) => items.length > 0);
  }, [filteredNotifications]);

  const getIcon = (type: string, paymentType?: string, alertCategory?: string) => {
    if (alertCategory === 'overdue' || type === 'critical') {
      return (
        <div className="w-10 h-10 rounded-xl bg-danger/10 text-danger flex items-center justify-center shrink-0 shadow-inner">
          <AlertCircle size={18} strokeWidth={2.5} />
        </div>
      );
    }
    if (alertCategory === 'upcoming' || alertCategory === 'due_today' || type === 'warning') {
      return (
        <div className="w-10 h-10 rounded-xl bg-warning/10 text-warning flex items-center justify-center shrink-0 shadow-inner">
          <Clock size={18} strokeWidth={2.5} />
        </div>
      );
    }
    switch (type) {
      case 'success': 
        return (
          <div className="w-10 h-10 rounded-xl bg-success/10 text-success flex items-center justify-center shrink-0 shadow-inner">
            <CheckCircle2 size={18} strokeWidth={2.5} />
          </div>
        );
      case 'error': 
        return (
          <div className="w-10 h-10 rounded-xl bg-danger/10 text-danger flex items-center justify-center shrink-0 shadow-inner">
            <XCircle size={18} strokeWidth={2.5} />
          </div>
        );
      case 'transaction': 
        return paymentType === 'phonepe' ? (
          <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0 shadow-inner">
            <Smartphone size={18} strokeWidth={2.5} />
          </div>
        ) : (
          <div className="w-10 h-10 rounded-xl bg-success/10 text-success flex items-center justify-center shrink-0 shadow-inner">
            <Banknote size={18} strokeWidth={2.5} />
          </div>
        );
      default: 
        return (
          <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0 shadow-inner">
            <Info size={18} strokeWidth={2.5} />
          </div>
        );
    }
  };

  const handleMarkAllRead = () => {
    triggerHaptic(25);
    history.filter(n => !n.isRead).forEach(n => markAsRead(n.id));
  };

  const handleManualScan = async () => {
    triggerHaptic(30);
    setIsScanning(true);
    try {
      await triggerScanAndNotify(true);
    } finally {
      setIsScanning(false);
    }
  };

  const confirmClearAll = () => {
    triggerHaptic([30, 50]);
    clearHistory();
    setShowClearConfirm(false);
  };

  const unreadCount = history.filter(n => !n.isRead).length;

  return (
    <div className="h-full overflow-y-auto bg-bg pb-28 scrollbar-hide">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-bg/95 backdrop-blur-md border-b border-border/80 shadow-xs">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                triggerHaptic(5);
                navigate(-1);
              }}
              className="w-9 h-9 rounded-xl bg-card border border-border hover:bg-muted flex items-center justify-center text-text-secondary active:scale-95 transition-all hover:text-text-primary"
              title="Go back"
            >
              <ChevronLeft size={18} strokeWidth={2.5} />
            </button>
            <div>
              <h1 className="text-base font-black tracking-tight text-text-primary leading-tight">Payment Alerts</h1>
              <p className="text-[11px] font-black text-text-secondary opacity-65 leading-none mt-0.5">
                {unreadCount > 0 ? `${unreadCount} unread alerts` : 'All caught up'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleManualScan}
              disabled={isScanning}
              className="h-9 px-3 rounded-xl bg-accent/10 border border-accent/20 flex items-center gap-1.5 text-accent text-[10px] font-black uppercase tracking-wider hover:bg-accent hover:text-white transition-all active:scale-95 disabled:opacity-50 cursor-pointer min-h-[36px]"
              title="Scan customer due dates now"
            >
              <BellRing size={13} className={isScanning ? 'animate-spin' : ''} />
              <span>Scan Now</span>
            </button>

            {unreadCount > 0 && (
              <button 
                onClick={handleMarkAllRead}
                className="w-9 h-9 rounded-xl bg-accent/10 text-accent hover:bg-accent hover:text-white border border-accent/10 flex items-center justify-center transition-all active:scale-95"
                title="Mark all as read"
              >
                <CheckCheck size={16} strokeWidth={2.5} />
              </button>
            )}
            
            {history.length > 0 && (
              <button 
                onClick={() => setShowClearConfirm(true)}
                className="w-9 h-9 rounded-xl bg-danger/10 text-danger hover:bg-danger hover:text-white border border-danger/10 flex items-center justify-center transition-all active:scale-95"
                title="Clear all alerts"
              >
                <Trash2 size={16} strokeWidth={2} />
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="max-w-2xl mx-auto px-4 pb-3 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5">
            {[
              { id: 'all', label: 'All Alerts' },
              { id: 'unread', label: 'Unread' },
              { id: 'due_soon', label: '⏳ Due Soon' },
              { id: 'overdue', label: '⚠️ Overdue' },
              { id: 'payments', label: '💰 Payments' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  triggerHaptic(5);
                  setFilter(tab.id as FilterType);
                }}
                className={cn(
                  "px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap border cursor-pointer min-h-[32px]",
                  filter === tab.id 
                    ? "bg-accent border-accent text-white shadow-xs" 
                    : "bg-card border-border/60 text-text-secondary hover:border-border"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-7">
        <AnimatePresence mode="popLayout">
          {groupedNotifications.length === 0 ? (
            <motion.div 
              key="empty-state"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-16 bg-card rounded-[32px] border border-border/60 p-8 shadow-xs max-w-md mx-auto"
            >
              <div className="w-16 h-16 rounded-2xl bg-accent/10 text-accent flex items-center justify-center mx-auto mb-4 shadow-inner">
                <BellRing size={26} strokeWidth={2.2} />
              </div>
              <h3 className="text-sm font-black uppercase tracking-widest text-text-primary">All Caught Up!</h3>
              <p className="text-xs text-text-secondary opacity-80 max-w-xs mx-auto mt-2 leading-relaxed font-medium">
                {filter === 'due_soon' 
                  ? 'No upcoming due date reminders in your active timing window.'
                  : filter === 'overdue'
                  ? 'Excellent job! Zero overdue borrower accounts detected.'
                  : 'You have cleared your collection alerts list. Feel free to trigger an on-demand scan.'}
              </p>
              <button
                onClick={handleManualScan}
                className="mt-6 px-5 py-2.5 rounded-xl bg-accent hover:bg-accent/90 text-white text-[11px] font-black uppercase tracking-widest hover:opacity-90 active:scale-95 transition-all inline-flex items-center gap-2 shadow-sm shadow-accent/20 cursor-pointer min-h-[38px]"
              >
                <BellRing size={13} />
                Scan Borrowers Ledger
              </button>
            </motion.div>
          ) : (
            groupedNotifications.map(([group, items]) => (
              <div key={group} className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[10px] font-black text-text-secondary opacity-50 uppercase tracking-[0.2em]">
                    {group}
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-wider text-text-secondary/40 bg-muted px-2 py-0.5 rounded-md">
                    {items.length} {items.length === 1 ? 'alert' : 'alerts'}
                  </span>
                </div>

                <div className="space-y-3">
                  {items.map((item) => {
                    const isAlert = item.alertCategory === 'upcoming' || item.alertCategory === 'due_today' || item.alertCategory === 'overdue';
                    const targetCustomerQuery = item.customerPhone || item.customerName || '';

                    return (
                      <motion.div
                        key={item.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        className={cn(
                          "relative rounded-[24px] p-4 sm:p-5 border transition-all shadow-[0_4px_20px_rgba(0,0,0,0.01)]",
                          !item.isRead 
                            ? "bg-card border-accent/25 ring-1 ring-accent/5" 
                            : "bg-card/75 border-border/40 opacity-90"
                        )}
                      >
                        <div className="flex gap-4 items-start">
                          {getIcon(item.type, item.paymentType, item.alertCategory)}
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2.5">
                              <h3 className={cn(
                                "text-[14px] font-black tracking-tight line-clamp-1 shrink-1 min-w-0",
                                !item.isRead ? "text-text-primary" : "text-text-secondary opacity-80"
                              )}>
                                {item.title}
                              </h3>
                              <span className="text-[9px] font-bold text-text-secondary opacity-50 uppercase whitespace-nowrap shrink-0 font-mono">
                                {safeFormat(item.timestamp, 'hh:mm a')}
                              </span>
                            </div>
                            
                            <p className="text-xs text-text-secondary mt-1 font-medium leading-relaxed max-w-[95%]">
                              {item.type === 'transaction' 
                                ? `Received ₹${item.amount?.toLocaleString('en-IN')} from ${item.customerName}`
                                : item.message}
                            </p>

                            {/* Alert Specific Metadata Tags */}
                            {(item.diffDays !== undefined || item.dueDate) && (
                              <div className="flex flex-wrap items-center gap-1.5 mt-3">
                                {item.diffDays !== undefined && (
                                  <span className={cn(
                                    "px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider",
                                    item.diffDays < 0 
                                      ? "bg-danger/10 text-danger border border-danger/10" 
                                      : item.diffDays === 0
                                      ? "bg-warning/10 text-warning border border-warning/10"
                                      : "bg-accent/10 text-accent border border-accent/10"
                                  )}>
                                    {item.diffDays < 0 
                                      ? `Overdue: ${Math.abs(item.diffDays)}d` 
                                      : item.diffDays === 0
                                      ? 'Due Today'
                                      : `Due in ${item.diffDays}d`}
                                  </span>
                                )}
                                {item.dueDate && (
                                  <span className="text-[9px] font-bold text-text-secondary/60 bg-muted px-2 py-0.5 rounded-lg flex items-center gap-1">
                                    <Calendar size={10} className="opacity-60" />
                                    {safeFormat(item.dueDate, 'dd MMM yyyy')}
                                  </span>
                                )}
                                {item.amount !== undefined && (
                                  <span className="text-[9px] font-black uppercase tracking-wider text-text-primary bg-muted px-2 py-0.5 rounded-lg">
                                    Pending: ₹{item.amount.toLocaleString('en-IN')}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Actionable Buttons */}
                            <div className="flex flex-wrap items-center gap-1.5 mt-4 pt-1 border-t border-border/20">
                              {/* Direct Collect / Open Entry */}
                              {targetCustomerQuery && (
                                <button 
                                  onClick={() => {
                                    triggerHaptic(10);
                                    markAsRead(item.id);
                                    navigate(`/entry?search=${encodeURIComponent(targetCustomerQuery)}`);
                                  }}
                                  className="h-8 px-3.5 rounded-xl bg-accent hover:bg-accent/90 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-1 shadow-sm shadow-accent/25 active:scale-95 transition-all cursor-pointer min-h-[32px]"
                                >
                                  <span>Collect</span>
                                  <ArrowRight size={11} strokeWidth={2.5} />
                                </button>
                              )}

                              {/* WhatsApp Reminder */}
                              {item.customerPhone && (
                                <button 
                                  onClick={() => {
                                    triggerHaptic(15);
                                    markAsRead(item.id);
                                    const customMsg = item.alertCategory === 'overdue'
                                      ? `Urgent: Dear ${item.customerName || 'Customer'}, your Pigmy payment of ₹${item.amount?.toLocaleString('en-IN') || ''} is overdue. Kindly clear the pending balance today.`
                                      : `Hello ${item.customerName || 'Customer'}, friendly reminder regarding your Pigmy payment of ₹${item.amount?.toLocaleString('en-IN') || ''}. Please keep the amount ready for collection. Thank you!`;
                                    triggerWhatsApp(item.customerPhone, item.customerName, customMsg, item.customerId);
                                  }}
                                  className="h-8 px-3.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-black uppercase tracking-widest flex items-center gap-1 hover:bg-emerald-600 hover:text-white active:scale-95 transition-all cursor-pointer min-h-[32px]"
                                >
                                  <MessageSquare size={11} />
                                  <span>WhatsApp</span>
                                </button>
                              )}

                              {/* Call Customer */}
                              {item.customerPhone && (
                                <a 
                                  href={`tel:${item.customerPhone}`}
                                  onClick={() => {
                                    triggerHaptic(10);
                                    markAsRead(item.id);
                                  }}
                                  className="h-8 px-3.5 rounded-xl bg-card border border-border/80 text-text-secondary text-[10px] font-black uppercase tracking-widest flex items-center gap-1 hover:text-text-primary hover:border-text-secondary active:scale-95 transition-all min-h-[32px]"
                                >
                                  <Phone size={11} />
                                  <span>Call</span>
                                </a>
                              )}

                              {/* Mark as read / Delete */}
                              {!item.isRead ? (
                                <button 
                                  onClick={() => {
                                    triggerHaptic(10);
                                    markAsRead(item.id);
                                  }}
                                  className="h-8 px-3 rounded-xl bg-muted text-text-secondary text-[10px] font-black uppercase tracking-widest hover:text-text-primary active:scale-95 transition-all ml-auto min-h-[32px] cursor-pointer"
                                >
                                  Mark Read
                                </button>
                              ) : (
                                <button 
                                  onClick={() => {
                                    triggerHaptic(10);
                                    deleteNotification(item.id);
                                  }}
                                  className="h-8 w-8 rounded-xl flex items-center justify-center text-text-secondary opacity-40 hover:opacity-100 hover:bg-muted hover:text-danger active:scale-95 transition-all ml-auto min-h-[32px] cursor-pointer"
                                  title="Delete alert"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Unread dot */}
                        {!item.isRead && (
                          <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-accent animate-pulse" />
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Clear All Confirmation Modal Backdrop */}
      <AnimatePresence>
        {showClearConfirm && (
          <div className="fixed inset-0 z-[99990] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs pointer-events-auto">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-transparent"
              onClick={() => setShowClearConfirm(false)}
            />

            {/* Modal Dialog Card */}
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="clear-confirm-title"
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="relative w-full max-w-[340px] bg-card text-text-primary rounded-[28px] p-6 shadow-2xl border border-border/80 flex flex-col items-center text-center z-10 select-none overflow-hidden outline-none"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header Icon */}
              <div className="w-14 h-14 rounded-2xl bg-danger/10 text-danger flex items-center justify-center mb-4 shadow-inner" aria-hidden="true">
                <Trash2 size={24} strokeWidth={2.2} />
              </div>

              {/* Title */}
              <h3 id="clear-confirm-title" className="text-base font-black text-text-primary uppercase tracking-tight mb-2">
                Clear All Alerts?
              </h3>

              {/* Body */}
              <p className="text-xs text-text-secondary leading-relaxed mb-6 font-medium max-w-[240px]">
                Are you sure you want to permanently empty your notification center audit logs? This action cannot be undone.
              </p>

              {/* Actions */}
              <div className="flex flex-col gap-2 w-full">
                <button
                  type="button"
                  onClick={confirmClearAll}
                  className="w-full py-3 px-4 rounded-xl bg-danger hover:bg-danger/90 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-danger/20 active:scale-98 transition-all cursor-pointer min-h-[40px]"
                >
                  Yes, Clear History
                </button>
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(false)}
                  className="w-full py-2.5 px-4 rounded-xl bg-muted text-text-secondary hover:text-text-primary font-bold text-xs uppercase tracking-widest active:scale-98 transition-all cursor-pointer min-h-[38px]"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
