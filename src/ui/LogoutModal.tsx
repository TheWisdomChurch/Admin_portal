// src/components/admin/LogoutModal.tsx
'use client';

import { LogOut } from 'lucide-react';
import { Button } from '@/ui/Button';
import { Modal } from '@/ui/Modal';

interface LogoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  userName?: string;
  loading?: boolean;
}

export function LogoutModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  userName = 'User',
  loading = false 
}: LogoutModalProps) {
  return (
    <Modal open={isOpen} onClose={onClose} labelledBy="logout-modal-title">
      <div className="p-6">
        <div
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-full mb-4"
          style={{ background: 'var(--color-danger-surface)', color: 'var(--color-danger-text)' }}
        >
          <LogOut className="h-6 w-6" />
        </div>

        <h3 id="logout-modal-title" className="text-lg font-semibold text-[var(--color-text-primary)] text-center mb-2">
          Confirm Logout
        </h3>

        <div className="text-center text-[var(--color-text-secondary)] mb-6">
          <p>Are you sure you want to logout, <span className="font-semibold">{userName}</span>?</p>
          <p className="text-sm text-[var(--color-text-tertiary)] mt-2">You&apos;ll need to log in again to access the dashboard.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1"
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={onConfirm}
            className="flex-1"
            loading={loading}
            disabled={loading}
          >
            {loading ? 'Logging out...' : 'Yes, Logout'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
