import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type ContainerSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

interface ContainerProps {
  children: ReactNode;
  className?: string;
  size?: ContainerSize;
  padded?: boolean;
}

const sizeClasses: Record<ContainerSize, string> = {
  sm: 'max-w-3xl',
  md: 'max-w-4xl',
  lg: 'max-w-5xl',
  xl: 'max-w-6xl',
  full: 'max-w-none',
};

export function Container({ children, className, size = 'xl', padded = true }: ContainerProps) {
  return (
    <div className={cn('mx-auto w-full', padded && 'px-4 sm:px-6 lg:px-8', sizeClasses[size], className)}>
      {children}
    </div>
  );
}
