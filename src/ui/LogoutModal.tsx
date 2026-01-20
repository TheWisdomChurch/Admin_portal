// src/components/admin/LogoutModal.tsx
'use client';

import { LogOut } from 'lucide-react';
import { Button } from '@/ui/Button';

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
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative transform overflow-hidden rounded-xl bg-white shadow-2xl transition-all w-full max-w-md">
          {/* Modal content */}
          <div className="p-6">
            {/* Icon */}
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 mb-4">
              <LogOut className="h-6 w-6 text-red-600" />
            </div>
            
            {/* Title */}
            <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">
              Confirm Logout
            </h3>
            
            {/* Message */}
            <div className="text-center text-gray-600 mb-6">
              <p>Are you sure you want to logout, <span className="font-semibold">{userName}</span>?</p>
              <p className="text-sm text-gray-500 mt-2">You'll need to log in again to access the dashboard.</p>
            </div>
            
            {/* Actions */}
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
                // variant="destructive"
                onClick={onConfirm}
                className="flex-1"
                loading={loading}
                disabled={loading}
              >
                {loading ? 'Logging out...' : 'Yes, Logout'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}