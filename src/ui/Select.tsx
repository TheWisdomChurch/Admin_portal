// src/components/ui/Select.tsx
import { SelectHTMLAttributes, forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: string;
  label?: string;
  helperText?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, label, helperText, id, children, ...props }, ref) => {
    const selectId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="space-y-2">
        {label && (
          <label htmlFor={selectId} className="block text-sm font-medium text-[var(--color-text-secondary)]">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={cn(
              'flex h-10 w-full appearance-none rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 pr-9 text-sm text-[var(--color-text-primary)] ring-offset-[var(--color-background-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
              error && 'border-[var(--color-border-error)] focus-visible:ring-[var(--color-border-error)]',
              className
            )}
            {...props}
          >
            {children}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
        </div>
        {helperText && !error && (
          <p className="text-sm text-[var(--color-text-tertiary)]">{helperText}</p>
        )}
        {error && <p className="text-sm text-[var(--color-danger-text)]">{error}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';
export { Select };
