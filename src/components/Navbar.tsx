// src/components/admin/Navbar.tsx
'use client';

import { useEffect, useState } from 'react';
import { Bell, Search, LogOut, Calendar, Settings, Moon, Sun, Monitor } from 'lucide-react';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/input';
import { useAuthContext } from '@/providers/AuthProviders';
import { useRouter } from 'next/navigation';
import { LogoutModal } from '@/ui/LogoutModal';
import { Badge } from '@/ui/Badge';
import { format } from 'date-fns';
import { useTheme } from '@/providers/ThemeProviders';
import { apiClient } from '@/lib/api';

export function Navbar() {
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [unread, setUnread] = useState(0);
  const auth = useAuthContext();
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  const currentDate = format(new Date(), 'EEEE, MMMM dd, yyyy');

  const getUserName = () => {
    if (!auth.user) return 'User';
    return `${auth.user.first_name} ${auth.user.last_name}`.trim();
  };

  const getUserInitials = () => {
    if (!auth.user) return 'U';
    const first = auth.user.first_name?.charAt(0) || '';
    const last = auth.user.last_name?.charAt(0) || '';
    return `${first}${last}`.toUpperCase() || 'U';
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchQuery.trim();
    if (trimmed && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('dashboard-search', { detail: trimmed }));
    }
  };

  const handleLogoutClick = () => {
    setShowLogoutModal(true);
  };

  const handleConfirmLogout = async () => {
    setIsLoggingOut(true);
    try {
      await auth.logout();
      // AuthProvider will handle redirect
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setIsLoggingOut(false);
      setShowLogoutModal(false);
    }
  };

  const cycleTheme = () => {
    if (theme === 'system') {
      setTheme('light');
    } else if (theme === 'light') {
      setTheme('dark');
    } else {
      setTheme('system');
    }
  };

  const themeIcon = theme === 'system' ? Monitor : theme === 'dark' ? Moon : Sun;
  const themeLabel = theme === 'system' ? 'System theme' : theme === 'dark' ? 'Dark mode' : 'Light mode';
  const ThemeIcon = themeIcon;

  useEffect(() => {
    let mounted = true;
    const loadUnread = async () => {
      try {
        const inbox = await apiClient.listAdminNotifications(20);
        if (!mounted) return;
        setUnread(Number(inbox.unread || 0));
      } catch {
        if (!mounted) return;
        setUnread(0);
      }
    };

    loadUnread();
    const timer = window.setInterval(loadUnread, 60000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  const openNotifications = () => {
    if (auth.user?.role === 'super_admin') {
      router.push('/dashboard/super/notifications');
      return;
    }
    router.push('/dashboard/notifications');
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-[var(--color-background-primary)]/95 backdrop-blur-sm border-b border-[var(--color-border-primary)] shadow-sm">
        <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-6">
          {/* Left side - Date and Breadcrumb */}
          <div className="flex items-center gap-6">
            <div className="hidden sm:block">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[var(--color-text-tertiary)]" />
                <span className="text-xs font-medium text-[var(--color-text-secondary)] md:text-sm">{currentDate}</span>
              </div>
            </div>
            
            {/* Mobile menu and title */}
            <div className="sm:hidden">
              <h1 className="font-display text-lg font-semibold text-[var(--color-text-primary)]">Dashboard</h1>
            </div>
          </div>

          {/* Center - Search */}
          <div className="flex-1 max-w-2xl mx-4 hidden md:block">
            <form onSubmit={handleSearch} className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search events, members, reels..."
                className="pl-10 pr-20 bg-[var(--color-background-secondary)]"
              />
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
                disabled={!searchQuery.trim()}
              >
                Search
              </Button>
            </form>
          </div>

          {/* Right side - Actions and User */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Dark mode toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={cycleTheme}
              className="hidden sm:flex text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              aria-label={themeLabel}
              title={themeLabel}
            >
              <ThemeIcon className="h-4 w-4" />
            </Button>

            {/* Notifications */}
            <div className="relative hidden sm:block">
              <Button
                variant="ghost"
                size="sm"
                className="relative text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                aria-label="Notifications"
                onClick={openNotifications}
              >
                <Bell className="h-5 w-5" />
                {unread > 0 && (
                  <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                )}
              </Button>
            </div>

            {/* Settings */}
            <Button
              variant="ghost"
              size="sm"
              className="hidden md:flex text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              aria-label="Settings"
              onClick={() => router.push('/dashboard/settings')}
            >
              <Settings className="h-5 w-5" />
            </Button>

            {/* User profile dropdown */}
            <div className="flex items-center gap-2 sm:gap-3 pl-3 border-l border-[var(--color-border-secondary)]">
              {/* Desktop user info */}
              <div className="hidden md:block text-right">
                <p className="text-sm font-semibold text-[var(--color-text-primary)] leading-tight">
                  {getUserName()}
                </p>
                <p className="text-xs text-[var(--color-text-tertiary)] leading-tight">
                  {auth.user?.role?.replace('_', ' ').toUpperCase()}
                </p>
              </div>
              
              {/* User avatar */}
              <div className="relative group">
                <button
                  className="h-10 w-10 rounded-[var(--radius-button)] bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-white font-semibold shadow-sm hover:shadow-md transition-shadow"
                  aria-label="User menu"
                >
                  {getUserInitials()}
                </button>
                
                {/* Online indicator */}
                <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[var(--color-background-primary)] bg-green-500" />
              </div>

              {/* Logout button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogoutClick}
                className="text-[var(--color-text-secondary)] hover:text-red-600 hover:bg-red-50"
                aria-label="Logout"
                disabled={isLoggingOut}
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden lg:inline ml-2">Logout</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Quick stats bar */}
        <div className="hidden lg:flex items-center justify-between px-6 py-2 bg-gradient-to-r from-[var(--color-background-tertiary)] to-transparent border-t border-[var(--color-border-secondary)]">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                <Calendar className="h-3 w-3 mr-1" />
                Today: {format(new Date(), 'MMM dd')}
              </Badge>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-xs text-[var(--color-text-tertiary)]">
              Server: <Badge variant="success" className="ml-1">Online</Badge>
            </div>
            <div className="text-xs text-[var(--color-text-tertiary)]">
              Version: <span className="font-medium text-[var(--color-text-secondary)]">1.0.0</span>
            </div>
          </div>
        </div>
      </header>

      {/* Logout Confirmation Modal */}
      <LogoutModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleConfirmLogout}
        userName={getUserName()}
        loading={isLoggingOut}
      />
    </>
  );
}
