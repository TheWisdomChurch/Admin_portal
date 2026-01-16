// src/components/admin/Navbar.tsx
'use client';

import { Bell, Search, User, LogOut } from 'lucide-react';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/input';
import { useAuthContext } from '@/providers/AuthProviders';
import { useRouter } from 'next/navigation';

export function Navbar() {
  const auth = useAuthContext();
  const router = useRouter();

  const handleLogout = () => {
    auth.logout();
    router.push('/login');
  };

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-secondary-200">
      <div className="flex items-center justify-between px-6 py-4">
        {/* Search */}
        <div className="flex-1 max-w-lg">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary-500" />
            <Input
              placeholder="Search events, reels, or members..."
              className="pl-10"
            />
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" className="relative">
            <Bell className="h-5 w-5" />
            <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500" />
          </Button>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium text-secondary-900">
                {auth.user?.first_name} {auth.user?.last_name}
              </p>
              <p className="text-xs text-secondary-500 capitalize">
                {auth.user?.role?.replace('_', ' ')}
              </p>
            </div>
            
            <div className="h-9 w-9 rounded-full bg-primary-100 flex items-center justify-center">
              <User className="h-5 w-5 text-primary-600" />
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-red-600 hover:text-red-700"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}