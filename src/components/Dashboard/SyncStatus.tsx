import React, { useEffect, useState } from 'react';
import { useSync } from '../../context/SyncContext';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { WifiOff, Bell } from 'lucide-react';
import { useUI } from '../../context/UIContext';
import { useFeedback } from '../../context/FeedbackContext';

export function SyncStatus({ 
  customTitle, 
  customSubtitle,
  onOpenNotifications 
}: { 
  customTitle?: string; 
  customSubtitle?: string;
  onOpenNotifications?: () => void;
}) {
  const { isCompact } = useUI();
  const { status, lastSynced, pendingCount } = useSync();
  const { setCenterOpen, history } = useFeedback();
  const [timeAgo, setTimeAgo] = useState('just now');

  useEffect(() => {
    if (!lastSynced) return;
    
    const updateTime = () => {
      const diff = Date.now() - lastSynced;
      if (diff < 5000) setTimeAgo('just now');
      else if (diff < 60000) setTimeAgo(`${Math.floor(diff / 1000)}s ago`);
      else if (diff < 3600000) setTimeAgo(`${Math.floor(diff / 60000)}m ago`);
      else setTimeAgo('Today');
    };

    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, [lastSynced]);

  const config = {
    synced: { label: 'Synced ✓', color: 'text-success', bg: 'bg-success/10', dot: 'bg-success shadow-[0_0_8px_rgba(16,185,129,0.5)]' },
    pending: { label: pendingCount > 0 ? `Sync Pending (${pendingCount})` : 'Sync Pending', color: 'text-warning', bg: 'bg-warning/10', dot: 'bg-warning shadow-[0_0_8px_rgba(245,158,11,0.5)]' },
    offline: { label: 'Offline', color: 'text-danger', bg: 'bg-danger/10', dot: 'bg-danger shadow-[0_0_8px_rgba(239,68,68,0.5)]' }
  };

  const current = config[status as keyof typeof config] || config.synced;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <h1 className="font-black text-[22px] tracking-tight text-text-primary uppercase leading-tight">{customTitle || 'Overview'}</h1>
          <div className="flex items-center gap-1.5 mt-0.5">
            <div className={`w-1.5 h-1.5 rounded-full ${current.dot} ${status === 'pending' ? 'animate-pulse' : ''}`} />
            <p className="font-black text-text-secondary opacity-40 text-[10px] uppercase tracking-[0.2em]">
              {customSubtitle ? customSubtitle : `Today • Synced ${timeAgo}`}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
            {onOpenNotifications && (
              <button
                type="button"
                onClick={onOpenNotifications}
                className="p-2 rounded-xl bg-card hover:bg-muted border border-border/70 text-text-secondary hover:text-accent flex items-center justify-center transition-all active:scale-95 shadow-xs relative cursor-pointer"
                title="Android Notification Center & Alert Settings"
              >
                <Bell size={15} />
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              </button>
            )}

            <motion.div
              key={status}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl ${current.bg} ${current.color} font-black border border-current/5 text-[9px] uppercase tracking-widest`}
            >
              {current.label}
            </motion.div>
        </div>
      </div>
    </div>
  );
}
