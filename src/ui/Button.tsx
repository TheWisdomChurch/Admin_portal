// src/components/ui/Button.tsx
import { ButtonHTMLAttributes, forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'warning' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, icon, children, disabled, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center rounded-[var(--radius-button)] font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';
    
    // Use basic Tailwind colors that work without custom config
    const variants = {
      primary: 'bg-[var(--color-accent-primary)] text-[var(--color-text-onprimary)] hover:bg-[var(--color-accent-primaryhover)] focus-visible:ring-[var(--color-accent-primary)] shadow-sm hover:-translate-y-0.5',
      secondary: 'bg-[var(--color-background-tertiary)] text-[var(--color-text-primary)] hover:bg-[var(--color-background-hover)] focus-visible:ring-[var(--color-border-focus)]',
      warning: 'bg-amber-500 text-white hover:bg-amber-600 focus-visible:ring-amber-500',
      danger: 'bg-[var(--color-accent-danger)] text-white hover:opacity-90 focus-visible:ring-[var(--color-accent-danger)]',
      ghost: 'text-[var(--color-text-secondary)] hover:bg-[var(--color-background-hover)] hover:text-[var(--color-text-primary)] focus-visible:ring-[var(--color-border-focus)]',
      outline: 'border border-[var(--color-border-primary)] bg-transparent text-[var(--color-text-primary)] hover:bg-[var(--color-background-hover)] focus-visible:ring-[var(--color-border-focus)]',
    };

    const sizes = {
      sm: 'h-9 px-3 text-sm',
      md: 'h-10 px-4 text-sm',
      lg: 'h-12 px-6 text-base',
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {icon && !loading && <span className="mr-2">{icon}</span>}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
export { Button };
