'use client';

import React, { InputHTMLAttributes, useId } from 'react';
import { cn } from '@/lib/utils'; // Assuming you have a cn utility for classnames

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  disabled?: boolean;
  className?: string;
}

export function Checkbox({ id: customId, label, disabled, className, ...props }: CheckboxProps) {
  const generatedId = useId();
  const inputId = customId || `checkbox-${generatedId.replace(/:/g, '')}`;

  return (
    <label
      htmlFor={inputId}
      className={cn(
        'flex items-center gap-2 text-sm text-(--color-text-secondary) cursor-pointer',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <input
        id={inputId}
        type="checkbox"
        disabled={disabled}
        className={cn(
          'h-4 w-4 rounded border-(--color-border-primary) text-(--color-accent-primary) focus:ring-(--color-border-focus)',
          'disabled:cursor-not-allowed disabled:opacity-50'
        )}
        {...props}
      />
      <span>{label}</span>
    </label>
  );
}
