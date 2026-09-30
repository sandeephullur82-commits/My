import React, { useEffect, useState, useMemo } from 'react';
import { useRealtimeData } from '../hooks/useRealtimeData';
import { format } from 'date-fns';
import { SyncStatus } from '../components/Dashboard/SyncStatus';
import { StatsGrid } from '../components/Dashboard/StatsGrid';
import { firestoreService } from '../services/firestoreService';
import { toast } from 'sonner';

import { StatsSkeleton, Skeleton } from '../components/Skeleton';
import { PageContainer } from '../components/PageContainer';

export function Dashboard({ onNavigate }: { onNavigate: (tab: string, filter?: any, customerId?: string, entryTabVal?: any, dateFilterVal?: any, urlFilter?: string) => void }) {
  const { transactions, customers, loading } = useRealtimeData();
  const [isReady, setIsReady] = useState(false);

  // Maintain isReady only for the initial mount to prevent flickering on every tab switch
  useEffect(() => {
    if (!loading) {
       setIsReady(true);
     }
  }, [loading]);

  // Memoize date strings to avoid redundant calculations
  const today = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

  // Performance Optimization: O(M + N) instead of O(M * N)
  const pendingCustomers = useMemo(() => {
    const paidTodaySet = new Set(
      transactions
        .filter(tx => tx.date === today && !tx.isDeleted && tx.status === 'paid')
        .map(tx => tx.customerId)
    );
    return customers.filter(c => {
      const loanAmount = c.loanAmount || c.loan || 0;
      const pendingAmount = c.pending !== undefined ? c.pending : (loanAmount - (c.paid || 0));
      return pendingAmount > 0 && !paidTodaySet.has(c.id);
    });
  }, [transactions, customers, today]);

  // Memoize stats calculation
  const stats = useMemo(() => {
    let cashToday = 0;
    let cashCount = 0;
    let phonepeToday = 0;
    let phonepeCount = 0;
    let notPaidTotal = 0;
    let notPaidCount = 0;

    transactions.forEach(tx => {
      if (tx.isDeleted) return;

      if (tx.status === 'unsettled') {
        notPaidTotal += tx.amount;
        notPaidCount++;
      }

      if (tx.date === today && tx.status === 'paid') {
        if (tx.type === 'cash') {
          cashToday += tx.amount;
          cashCount++;
        }
        if (tx.type === 'phonepe') {
          phonepeToday += tx.amount;
          phonepeCount++;
        }
      }
    });

    return { 
      cash: cashToday, 
      phonepe: phonepeToday, 
      notPaid: notPaidTotal,
      total: cashToday + phonepeToday,
      cashCount,
      phonepeCount,
      notPaidCount,
    };
  }, [transactions, today]);

  const handleTotalClick = () => {
    onNavigate('transactions', 'ALL');
  };

  const todayEntriesCount = useMemo(() => {
    return transactions.filter(tx => tx.date === today && !tx.isDeleted).length;
  }, [transactions, today]);

  const statsStrip = {
      todayCount: todayEntriesCount,
      pendingCount: pendingCustomers.length,
      totalCustomers: customers.length
  };

  if (!isReady) {
    return (
      <PageContainer>
        <div className="flex flex-col gap-6">
          <SyncStatus />
          <StatsSkeleton />
          <div className="flex flex-col gap-4">
            <Skeleton className="h-40 w-full rounded-2xl" />
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Top Section */}
        <SyncStatus />

        {/* Quick Info Strip */}
        <div className="flex items-center justify-between px-5 py-3 bg-card border border-border/10 rounded-[20px] shadow-sm">
           <div 
             className="flex flex-col items-center cursor-pointer active:scale-95 transition-transform"
             onClick={() => onNavigate('entry', 'ALL', undefined, 'PAID', 'ALL')}
           >
              <span className="text-[14px] font-black text-text-primary">{statsStrip.todayCount}</span>
              <span className="text-[8px] font-black uppercase tracking-widest text-text-secondary opacity-40">Today</span>
           </div>
           <div className="w-px h-6 bg-border/20" />
           <div 
             className="flex flex-col items-center cursor-pointer active:scale-95 transition-transform"
             onClick={() => onNavigate('entry', 'ALL', undefined, 'PENDING', 'ALL')}
           >
              <span className="text-[14px] font-black text-warning">{statsStrip.pendingCount}</span>
              <span className="text-[8px] font-black uppercase tracking-widest text-text-secondary opacity-40">Pending</span>
           </div>
           <div className="w-px h-6 bg-border/20" />
           <div 
             className="flex flex-col items-center cursor-pointer active:scale-95 transition-transform"
             onClick={() => onNavigate('customers')}
           >
              <span className="text-[14px] font-black text-accent">{statsStrip.totalCustomers}</span>
              <span className="text-[8px] font-black uppercase tracking-widest text-text-secondary opacity-40">Total</span>
           </div>
        </div>

        <div className="space-y-6">
          {/* Stats Grid */}
          <StatsGrid 
            stats={stats} 
            onNavigate={(tab, filter, custId, et, df) => {
              if (filter === 'CASH' || filter === 'PHONEPE') {
                onNavigate('transactions', filter);
              } else if (filter === 'NOT_PAID' || filter === 'unsettled') {
                onNavigate('transactions', 'UNSETTLED');
              } else {
                onNavigate(tab, filter, custId, et, df);
              }
            }} 
            onTotalClick={handleTotalClick}
          />
        </div>
      </div>
    </PageContainer>
  );
}
