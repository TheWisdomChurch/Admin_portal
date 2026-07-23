// src/components/ui/Textarea.tsx
import { TextareaHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
  label?: string;
  helperText?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, label, helperText, id, rows = 4, ...props }, ref) => {
    const textareaId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="space-y-2">
        {label && (
          <label htmlFor={textareaId} className="block text-sm font-medium text-[var(--color-text-secondary)]">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          className={cn(
            'flex w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm leading-6 text-[var(--color-text-primary)] ring-offset-[var(--color-background-primary)] placeholder:text-[var(--color-text-tertiary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-[var(--color-border-error)] focus-visible:ring-[var(--color-border-error)]',
            className
          )}
          {...props}
        />
        {helperText && !error && (
          <p className="text-sm text-[var(--color-text-tertiary)]">{helperText}</p>
        )}
        {error && <p className="text-sm text-[var(--color-danger-text)]">{error}</p>}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
export { Textarea };
