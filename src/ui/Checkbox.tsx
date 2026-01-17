'use client';

import React, { InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils'; // Assuming you have a cn utility for classnames

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  disabled?: boolean;
  className?: string;
}

export function Checkbox({ label, disabled, className, ...props }: CheckboxProps) {
  return (
    <label className={cn(
      'flex items-center gap-2 text-sm text-secondary-700',
      disabled && 'opacity-50 cursor-not-allowed',
      className
    )}>
      <input
        type="checkbox"
        disabled={disabled}
        className={cn(
          'h-4 w-4 rounded border-secondary-300 text-primary-600 focus:ring-primary-500',
          'disabled:cursor-not-allowed disabled:opacity-50'
        )}
        {...props}
      />
      {label}
    </label>
  );
}