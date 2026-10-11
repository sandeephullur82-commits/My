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
      title: "Total Collected", 
      value: stats.total, 
      count: stats.cashCount + stats.phonepeCount,
      icon: TrendingUp, 
      color: 'text-accent', 
      bg: 'bg-card border-border/80 hover:border-accent/40', 
      iconBg: 'bg-accent/10 text-accent',
      onClick: () => {
        if (onTotalClick) onTotalClick();
        else onNavigate('transactions', 'ALL');
      },
      subtitle: `${stats.cashCount} Cash + ${stats.phonepeCount} UPI today`
    },
    { 
      id: 'cash', 
      title: 'Cash In Hand', 
      value: stats.cash, 
      count: stats.cashCount,
      icon: Banknote, 
      color: 'text-emerald-600 dark:text-emerald-400', 
      bg: 'bg-card border-border/80 hover:border-emerald-500/40', 
      iconBg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
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
      bg: 'bg-card border-border/80 hover:border-blue-500/40', 
      iconBg: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
      onClick: () => onNavigate('entry', 'PHONEPE', undefined, 'PAID', 'TODAY'),
      subtitle: `${stats.phonepeCount} UPI entries`
    },
    { 
      id: 'notPaid', 
      title: 'To Collect / Due', 
      value: stats.notPaid, 
      count: stats.notPaidCount,
      icon: AlertCircle, 
      color: 'text-amber-600 dark:text-amber-400', 
      bg: 'bg-card border-border/80 hover:border-amber-500/40', 
      iconBg: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
      onClick: () => onNavigate('entry', 'NOT_PAID', undefined, 'UNPAID', 'ALL'),
      subtitle: `${stats.notPaidCount} borrowers with dues`
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <motion.div
            key={card.id}
            initial={{ opacity: 1, y: 0 }}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={card.onClick}
            className={cn(
              "relative overflow-hidden rounded-2xl border flex flex-col justify-between transition-all p-4 cursor-pointer shadow-xs group min-h-[120px]",
              card.bg
            )}
          >
            {/* Top row: Icon + Count tag + Arrow */}
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={cn(
                  "w-9 h-9 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 shrink-0",
                  card.iconBg
                )}>
                  <Icon size={18} strokeWidth={2.5} />
                </div>
                <span className="text-xs font-bold text-text-secondary tracking-tight truncate">
                  {card.title}
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <ArrowUpRight size={15} className="text-text-secondary opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
              </div>
            </div>

            {/* Bottom row: Value + Subtitle */}
            <div className="mt-3">
              <div className="flex items-baseline gap-1">
                <span className="text-xs font-bold text-text-secondary font-sans">₹</span>
                <span className="text-xl sm:text-2xl font-black font-mono tabular-nums tracking-tight text-text-primary">
                  {card.value.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 mt-1">
                <p className="text-[11px] font-medium text-text-secondary truncate">
                  {card.subtitle}
                </p>
                {card.count > 0 && (
                  <span className="text-[10px] font-mono font-bold text-text-secondary px-1.5 py-0.2 rounded-md bg-muted/80 shrink-0">
                    {card.count}
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
