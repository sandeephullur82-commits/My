import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useFeedback } from '../context/FeedbackContext';
import { useNotificationCenter } from '../context/NotificationContext';
import { 
  ChevronLeft, Trash2, CheckCheck, 
  Banknote, Smartphone, AlertCircle, 
  Info, CheckCircle2, XCircle, Clock,
  Calendar, Phone, MessageSquare, ArrowRight, BellRing
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format, isToday, isYesterday } from 'date-fns';
import { cn, safeFormat } from '../lib/utils';
import { triggerWhatsApp } from '../lib/whatsapp';

type FilterType = 'all' | 'unread' | 'due_soon' | 'overdue' | 'payments';

export function Notifications() {
  const { history, clearHistory, deleteNotification, markAsRead } = useFeedback();
  const { preferences, alerts, triggerScanAndNotify } = useNotificationCenter();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialFilter = (searchParams.get('filter') as FilterType) || 'all';
  const [filter, setFilter] = useState<FilterType>(
    ['all', 'unread', 'due_soon', 'overdue', 'payments'].includes(initialFilter) ? initialFilter : 'all'
  );
  const [isScanning, setIsScanning] = useState(false);
  const navigate = useNavigate();

  React.useEffect(() => {
    const urlFilter = searchParams.get('filter') as FilterType;
    if (urlFilter && ['all', 'unread', 'due_soon', 'overdue', 'payments'].includes(urlFilter)) {
      setFilter(urlFilter);
    }
  }, [searchParams]);

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
      return <AlertCircle size={20} className="text-danger" />;
    }
    if (alertCategory === 'upcoming' || alertCategory === 'due_today' || type === 'warning') {
      return <Clock size={20} className="text-warning" />;
    }
    switch (type) {
      case 'success': return <CheckCircle2 size={20} className="text-success" />;
      case 'error': return <XCircle size={20} className="text-danger" />;
      case 'transaction': return paymentType === 'phonepe' ? <Smartphone size={20} className="text-accent" /> : <Banknote size={20} className="text-success" />;
      default: return <Info size={20} className="text-accent" />;
    }
  };

  const handleMarkAllRead = () => {
    history.filter(n => !n.isRead).forEach(n => markAsRead(n.id));
  };

  const handleManualScan = async () => {
    setIsScanning(true);
    try {
      await triggerScanAndNotify(true);
    } finally {
      setIsScanning(false);
    }
  };

  const unreadCount = history.filter(n => !n.isRead).length;

  return (
    <div className="h-full overflow-y-auto bg-bg pb-28">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-bg/90 backdrop-blur-md border-b border-border/40">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate(-1)}
              className="w-10 h-10 rounded-xl bg-card border border-border/20 flex items-center justify-center text-text-secondary active:scale-95 transition-all hover:border-border"
            >
              <ChevronLeft size={20} />
            </button>
            <div>
              <h1 className="text-[19px] font-black uppercase tracking-tight text-text-primary">Payment Alerts</h1>
              <p className="text-[10px] font-bold text-text-secondary opacity-60 uppercase tracking-widest leading-none mt-0.5">
                {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleManualScan}
              disabled={isScanning}
              className="h-10 px-3 rounded-xl bg-accent/10 border border-accent/20 flex items-center gap-1.5 text-accent text-[11px] font-bold uppercase tracking-wider hover:bg-accent hover:text-white transition-all active:scale-95 disabled:opacity-50"
              title="Scan customer due dates now"
            >
              <BellRing size={15} className={isScanning ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Scan Now</span>
            </button>

            {unreadCount > 0 && (
              <button 
                onClick={handleMarkAllRead}
                className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent hover:bg-accent hover:text-white transition-all active:scale-95"
                title="Mark all as read"
              >
                <CheckCheck size={18} />
              </button>
            )}
            
            <button 
              onClick={clearHistory}
              className="w-10 h-10 rounded-xl bg-danger/10 flex items-center justify-center text-danger hover:bg-danger hover:text-white transition-all active:scale-95"
              title="Clear all"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="max-w-2xl mx-auto px-4 pb-3 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-2">
            {[
              { id: 'all', label: 'All' },
              { id: 'unread', label: 'Unread' },
              { id: 'due_soon', label: '⏳ Due Soon' },
              { id: 'overdue', label: '⚠️ Overdue' },
              { id: 'payments', label: '💰 Payments' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id as FilterType)}
                className={cn(
                  "px-3.5 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all whitespace-nowrap border",
                  filter === tab.id 
                    ? "bg-accent border-accent text-white shadow-sm" 
                    : "bg-card border-border/30 text-text-secondary hover:border-border"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <AnimatePresence mode="popLayout">
          {groupedNotifications.length === 0 ? (
            <motion.div 
              key="empty-state"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-20 bg-card rounded-3xl border border-border/30 p-8 shadow-sm"
            >
              <div className="w-16 h-16 rounded-2xl bg-accent/10 text-accent flex items-center justify-center mx-auto mb-4">
                <BellRing size={28} />
              </div>
              <h3 className="text-lg font-black uppercase tracking-tight text-text-primary">No Notifications</h3>
              <p className="text-xs font-medium text-text-secondary max-w-xs mx-auto mt-1 leading-relaxed">
                {filter === 'due_soon' 
                  ? 'No upcoming due date reminders in your active timing window.'
                  : filter === 'overdue'
                  ? 'Great news! No overdue accounts detected.'
                  : 'You are completely caught up with your collections and payment reminders.'}
              </p>
              <button
                onClick={handleManualScan}
                className="mt-5 px-5 py-2.5 rounded-xl bg-accent text-white text-xs font-bold uppercase tracking-wider hover:opacity-90 active:scale-95 transition-all inline-flex items-center gap-2"
              >
                <BellRing size={14} />
                Scan Customer Accounts Now
              </button>
            </motion.div>
          ) : (
            groupedNotifications.map(([group, items]) => (
              <div key={group} className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[10px] font-black text-text-secondary opacity-60 uppercase tracking-widest">
                    {group}
                  </span>
                  <span className="text-[10px] font-bold text-text-secondary opacity-40">
                    {items.length} {items.length === 1 ? 'alert' : 'alerts'}
                  </span>
                </div>

                <div className="space-y-2.5">
                  {items.map((item) => {
                    const isAlert = item.alertCategory === 'upcoming' || item.alertCategory === 'due_today' || item.alertCategory === 'overdue';
                    const targetCustomerQuery = item.customerPhone || item.customerName || '';

                    return (
                      <motion.div
                        key={item.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className={cn(
                          "relative rounded-2xl p-4 sm:p-5 border transition-all shadow-sm",
                          !item.isRead 
                            ? "bg-card border-accent/30 ring-1 ring-accent/10" 
                            : "bg-card/70 border-border/30 opacity-90"
                        )}
                      >
                        <div className="flex gap-4 items-start">
                          <div className={cn(
                            "w-11 h-11 rounded-xl flex items-center justify-center shrink-0",
                            !item.isRead ? "bg-accent/10" : "bg-muted"
                          )}>
                            {getIcon(item.type, item.paymentType, item.alertCategory)}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <h3 className={cn(
                                "text-[14px] font-bold tracking-tight line-clamp-1",
                                !item.isRead ? "text-text-primary font-black" : "text-text-secondary"
                              )}>
                                {item.title}
                              </h3>
                              <span className="text-[9px] font-bold text-text-secondary opacity-60 uppercase whitespace-nowrap shrink-0">
                                {safeFormat(item.timestamp, 'hh:mm a')}
                              </span>
                            </div>
                            
                            <p className="text-[12px] text-text-secondary leading-relaxed mb-3">
                              {item.type === 'transaction' 
                                ? `Received ₹${item.amount?.toLocaleString('en-IN')} from ${item.customerName}`
                                : item.message}
                            </p>

                            {/* Alert Specific Metadata Tags */}
                            {(item.diffDays !== undefined || item.dueDate) && (
                              <div className="flex flex-wrap items-center gap-2 mb-3">
                                {item.diffDays !== undefined && (
                                  <span className={cn(
                                    "px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider",
                                    item.diffDays < 0 
                                      ? "bg-danger/10 text-danger border border-danger/20" 
                                      : item.diffDays === 0
                                      ? "bg-warning/10 text-warning border border-warning/20"
                                      : "bg-accent/10 text-accent border border-accent/20"
                                  )}>
                                    {item.diffDays < 0 
                                      ? `Overdue: ${Math.abs(item.diffDays)}d` 
                                      : item.diffDays === 0
                                      ? 'Due Today'
                                      : `Due in ${item.diffDays}d`}
                                  </span>
                                )}
                                {item.dueDate && (
                                  <span className="text-[10px] text-text-secondary font-medium flex items-center gap-1">
                                    <Calendar size={11} className="opacity-60" />
                                    {safeFormat(item.dueDate, 'dd MMM yyyy')}
                                  </span>
                                )}
                                {item.amount !== undefined && (
                                  <span className="text-[10px] font-bold text-text-primary">
                                    Pending: ₹{item.amount.toLocaleString('en-IN')}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Actionable Buttons */}
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              {/* Direct Collect / Open Entry */}
                              {targetCustomerQuery && (
                                <button 
                                  onClick={() => {
                                    markAsRead(item.id);
                                    navigate(`/entry?search=${encodeURIComponent(targetCustomerQuery)}`);
                                  }}
                                  className="h-8 px-3 rounded-lg bg-accent text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 hover:opacity-90 active:scale-95 transition-all shadow-sm"
                                >
                                  <span>Collect</span>
                                  <ArrowRight size={12} />
                                </button>
                              )}

                              {/* WhatsApp Reminder */}
                              {item.customerPhone && (
                                <button 
                                  onClick={() => {
                                    markAsRead(item.id);
                                    const customMsg = item.alertCategory === 'overdue'
                                      ? `Urgent: Dear ${item.customerName || 'Customer'}, your Pigmy payment of ₹${item.amount?.toLocaleString('en-IN') || ''} is overdue. Kindly clear the pending balance today.`
                                      : `Hello ${item.customerName || 'Customer'}, friendly reminder regarding your Pigmy payment of ₹${item.amount?.toLocaleString('en-IN') || ''}. Please keep the amount ready for collection. Thank you!`;
                                    triggerWhatsApp(item.customerPhone, item.customerName, customMsg, item.customerId);
                                  }}
                                  className="h-8 px-3 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 hover:bg-emerald-500 hover:text-white active:scale-95 transition-all"
                                >
                                  <MessageSquare size={12} />
                                  <span>WhatsApp</span>
                                </button>
                              )}

                              {/* Call Customer */}
                              {item.customerPhone && (
                                <a 
                                  href={`tel:${item.customerPhone}`}
                                  onClick={() => markAsRead(item.id)}
                                  className="h-8 px-3 rounded-lg bg-card border border-border/40 text-text-secondary text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 hover:text-text-primary active:scale-95 transition-all"
                                >
                                  <Phone size={12} />
                                  <span>Call</span>
                                </a>
                              )}

                              {/* Mark as read / Delete */}
                              {!item.isRead ? (
                                <button 
                                  onClick={() => markAsRead(item.id)}
                                  className="h-8 px-2.5 rounded-lg bg-muted text-text-secondary text-[10px] font-bold uppercase tracking-wider hover:text-text-primary active:scale-95 transition-all ml-auto"
                                >
                                  Mark Read
                                </button>
                              ) : (
                                <button 
                                  onClick={() => deleteNotification(item.id)}
                                  className="h-8 w-8 rounded-lg flex items-center justify-center text-text-secondary opacity-40 hover:opacity-100 hover:text-danger active:scale-95 transition-all ml-auto"
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
                          <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-accent" />
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
    </div>
  );
}
