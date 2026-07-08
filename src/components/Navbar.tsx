'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, CalendarDays, LogOut, Monitor, Moon, Search, ShieldCheck, Sun } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';
import { LogoutModal } from '@/ui/LogoutModal';
import { Badge } from '@/ui/Badge';
import { useAuthContext } from '@/providers/AuthProviders';
import { useTheme } from '@/providers/ThemeProviders';
import { apiClient } from '@/lib/api';
import { getUserRole } from '@/lib/authRole';

function titleFromPath(pathname: string): string {
  if (pathname === '/dashboard/super') return 'Super Admin Command Center';
  if (pathname === '/dashboard') return 'Admin Dashboard';

  const parts = pathname
    .replace(/^\/dashboard\/?/, '')
    .split('/')
    .filter(Boolean)
    .map((part) => part.replace(/-/g, ' '));

  if (parts.length === 0) return 'Dashboard';

  return parts
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' / ');
}

function initials(first?: string, last?: string, email?: string): string {
  const value = `${first?.[0] || ''}${last?.[0] || ''}`.toUpperCase();
  if (value) return value;
  return (email?.slice(0, 2) || 'WH').toUpperCase();
}

function roleLabel(role?: string | null): string {
  const normalized = (role || '').trim();
  return normalized ? normalized.replace(/_/g, ' ').toUpperCase() : 'ADMIN';
}

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const auth = useAuthContext();
  const { theme, setTheme } = useTheme();

  const [searchQuery, setSearchQuery] = useState('');
  const [unread, setUnread] = useState(0);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const role = getUserRole(auth.user);
  const isSuperAdmin = role === 'super_admin';
  const pageTitle = useMemo(() => titleFromPath(pathname), [pathname]);
  const currentDate = useMemo(() => format(new Date(), 'EEEE, MMMM dd, yyyy'), []);
  const fullName = `${auth.user?.first_name || ''} ${auth.user?.last_name || ''}`.trim() || 'Administrator';
  const userInitials = initials(auth.user?.first_name, auth.user?.last_name, auth.user?.email);

  const ThemeIcon = theme === 'system' ? Monitor : theme === 'dark' ? Moon : Sun;
  const themeLabel = theme === 'system' ? 'System theme' : theme === 'dark' ? 'Dark mode' : 'Light mode';

  useEffect(() => {
    let mounted = true;

    const loadUnread = async () => {
      try {
        const inbox = await apiClient.listAdminNotifications(20);
        if (mounted) setUnread(Number(inbox.unread || 0));
      } catch {
        if (mounted) setUnread(0);
      }
    };

    void loadUnread();
    const timer = window.setInterval(loadUnread, 60000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;
    window.dispatchEvent(new CustomEvent('dashboard-search', { detail: query }));
  };

  const cycleTheme = () => {
    if (theme === 'system') setTheme('light');
    else if (theme === 'light') setTheme('dark');
    else setTheme('system');
  };

  const openNotifications = () => {
    router.push(isSuperAdmin ? '/dashboard/super/notifications' : '/dashboard/notifications');
  };

  const confirmLogout = async () => {
    setIsLoggingOut(true);
    try {
      await auth.logout();
    } finally {
      setIsLoggingOut(false);
      setShowLogoutModal(false);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[var(--color-border-primary)] bg-[var(--color-background-primary)]/95 text-[var(--color-text-primary)] shadow-sm backdrop-blur-xl">
        <div className="flex min-h-[72px] items-center justify-between gap-4 px-4 py-3 md:px-6 lg:px-8">
          <div className="min-w-0 flex-1 pl-12 md:pl-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-lg font-bold tracking-tight md:text-xl">{pageTitle}</h1>
              {isSuperAdmin && (
                <Badge variant="warning" className="gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  Super Admin
                </Badge>
              )}
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
              <CalendarDays className="h-3.5 w-3.5" />
              <span>{currentDate}</span>
            </div>
          </div>

          <form onSubmit={handleSearch} className="hidden w-full max-w-xl lg:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search records, requests, forms..."
                className="h-11 rounded-2xl bg-[var(--color-background-secondary)] pl-10 pr-24"
              />
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                disabled={!searchQuery.trim()}
                className="absolute right-1.5 top-1/2 -translate-y-1/2"
              >
                Search
              </Button>
            </div>
          </form>

          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={cycleTheme} aria-label={themeLabel} title={themeLabel}>
              <ThemeIcon className="h-4 w-4" />
            </Button>

            <Button type="button" variant="ghost" size="sm" onClick={openNotifications} aria-label="Open notifications" className="relative">
              <Bell className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </Button>

            <div className="hidden items-center gap-3 rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-3 py-2 md:flex">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-yellow-700 text-xs font-bold text-white shadow-sm">
                {userInitials}
              </div>
              <div className="min-w-0 text-right">
                <p className="max-w-[160px] truncate text-sm font-semibold leading-tight">{fullName}</p>
                <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">{roleLabel(role)}</p>
              </div>
            </div>

            <Button type="button" variant="outline" size="sm" onClick={() => setShowLogoutModal(true)} disabled={isLoggingOut}>
              <LogOut className="h-4 w-4" />
              <span className="ml-2 hidden xl:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      <LogoutModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={confirmLogout}
        userName={fullName}
        loading={isLoggingOut}
      />
    </>
  );
}
