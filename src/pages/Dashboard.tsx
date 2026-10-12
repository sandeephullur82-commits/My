import React, { useEffect, useState, useMemo } from 'react';
import { useRealtimeData } from '../hooks/useRealtimeData';
import { format } from 'date-fns';
import { SyncStatus } from '../components/Dashboard/SyncStatus';
import { StatsGrid } from '../components/Dashboard/StatsGrid';
import { DashboardRenewalSection } from '../components/Dashboard/DashboardRenewalSection';
import { StatsSkeleton, Skeleton } from '../components/Skeleton';
import { PageContainer } from '../components/PageContainer';

import { CheckCircle2, Clock, Users, ArrowRight } from 'lucide-react';

export function Dashboard({ onNavigate }: { onNavigate: (tab: string, filter?: any, customerId?: string, entryTabVal?: any, dateFilterVal?: any, urlFilter?: string) => void }) {
  const { transactions, customers, loading } = useRealtimeData();
  const [isReady, setIsReady] = useState(false);



  useEffect(() => {
    if (!loading) {
      setIsReady(true);
    }
  }, [loading]);

  const today = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

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

  const stats = useMemo(() => {
    let cashToday = 0;
    let cashCount = 0;
    let phonepeToday = 0;
    let phonepeCount = 0;
    let notPaidTotal = 0;
    let notPaidCount = 0;

    transactions.forEach(tx => {
      if (tx.isDeleted) return;

      if (tx.status === 'unsettled' || tx.type === 'NP') {
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

  if (!isReady) {
    return (
      <PageContainer>
        <div className="flex flex-col gap-5 max-w-7xl mx-auto">
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
      <div className="flex flex-col gap-6 max-w-7xl mx-auto animate-in fade-in duration-300 pb-4">
        {/* Top Header */}
        <SyncStatus />

        {/* Quick Summary Metrics Strip */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-4 lg:gap-6">
          
          {/* Card 1: Today Collected */}
          <div 
            onClick={() => onNavigate('entry', 'ALL', undefined, 'PAID', 'ALL')}
            className="flex flex-col items-center justify-center p-3.5 sm:p-5 bg-card border border-border/80 hover:border-success/40 rounded-2xl shadow-xs cursor-pointer active:scale-95 transition-all group text-center"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-success/10 text-success flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <CheckCircle2 size={18} strokeWidth={2.5} />
            </div>
            <span className="text-xl sm:text-3xl font-black font-mono tabular-nums text-text-primary tracking-tight leading-none">
              {todayEntriesCount}
            </span>
            <span className="text-[11px] sm:text-xs font-bold text-text-secondary mt-1.5">
              Collected Today
            </span>
          </div>

          {/* Card 2: Pending Today */}
          <div 
            onClick={() => onNavigate('entry', 'ALL', undefined, 'PENDING', 'ALL')}
            className="flex flex-col items-center justify-center p-3.5 sm:p-5 bg-card border border-border/80 hover:border-warning/40 rounded-2xl shadow-xs cursor-pointer active:scale-95 transition-all group text-center"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-warning/10 text-warning flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <Clock size={18} strokeWidth={2.5} />
            </div>
            <span className="text-xl sm:text-3xl font-black font-mono tabular-nums text-warning tracking-tight leading-none">
              {pendingCustomers.length}
            </span>
            <span className="text-[11px] sm:text-xs font-bold text-text-secondary mt-1.5">
              Pending Today
            </span>
          </div>

          {/* Card 3: Total Accounts */}
          <div 
            onClick={() => onNavigate('customers')}
            className="flex flex-col items-center justify-center p-3.5 sm:p-5 bg-card border border-border/80 hover:border-accent/40 rounded-2xl shadow-xs cursor-pointer active:scale-95 transition-all group text-center"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <Users size={18} strokeWidth={2.5} />
            </div>
            <span className="text-xl sm:text-3xl font-black font-mono tabular-nums text-accent tracking-tight leading-none">
              {customers.length}
            </span>
            <span className="text-[11px] sm:text-xs font-bold text-text-secondary mt-1.5">
              Total Customers
            </span>
          </div>
        </div>

        {/* Responsive Multi-Column Layout on Tablets (md: 768px+) and Desktops (lg: 1024px+) */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          {/* Main Left Column: Financial Breakdown */}
          <div className="md:col-span-7 xl:col-span-8 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-text-secondary">
                Collection Breakdown
              </h2>
              <button
                onClick={() => onNavigate('transactions', 'ALL')}
                className="text-xs font-bold text-accent hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Full Ledger</span>
                <ArrowRight size={13} />
              </button>
            </div>

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

          {/* Secondary Right Column: Matured Loan Renewals */}
          <div className="md:col-span-5 xl:col-span-4 space-y-4">
            <DashboardRenewalSection customers={customers} onNavigate={onNavigate} />
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
