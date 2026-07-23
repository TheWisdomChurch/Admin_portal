'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Panel size (max-width). */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Additional classes for the panel. */
  className?: string;
  /** Additional classes for the backdrop (e.g. a different tint or z-index for a stacked modal). */
  overlayClassName?: string;
  closeOnBackdrop?: boolean;
  labelledBy?: string;
}

const sizes = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
};

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
const FORM_FIELD_SELECTOR = 'input:not([disabled]), textarea:not([disabled]), select:not([disabled])';

/**
 * Shared overlay/panel shell for every modal in the app — handles the
 * backdrop, escape-to-close, focus trap, and focus restoration once so
 * individual modals only need to supply their content.
 */
export function Modal({
  open,
  onClose,
  children,
  size = 'md',
  className,
  overlayClassName,
  closeOnBackdrop = true,
  labelledBy,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;

      const focusable = panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    // Prefer the first actual form field (e.g. an OTP/code input) over a
    // leading close button so opening a modal lets you start typing right
    // away instead of requiring a click into the field first.
    const firstField = panelRef.current?.querySelector<HTMLElement>(FORM_FIELD_SELECTOR);
    const firstFocusable = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    const autofocusTarget = firstField || firstFocusable || panelRef.current;
    autofocusTarget?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-text-primary)]/50 px-4 py-6 backdrop-blur-sm',
        overlayClassName
      )}
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className={cn(
          'w-full overflow-hidden rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] shadow-2xl outline-none',
          sizes[size],
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}
