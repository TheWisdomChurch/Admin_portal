// src/components/admin/Sidebar.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  LayoutDashboard, 
  Calendar, 
  Video, 
  BarChart3, 
  Settings, 
  LogOut,
  Menu,
  X,
  Home,
  Users,
  MessageSquare,
  Image
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuthContext } from '@/providers/AuthProviders';
import { Badge } from '@/ui/Badge';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/events', label: 'Events', icon: Calendar },
  { href: '/dashboard/reels', label: 'Reels', icon: Video },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const auth = useAuthContext();

  const handleLogout = () => {
    auth.logout();
    setIsMobileOpen(false);
  };

  // Get user's full name
  const getUserName = () => {
    if (!auth.user) return 'User';
    return `${auth.user.first_name} ${auth.user.last_name}`.trim();
  };

  // Format role for display
  const formatRole = (role: string = '') => {
    return role
      .replace('_', ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <>
      {/* Mobile toggle button */}
      <button
        onClick={() => setIsMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-white shadow-lg border border-secondary-200"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5 text-secondary-700" />
      </button>

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{
          width: isMobileOpen || !isCollapsed ? '256px' : '72px',
        }}
        className={`
          fixed left-0 top-0 z-50 h-screen bg-white border-r border-secondary-200
          transition-all duration-300 ease-in-out flex flex-col
          shadow-lg
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Header */}
        <div className="p-6 border-b border-secondary-200">
          <div className="flex items-center justify-between">
            <Link 
              href="/dashboard" 
              className="flex items-center gap-3 min-w-0"
              onClick={() => setIsMobileOpen(false)}
            >
              <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center flex-shrink-0">
                <Home className="h-5 w-5 text-white" />
              </div>
              {(!isCollapsed || isMobileOpen) && (
                <div className="min-w-0">
                  <h1 className="font-bold text-lg text-secondary-900 truncate">Church Admin</h1>
                  <p className="text-xs text-secondary-500 truncate">Wisdom Church</p>
                </div>
              )}
            </Link>
            
            {/* Desktop collapse button */}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="hidden lg:flex p-2 hover:bg-secondary-100 rounded-lg transition-colors"
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isCollapsed ? (
                <Menu className="h-4 w-4 text-secondary-600" />
              ) : (
                <X className="h-4 w-4 text-secondary-600" />
              )}
            </button>

            {/* Mobile close button */}
            <button
              onClick={() => setIsMobileOpen(false)}
              className="lg:hidden p-2 hover:bg-secondary-100 rounded-lg transition-colors"
              aria-label="Close menu"
            >
              <X className="h-4 w-4 text-secondary-600" />
            </button>
          </div>

          {/* Admin info */}
          {(!isCollapsed || isMobileOpen) && auth.user && (
            <div className="mt-6 pt-6 border-t border-secondary-100">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center flex-shrink-0">
                  <span className="font-semibold text-primary-700">
                    {auth.user.first_name?.charAt(0)}
                    {auth.user.last_name?.charAt(0)}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-secondary-900 truncate">
                    {getUserName()}
                  </p>
                  <p className="text-xs text-secondary-500 truncate">
                    {auth.user.email}
                  </p>
                  <Badge variant="primary" className="mt-1 text-xs">
                    {formatRole(auth.user.role)}
                  </Badge>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsMobileOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all
                  duration-200 ease-out
                  ${isActive 
                    ? 'bg-gradient-to-r from-primary-50 to-primary-50 text-primary-700 border-l-4 border-primary-600 pl-2.5' 
                    : 'text-secondary-700 hover:bg-secondary-100 hover:text-secondary-900 hover:border-l-4 hover:border-secondary-300 hover:pl-2.5'
                  }
                `}
              >
                <Icon className={`h-5 w-5 flex-shrink-0 ${isActive ? 'text-primary-600' : 'text-secondary-500'}`} />
                {(!isCollapsed || isMobileOpen) && (
                  <span className="truncate">{item.label}</span>
                )}
                {isActive && (!isCollapsed || isMobileOpen) && (
                  <div className="ml-auto h-2 w-2 rounded-full bg-primary-600" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-secondary-200 bg-gradient-to-t from-secondary-50/50 to-transparent">
          <div className="mb-4">
            {(!isCollapsed || isMobileOpen) && (
              <div className="px-3 py-2 bg-secondary-100 rounded-lg">
                <p className="text-xs text-secondary-600">
                  Last login: Today
                </p>
              </div>
            )}
          </div>
          
          <button
            onClick={handleLogout}
            className={`
              flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium 
              transition-colors w-full
              text-red-700 hover:bg-red-50 hover:text-red-800
              ${(!isCollapsed || isMobileOpen) ? 'justify-start' : 'justify-center'}
            `}
            aria-label="Logout"
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            {(!isCollapsed || isMobileOpen) && <span>Logout</span>}
          </button>
          
          {(!isCollapsed || isMobileOpen) && (
            <p className="mt-4 text-center text-xs text-secondary-500">
              v1.0.0 • Wisdom Church
            </p>
          )}
        </div>
      </motion.aside>

      {/* Spacer for desktop */}
      <div 
        className="hidden lg:block flex-shrink-0 transition-all duration-300 ease-in-out" 
        style={{ width: isCollapsed ? '72px' : '256px' }} 
      />
    </>
  );
}