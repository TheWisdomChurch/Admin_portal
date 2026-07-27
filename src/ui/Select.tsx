// src/components/ui/Select.tsx
import { SelectHTMLAttributes, forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { controlClassName, FieldShell } from '@/ui/FieldShell';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: string;
  label?: string;
  helperText?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, label, helperText, id, children, required, ...props }, ref) => (
    <FieldShell id={id} label={label} helperText={helperText} error={error} required={required}>
      {({ controlId, describedBy, invalid }) => (
        <div className="relative">
          <select
            ref={ref}
            id={controlId}
            required={required}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            className={cn(controlClassName, 'h-11 appearance-none py-2 pr-9', invalid && 'border-[var(--color-border-error)] focus-visible:border-[var(--color-border-error)] focus-visible:ring-[var(--color-border-error)]/25', className)}
            {...props}
          >
            {children}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
        </div>
      )}
    </FieldShell>
  )
);

Select.displayName = 'Select';
export { Select };
