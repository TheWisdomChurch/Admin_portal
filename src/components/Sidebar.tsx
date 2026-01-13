// src/components/admin/Sidebar.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Calendar, 
  Video, 
  BarChart3, 
  Settings, 
  LogOut,
  Menu,
  X,
  Home
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
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
  const { logout, admin } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <>
      {/* Mobile toggle button */}
      <button
        onClick={() => setIsMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-white shadow-lg"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{
          width: isMobileOpen || !isCollapsed ? '256px' : '72px',
        }}
        className={`
          fixed left-0 top-0 z-40 h-screen bg-white border-r border-secondary-200
          transition-all duration-300 ease-in-out
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Header */}
        <div className="p-6 border-b border-secondary-200">
          <div className="flex items-center justify-between">
            <Link 
              href="/dashboard" 
              className="flex items-center gap-3"
              onClick={() => setIsMobileOpen(false)}
            >
              <div className="h-8 w-8 rounded-lg bg-primary-600 flex items-center justify-center">
                <Home className="h-5 w-5 text-white" />
              </div>
              {(!isCollapsed || isMobileOpen) && (
                <span className="font-bold text-lg text-secondary-900">Church Admin</span>
              )}
            </Link>
            
            {/* Desktop collapse button */}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="hidden lg:flex p-1 hover:bg-secondary-100 rounded-lg"
            >
              {isCollapsed ? (
                <Menu className="h-5 w-5 text-secondary-600" />
              ) : (
                <X className="h-5 w-5 text-secondary-600" />
              )}
            </button>

            {/* Mobile close button */}
            <button
              onClick={() => setIsMobileOpen(false)}
              className="lg:hidden p-1 hover:bg-secondary-100 rounded-lg"
            >
              <X className="h-5 w-5 text-secondary-600" />
            </button>
          </div>

          {/* Admin info */}
          {(!isCollapsed || isMobileOpen) && admin && (
            <div className="mt-6">
              <p className="text-sm font-medium text-secondary-900">{admin.username}</p>
              <p className="text-xs text-secondary-500">{admin.email}</p>
              <Badge variant="info" className="mt-1">
                {admin.role.replace('_', ' ')}
              </Badge>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsMobileOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors
                  ${isActive 
                    ? 'bg-primary-50 text-primary-700' 
                    : 'text-secondary-700 hover:bg-secondary-100 hover:text-secondary-900'
                  }
                `}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {(!isCollapsed || isMobileOpen) && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-secondary-200">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-red-700 hover:bg-red-50 w-full"
          >
            <LogOut className="h-5 w-5" />
            {(!isCollapsed || isMobileOpen) && <span>Logout</span>}
          </button>
        </div>
      </motion.aside>

      {/* Spacer for desktop */}
      <div className="hidden lg:block" style={{ width: isCollapsed ? '72px' : '256px' }} />
    </>
  );
}