import React from 'react';
import { Plus, UserPlus, Users } from 'lucide-react';
import { motion } from 'motion/react';
import { useUI } from '../../context/UIContext';

interface QuickActionsProps {
  onNavigate: (tab: string, filter?: any, customerId?: string, entryTab?: any) => void;
  onAddCustomer: () => void;
  onAddEntry: () => void;
}

export function QuickActions({ onNavigate, onAddCustomer, onAddEntry }: QuickActionsProps) {
  const { isCompact } = useUI();
  
  return (
    <div className="grid grid-cols-2 gap-sm">
      <motion.button
        whileTap={{ scale: 0.96 }}
        onClick={onAddEntry}
        className="flex flex-col items-center justify-center gap-1.5 rounded-2xl bg-accent text-white font-bold shadow-lg shadow-accent/20 h-20 text-[10px] uppercase tracking-widest transition-all hover:brightness-110 group overflow-hidden relative"
      >
        <div className="w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center transition-transform group-hover:scale-110">
          <Plus size={16} strokeWidth={3} />
        </div>
        Add Entry
      </motion.button>

      <motion.button
        whileTap={{ scale: 0.96 }}
        onClick={onAddCustomer}
        className="flex flex-col items-center justify-center gap-1.5 rounded-2xl bg-white dark:bg-card text-text-primary font-bold border border-border/50 shadow-sm h-20 text-[10px] uppercase tracking-widest transition-all hover:border-success/40 group overflow-hidden relative"
      >
        <div className="w-8 h-8 rounded-full bg-success/10 text-success flex items-center justify-center transition-transform group-hover:scale-110">
          <UserPlus size={16} strokeWidth={2.5} />
        </div>
        Customer
      </motion.button>
    </div>
  );
}
