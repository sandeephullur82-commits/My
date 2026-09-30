import React, { useEffect, useState, useRef } from 'react';
import { animate } from 'motion/react';

interface AnimatedNumberProps {
  value: number;
  format?: 'currency' | 'number';
  className?: string;
}

export function AnimatedNumber({ value, format = 'number', className }: AnimatedNumberProps) {
  const nodeRef = useRef<HTMLSpanElement>(null);
  const prevValue = useRef(value);

  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;

    const formatValue = (val: number) => {
      if (format === 'currency') {
        return `₹${Math.round(val).toLocaleString('en-IN')}`;
      }
      return Math.round(val).toLocaleString('en-IN');
    };

    const controls = animate(prevValue.current, value, {
      duration: 0.4,
      ease: [0.32, 0.72, 0, 1], // ease-out-cubic
      onUpdate(currentValue) {
        node.textContent = formatValue(currentValue);
      },
    });

    prevValue.current = value;
    return () => controls.stop();
  }, [value, format]);

  return <span ref={nodeRef} className={className}>{format === 'currency' ? `₹${value.toLocaleString('en-IN')}` : value.toLocaleString('en-IN')}</span>;
}
