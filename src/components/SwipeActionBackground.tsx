import React from 'react';
import { motion, MotionValue } from 'motion/react';
import { MessageSquare, Phone } from 'lucide-react';

interface SwipeActionBackgroundProps {
  leftActionOpacity: MotionValue<number>;
  rightActionOpacity: MotionValue<number>;
  onActionTap: (action: 'whatsapp' | 'call') => void;
  customerName: string;
  customerId: string;
  roundedClass?: string;
}

export function SwipeActionBackground({
  leftActionOpacity,
  rightActionOpacity,
  onActionTap,
  customerName,
  customerId,
  roundedClass = 'rounded-2xl'
}: SwipeActionBackgroundProps) {
  return (
    <div className={`absolute inset-0 flex items-center justify-between ${roundedClass} overflow-hidden`}>
      {/* Swipe Right Action (WhatsApp - Emerald Green) */}
      <motion.button
        id={`swipe-whatsapp-${customerId}`}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onActionTap('whatsapp');
        }}
        className={`h-full flex items-center pl-5 pr-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white gap-2.5 ${roundedClass} rounded-r-none cursor-pointer transition-colors text-left select-none`}
        style={{ opacity: leftActionOpacity, width: '130px' }}
        title={`WhatsApp ${customerName}`}
      >
        <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
          <MessageSquare size={18} className="text-white" strokeWidth={2.5} />
        </div>
        <div className="min-w-0">
          <span className="block text-[11px] font-black uppercase tracking-wider leading-none">WhatsApp</span>
          <span className="text-[9px] font-semibold text-white/80 mt-1 block">Tap to Send</span>
        </div>
      </motion.button>

      {/* Swipe Left Action (Call - Blue) */}
      <motion.button
        id={`swipe-call-${customerId}`}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onActionTap('call');
        }}
        className={`h-full flex items-center justify-end pr-5 pl-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white gap-2.5 ${roundedClass} rounded-l-none cursor-pointer transition-colors text-right ml-auto select-none`}
        style={{ opacity: rightActionOpacity, width: '130px' }}
        title={`Call ${customerName}`}
      >
        <div className="min-w-0">
          <span className="block text-[11px] font-black uppercase tracking-wider leading-none">Call</span>
          <span className="text-[9px] font-semibold text-white/80 mt-1 block">Tap to Call</span>
        </div>
        <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
          <Phone size={18} className="text-white" strokeWidth={2.5} />
        </div>
      </motion.button>
    </div>
  );
}
