// src/ui/ConfirmationModal.tsx
'use client';

import { ReactNode, useEffect } from 'react';
import { AlertTriangle, X, Info, AlertCircle } from 'lucide-react';
import { Button } from '@/ui/Button';
import { cn } from '@/lib/utils';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  loading?: boolean;
  children?: ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  loading = false,
  children,
  maxWidth = 'md',
}: ConfirmationModalProps) {
  // Handle ESC key press
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          icon: AlertTriangle,
          iconBg: 'bg-red-50',
          iconColor: 'text-red-600',
          borderColor: 'border-red-100',
          buttonVariant: 'danger' as const,
          titleColor: 'text-red-700',
        };
      case 'warning':
        return {
          icon: AlertCircle,
          iconBg: 'bg-amber-50',
          iconColor: 'text-amber-600',
          borderColor: 'border-amber-100',
          buttonVariant: 'outline' as const,
          titleColor: 'text-amber-700',
        };
      default:
        return {
          icon: Info,
          iconBg: 'bg-blue-50',
          iconColor: 'text-blue-600',
          borderColor: 'border-blue-100',
          buttonVariant: 'primary' as const,
          titleColor: 'text-blue-700',
        };
    }
  };

  const getMaxWidth = () => {
    switch (maxWidth) {
      case 'sm':
        return 'max-w-sm';
      case 'md':
        return 'max-w-md';
      case 'lg':
        return 'max-w-lg';
      case 'xl':
        return 'max-w-xl';
      default:
        return 'max-w-md';
    }
  };

  const styles = getVariantStyles();
  const Icon = styles.icon;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop with fade-in animation */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />
      
      {/* Modal container */}
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Modal panel with slide-up animation */}
        <div 
          className={cn(
            'relative w-full transform overflow-hidden rounded-2xl bg-white shadow-2xl transition-all duration-300',
            getMaxWidth(),
            'scale-100 opacity-100 translate-y-0'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 z-10 rounded-full p-2 text-secondary-400 hover:bg-secondary-50 hover:text-secondary-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
            disabled={loading}
          >
            <X className="h-5 w-5" />
          </button>

          {/* Header */}
          <div className={cn('px-8 pt-8 pb-6', styles.borderColor)}>
            <div className="flex items-start gap-4">
              <div className={cn('flex-shrink-0 rounded-xl p-3', styles.iconBg)}>
                <Icon className={cn('h-6 w-6', styles.iconColor)} />
              </div>
              <div className="flex-1">
                <h3 className={cn('text-xl font-bold', styles.titleColor)}>
                  {title}
                </h3>
                <p className="mt-2 text-secondary-600">{description}</p>
              </div>
            </div>
          </div>

          {/* Content */}
          {children && (
            <div className="px-8 py-6">
              {children}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col-reverse gap-3 border-t border-secondary-100 px-8 py-6 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="sm:w-auto w-full"
            >
              {cancelText}
            </Button>
            <Button
              type="button"
              variant={styles.buttonVariant}
              onClick={onConfirm}
              loading={loading}
              className="sm:w-auto w-full"
            >
              {confirmText}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}