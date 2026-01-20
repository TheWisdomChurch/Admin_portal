// src/components/admin/Sidebar.tsx
'use client';

import { useState, useEffect } from 'react';
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
  Home,
  Users,
  MessageSquare,
  Image,
  Shield,
  BellRing,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthContext } from '@/providers/AuthProviders';
import { Badge } from '@/ui/Badge';
import { LogoutModal } from '@/ui/LogoutModal';

const navItems = [
  { 
    href: '/dashboard', 
    label: 'Dashboard', 
    icon: LayoutDashboard,
    description: 'Overview and metrics'
  },
  { 
    href: '/dashboard/events', 
    label: 'Events', 
    icon: Calendar,
    description: 'Manage church events'
  },
  { 
    href: '/dashboard/members', 
    label: 'Members', 
    icon: Users,
    description: 'Church members directory'
  },
  { 
    href: '/dashboard/reels', 
    label: 'Reels', 
    icon: Video,
    description: 'Video content management'
  },
  { 
    href: '/dashboard/testimonials', 
    label: 'Testimonials', 
    icon: MessageSquare,
    description: 'Member testimonials'
  },
  { 
    href: '/dashboard/analytics', 
    label: 'Analytics', 
    icon: BarChart3,
    description: 'Statistics and insights'
  },
  { 
    href: '/dashboard/content', 
    label: 'Content', 
    icon: FileText,
    description: 'Website content'
  },
  { 
    href: '/dashboard/settings', 
    label: 'Settings', 
    icon: Settings,
    description: 'System configuration'
  },
];

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
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

  return (
    <>
      {/* Mobile toggle button */}
      <button
        onClick={() => setIsMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-40 p-2.5 rounded-xl bg-white shadow-lg border border-gray-200 hover:bg-gray-50 transition-colors"
        aria-label="Open navigation menu"
      >
        <Menu className="h-5 w-5 text-gray-700" />
      </button>

      {/* Sidebar */}
      <aside
        className={`
          fixed left-0 top-0 z-50 h-screen bg-white border-r border-gray-200
          flex flex-col shadow-xl backdrop-blur-sm bg-white/95
          transition-transform duration-300 ease-in-out
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          ${isCollapsed && !isMobileOpen ? 'lg:w-20' : 'lg:w-72'}
        `}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <Link 
              href="/dashboard" 
              className="flex items-center gap-3 min-w-0 group"
              onClick={() => setIsMobileOpen(false)}
            >
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center flex-shrink-0 shadow-md group-hover:shadow-lg transition-shadow">
                <Shield className="h-5 w-5 text-white" />
              </div>
              {(!isCollapsed || isMobileOpen) && (
                <div className="min-w-0">
                  <h1 className="font-bold text-lg text-gray-900 truncate">Wisdom Church</h1>
                  <p className="text-xs text-gray-500 truncate">Administration Panel</p>
                </div>
              )}
            </Link>
            
            {/* Desktop collapse button */}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="hidden lg:flex p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isCollapsed ? (
                <Menu className="h-4 w-4 text-gray-600" />
              ) : (
                <X className="h-4 w-4 text-gray-600" />
              )}
            </button>

            {/* Mobile close button */}
            <button
              onClick={() => setIsMobileOpen(false)}
              className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Close menu"
            >
              <X className="h-4 w-4 text-gray-600" />
            </button>
          </div>

          {/* User info */}
          {(!isCollapsed || isMobileOpen) && auth.user && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 pt-6 border-t border-gray-100"
            >
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center flex-shrink-0 shadow-sm">
                  <span className="font-bold text-lg text-blue-700">
                    {getInitials()}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {getUserName()}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
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
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
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
                    className={`
                      flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all
                      duration-200 ease-out group relative
                      ${isActive 
                        ? 'bg-gradient-to-r from-blue-50 to-blue-50 text-blue-700 shadow-sm' 
                        : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 hover:shadow-sm'
                      }
                    `}
                  >
                    <div className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0
                      ${isActive 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-100 text-gray-600 group-hover:bg-blue-100 group-hover:text-blue-600'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    
                    {(!isCollapsed || isMobileOpen) && (
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="truncate font-medium">{item.label}</span>
                          {isActive && (
                            <div className="h-1.5 w-1.5 rounded-full bg-blue-600 ml-2" />
                          )}
                        </div>
                        <p className="text-xs text-gray-500 truncate mt-0.5">
                          {item.description}
                        </p>
                      </div>
                    )}
                    
                    {/* Active indicator for collapsed state */}
                    {isCollapsed && !isMobileOpen && isActive && (
                      <div className="absolute right-0 top-1/2 h-6 w-1.5 -translate-y-1/2 bg-blue-600 rounded-l-lg" />
                    )}
                  </Link>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gradient-to-t from-gray-50/50 to-transparent">
          {(!isCollapsed || isMobileOpen) && (
            <div className="mb-4 px-3 py-2 bg-gray-100 rounded-lg">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-600">
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
              text-red-700 hover:bg-red-50 hover:text-red-800 hover:shadow-sm
              ${(!isCollapsed || isMobileOpen) ? 'justify-start' : 'justify-center'}
            `}
            aria-label="Logout"
            disabled={isLoggingOut}
          >
            <div className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0
              bg-red-50 text-red-600 group-hover:bg-red-100 group-hover:text-red-700`}
            >
              <LogOut className="h-4 w-4" />
            </div>
            {(!isCollapsed || isMobileOpen) && (
              <span className="font-medium">Logout</span>
            )}
          </button>
          
          {(!isCollapsed || isMobileOpen) && (
            <p className="mt-4 text-center text-xs text-gray-500">
              v1.0.0 • Wisdom Church Admin
            </p>
          )}
        </div>
      </aside>

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/30 z-40 backdrop-blur-sm"
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