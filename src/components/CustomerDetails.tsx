import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Customer, Transaction } from '../services/firestoreService';
import { ArrowLeft, Phone, Calendar, IndianRupee, Plus, Edit2, AlertTriangle, Trash2, X, Lock, Pin, Search, MoreVertical, MessageCircle, Eye, Clock, Receipt } from 'lucide-react';
import { firestoreService, auth } from '../services/firestoreService';
import { toast } from 'sonner';
import { exportTransactionsPDF } from '../lib/pdfExport';
import { PDFViewerModal } from './PDFViewerModal';
import { ContactPermissionModal } from './ContactPermissionModal';
import { ReceiptSuccessModal, ReceiptData } from './ReceiptSuccessModal';
import { safeFormat, safeDifferenceInDays } from '../lib/utils';

import { triggerWhatsApp } from '../lib/whatsapp';

interface CustomerDetailsProps {
  key?: string;
  customer: Customer;
  transactions: Transaction[];
  onClose: () => void;
  onAddEntry: () => void;
  onEdit: () => void;
  onDelete?: (id: string) => void;
  onTogglePin?: () => void;
}

export function CustomerDetails({ customer, transactions, onClose, onAddEntry, onEdit, onDelete, onTogglePin }: CustomerDetailsProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [pendingAction, setPendingAction] = React.useState<'call' | 'whatsapp' | null>(null);
  const [previewReport, setPreviewReport] = React.useState<{ blob: Blob, fileName: string, title: string } | null>(null);
  const [showPreview, setShowPreview] = React.useState(false);
  const [showFABMenu, setShowFABMenu] = React.useState(false);
  const [selectedReceipt, setSelectedReceipt] = React.useState<ReceiptData | null>(null);

  const customerTransactions = transactions
    .filter(tx => tx.customerId === customer.id)
    .sort((a, b) => b.timestamp - a.timestamp);

  const displayId = customer.displayId || customer.id;
  const loanAmount = customer.loanAmount || customer.loan || 0;
  const pendingAmount = customer.pending !== undefined ? customer.pending : (loanAmount - (customer.paid || 0));
  const paidAmount = customer.paid || 0;

  const isOverdue = customer.endDate < Date.now() && pendingAmount > 0;
  const overdueDays = isOverdue ? safeDifferenceInDays(Date.now(), customer.endDate) : 0;
  
  const progress = loanAmount > 0 ? Math.min(100, Math.max(0, (paidAmount / loanAmount) * 100)) : 0;

  // Smart Insights
  const daysElapsed = Math.max(1, safeDifferenceInDays(Date.now(), customer.startDate));
  const avgDaily = paidAmount / daysElapsed;
  const remainingDays = Math.max(0, safeDifferenceInDays(customer.endDate, Date.now()));
  const expectedCompletionDays = avgDaily > 0 ? Math.ceil(pendingAmount / avgDaily) : 0;

  const confirmAction = () => {
    if (pendingAction === 'call') {
      console.log("Confirming call for", customer.phone);
      const cleaned = String(customer.phone).replace(/[^\d]/g, '');
      const phoneWithCountry = cleaned.length === 10 ? `+91${cleaned}` : (customer.phone.startsWith('+') ? customer.phone : `+${cleaned}`);
      window.location.href = `tel:${phoneWithCountry}`;
    } else if (pendingAction === 'whatsapp') {
      console.log("Confirming WhatsApp for", customer.phone);
      triggerWhatsApp(customer.phone, customer.name, undefined, customer.id);
    }
    setPendingAction(null);
  };

  const handleCallClick = () => {
    if (customer.phone) {
      setPendingAction('call');
    } else {
      toast.error("No phone number available");
    }
  };

  const handleWhatsAppClick = () => {
    if (customer.phone) {
      setPendingAction('whatsapp');
    } else {
      toast.error("No phone number available");
    }
  };

  const handleViewReport = async () => {
    const toastId = toast.loading('Generating ledger...');
    try {
      const result = await exportTransactionsPDF(
        customerTransactions, 
        [customer], 
        'CUSTOMER', 
        `${customer.name} - Statement`,
        'Full History'
      );
      
      setPreviewReport(result);
      setShowPreview(true);
      
      toast.success('Report ready', { id: toastId });
    } catch (err) {
      console.error('Export failed', err);
      toast.error('Failed to generate report', { id: toastId });
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      if (onDelete) {
        onDelete(customer.id);
      } else {
        await firestoreService.deleteCustomer(customer.id);
        toast('🗑️ Customer deleted', {
          action: {
            label: 'Undo',
            onClick: async () => {
              try {
                await firestoreService.undoDeleteCustomer(customer.id);
                toast.success('↩️ Customer restored');
              } catch (error) {
                toast.error('Failed to restore customer');
              }
            }
          },
          duration: 5000,
        });
      }
      onClose();
    } catch (error) {
      toast.error('Failed to delete customer');
      setIsDeleting(false);
    }
  };

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 20, stiffness: 260 }}
      className="fixed inset-0 z-[1000] bg-bg flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center gap-3 p-4 pt-safe-top bg-card border-b border-border sticky top-0 z-10">
        <button 
          onClick={() => {
            console.log("CustomerDetails Close clicked");
            onClose();
          }} 
          className="p-2 -ml-2 rounded-full hover:bg-bg text-text-primary"
        >
          <ArrowLeft size={24} />
        </button>
        <div className="flex-1">
          <h2 className="font-bold text-[18px] tracking-tight leading-none text-text-primary mb-1">{customer.name}</h2>
          <p className="text-[11px] font-bold text-text-secondary uppercase tracking-widest opacity-40">ID: {displayId}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin?.();
            }}
            className={`p-2 rounded-full transition-all ${customer.isPinned ? 'text-accent ring-1 ring-accent/20 bg-accent/5' : 'text-text-secondary opacity-40 hover:opacity-100'}`}
          >
            <Pin size={20} className={customer.isPinned ? 'fill-accent' : ''} />
          </button>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit?.();
            }}
            className="p-2 rounded-full text-text-secondary opacity-40 hover:opacity-100 transition-all"
          >
            <Edit2 size={20} />
          </button>

          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="p-2 rounded-full text-danger opacity-40 hover:opacity-100 transition-all"
          >
            <Trash2 size={20} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide pb-[140px]">
        {/* Summary Section */}
        <div className="p-6 flex flex-col items-center justify-center bg-card border-b border-border">
          <div className="relative w-32 h-32 mb-4">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="8" className="text-bg" />
              <circle 
                cx="50" cy="50" r="45" 
                fill="none" stroke="currentColor" strokeWidth="8" 
                strokeDasharray={`${progress * 2.83} 283`}
                className={isOverdue ? 'text-danger' : 'text-success'} 
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold">{Math.round(progress)}%</span>
              <span className="text-xs text-text-secondary">Paid</span>
            </div>
          </div>
          
          <div className="text-center">
            <p className="text-sm text-text-secondary mb-1">Pending Amount</p>
            <p className={`text-4xl font-bold ${isOverdue ? 'text-danger' : 'text-warning'}`}>
              ₹{pendingAmount.toLocaleString()}
            </p>
            <p className="text-sm text-success font-medium mt-2">
              Total Paid: ₹{paidAmount.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Overdue Alert */}
        {isOverdue && (
          <div className="mx-4 mt-4 p-3 rounded-xl bg-danger/10 border border-danger/20 flex items-start gap-3">
            <AlertTriangle className="text-danger shrink-0 mt-0.5" size={20} />
            <div>
              <h4 className="text-danger font-semibold text-sm">Payment Overdue</h4>
              <p className="text-danger/80 text-xs mt-0.5">This account is {overdueDays} days past its end date.</p>
            </div>
          </div>
        )}

        {/* Info Grid */}
        <div className="p-4">
          <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3 ml-1">Account Details</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-card p-3 rounded-xl border border-border">
              <div className="flex items-center gap-2 text-text-secondary mb-1">
                <Phone size={14} /> <span className="text-xs">Phone</span>
              </div>
              <p className="font-medium text-sm">{customer.phone || 'N/A'}</p>
            </div>
            <div className="bg-card p-3 rounded-xl border border-border">
              <div className="flex items-center gap-2 text-text-secondary mb-1">
                <IndianRupee size={14} /> <span className="text-xs">Total Loan</span>
              </div>
              <p className="font-medium text-sm">₹{loanAmount.toLocaleString()}</p>
            </div>
            <div className="bg-card p-3 rounded-xl border border-border">
              <div className="flex items-center gap-2 text-text-secondary mb-1">
                <Clock size={14} /> <span className="text-xs">Schedule</span>
              </div>
              <p className="font-medium text-sm">
                {customer.frequency === 'daily' || customer.frequencyDays === 1 
                  ? 'Daily (1 Day)' 
                  : customer.frequency === 'weekly' || customer.frequencyDays === 7 
                  ? 'Weekly (7 Days)' 
                  : customer.frequency === 'monthly' || customer.frequencyDays === 30 
                  ? 'Monthly (30 Days)' 
                  : customer.frequencyDays 
                  ? `Every ${customer.frequencyDays} Days`
                  : 'Daily'}
              </p>
            </div>
            <div className="bg-card p-3 rounded-xl border border-border">
              <div className="flex items-center gap-2 text-text-secondary mb-1">
                <Calendar size={14} /> <span className="text-xs">Start Date</span>
              </div>
              <p className="font-medium text-sm">{safeFormat(customer.startDate, 'dd MMM yyyy')}</p>
            </div>
            <div className="bg-card p-3 rounded-xl border border-border">
              <div className="flex items-center gap-2 text-text-secondary mb-1">
                <Calendar size={14} /> <span className="text-xs">End Date</span>
              </div>
              <p className="font-medium text-sm">{safeFormat(customer.endDate, 'dd MMM yyyy')}</p>
            </div>
            <div className="bg-card p-3 rounded-xl border border-border">
              <div className="flex items-center gap-2 text-text-secondary mb-1">
                <Calendar size={14} /> <span className="text-xs">Tenure</span>
              </div>
              <p className="font-medium text-sm">
                {customer.durationDays || Math.max(1, safeDifferenceInDays(customer.endDate, customer.startDate) + 1)} Days
              </p>
            </div>
          </div>
        </div>

        {/* Smart Insights */}
        <div className="px-4 pb-4">
          <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3 ml-1">Smart Insights</h3>
          <div className="bg-card rounded-xl border border-border p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-text-secondary">Avg. Daily Payment</span>
              <span className="font-medium text-sm">₹{Math.round(avgDaily).toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-text-secondary">Remaining Days</span>
              <span className="font-medium text-sm">{remainingDays} days</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-text-secondary">Est. Completion</span>
              <span className="font-medium text-sm">{expectedCompletionDays > 0 ? `${expectedCompletionDays} days` : 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* Transaction History */}
        <div className="px-4 pb-4">
          <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3 ml-1">Transaction History</h3>
          
          {customerTransactions.length === 0 ? (
            <div className="bg-card rounded-xl border border-border p-6 text-center text-text-secondary text-sm">
              No transactions yet
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {(() => {
                const groups: Record<string, Transaction[]> = {};
                customerTransactions.forEach(tx => {
                  const dateKey = tx.date; // Use YYYY-MM-DD from transaction
                  if (!groups[dateKey]) groups[dateKey] = [];
                  groups[dateKey].push(tx);
                });

                return Object.entries(groups)
                  .sort(([a], [b]) => b.localeCompare(a))
                  .map(([dateKey, txs]) => {
                    const dateObj = new Date(dateKey);
                    const isToday = dateKey === safeFormat(Date.now(), 'yyyy-MM-dd');
                    const isYesterday = dateKey === safeFormat(Date.now() - 86400000, 'yyyy-MM-dd');
                    
                    let displayDate = safeFormat(dateObj, 'dd MMM yyyy', dateKey);
                    if (isToday) displayDate = 'Today';
                    if (isYesterday) displayDate = 'Yesterday';

                    return (
                      <div key={dateKey}>
                        <h4 className="text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2 ml-1 opacity-50">
                          {displayDate}
                        </h4>
                        <div className="bg-card rounded-2xl border border-border overflow-hidden divide-y divide-border shadow-sm">
                          {txs.map((tx, idx) => (
                            <div key={`${tx.id}-${idx}`} className="p-4 flex items-center justify-between transition-colors hover:bg-bg/40">
                              <div>
                                <div className="flex items-center gap-2">
                                  <div className={`w-2 h-2 rounded-full ${tx.type === 'cash' ? 'bg-success' : tx.type === 'phonepe' ? 'bg-accent' : 'bg-warning'}`} />
                                  <p className="text-[11px] font-black text-text-primary uppercase tracking-wider">{String(tx.type).replace('_', ' ')}</p>
                                </div>
                                <p className="text-[10px] font-bold text-text-secondary opacity-50 mt-1 uppercase">Ref: {tx.id.slice(0, 8)}</p>
                              </div>
                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedReceipt({
                                      transaction: tx,
                                      customer,
                                      previousBalance: pendingAmount + tx.amount,
                                      newBalance: pendingAmount
                                    });
                                  }}
                                  className="p-1.5 px-2 rounded-xl bg-accent/10 hover:bg-accent hover:text-white text-accent transition-all flex items-center gap-1 text-[9px] font-black uppercase tracking-wider active:scale-95 cursor-pointer shadow-xs border border-accent/20"
                                  title="View & Print Receipt"
                                >
                                  <Receipt size={12} />
                                  <span>Receipt</span>
                                </button>
                                <div className="text-right">
                                  <p className="font-black text-sm text-text-primary tracking-tight">
                                    ₹{tx.amount.toLocaleString()}
                                  </p>
                                  <p className="text-[9px] font-bold text-text-secondary opacity-40 uppercase tracking-tighter">
                                     {safeFormat(tx.timestamp, 'hh:mm a')}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  });
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Floating Action Button Menu (Speed Dial) */}
      <div className="fixed right-5 bottom-8 z-[1050] flex flex-col items-end gap-3.5 pointer-events-none">
        
        {/* Backdrop for FAB Menu */}
        <AnimatePresence>
          {showFABMenu && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-bg/40 backdrop-blur-sm z-[-1] pointer-events-auto"
              onClick={(e) => { e.stopPropagation(); setShowFABMenu(false); }}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showFABMenu && (
            <motion.div
              key="whatsapp-btn"
              initial={{ opacity: 0, y: 15, scale: 0.85 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 15, scale: 0.85 }}
              transition={{ duration: 0.18, delay: 0.09 }}
              className="flex items-center gap-2.5 pointer-events-auto cursor-pointer group"
              onClick={(e) => { e.stopPropagation(); setShowFABMenu(false); handleWhatsAppClick(); }}
            >
              <span className="bg-card dark:bg-muted/80 px-3 py-1.5 rounded-xl border border-border/50 text-[10px] font-black uppercase tracking-widest text-text-primary shadow-sm hover:border-[#25D366]/40 transition-colors">
                WhatsApp
              </span>
              <div className="w-12 h-12 rounded-full bg-[#25D366] text-white flex items-center justify-center shadow-lg shadow-[#25D366]/20 active:scale-90 transition-all">
                <MessageCircle size={20} fill="white" />
              </div>
            </motion.div>
          )}

          {showFABMenu && (
            <motion.div
              key="call-btn"
              initial={{ opacity: 0, y: 15, scale: 0.85 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 15, scale: 0.85 }}
              transition={{ duration: 0.18, delay: 0.06 }}
              className="flex items-center gap-2.5 pointer-events-auto cursor-pointer group"
              onClick={(e) => { e.stopPropagation(); setShowFABMenu(false); handleCallClick(); }}
            >
              <span className="bg-card dark:bg-muted/80 px-3 py-1.5 rounded-xl border border-border/50 text-[10px] font-black uppercase tracking-widest text-text-primary shadow-sm hover:border-accent/40 transition-colors">
                Call
              </span>
              <div className="w-12 h-12 rounded-full bg-card border border-border text-text-primary flex items-center justify-center shadow-lg active:scale-90 transition-all">
                <Phone size={20} />
              </div>
            </motion.div>
          )}

          {showFABMenu && (
            <motion.div
              key="report-btn"
              initial={{ opacity: 0, y: 15, scale: 0.85 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 15, scale: 0.85 }}
              transition={{ duration: 0.18, delay: 0.03 }}
              className="flex items-center gap-2.5 pointer-events-auto cursor-pointer group"
              onClick={(e) => { e.stopPropagation(); setShowFABMenu(false); handleViewReport(); }}
            >
              <span className="bg-card dark:bg-muted/80 px-3 py-1.5 rounded-xl border border-border/50 text-[10px] font-black uppercase tracking-widest text-text-primary shadow-sm hover:border-accent/40 transition-colors">
                Ledger Report
              </span>
              <div className="w-12 h-12 rounded-full bg-card border border-border text-text-primary flex items-center justify-center shadow-lg active:scale-90 transition-all">
                <Eye size={20} />
              </div>
            </motion.div>
          )}

          {showFABMenu && (
            <motion.div
              key="entry-btn"
              initial={{ opacity: 0, y: 15, scale: 0.85 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 15, scale: 0.85 }}
              transition={{ duration: 0.18, delay: 0 }}
              className="flex items-center gap-2.5 pointer-events-auto cursor-pointer group"
              onClick={(e) => {
                e.stopPropagation();
                setShowFABMenu(false);
                onAddEntry?.();
              }}
            >
              <span className="bg-card dark:bg-muted/80 px-3 py-1.5 rounded-xl border border-border/50 text-[10px] font-black uppercase tracking-widest text-text-primary shadow-sm hover:border-accent/40 transition-colors">
                Add Entry
              </span>
              <div className="w-12 h-12 rounded-full bg-accent text-white flex items-center justify-center shadow-lg active:scale-90 transition-all">
                <Plus size={22} strokeWidth={3} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Main Toggle FAB */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={(e) => { e.stopPropagation(); setShowFABMenu(!showFABMenu); }}
          className="w-14 h-14 rounded-full bg-accent text-white flex items-center justify-center shadow-xl shadow-accent/30 pointer-events-auto transition-transform z-10"
          animate={{ rotate: showFABMenu ? 45 : 0 }}
        >
          <Plus size={24} strokeWidth={2.5} />
        </motion.button>
      </div>

      {/* Contact Permission Modal */}
      <ContactPermissionModal
        isOpen={pendingAction !== null}
        type={pendingAction}
        customerName={customer.name}
        customerPhone={customer.phone}
        customerId={customer.id}
        onConfirm={confirmAction}
        onCancel={() => setPendingAction(null)}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-card w-full max-w-[480px] rounded-[32px] p-6 shadow-2xl border border-border flex flex-col max-h-[90vh]"
          >
            <div className="flex justify-between items-center mb-5 shrink-0">
              <h3 className="text-[18px] font-black text-text-primary uppercase tracking-tight">Delete {customer.name}?</h3>
              <button 
                onClick={() => setShowDeleteConfirm(false)} 
                className="p-2 rounded-full bg-bg text-text-secondary hover:text-text-primary transition-colors"
                title="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1">
              <div className="bg-bg/50 rounded-2xl p-4 mb-6 border border-border">
                <div className="flex justify-between mb-3">
                  <span className="text-[12px] font-bold text-text-secondary uppercase tracking-widest opacity-60">Related Entries</span>
                  <span className="text-[13px] font-black text-text-primary">{customerTransactions.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[12px] font-bold text-text-secondary uppercase tracking-widest opacity-60">Pending Amount</span>
                  <span className="text-[13px] font-black text-danger">₹{pendingAmount.toLocaleString()}</span>
                </div>
              </div>
              <p className="text-[13px] font-medium text-text-secondary mb-8 text-center leading-relaxed break-normal whitespace-normal">
                This will mark the customer and all related entries as deleted. This can be undone for 5 seconds.
              </p>
            </div>

            <div className="flex gap-3 pt-2 shrink-0">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-4 rounded-2xl bg-bg border border-border font-black text-[12px] uppercase tracking-widest text-text-secondary active:scale-95 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-4 rounded-2xl bg-danger text-white font-black text-[12px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-danger/20 active:scale-95 transition-all"
              >
                <Trash2 size={18} /> Delete
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <PDFViewerModal 
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        report={previewReport}
      />

      {selectedReceipt && (
        <ReceiptSuccessModal
          receipt={selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
        />
      )}
    </motion.div>
  );
}
