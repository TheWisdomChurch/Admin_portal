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
    success: 'bg-[var(--color-success-surface)] text-[var(--color-success-text)] border border-[var(--color-success-border)]',
    warning: 'bg-[var(--color-warning-surface)] text-[var(--color-warning-text)] border border-[var(--color-warning-border)]',
    danger: 'bg-[var(--color-danger-surface)] text-[var(--color-danger-text)] border border-[var(--color-danger-border)]',
    info: 'bg-[var(--color-info-surface)] text-[var(--color-info-text)] border border-[var(--color-info-border)]',
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
    default: 'bg-[var(--color-background-tertiary)] text-[var(--color-text-secondary)]',
    primary: 'bg-[var(--color-accent-primary)] text-[var(--color-text-onprimary)]',
    success: 'bg-[var(--color-accent-success)] text-white',
    warning: 'bg-[var(--color-accent-warning)] text-white',
    danger: 'bg-[var(--color-accent-danger)] text-white',
    info: 'bg-[var(--color-accent-info)] text-white',
    outline: 'bg-transparent text-[var(--color-text-secondary)] border border-[var(--color-border-secondary)]',
    secondary: 'bg-[var(--color-text-secondary)] text-[var(--color-text-inverse)]',
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
    default: 'bg-[var(--color-text-tertiary)]',
    primary: 'bg-[var(--color-accent-primary)]',
    success: 'bg-[var(--color-accent-success)]',
    warning: 'bg-[var(--color-accent-warning)]',
    danger: 'bg-[var(--color-accent-danger)]',
    info: 'bg-[var(--color-accent-info)]',
    outline: 'bg-transparent border border-[var(--color-border-secondary)]',
    secondary: 'bg-[var(--color-text-tertiary)]',
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
