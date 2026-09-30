import React from 'react';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div 
      className={`relative overflow-hidden bg-border/40 rounded-lg ${className}`} 
      {...props}
    >
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
    </div>
  );
}

export function CustomerCardSkeleton() {
  return (
    <div className="bg-card rounded-[24px] p-6 border border-border/50 shadow-sm flex flex-col gap-5">
      <div className="flex items-center gap-4">
        <Skeleton className="w-14 h-14 rounded-2xl" />
        <div className="flex flex-col gap-2 flex-1">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-3 w-1/4 opacity-50" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full opacity-30" />
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-14 rounded-2xl" />
          <Skeleton className="h-14 rounded-2xl" />
          <Skeleton className="h-14 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

export function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i}>
          <Skeleton className="h-28 rounded-3xl" />
        </div>
      ))}
    </div>
  );
}
