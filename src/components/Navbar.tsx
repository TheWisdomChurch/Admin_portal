// src/components/admin/Navbar.tsx
'use client';

import { useState } from 'react';
import { Bell, Search, User, LogOut, Calendar, Settings, Moon, Sun } from 'lucide-react';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/input';
import { useAuthContext } from '@/providers/AuthProviders';
import { useRouter } from 'next/navigation';
import { LogoutModal } from '@/ui/LogoutModal';
import { Badge } from '@/ui/Badge';
import { format } from 'date-fns';

export function Navbar() {
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const auth = useAuthContext();
  const router = useRouter();

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
    if (searchQuery.trim()) {
      console.log('Searching for:', searchQuery);
      // Implement search functionality
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

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    // Implement dark mode logic
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-6 py-3">
          {/* Left side - Date and Breadcrumb */}
          <div className="flex items-center gap-6">
            <div className="hidden lg:block">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">{currentDate}</span>
              </div>
            </div>
            
            {/* Mobile menu and title */}
            <div className="lg:hidden">
              <h1 className="text-lg font-semibold text-gray-900">Dashboard</h1>
            </div>
          </div>

          {/* Center - Search */}
          <div className="flex-1 max-w-2xl mx-4">
            <form onSubmit={handleSearch} className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search events, members, reels..."
                className="pl-10 pr-4 py-2 bg-gray-50 border-gray-300 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                disabled={!searchQuery.trim()}
              >
                Search
              </Button>
            </form>
          </div>

          {/* Right side - Actions and User */}
          <div className="flex items-center gap-3">
            {/* Dark mode toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleDarkMode}
              className="hidden md:flex text-gray-600 hover:text-gray-900"
              aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            >
              {darkMode ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>

            {/* Notifications */}
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                className="relative text-gray-600 hover:text-gray-900"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" />
                <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              </Button>
            </div>

            {/* Settings */}
            <Button
              variant="ghost"
              size="sm"
              className="hidden md:flex text-gray-600 hover:text-gray-900"
              aria-label="Settings"
              onClick={() => router.push('/dashboard/settings')}
            >
              <Settings className="h-5 w-5" />
            </Button>

            {/* User profile dropdown */}
            <div className="flex items-center gap-3 pl-3 border-l border-gray-300">
              {/* Desktop user info */}
              <div className="hidden md:block text-right">
                <p className="text-sm font-semibold text-gray-900 leading-tight">
                  {getUserName()}
                </p>
                <p className="text-xs text-gray-500 leading-tight">
                  {auth.user?.role?.replace('_', ' ').toUpperCase()}
                </p>
              </div>
              
              {/* User avatar */}
              <div className="relative group">
                <button
                  className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center text-white font-semibold shadow-sm hover:shadow-md transition-shadow"
                  aria-label="User menu"
                >
                  {getUserInitials()}
                </button>
                
                {/* Online indicator */}
                <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-green-500" />
              </div>

              {/* Logout button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogoutClick}
                className="text-gray-600 hover:text-red-600 hover:bg-red-50"
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
        <div className="hidden lg:flex items-center justify-between px-6 py-2 bg-gradient-to-r from-blue-50 to-gray-50 border-t border-gray-200">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                <Calendar className="h-3 w-3 mr-1" />
                Today: {format(new Date(), 'MMM dd')}
              </Badge>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-xs text-gray-600">
              Server: <Badge variant="success" className="ml-1">Online</Badge>
            </div>
            <div className="text-xs text-gray-600">
              Version: <span className="font-medium">1.0.0</span>
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