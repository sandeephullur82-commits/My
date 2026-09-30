import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { CheckCircle2, MessageSquare, ArrowRight, CornerDownLeft } from 'lucide-react';
import { toast } from 'sonner';

interface WhatsAppCallbackProps {
  onNavigate?: (tab: string, filter?: any, customerId?: string) => void;
}

export function WhatsAppCallback({ onNavigate }: WhatsAppCallbackProps) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(2);

  const customerId = searchParams.get('customerId') || searchParams.get('focus') || '';
  const customerName = searchParams.get('name') || searchParams.get('customer') || '';
  const status = searchParams.get('status') || 'completed';
  const targetTab = searchParams.get('tab') || 'entry';

  useEffect(() => {
    if (navigator.vibrate) {
      navigator.vibrate(15);
    }
    toast.success('WhatsApp session returned', {
      description: customerName
        ? `Ledger ready for ${customerName}`
        : 'Returning to your collection ledger',
    });

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          executeReturn();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const executeReturn = () => {
    if (onNavigate && targetTab === 'entry') {
      onNavigate('entry', undefined, customerId || undefined);
    } else if (customerId) {
      navigate(`/entry?focus=${encodeURIComponent(customerId)}`, { replace: true });
    } else if (targetTab === 'customers') {
      navigate('/customers', { replace: true });
    } else {
      navigate('/entry', { replace: true });
    }
  };

  return (
    <div
      id="whatsapp-callback-container"
      className="min-h-[80vh] flex flex-col items-center justify-center p-6"
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="w-full max-w-md bg-card border border-border rounded-2xl p-6 md:p-8 shadow-sm text-center flex flex-col items-center"
      >
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-6">
          <MessageSquare size={32} className="stroke-[2.2]" />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold tracking-wide uppercase mb-3">
          <CheckCircle2 size={13} />
          <span>WhatsApp Callback Verified</span>
        </div>

        <h1 className="text-xl md:text-2xl font-bold tracking-tight text-text-primary mb-2">
          {customerName ? `Reminder Sent to ${customerName}` : 'Returned to Pigmy Pro'}
        </h1>

        <p className="text-sm text-text-secondary leading-relaxed max-w-xs mb-8">
          Your WhatsApp interaction was processed. Resuming your field collection workspace in{' '}
          <span className="font-semibold text-text-primary">{countdown}s</span>.
        </p>

        <div className="w-full flex flex-col sm:flex-row gap-3">
          <button
            id="return-to-ledger-btn"
            onClick={executeReturn}
            className="w-full py-3 px-6 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent/90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            <span>Continue to Ledger</span>
            <ArrowRight size={16} />
          </button>

          <button
            id="go-to-dashboard-btn"
            onClick={() => navigate('/', { replace: true })}
            className="w-full sm:w-auto py-3 px-5 rounded-xl border border-border bg-bg text-text-primary text-sm font-medium hover:bg-card active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <CornerDownLeft size={16} />
            <span>Dashboard</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
