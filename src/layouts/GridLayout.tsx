import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type GridGap = 'none' | 'sm' | 'md' | 'lg' | 'xl';

interface GridLayoutProps {
  children: ReactNode;
  className?: string;
  columns?: string;
  gap?: GridGap;
}

const gapClasses: Record<GridGap, string> = {
  none: 'gap-0',
  sm: 'gap-3',
  md: 'gap-5',
  lg: 'gap-6',
  xl: 'gap-8',
};

export function GridLayout({
  children,
  className,
  columns = 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4',
  gap = 'lg',
}: GridLayoutProps) {
  return (
    <div className={cn('grid', columns, gapClasses[gap], className)}>
      {children}
    </div>
  );
}
