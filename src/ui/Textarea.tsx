// src/components/ui/Textarea.tsx
import { TextareaHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { controlClassName, FieldShell } from '@/ui/FieldShell';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
  label?: string;
  helperText?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, label, helperText, id, rows = 4, required, ...props }, ref) => (
    <FieldShell id={id} label={label} helperText={helperText} error={error} required={required}>
      {({ controlId, describedBy, invalid }) => (
        <textarea
          ref={ref}
          id={controlId}
          rows={rows}
          required={required}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn(controlClassName, 'min-h-28 resize-y py-2.5 leading-6', invalid && 'border-[var(--color-border-error)] focus-visible:border-[var(--color-border-error)] focus-visible:ring-[var(--color-border-error)]/25', className)}
          {...props}
        />
      )}
    </FieldShell>
  )
);

Textarea.displayName = 'Textarea';
export { Textarea };
