import React from 'react';

interface HighlightProps {
  text: string;
  highlight?: string;
}

export function Highlight({ text, highlight }: HighlightProps) {
  if (!highlight || typeof highlight !== 'string' || !highlight.trim()) {
    return <>{text}</>;
  }

  const regex = new RegExp(`(${String(highlight).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = String(text || '').split(regex);

  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <span key={i} className="bg-accent/20 text-accent rounded-sm px-0.5">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}
