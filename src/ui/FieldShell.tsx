import { useId, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

export const controlClassName =
  'w-full rounded-[var(--radius-control)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 text-sm text-[var(--color-text-primary)] shadow-[var(--shadow-control)] outline-none ring-offset-[var(--color-background-primary)] transition-[border-color,box-shadow,background-color] placeholder:text-[var(--color-text-tertiary)] hover:border-[var(--color-border-secondary)] focus-visible:border-[var(--color-border-focus)] focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]/25 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:bg-[var(--color-background-tertiary)] disabled:text-[var(--color-text-disabled)]';

type FieldShellProps = {
  id?: string;
  label?: string;
  helperText?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: (props: { controlId: string; describedBy?: string; invalid: boolean }) => ReactNode;
};

export function FieldShell({ id, label, helperText, error, required, className, children }: FieldShellProps) {
  const generatedId = useId();
  const labelId = label?.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const controlId = id || labelId || `field-${generatedId.replace(/:/g, '')}`;
  const descriptionId = helperText && !error ? `${controlId}-description` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;

  return (
    <div className={cn('space-y-2', className)}>
      {label ? (
        <label htmlFor={controlId} className="block text-sm font-medium text-[var(--color-text-secondary)]">
          {label}
          {required ? <span className="ml-1 text-[var(--color-danger-text)]" aria-hidden="true">*</span> : null}
        </label>
      ) : null}
      {children({ controlId, describedBy: errorId || descriptionId, invalid: Boolean(error) })}
      {descriptionId ? <p id={descriptionId} className="text-xs leading-5 text-[var(--color-text-tertiary)]">{helperText}</p> : null}
      {errorId ? <p id={errorId} className="text-xs font-medium leading-5 text-[var(--color-danger-text)]" role="alert">{error}</p> : null}
    </div>
  );
}
