// src/components/ui/Input.tsx
import { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { controlClassName, FieldShell } from '@/ui/FieldShell';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
  helperText?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, label, helperText, id, required, ...props }, ref) => (
    <FieldShell id={id} label={label} helperText={helperText} error={error} required={required}>
      {({ controlId, describedBy, invalid }) => (
        <input ref={ref} id={controlId} required={required} aria-invalid={invalid || undefined} aria-describedby={describedBy} className={cn(controlClassName, 'h-11 py-2', invalid && 'border-[var(--color-border-error)] focus-visible:border-[var(--color-border-error)] focus-visible:ring-[var(--color-border-error)]/25', className)} {...props} />
      )}
    </FieldShell>
  )
);

Input.displayName = 'Input';
export { Input };
