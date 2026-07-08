'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  BellRing,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Crown,
  FileText,
  IdCard,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  MessageSquare,
  Palette,
  Settings,
  Shield,
  ShoppingBag,
  UserPlus,
  Users,
  Video,
  X,
} from 'lucide-react';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { LogoutModal } from '@/ui/LogoutModal';
import { useAuthContext } from '@/providers/AuthProviders';
import { getUserRole } from '@/lib/authRole';

type NavItem = {
  href: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: Array<'admin' | 'super_admin'>;
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

const superConsole: NavGroup = {
  title: 'Super admin',
  items: [
    { href: '/dashboard/super', label: 'Command Center', description: 'Authority overview', icon: Crown, roles: ['super_admin'] },
    { href: '/dashboard/super/requests', label: 'Requests', description: 'Approval queue', icon: BellRing, roles: ['super_admin'] },
    { href: '/dashboard/super/analytics', label: 'Analytics', description: 'Leadership metrics', icon: BarChart3, roles: ['super_admin'] },
    { href: '/dashboard/super/reports', label: 'Reports', description: 'Exports and summaries', icon: FileText, roles: ['super_admin'] },
    { href: '/dashboard/super/notifications', label: 'Notifications', description: 'Super-admin alerts', icon: BellRing, roles: ['super_admin'] },
    { href: '/dashboard/design-system', label: 'Design System', description: 'Tokens & component reference', icon: Palette, roles: ['super_admin'] },
  ],
};

const operations: NavGroup = {
  title: 'Operations',
  items: [
    { href: '/dashboard', label: 'Dashboard', description: 'Admin overview', icon: LayoutDashboard, roles: ['admin'] },
    { href: '/dashboard/administration', label: 'Administration', description: 'People intelligence', icon: Shield },
    { href: '/dashboard/leadership', label: 'Leadership', description: 'Leadership profiles', icon: IdCard },
    { href: '/dashboard/workforce', label: 'Workforce', description: 'Serving teams', icon: ClipboardList },
    { href: '/dashboard/new-members', label: 'New Members', description: 'Membership intake', icon: UserPlus },
    { href: '/dashboard/members', label: 'Members', description: 'Member records', icon: Users },
  ],
};

const ministries: NavGroup = {
  title: 'Ministry content',
  items: [
    { href: '/dashboard/event', label: 'Events', description: 'Programs and banners', icon: Calendar },
    { href: '/dashboard/reels', label: 'Reels', description: 'Video content', icon: Video },
    { href: '/dashboard/testimonials', label: 'Testimonials', description: 'Stories and approvals', icon: MessageSquare },
    { href: '/dashboard/forms', label: 'Forms', description: 'Registration workflows', icon: ClipboardList },
    { href: '/dashboard/store', label: 'Store', description: 'Products and orders', icon: ShoppingBag },
    { href: '/dashboard/content', label: 'Website Content', description: 'Public content blocks', icon: FileText },
  ],
};

const communication: NavGroup = {
  title: 'Communication',
  items: [
    { href: '/dashboard/email-marketing', label: 'Email Marketing', description: 'Targeted campaigns', icon: Mail },
    { href: '/dashboard/newsletter', label: 'Newsletter', description: 'Subscribers and sends', icon: Mail },
    { href: '/dashboard/notifications', label: 'Notifications', description: 'Inbox and alerts', icon: BellRing },
    { href: '/dashboard/settings', label: 'Settings', description: 'Portal preferences', icon: Settings },
  ],
};

function normalizeRole(role?: string | null): 'admin' | 'super_admin' | '' {
  const normalized = (role || '').trim().toLowerCase().replace(/[-\s]+/g, '_');
  if (normalized === 'admin' || normalized === 'super_admin') return normalized;
  return '';
}

function initials(first?: string, last?: string, email?: string): string {
  const value = `${first?.[0] || ''}${last?.[0] || ''}`.toUpperCase();
  if (value) return value;
  return (email?.slice(0, 2) || 'WH').toUpperCase();
}

function roleLabel(role: string): string {
  return role
    .replace(/_/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function Sidebar() {
  const pathname = usePathname();
  const auth = useAuthContext();
  const role = normalizeRole(getUserRole(auth.user));
  const isSuperAdmin = role === 'super_admin';

  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const groups = useMemo(() => {
    // Role separation is intentional. The super-admin is the approval authority,
    // not an operational admin. Admin modules stay hidden from this console.
    const source = isSuperAdmin ? [superConsole] : [operations, ministries, communication];

    return source
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => !item.roles || item.roles.includes(role as 'admin' | 'super_admin')),
      }))
      .filter((group) => group.items.length > 0);
  }, [isSuperAdmin, role]);

  const showLabels = isMobileOpen || !isCollapsed;
  const homeHref = isSuperAdmin ? '/dashboard/super' : '/dashboard';
  const fullName = `${auth.user?.first_name || ''} ${auth.user?.last_name || ''}`.trim() || 'Administrator';
  const userInitials = initials(auth.user?.first_name, auth.user?.last_name, auth.user?.email);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMobileOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  useEffect(() => {
    document.body.style.overflow = isMobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileOpen]);

  useEffect(() => {
    const sync = () => {
      if (window.innerWidth < 768) {
        setIsCollapsed(false);
        return;
      }
      setIsCollapsed(window.innerWidth >= 768 && window.innerWidth < 1180);
    };
    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, []);

  useEffect(() => {
    document.body.classList.toggle('sidebar-collapsed', isCollapsed);
    return () => document.body.classList.remove('sidebar-collapsed');
  }, [isCollapsed]);

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
      <button
        type="button"
        onClick={() => setIsMobileOpen(true)}
        className="fixed left-4 top-4 z-50 inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] shadow-lg md:hidden"
        aria-label="Open navigation menu"
      >
        <Menu className="h-5 w-5 text-[var(--color-text-primary)]" />
      </button>

      {isMobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={() => setIsMobileOpen(false)}
          aria-label="Close navigation backdrop"
        />
      )}

      <aside
        className={`fixed left-0 top-0 z-50 flex h-screen flex-col border-r border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] shadow-2xl transition-all duration-300 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
        style={{ width: isCollapsed && !isMobileOpen ? 'var(--sidebar-width-collapsed)' : 'var(--sidebar-width-expanded)' }}
      >
        <div className="border-b border-[var(--color-border-secondary)] p-4">
          <div className="flex items-center justify-between gap-3">
            <Link href={homeHref} onClick={() => setIsMobileOpen(false)} className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-black shadow-md ring-1 ring-white/10">
                <Image src="/OIP.webp" alt="Wisdom Church" width={34} height={34} className="rounded-xl object-cover" priority />
              </div>
              {showLabels && (
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold tracking-tight text-[var(--color-text-primary)]">Wisdom Church</p>
                  <p className="truncate text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
                    {isSuperAdmin ? 'Authority Console' : 'Admin Portal'}
                  </p>
                </div>
              )}
            </Link>

            <button
              type="button"
              onClick={() => setIsMobileOpen(false)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-[var(--color-text-tertiary)] hover:bg-[var(--color-background-hover)] md:hidden"
              aria-label="Close navigation menu"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {showLabels && auth.user && (
            <div className="mt-4 rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-yellow-700 text-sm font-bold text-white shadow-sm">
                  {userInitials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">{fullName}</p>
                  <p className="truncate text-xs text-[var(--color-text-tertiary)]">{auth.user.email}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <Badge variant={isSuperAdmin ? 'warning' : 'primary'} className="gap-1">
                  <Shield className="h-3 w-3" />
                  {roleLabel(role)}
                </Badge>
                {isSuperAdmin && <Badge variant="success">Approver</Badge>}
              </div>
            </div>
          )}
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {groups.map((group) => (
            <div key={group.title}>
              {showLabels && (
                <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
                  {group.title}
                </p>
              )}
              <div className="space-y-1">
                {group.items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={item.label}
                      aria-current={active ? 'page' : undefined}
                      onClick={() => setIsMobileOpen(false)}
                      className={`group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-all ${
                        showLabels ? '' : 'justify-center'
                      } ${
                        active
                          ? 'bg-[var(--color-accent-primary)] text-[var(--color-text-onprimary)] shadow-md'
                          : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-background-hover)] hover:text-[var(--color-text-primary)]'
                      }`}
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                          active ? 'bg-white/15 text-current' : 'bg-[var(--color-background-tertiary)] text-current'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      {showLabels && (
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{item.label}</span>
                          <span className={`block truncate text-xs ${active ? 'text-white/75' : 'text-[var(--color-text-tertiary)]'}`}>
                            {item.description}
                          </span>
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-[var(--color-border-secondary)] p-3">
          <div className={`flex items-center gap-2 ${showLabels ? 'justify-between' : 'justify-center'}`}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsCollapsed((value) => !value)}
              className="hidden md:inline-flex"
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowLogoutModal(true)}
              className={showLabels ? 'flex-1' : ''}
            >
              <LogOut className="h-4 w-4" />
              {showLabels && <span className="ml-2">Logout</span>}
            </Button>
          </div>
        </div>
      </aside>

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
