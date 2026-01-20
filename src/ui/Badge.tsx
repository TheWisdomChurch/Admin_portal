// src/components/ui/Badge.tsx
import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'outline' | 'secondary';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function Badge({ 
  children, 
  variant = 'default', 
  className,
  size = 'md'
}: BadgeProps) {
  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-xs',
    md: 'px-2.5 py-0.5 text-xs',
    lg: 'px-3 py-1 text-sm',
  };

  const variants = {
    default: 'bg-[var(--color-background-tertiary)] text-[var(--color-text-secondary)] border border-[var(--color-border-secondary)]',
    primary: 'bg-[var(--color-background-tertiary)] text-[var(--color-accent-primary)] border border-[var(--color-accent-primary)]',
    success: 'bg-green-100 text-green-800 border border-green-200',
    warning: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
    danger: 'bg-red-100 text-red-800 border border-red-200',
    info: 'bg-blue-100 text-blue-800 border border-blue-200',
    outline: 'bg-transparent text-[var(--color-text-secondary)] border border-[var(--color-border-secondary)]',
    secondary: 'bg-[var(--color-background-tertiary)] text-[var(--color-text-primary)] border border-[var(--color-border-secondary)]',
  };

  return (
    <span className={cn(
      'inline-flex items-center rounded-[var(--radius-pill)] font-medium',
      'whitespace-nowrap transition-colors',
      sizeClasses[size],
      variants[variant],
      className
    )}>
      {children}
    </span>
  );
}

// Extended Badge component with icon support
interface BadgeWithIconProps extends BadgeProps {
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
}

export function BadgeWithIcon({ 
  children, 
  icon,
  iconPosition = 'left',
  variant = 'default',
  className,
  size = 'md'
}: BadgeWithIconProps) {
  return (
    <Badge variant={variant} className={cn('gap-1.5', className)} size={size}>
      {icon && iconPosition === 'left' && (
        <span className="flex items-center">{icon}</span>
      )}
      <span>{children}</span>
      {icon && iconPosition === 'right' && (
        <span className="flex items-center">{icon}</span>
      )}
    </Badge>
  );
}

// Pill Badge variant (more rounded)
export function PillBadge({ 
  children, 
  variant = 'default', 
  className,
  size = 'md'
}: BadgeProps) {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base',
  };

  const variants = {
    default: 'bg-secondary-100 text-secondary-800',
    primary: 'bg-primary-600 text-white',
    success: 'bg-green-600 text-white',
    warning: 'bg-yellow-600 text-white',
    danger: 'bg-red-600 text-white',
    info: 'bg-blue-600 text-white',
    outline: 'bg-transparent text-secondary-700 border border-secondary-300',
    secondary: 'bg-secondary-600 text-white',
  };

  return (
    <span className={cn(
      'inline-flex items-center rounded-[var(--radius-button)] font-medium',
      'whitespace-nowrap transition-colors',
      sizeClasses[size],
      variants[variant],
      className
    )}>
      {children}
    </span>
  );
}

// Dot Badge (small indicator)
interface DotBadgeProps {
  color?: BadgeVariant;
  size?: 'sm' | 'md' | 'lg';
  pulse?: boolean;
  className?: string;
}

export function DotBadge({ 
  color = 'primary', 
  size = 'md',
  pulse = false,
  className 
}: DotBadgeProps) {
  const sizeClasses = {
    sm: 'h-1.5 w-1.5',
    md: 'h-2 w-2',
    lg: 'h-3 w-3',
  };

  const colorClasses = {
    default: 'bg-secondary-500',
    primary: 'bg-primary-500',
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    danger: 'bg-red-500',
    info: 'bg-blue-500',
    outline: 'bg-transparent border border-secondary-400',
    secondary: 'bg-secondary-400',
  };

  return (
    <span className={cn(
      'inline-block rounded-full',
      sizeClasses[size],
      colorClasses[color],
      pulse && 'animate-pulse',
      className
    )} />
  );
}
