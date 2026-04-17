// src/components/admin/Sidebar.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Video,
  Store,
  BarChart3,
  ClipboardList,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  MessageSquare,
  Shield,
  BellRing,
  FileText,
  LineChart,
  Mail,
  CalendarDays,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useAuthContext } from '@/providers/AuthProviders';
import { Badge } from '@/ui/Badge';
import { LogoutModal } from '@/ui/LogoutModal';

const adminNavItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, description: 'Overview and metrics' },
  { href: '/dashboard/administration', label: 'Administration', icon: Shield, description: 'Workforce, leadership, members' },
  { href: '/dashboard/event', label: 'Events', icon: CalendarDays, description: 'Create and manage events' },
  { href: '/dashboard/reels', label: 'Reels', icon: Video, description: 'Video content management' },
  { href: '/dashboard/store', label: 'Store', icon: Store, description: 'Products, stock, and order flow' },
  { href: '/dashboard/testimonials', label: 'Testimonials', icon: MessageSquare, description: 'Member testimonials' },
  { href: '/dashboard/forms', label: 'Forms', icon: ClipboardList, description: 'Create registration links' },
  { href: '/dashboard/email-marketing', label: 'Email Marketing', icon: Mail, description: 'Build campaigns from form audiences' },
  { href: '/dashboard/registrations', label: 'Registrations', icon: Users, description: 'Registered people list' },
  { href: '/dashboard/notifications', label: 'Notifications', icon: BellRing, description: 'Alerts and approvals' },
  { href: '/dashboard/security', label: 'Security', icon: Shield, description: 'Access, MFA, and approvals' },
  { href: '/dashboard/content', label: 'Content', icon: FileText, description: 'Website content' },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings, description: 'System configuration' },
];

const superNavItems = [
  { href: '/dashboard/super', label: 'Dashboard', icon: LayoutDashboard, description: 'Approvals & analytics' },
  { href: '/dashboard/super/requests', label: 'Requests', icon: BellRing, description: 'Pending approvals' },
  { href: '/dashboard/super/analytics', label: 'Analytics', icon: LineChart, description: 'Charts & trends' },
  { href: '/dashboard/email-marketing', label: 'Email Marketing', icon: Mail, description: 'Audience campaigns & outreach' },
  { href: '/dashboard/super/reports', label: 'Reports', icon: FileText, description: 'Monthly exports' },
  { href: '/dashboard/super/notifications', label: 'Notifications', icon: BarChart3, description: 'Alerts and updates' },
  { href: '/dashboard/security', label: 'Security', icon: Shield, description: 'Access controls and risk posture' },
];

export function Sidebar() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();
  const auth = useAuthContext();

  // Close mobile sidebar when clicking outside on mobile
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileOpen) {
        setIsMobileOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isMobileOpen]);

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMobileOpen]);

  // Collapse sidebar on tablets by default, expand on large screens.
  useEffect(() => {
    const updateCollapseState = () => {
      if (typeof window === 'undefined') return;
      const width = window.innerWidth;
      // mobile uses drawer, so keep labels when open
      if (width < 768) {
        setIsCollapsed(false);
        return;
      }
      // tablet: icon-only
      if (width >= 768 && width < 1024) {
        setIsCollapsed(true);
        return;
      }
      // desktop: full
      setIsCollapsed(false);
    };

    updateCollapseState();
    window.addEventListener('resize', updateCollapseState);
    return () => window.removeEventListener('resize', updateCollapseState);
  }, []);

  // Keep CSS variable for content offset in sync with collapse state.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (isCollapsed) {
      document.body.classList.add('sidebar-collapsed');
    } else {
      document.body.classList.remove('sidebar-collapsed');
    }
    return () => document.body.classList.remove('sidebar-collapsed');
  }, [isCollapsed]);

  const getUserName = () => {
    if (!auth.user) return 'User';
    return `${auth.user.first_name} ${auth.user.last_name}`.trim();
  };

  const formatRole = (role: string = '') => {
    return role
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const handleLogoutClick = () => {
    setShowLogoutModal(true);
    setIsMobileOpen(false);
  };

  const handleConfirmLogout = async () => {
    setIsLoggingOut(true);
    try {
      await auth.logout();
      // AuthProvider will handle the redirect
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setIsLoggingOut(false);
      setShowLogoutModal(false);
    }
  };

  const getInitials = () => {
    if (!auth.user) return 'U';
    const first = auth.user.first_name?.charAt(0) || '';
    const last = auth.user.last_name?.charAt(0) || '';
    return `${first}${last}`.toUpperCase() || 'U';
  };

  const showLabels = isMobileOpen || !isCollapsed;

  const navItems = auth.user?.role === 'super_admin'
    ? superNavItems
    : adminNavItems;

  const homeHref = auth.user?.role === 'super_admin' ? '/dashboard/super' : '/dashboard';

  return (
    <>
      {/* Mobile toggle button */}
      <button
        onClick={() => setIsMobileOpen(true)}
        className="md:hidden fixed top-4 left-4 z-50 p-3 rounded-xl bg-background shadow-lg border border-border hover:bg-accent/50 transition-colors"
        aria-label="Open navigation menu"
      >
        <Menu className="h-5 w-5 text-foreground" />
      </button>

      {/* Sidebar */}
      <aside
        className={`
          fixed left-0 top-0 z-50 h-screen border-r border-border
          flex flex-col shadow-2xl bg-background/95 backdrop-blur-xl
          transition-all duration-300 ease-in-out
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
        style={{
          width: isMobileOpen
            ? 'var(--sidebar-width-expanded)'
            : isCollapsed
              ? 'var(--sidebar-width-collapsed)'
              : 'var(--sidebar-width-expanded)',
        }}
      >
        {/* Header */}
        <div className="p-6 border-b border-border/50">
          <div className="flex items-center justify-between">
            <Link
              href={homeHref}
              className="flex items-center gap-3 min-w-0 group"
              onClick={() => setIsMobileOpen(false)}
            >
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center flex-shrink-0 shadow-lg">
                <Image
                  src="/OIP.webp"
                  alt="Wisdom Church logo"
                  width={40}
                  height={40}
                  className="rounded-lg object-cover"
                />
              </div>
              {showLabels && (
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h1 className="font-bold text-lg text-foreground">
                      Wisdom Church
                    </h1>
                  </div>
                  <p className="text-sm text-muted-foreground">Admin Portal</p>
                </div>
              )}
            </Link>

            {/* Mobile close button */}
            <button
              onClick={() => setIsMobileOpen(false)}
              className="md:hidden p-2 hover:bg-accent/50 rounded-lg transition-colors"
              aria-label="Close menu"
            >
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>

          {/* User info */}
          {showLabels && auth.user && (
            <div className="mt-6">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-accent/30">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="font-semibold text-primary">
                    {getInitials()}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {getUserName()}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {auth.user.email}
                  </p>
                  <div className="mt-2">
                    <Badge variant="secondary" className="text-xs">
                      <Shield className="h-3 w-3 mr-1" />
                      {formatRole(auth.user.role)}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-2 overflow-y-auto p-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;

            return (
              <div key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setIsMobileOpen(false)}
                  title={item.label}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all
                    duration-200 ease-out group relative
                    ${showLabels ? '' : 'justify-center'}
                    ${isActive
                      ? 'bg-primary text-primary-foreground shadow-lg'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground hover:shadow-md'
                    }
                  `}
                >
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0
                    ${isActive
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-accent text-muted-foreground group-hover:bg-accent group-hover:text-foreground'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>

                  {showLabels && (
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="truncate font-medium">{item.label}</span>
                        {isActive && (
                          <div className="h-2 w-2 rounded-full bg-primary-foreground/60 ml-2" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-1">
                        {item.description}
                      </p>
                    </div>
                  )}

                  {/* Active indicator for collapsed state */}
                  {!showLabels && isActive && (
                    <div className="absolute right-0 top-1/2 h-6 w-1 -translate-y-1/2 bg-primary rounded-l-lg" />
                  )}
                  {!showLabels && (
                    <div className="pointer-events-none absolute left-full top-1/2 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100">
                      <div className="font-medium">{item.label}</div>
                      <div className="text-muted-foreground text-xs mt-1">{item.description}</div>
                    </div>
                  )}
                </Link>
              </div>
            );
          })}
        </nav>

        {/* Collapse toggle for desktop */}
        <div className="hidden md:block p-4 border-t border-border/50">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-accent/50 transition-colors"
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border/50">
          {showLabels && (
            <div className="mb-4 px-3 py-2 bg-accent/30 rounded-lg">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  <BellRing className="h-3 w-3 inline mr-1" />
                  Last login: Today
                </p>
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              </div>
            </div>
          )}

          <button
            onClick={handleLogoutClick}
            className={`
              flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium
              transition-all w-full group
              text-destructive hover:bg-destructive/10 hover:text-destructive
              ${showLabels ? 'justify-start' : 'justify-center'}
            `}
            aria-label="Logout"
            disabled={isLoggingOut}
          >
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0
              bg-destructive/10 text-destructive group-hover:bg-destructive/20`}
            >
              <LogOut className="h-4 w-4" />
            </div>
            {showLabels && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <LogoutModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleConfirmLogout}
        loading={isLoggingOut}
      />
    </>
  );
}
