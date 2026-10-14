'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  BellRing,
  Calendar,
  CalendarCheck,
  CalendarClock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Crown,
  FileText,
  HandCoins,
  HandHeart,
  HeartHandshake,
  IdCard,
  LayoutDashboard,
  LogOut,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  MessageSquare,
  Palette,
  Settings,
  Settings2,
  Shield,
  ShoppingBag,
  Sparkles,
  UserCog,
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
  id: string;
  title: string;
  items: NavItem[];
};

const superConsole: NavGroup = {
  id: 'authority',
  title: 'Authority & Governance',
  items: [
    {
      href: '/dashboard/super',
      label: 'Command Center',
      description: 'Authority overview',
      icon: Crown,
      roles: ['super_admin'],
    },
    {
      href: '/dashboard/super/requests',
      label: 'Approvals',
      description: 'Review & approval queue',
      icon: BellRing,
      roles: ['super_admin'],
    },
    {
      href: '/dashboard/super/analytics',
      label: 'Analytics',
      description: 'Leadership metrics',
      icon: BarChart3,
      roles: ['super_admin'],
    },
    {
      href: '/dashboard/super/reports',
      label: 'Reports',
      description: 'Exports and summaries',
      icon: FileText,
      roles: ['super_admin'],
    },
    {
      href: '/dashboard/super/notifications',
      label: 'Notifications',
      description: 'Super-admin alerts',
      icon: BellRing,
      roles: ['super_admin'],
    },
    {
      href: '/dashboard/super/users',
      label: 'Admin Users',
      description: 'Portal access & roles',
      icon: UserCog,
      roles: ['super_admin'],
    },
    {
      href: '/dashboard/design-system',
      label: 'Design System',
      description: 'Tokens & component reference',
      icon: Palette,
      roles: ['super_admin'],
    },
  ],
};

const peopleMinistry: NavGroup = {
  id: 'people',
  title: 'People & Ministry',
  items: [
    {
      href: '/dashboard',
      label: 'Dashboard',
      description: 'Executive overview',
      icon: LayoutDashboard,
    },
    {
      href: '/dashboard/administration',
      label: 'Administration',
      description: 'People intelligence',
      icon: Shield,
    },
    {
      href: '/dashboard/leadership',
      label: 'Leadership',
      description: 'Leadership profiles',
      icon: IdCard,
    },
    {
      href: '/dashboard/workforce',
      label: 'Workforce',
      description: 'Serving teams',
      icon: ClipboardList,
    },
    {
      href: '/dashboard/new-members',
      label: 'New Members',
      description: 'Membership intake',
      icon: UserPlus,
    },
    {
      href: '/dashboard/members',
      label: 'Members',
      description: 'Member directory',
      icon: Users,
    },
    {
      href: '/dashboard/cell-groups',
      label: 'Cell Groups',
      description: 'Small groups & fellowships',
      icon: MapPin,
    },
    {
      href: '/dashboard/ministries',
      label: 'Ministries',
      description: 'Teams & leaders',
      icon: HeartHandshake,
    },
    {
      href: '/dashboard/visits',
      label: 'Planned Visits',
      description: 'Guest intake pipeline',
      icon: Calendar,
    },
  ],
};

const programsOperations: NavGroup = {
  id: 'programs',
  title: 'Programs & Operations',
  items: [
    {
      href: '/dashboard/forms',
      label: 'Program Forms',
      description: 'Registrations & e-flyers',
      icon: Sparkles,
    },
    {
      href: '/dashboard/event',
      label: 'Events & Calendar',
      description: 'Church programs & dates',
      icon: Calendar,
    },
    {
      href: '/dashboard/attendance',
      label: 'Attendance',
      description: 'Service check-ins & passes',
      icon: CalendarCheck,
    },
    {
      href: '/dashboard/giving',
      label: 'Giving & Tithes',
      description: 'Transactions & totals',
      icon: HandCoins,
    },
    {
      href: '/dashboard/store',
      label: 'Store',
      description: 'Resources & inventory',
      icon: ShoppingBag,
    },
    {
      href: '/dashboard/analytics',
      label: 'Analytics',
      description: 'Operational trends',
      icon: BarChart3,
    },
  ],
};

const outreachCommunications: NavGroup = {
  id: 'outreach',
  title: 'Outreach & Communications',
  items: [
    {
      href: '/dashboard/email-marketing',
      label: 'Email Campaigns',
      description: 'Targeted broadcasts',
      icon: Mail,
    },
    {
      href: '/dashboard/email-marketing/schedules',
      label: 'Email Schedules',
      description: 'Automated schedules',
      icon: CalendarClock,
    },
    {
      href: '/dashboard/administration/automations',
      label: 'Automations',
      description: 'Worker reminders & journeys',
      icon: Settings2,
    },
    {
      href: '/dashboard/newsletter',
      label: 'Newsletter',
      description: 'Subscribers & dispatches',
      icon: Mail,
    },
    {
      href: '/dashboard/notifications',
      label: 'Notifications',
      description: 'Inbox & administrative alerts',
      icon: BellRing,
    },
    {
      href: '/dashboard/testimonials',
      label: 'Testimonials',
      description: 'Approved praise reports',
      icon: MessageSquare,
    },
    {
      href: '/dashboard/reels',
      label: 'Reels & Media',
      description: 'Video highlights',
      icon: Video,
    },
    {
      href: '/dashboard/content',
      label: 'Website Content',
      description: 'Public web components',
      icon: FileText,
    },
    {
      href: '/dashboard/prayer-requests',
      label: 'Prayer Requests',
      description: 'Pastoral triage',
      icon: HandHeart,
      roles: ['super_admin'],
    },
    {
      href: '/dashboard/contact-messages',
      label: 'Contact Messages',
      description: 'Inbound inquiries',
      icon: MessageCircle,
    },
  ],
};

const systemSettings: NavGroup = {
  id: 'system',
  title: 'Configuration',
  items: [
    {
      href: '/dashboard/settings',
      label: 'Portal Settings',
      description: 'System preferences',
      icon: Settings,
    },
  ],
};

function normalizeRole(role?: string | null): 'admin' | 'super_admin' | '' {
  const normalized = (role || '')
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, '_');
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

const STORAGE_KEY = 'wh_sidebar_sections_state';

export function Sidebar() {
  const pathname = usePathname();
  const auth = useAuthContext();
  const role = normalizeRole(getUserRole(auth.user));
  const isSuperAdmin = role === 'super_admin';

  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Collapsed state for each domain section
  const [sectionStates, setSectionStates] = useState<Record<string, boolean>>({});

  const groups = useMemo(() => {
    const source = isSuperAdmin
      ? [superConsole, peopleMinistry, programsOperations, outreachCommunications, systemSettings]
      : [peopleMinistry, programsOperations, outreachCommunications, systemSettings];

    return source
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => !item.roles || item.roles.includes(role as 'admin' | 'super_admin')),
      }))
      .filter((group) => group.items.length > 0);
  }, [isSuperAdmin, role]);

  // Load saved section collapse states on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setSectionStates(JSON.parse(saved));
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const toggleSection = (id: string) => {
    setSectionStates((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore
      }
      return next;
    });
  };

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
        style={{
          width: isCollapsed && !isMobileOpen ? 'var(--sidebar-width-collapsed)' : 'var(--sidebar-width-expanded)',
        }}
      >
        {/* Header Branding */}
        <div className="border-b border-[var(--color-border-secondary)] p-4">
          <div className="flex items-center justify-between gap-3">
            <Link href={homeHref} onClick={() => setIsMobileOpen(false)} className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-black shadow-md ring-1 ring-white/10">
                <Image src="/OIP.webp" alt="Wisdom Church" width={34} height={34} className="rounded-xl object-cover" priority />
              </div>
              {showLabels && (
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold tracking-tight text-[var(--color-text-primary)]">Wisdom Church</p>
                  <p className="truncate text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
                    {isSuperAdmin ? 'Authority Console' : 'Executive Portal'}
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
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-yellow-700 text-sm font-semibold text-white shadow-sm">
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

        {/* Navigation Domains with Collapsible Accordions */}
        <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
          {groups.map((group) => {
            const hasActiveChild = group.items.some(
              (item) => pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`))
            );
            // If user explicitly collapsed this section, respect it unless it has the active child
            const isExplicitlyCollapsed = sectionStates[group.id] === true;
            const isSectionOpen = hasActiveChild ? true : !isExplicitlyCollapsed;

            return (
              <div key={group.id} className="space-y-1">
                {showLabels && (
                  <button
                    type="button"
                    onClick={() => toggleSection(group.id)}
                    className="flex w-full items-center justify-between px-3 py-1.5 text-left text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-text-tertiary)] transition hover:text-[var(--color-text-primary)]"
                  >
                    <span>{group.title}</span>
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform duration-200 ${isSectionOpen ? '' : '-rotate-90'}`}
                    />
                  </button>
                )}

                {isSectionOpen && (
                  <div className="space-y-1 pt-0.5">
                    {group.items.map((item) => {
                      const active =
                        pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`));
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          title={item.label}
                          aria-current={active ? 'page' : undefined}
                          onClick={() => setIsMobileOpen(false)}
                          className={`group relative flex items-center gap-3 rounded-2xl px-3 py-2 text-sm transition-all ${
                            showLabels ? '' : 'justify-center'
                          } ${
                            active
                              ? 'bg-[var(--color-accent-primary)] text-[var(--color-text-onprimary)] shadow-md'
                              : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-background-hover)] hover:text-[var(--color-text-primary)]'
                          }`}
                        >
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-transform duration-150 group-hover:scale-105 ${
                              active ? 'bg-white/20 text-current' : 'bg-[var(--color-background-tertiary)] text-current'
                            }`}
                          >
                            <Icon className="h-4 w-4" />
                          </span>
                          {showLabels && (
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium text-xs sm:text-sm">{item.label}</span>
                              <span
                                className={`block truncate text-[11px] ${
                                  active ? 'text-white/80' : 'text-[var(--color-text-tertiary)]'
                                }`}
                              >
                                {item.description}
                              </span>
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Bottom Actions */}
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
