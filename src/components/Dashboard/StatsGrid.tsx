import React from 'react';
import { motion } from 'motion/react';
import { Banknote, Smartphone, AlertCircle, TrendingUp } from 'lucide-react';
import { useUI } from '../../context/UIContext';
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
  const { isCompact } = useUI();
  const cards = [
    { 
      id: 'notPaid', 
      title: 'To Settle', 
      value: stats.notPaid, 
      count: stats.notPaidCount,
      icon: AlertCircle, 
      color: 'text-warning', 
      bg: 'bg-warning/10', 
      borderColor: 'border-warning/20',
      clickable: true,
      hint: 'action',
      filter: 'NOT_PAID',
      entryTab: 'PAID',
      dateFilter: 'ALL',
      fullWidth: true
    },
    { 
      id: 'cash', 
      title: 'Daily Cash', 
      value: stats.cash, 
      count: stats.cashCount,
      icon: Banknote, 
      color: 'text-success', 
      bg: 'bg-success/5', 
      borderColor: 'border-success/10',
      clickable: true,
      filter: 'CASH',
      entryTab: 'PAID',
      dateFilter: 'TODAY'
    },
    { 
      id: 'phonepe', 
      title: 'UPI / Online', 
      value: stats.phonepe, 
      count: stats.phonepeCount,
      icon: Smartphone, 
      color: 'text-accent', 
      bg: 'bg-accent/5', 
      borderColor: 'border-accent/10',
      clickable: true,
      filter: 'PHONEPE',
      entryTab: 'PAID',
      dateFilter: 'TODAY'
    },
    { 
      id: 'total', 
      title: 'Total Rev', 
      value: stats.total, 
      icon: TrendingUp, 
      color: 'text-text-primary', 
      bg: 'bg-card', 
      borderColor: 'border-border/50',
      clickable: true,
      onSpecialClick: onTotalClick,
      lowEmphasis: true
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {cards.map((card, index) => {
        const Icon = card.icon;
        const handleClick = () => {
          if (!card.clickable) return;
          if ((card as any).onSpecialClick) {
            (card as any).onSpecialClick();
          } else {
            onNavigate('entry', card.filter, undefined, (card as any).entryTab, (card as any).dateFilter);
          }
        };

        return (
          <motion.div
            key={card.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleClick}
            className={cn(
              "relative overflow-hidden rounded-[24px] border flex flex-col items-start justify-between transition-all p-5 h-[110px]",
              card.bg,
              card.borderColor,
              card.fullWidth ? "col-span-2" : "col-span-1",
              card.clickable ? 'cursor-pointer active:shadow-inner' : 'cursor-default',
              card.id === 'notPaid' ? 'border-2 shadow-lg shadow-warning/5' : 'shadow-sm',
              card.lowEmphasis && 'opacity-60 grayscale-[0.5]'
            )}
          >
            {/* Background Icon Accent */}
            <div className={`absolute -bottom-6 -right-6 opacity-[0.05] group-hover:opacity-[0.08] transition-opacity rotate-12`}>
                <Icon size={96} className={card.color} />
            </div>

            <div className="flex items-start justify-between w-full relative z-10">
              <div className={cn(
                "w-9 h-9 rounded-xl flex items-center justify-center",
                card.id === 'total' ? 'bg-muted' : 'bg-white/80 dark:bg-black/20 shadow-sm border border-white/20'
              )}>
                <Icon className={card.color} size={18} />
              </div>
              {'count' in card && card.count > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/50 dark:bg-black/20 border border-white/20 backdrop-blur-sm">
                   <p className="text-[10px] font-black text-text-primary leading-none uppercase tracking-tighter">
                    {card.count} {card.count === 1 ? 'entry' : 'entries'}
                   </p>
                </div>
              )}
            </div>
            
            <div className="w-full relative z-10">
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-text-secondary opacity-40 leading-none mb-2">{card.title}</p>
              <p className={cn(
                "font-black text-text-primary leading-none tracking-tighter",
                card.fullWidth ? "text-2xl" : "text-[18px]"
              )}>
                <span className="text-[14px] font-medium mr-0.5 opacity-30">₹</span>
                {card.value.toLocaleString()}
              </p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
