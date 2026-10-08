import { useEffect, useRef } from 'react';
import { useRealtimeData } from './useRealtimeData';
import { whatsappReportService } from '../services/whatsappReportService';
import { toast } from 'sonner';
import { format } from 'date-fns';

export function useWhatsAppReportScheduler() {
  const { customers, transactions } = useRealtimeData();
  const checkingRef = useRef(false);

  useEffect(() => {
    const checkSchedule = async () => {
      if (checkingRef.current) return;
      
      const settings = whatsappReportService.getSettings();
      if (!settings.enabled) return;

      const now = new Date();
      const todayStr = format(now, 'yyyy-MM-dd');
      const currentTimeStr = format(now, 'HH:mm');

      // Check if scheduled time has arrived and hasn't been dispatched today
      if (currentTimeStr === settings.dispatchTime && settings.lastDispatchedDate !== todayStr) {
        checkingRef.current = true;
        try {
          whatsappReportService.saveSettings({ lastDispatchedDate: todayStr });
          
          toast('⏰ Daily Master Statement Ready', {
            description: `Automated 6:00 AM report prepared for WhatsApp (${customers.length} borrowers).`,
            duration: 15000,
            action: {
              label: 'Send to WhatsApp',
              onClick: () => {
                whatsappReportService.sendReportToWhatsApp(customers, transactions);
              }
            }
          });
        } finally {
          checkingRef.current = false;
        }
      }
    };

    // Check on mount and every 30 seconds
    checkSchedule();
    const timer = setInterval(checkSchedule, 30000);

    return () => clearInterval(timer);
  }, [customers, transactions]);
}
