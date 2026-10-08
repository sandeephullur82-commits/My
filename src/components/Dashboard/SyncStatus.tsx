import React from 'react';
import { format } from 'date-fns';
import { Calendar, Bell } from 'lucide-react';

export function SyncStatus({ 
  customTitle, 
  customSubtitle,
  onOpenNotifications 
}: { 
  customTitle?: string; 
  customSubtitle?: string;
  onOpenNotifications?: () => void;
}) {
  const todayFormatted = format(new Date(), 'EEEE, dd MMMM yyyy');

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-col">
        <h1 className="text-xl sm:text-2xl font-black tracking-tight text-text-primary leading-tight">
          {customTitle || 'Dashboard'}
        </h1>
        <div className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary mt-0.5">
          <Calendar size={13} className="opacity-60" />
          <span>{customSubtitle || todayFormatted}</span>
        </div>
      </div>
      
      {onOpenNotifications && (
        <button
          type="button"
          onClick={onOpenNotifications}
          className="p-2.5 rounded-xl bg-card hover:bg-muted border border-border text-text-secondary hover:text-accent flex items-center justify-center transition-all active:scale-95 shadow-xs relative cursor-pointer"
          title="Alerts and notifications"
        >
          <Bell size={16} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent animate-pulse" />
        </button>
      )}
    </div>
  );
}
