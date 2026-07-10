'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { ClipboardEvent, KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';

export interface OtpInputHandle {
  focus: () => void;
}

interface OtpInputProps {
  /** Number of digit boxes. */
  length?: number;
  value: string;
  onChange: (value: string) => void;
  /** Fires once when the value reaches `length` digits — wire this to auto-submit. */
  onComplete?: (value: string) => void;
  disabled?: boolean;
  /** Shows a danger state (e.g. after a rejected code) without clearing the value. */
  error?: boolean;
  className?: string;
}

/**
 * Segmented one-time-code entry (one box per digit) with auto-advance,
 * backspace-to-previous, arrow-key navigation, and full-code paste support.
 * Replaces the plain "type 6 digits into one text field" pattern everywhere
 * a verification code is entered.
 */
export const OtpInput = forwardRef<OtpInputHandle, OtpInputProps>(function OtpInput(
  { length = 6, value, onChange, onComplete, disabled = false, error = false, className },
  ref
) {
  const boxRefs = useRef<Array<HTMLInputElement | null>>([]);
  const firedForValue = useRef<string | null>(null);

  useImperativeHandle(ref, () => ({
    focus: () => boxRefs.current[0]?.focus(),
  }));

  const digits = Array.from({ length }, (_, index) => value[index] ?? '');

  useEffect(() => {
    if (value.length < length) {
      firedForValue.current = null;
      return;
    }
    if (value.length === length && /^\d+$/.test(value) && firedForValue.current !== value) {
      firedForValue.current = value;
      onComplete?.(value);
    }
  }, [value, length, onComplete]);

  const commit = (index: number, digit: string) => {
    const next = digits.slice();
    next[index] = digit;
    onChange(next.join('').slice(0, length));
  };

  const handleChange = (index: number, raw: string) => {
    const digit = raw.replace(/\D/g, '').slice(-1);
    commit(index, digit);
    if (digit && index < length - 1) {
      boxRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        event.preventDefault();
        commit(index - 1, '');
        boxRefs.current[index - 1]?.focus();
      } else {
        commit(index, '');
      }
      return;
    }
    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      boxRefs.current[index - 1]?.focus();
    }
    if (event.key === 'ArrowRight' && index < length - 1) {
      event.preventDefault();
      boxRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (index: number, event: ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '');
    if (!pasted) return;
    event.preventDefault();

    const next = digits.slice();
    let cursor = index;
    for (const char of pasted) {
      if (cursor >= length) break;
      next[cursor] = char;
      cursor += 1;
    }
    onChange(next.join('').slice(0, length));
    boxRefs.current[Math.min(cursor, length - 1)]?.focus();
  };

  return (
    <div className={cn('flex items-center justify-between gap-2', className)} role="group" aria-label="Verification code">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            boxRefs.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          value={digit}
          disabled={disabled}
          onChange={(event) => handleChange(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={(event) => handlePaste(index, event)}
          onFocus={(event) => event.target.select()}
          aria-label={`Digit ${index + 1} of ${length}`}
          className={cn(
            'h-12 w-11 rounded-[var(--radius-button)] border bg-[var(--color-background-secondary)] text-center text-lg font-bold text-[var(--color-text-primary)] outline-none transition focus:ring-2 focus:ring-[var(--color-border-focus)]/30 disabled:cursor-not-allowed disabled:opacity-50 sm:h-14 sm:w-12 sm:text-xl',
            error
              ? 'border-[var(--color-border-error)] text-[var(--color-danger-text)]'
              : 'border-[var(--color-border-primary)] focus:border-[var(--color-border-focus)]'
          )}
        />
      ))}
    </div>
  );
});
