import React from 'react';
import { motion } from 'motion/react';
import { Banknote, Smartphone, AlertCircle, TrendingUp, ArrowUpRight } from 'lucide-react';
import { cn } from '../../lib/utils';

interface StatsGridProps {
  stats: {
    cash: number;
    phonepe: number;
    notPaid: number;
    total: number;
    cashCount: number;
    phonepeCount: number;
    notPaidCount: number;
  };
  onNavigate: (tab: string, filter?: any, customerId?: string, entryTab?: any, dateFilter?: any) => void;
  onTotalClick?: () => void;
}

export function StatsGrid({ stats, onNavigate, onTotalClick }: StatsGridProps) {
  const cards = [
    { 
      id: 'total', 
      title: "Today's Total Collected", 
      value: stats.total, 
      count: stats.cashCount + stats.phonepeCount,
      icon: TrendingUp, 
      color: 'text-accent', 
      bg: 'bg-card border-border hover:border-accent/40', 
      fullWidth: true,
      onClick: () => {
        if (onTotalClick) onTotalClick();
        else onNavigate('transactions', 'ALL');
      },
      subtitle: `${stats.cashCount} Cash + ${stats.phonepeCount} UPI transactions completed`
    },
    { 
      id: 'cash', 
      title: 'Cash In Hand', 
      value: stats.cash, 
      count: stats.cashCount,
      icon: Banknote, 
      color: 'text-emerald-600 dark:text-emerald-400', 
      bg: 'bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/20 hover:border-emerald-500/40', 
      onClick: () => onNavigate('entry', 'CASH', undefined, 'PAID', 'TODAY'),
      subtitle: `${stats.cashCount} cash deposits`
    },
    { 
      id: 'phonepe', 
      title: 'UPI / Online', 
      value: stats.phonepe, 
      count: stats.phonepeCount,
      icon: Smartphone, 
      color: 'text-blue-600 dark:text-blue-400', 
      bg: 'bg-blue-500/5 dark:bg-blue-500/10 border-blue-500/20 hover:border-blue-500/40', 
      onClick: () => onNavigate('entry', 'PHONEPE', undefined, 'PAID', 'TODAY'),
      subtitle: `${stats.phonepeCount} UPI entries`
    },
    { 
      id: 'notPaid', 
      title: 'Unsettled / To Collect', 
      value: stats.notPaid, 
      count: stats.notPaidCount,
      icon: AlertCircle, 
      color: 'text-amber-600 dark:text-amber-400', 
      bg: 'bg-amber-500/5 dark:bg-amber-500/10 border-amber-500/20 hover:border-amber-500/40', 
      fullWidth: true,
      onClick: () => onNavigate('entry', 'NOT_PAID', undefined, 'UNPAID', 'ALL'),
      subtitle: `${stats.notPaidCount} borrowers marked not paid or pending settlement`
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3.5">
      {cards.map((card, index) => {
        const Icon = card.icon;

        return (
          <motion.div
            key={card.id}
            initial={{ opacity: 1, y: 0 }}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={card.onClick}
            className={cn(
              "relative overflow-hidden rounded-2xl border flex flex-col justify-between transition-all p-4.5 cursor-pointer shadow-sm group",
              card.bg,
              card.fullWidth ? "col-span-2 min-h-[105px]" : "col-span-1 min-h-[115px]"
            )}
          >
            {/* Top row: Icon + Count tag + Arrow */}
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2.5">
                <div className={cn(
                  "w-9 h-9 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105",
                  card.id === 'total' 
                    ? 'bg-accent/10 text-accent' 
                    : card.id === 'cash'
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                    : card.id === 'phonepe'
                    ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                    : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                )}>
                  <Icon size={19} strokeWidth={2.5} />
                </div>
                <span className="text-xs font-bold text-text-secondary tracking-tight">
                  {card.title}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {card.count > 0 && (
                  <span className="text-[11px] font-semibold text-text-secondary px-2 py-0.5 rounded-md bg-muted/80">
                    {card.count} {card.count === 1 ? 'entry' : 'entries'}
                  </span>
                )}
                <ArrowUpRight size={14} className="text-text-secondary opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
              </div>
            </div>

            {/* Bottom row: Value + Subtitle */}
            <div className="mt-3">
              <div className="flex items-baseline gap-1">
                <span className="text-sm font-bold text-text-secondary">₹</span>
                <span className={cn(
                  "font-black tracking-tight text-text-primary",
                  card.fullWidth ? "text-2xl sm:text-3xl" : "text-xl sm:text-2xl"
                )}>
                  {card.value.toLocaleString('en-IN')}
                </span>
              </div>
              {card.subtitle && (
                <p className="text-[11px] font-medium text-text-secondary mt-0.5 truncate">
                  {card.subtitle}
                </p>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
