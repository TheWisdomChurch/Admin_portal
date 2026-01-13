// src/app/(dashboard)/settings/page.tsx
'use client';

import { useState } from 'react';
import { Save, Bell, Lock, User, Globe, Trash2 } from 'lucide-react';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/input';
import { Card } from '@/ui/Card';
import { useAuth } from '@/hooks/useAuth';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const { admin } = useAuth();
  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [formData, setFormData] = useState({
    username: admin?.username || '',
    email: admin?.email || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    
    // Simulate API call for profile update
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast.success('Profile updated successfully');
    setProfileLoading(false);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate passwords match
    if (formData.newPassword !== formData.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    
    setPasswordLoading(true);
    
    // Simulate API call for password change
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast.success('Password changed successfully');
    
    // Clear password fields
    setFormData({
      ...formData,
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
    
    setPasswordLoading(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleClearData = async () => {
    if (!confirm('Are you sure you want to clear all data? This action cannot be undone.')) {
      return;
    }
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    toast.success('All data cleared successfully');
  };

  const handleDeleteAccount = async () => {
    if (!confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      return;
    }
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    toast.success('Account deleted successfully');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-secondary-900">Settings</h1>
        <p className="text-secondary-600 mt-2">Manage your account and preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Profile Settings */}
          <Card>
            <div className="p-6">
              <div className="flex items-center mb-6">
                <div className="p-2 rounded-lg bg-primary-50 text-primary-600 mr-3">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-secondary-900">Profile Information</h2>
                  <p className="text-secondary-600 text-sm">Update your personal details</p>
                </div>
              </div>
              
              <form onSubmit={handleProfileSubmit} className="space-y-4">
                <Input
                  label="Username"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  placeholder="Enter your username"
                />
                
                <Input
                  label="Email Address"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Enter your email"
                />
                
                <div className="pt-4">
                  <Button type="submit" loading={profileLoading}>
                    <Save className="h-4 w-4 mr-2" />
                    Update Profile
                  </Button>
                </div>
              </form>
            </div>
          </Card>

          {/* Security Settings */}
          <Card>
            <div className="p-6">
              <div className="flex items-center mb-6">
                <div className="p-2 rounded-lg bg-primary-50 text-primary-600 mr-3">
                  <Lock className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-secondary-900">Security</h2>
                  <p className="text-secondary-600 text-sm">Change your password</p>
                </div>
              </div>
              
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <Input
                  label="Current Password"
                  type="password"
                  name="currentPassword"
                  value={formData.currentPassword}
                  onChange={handleChange}
                  placeholder="Enter current password"
                />
                
                <Input
                  label="New Password"
                  type="password"
                  name="newPassword"
                  value={formData.newPassword}
                  onChange={handleChange}
                  placeholder="Enter new password"
                />
                
                <Input
                  label="Confirm New Password"
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Confirm new password"
                />
                
                <div className="pt-4">
                  <Button type="submit" loading={passwordLoading}>
                    <Save className="h-4 w-4 mr-2" />
                    Change Password
                  </Button>
                </div>
              </form>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Account Info */}
          <Card>
            <div className="p-6">
              <h2 className="text-xl font-semibold text-secondary-900 mb-6">Account Information</h2>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-secondary-600">Role</p>
                  <p className="text-secondary-900 font-medium capitalize">
                    {admin?.role?.replace('_', ' ') || 'N/A'}
                  </p>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-secondary-600">Member Since</p>
                  <p className="text-secondary-900 font-medium">
                    {admin?.createdAt ? new Date(admin.createdAt).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-secondary-600">Last Login</p>
                  <p className="text-secondary-900 font-medium">
                    {admin?.lastLogin ? new Date(admin.lastLogin).toLocaleString() : 'Never'}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Preferences */}
          <Card>
            <div className="p-6">
              <div className="flex items-center mb-6">
                <div className="p-2 rounded-lg bg-primary-50 text-primary-600 mr-3">
                  <Bell className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-secondary-900">Preferences</h2>
                  <p className="text-secondary-600 text-sm">Manage your notification settings</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-secondary-900">Email Notifications</p>
                    <p className="text-xs text-secondary-500">Receive email updates</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-11 h-6 bg-secondary-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                  </label>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-secondary-900">Desktop Notifications</p>
                    <p className="text-xs text-secondary-500">Receive browser notifications</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" />
                    <div className="w-11 h-6 bg-secondary-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                  </label>
                </div>
              </div>
            </div>
          </Card>

          {/* Danger Zone */}
          <Card>
            <div className="p-6">
              <h2 className="text-xl font-semibold text-secondary-900 mb-6">Danger Zone</h2>
              <div className="space-y-3">
                <Button 
                  variant="outline" 
                  className="w-full text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50"
                  onClick={handleClearData}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear All Data
                </Button>
                <Button 
                  variant="danger" 
                  className="w-full"
                  onClick={handleDeleteAccount}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Account
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}