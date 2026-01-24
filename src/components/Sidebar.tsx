// src/components/admin/Sidebar.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Calendar, 
  Video, 
  BarChart3, 
  ClipboardList,
  Settings, 
  LogOut,
  Menu,
  X,
  Users,
  MessageSquare,
  Shield,
  BellRing,
  FileText,
  LineChart
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthContext } from '@/providers/AuthProviders';
import { Badge } from '@/ui/Badge';
import { LogoutModal } from '@/ui/LogoutModal';
import { textStyles } from '@/styles/text';

const adminNavItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, description: 'Overview and metrics' },
  { href: '/dashboard/events', label: 'Events', icon: Calendar, description: 'Manage church events' },
  { href: '/dashboard/administration', label: 'Administration', icon: Shield, description: 'Workforce, leadership, members' },
  { href: '/dashboard/reels', label: 'Reels', icon: Video, description: 'Video content management' },
  { href: '/dashboard/testimonials', label: 'Testimonials', icon: MessageSquare, description: 'Member testimonials' },
  { href: '/dashboard/forms', label: 'Forms', icon: ClipboardList, description: 'Create registration links' },
  { href: '/dashboard/content', label: 'Content', icon: FileText, description: 'Website content' },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings, description: 'System configuration' },
];

const superNavItems = [
  { href: '/dashboard/super', label: 'Dashbord', icon: LayoutDashboard, description: 'Approvals & analytics' },
  { href: '/dashboard/super/requests', label: 'Requests', icon: BellRing, description: 'Pending approvals' },
  { href: '/dashboard/super/analytics', label: 'Analytics', icon: LineChart, description: 'Charts & trends' },
  { href: '/dashboard/super/reports', label: 'Reports', icon: FileText, description: 'Monthly exports' },
  { href: '/dashboard/super/notifications', label: 'Notifications', icon: BarChart3, description: 'Alerts and updates' },
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
        className="md:hidden fixed top-4 left-4 z-50 p-2.5 rounded-[var(--radius-button)] bg-[var(--color-background-primary)] shadow-lg border border-[var(--color-border-primary)] hover:bg-[var(--color-background-hover)] transition-colors"
        aria-label="Open navigation menu"
      >
        <Menu className="h-5 w-5 text-[var(--color-text-secondary)]" />
      </button>

      {/* Sidebar */}
      <aside
        className={`
          fixed left-0 top-0 z-50 h-screen border-r border-[var(--color-border-primary)]
          flex flex-col shadow-xl backdrop-blur-sm bg-[var(--color-background-primary)]
          transition-transform duration-300 ease-in-out
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
        <div className="p-5 border-b border-[var(--color-border-secondary)]">
          <div className="flex items-center justify-between">
            <Link 
              href={homeHref} 
              className="flex items-center gap-3 min-w-0 group"
              onClick={() => setIsMobileOpen(false)}
            >
              <div className="h-11 w-11 rounded-full border-2 border-white bg-black flex items-center justify-center flex-shrink-0 shadow-md group-hover:shadow-lg transition-shadow">
                <Image
                  src="/OIP.webp"
                  alt="Wisdom Church logo"
                  width={36}
                  height={36}
                  className="rounded-full object-cover"
                />
              </div>
              {showLabels && (
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h1 className="font-display font-semibold text-base text-[var(--color-text-primary)] truncate">
                      The Wisdom Church
                    </h1>
                  </div>
                  <p className={textStyles.subtitle}>Administration Panel</p>
                </div>
              )}
            </Link>
            
            {/* Mobile close button */}
            <button
              onClick={() => setIsMobileOpen(false)}
              className="md:hidden p-2 hover:bg-[var(--color-background-hover)] rounded-[var(--radius-button)] transition-colors"
              aria-label="Close menu"
            >
              <X className="h-4 w-4 text-[var(--color-text-secondary)]" />
            </button>
          </div>

          {/* User info */}
          {showLabels && auth.user && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 pt-6 border-t border-[var(--color-border-secondary)]"
            >
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-[var(--radius-button)] bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center flex-shrink-0 shadow-sm">
                  <span className="font-bold text-lg text-amber-700">
                    {getInitials()}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                    {getUserName()}
                  </p>
                  <p className="text-xs text-[var(--color-text-tertiary)] truncate">
                    {auth.user.email}
                  </p>
                  <div className="mt-2">
                    <Badge variant="primary" className="text-xs">
                      <Shield className="h-3 w-3 mr-1" />
                      {formatRole(auth.user.role)}
                    </Badge>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Navigation */}
        <nav className={`flex-1 space-y-1 overflow-y-auto ${isCollapsed ? 'p-3' : 'p-4'}`}>
          <AnimatePresence>
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;

              return (
                <motion.div
                  key={item.href}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <Link
                    href={item.href}
                    onClick={() => setIsMobileOpen(false)}
                    title={item.label}
                    className={`
                      flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all
                      duration-200 ease-out group relative
                      ${showLabels ? '' : 'justify-center'}
                      ${isActive 
                        ? 'bg-[var(--color-background-tertiary)] text-[var(--color-text-primary)] shadow-sm' 
                        : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-background-hover)] hover:text-[var(--color-text-primary)] hover:shadow-sm'
                      }
                    `}
                  >
                    <div className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0
                      ${isActive 
                        ? 'bg-[var(--color-accent-primary)] text-[var(--color-text-onprimary)]' 
                        : 'bg-[var(--color-background-tertiary)] text-[var(--color-text-secondary)] group-hover:bg-[var(--color-background-tertiary)] group-hover:text-[var(--color-accent-primary)]'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    
                    {showLabels && (
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="truncate font-medium">{item.label}</span>
                          {isActive && (
                            <div className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent-primary)] ml-2" />
                          )}
                        </div>
                        <p className="text-xs text-[var(--color-text-tertiary)] truncate mt-0.5">
                          {item.description}
                        </p>
                      </div>
                    )}
                    
                    {/* Active indicator for collapsed state */}
                    {!showLabels && isActive && (
                      <div className="absolute right-0 top-1/2 h-6 w-1.5 -translate-y-1/2 bg-[var(--color-accent-primary)] rounded-l-lg" />
                    )}
                    {!showLabels && (
                      <span className="pointer-events-none absolute left-full top-1/2 ml-3 -translate-y-1/2 whitespace-nowrap rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-3 py-1 text-xs text-[var(--color-text-secondary)] opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100">
                        {item.label}
                      </span>
                    )}
                  </Link>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--color-border-secondary)] bg-gradient-to-t from-[var(--color-background-tertiary)]/60 to-transparent">
          {showLabels && (
            <div className="mb-4 px-3 py-2 bg-[var(--color-background-tertiary)] rounded-[var(--radius-button)]">
              <div className="flex items-center justify-between">
                <p className="text-xs text-[var(--color-text-tertiary)]">
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
              flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium 
              transition-all w-full group
              text-red-600 hover:bg-red-50 hover:text-red-700 hover:shadow-sm
              ${showLabels ? 'justify-start' : 'justify-center'}
            `}
            aria-label="Logout"
            disabled={isLoggingOut}
          >
            <div className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0
              bg-red-50 text-red-600 group-hover:bg-red-100 group-hover:text-red-700`}
            >
              <LogOut className="h-4 w-4" />
            </div>
            {showLabels && (
              <span className="font-medium">Logout</span>
            )}
          </button>
          
          {showLabels && (
            <p className="mt-4 text-center text-xs text-[var(--color-text-tertiary)]">
              v1.0.0 • Wisdom Church Admin
            </p>
          )}
        </div>
      </aside>

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/30 z-40 backdrop-blur-sm"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

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
