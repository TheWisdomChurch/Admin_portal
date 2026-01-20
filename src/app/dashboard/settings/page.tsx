// src/app/(dashboard)/settings/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { Save, Bell, Lock, User, Globe, Trash2 } from 'lucide-react';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/input';
import { Card } from '@/ui/Card';
import { useAuthContext } from '@/providers/AuthProviders';
import { apiClient } from '@/lib/api';
import toast from 'react-hot-toast';
import { withAuth } from '@/providers/withAuth';
import { ConfirmationModal } from '@/ui/ConfirmationModal';


interface ProfileFormData {
  username: string;
  email: string;
}

interface PasswordFormData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

function SettingsPage() {
  const auth = useAuthContext();
  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [clearDataLoading, setClearDataLoading] = useState(false);
  const [deleteAccountLoading, setDeleteAccountLoading] = useState(false);
  
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showClearDataModal, setShowClearDataModal] = useState(false);
  
  const [profileFormData, setProfileFormData] = useState<ProfileFormData>({
    username: '',
    email: '',
  });

  const [passwordFormData, setPasswordFormData] = useState<PasswordFormData>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Initialize form data with user info
  useEffect(() => {
    if (auth.user) {
      setProfileFormData({
        username: auth.user.first_name || '',
        email: auth.user.email || '',
      });
    }
  }, [auth.user]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    
    try {
      // Prepare profile update data
      const updateData = {
        first_name: profileFormData.username,
        email: profileFormData.email,
      };

      // Call API to update profile
      const updatedUser = await apiClient.updateProfile(updateData);
      
      // Update auth context with new user data
      auth.checkAuth();
      
      toast.success('Profile updated successfully');
      
      // Update form data with new values
      setProfileFormData({
        username: updatedUser.first_name || '',
        email: updatedUser.email || '',
      });
    } catch (error: any) {
      toast.error(error.message || 'Failed to update profile');
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate passwords
    if (passwordFormData.newPassword !== passwordFormData.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    
    if (passwordFormData.newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    
    setPasswordLoading(true);
    
    try {
      // Call API to change password
      await apiClient.changePassword(
        passwordFormData.currentPassword,
        passwordFormData.newPassword
      );
      
      toast.success('Password changed successfully');
      
      // Clear password fields
      setPasswordFormData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (error: any) {
      toast.error(error.message || 'Failed to change password');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProfileFormData({
      ...profileFormData,
      [e.target.name]: e.target.value,
    });
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPasswordFormData({
      ...passwordFormData,
      [e.target.name]: e.target.value,
    });
  };

  const handleClearData = async () => {
    setClearDataLoading(true);
    try {
      await apiClient.clearUserData();
      toast.success('All user data cleared successfully');
      
      // Refresh auth context to get updated user data
      auth.checkAuth();
    } catch (error: any) {
      toast.error(error.message || 'Failed to clear data');
    } finally {
      setClearDataLoading(false);
      setShowClearDataModal(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteAccountLoading(true);
    try {
      await apiClient.deleteAccount();
      toast.success('Account deleted successfully');
      
      // Logout after deleting account
      setTimeout(() => {
        auth.logout();
      }, 1000);
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete account');
    } finally {
      setDeleteAccountLoading(false);
      setShowDeleteModal(false);
    }
  };

  if (auth.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <>
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-secondary-600 mb-1">First Name</p>
                      <p className="text-secondary-900 font-medium">
                        {auth.user?.first_name || 'N/A'}
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-sm font-medium text-secondary-600 mb-1">Last Name</p>
                      <p className="text-secondary-900 font-medium">
                        {auth.user?.last_name || 'N/A'}
                      </p>
                    </div>
                  </div>
                  
                  <Input
                    label="Display Name"
                    name="username"
                    value={profileFormData.username}
                    onChange={handleProfileChange}
                    placeholder="Enter display name"
                    helperText="This name will be displayed to other users"
                  />
                  
                  <Input
                    label="Email Address"
                    type="email"
                    name="email"
                    value={profileFormData.email}
                    onChange={handleProfileChange}
                    placeholder="Enter your email"
                    required
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
                    value={passwordFormData.currentPassword}
                    onChange={handlePasswordChange}
                    placeholder="Enter current password"
                    required
                  />
                  
                  <Input
                    label="New Password"
                    type="password"
                    name="newPassword"
                    value={passwordFormData.newPassword}
                    onChange={handlePasswordChange}
                    placeholder="Enter new password (min. 6 characters)"
                    required
                    minLength={6}
                  />
                  
                  <Input
                    label="Confirm New Password"
                    type="password"
                    name="confirmPassword"
                    value={passwordFormData.confirmPassword}
                    onChange={handlePasswordChange}
                    placeholder="Confirm new password"
                    required
                    minLength={6}
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
                    <p className="text-sm font-medium text-secondary-600">Full Name</p>
                    <p className="text-secondary-900 font-medium">
                      {auth.user ? `${auth.user.first_name} ${auth.user.last_name}` : 'N/A'}
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-sm font-medium text-secondary-600">Role</p>
                    <p className="text-secondary-900 font-medium capitalize">
                      {auth.user?.role?.replace('_', ' ') || 'N/A'}
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-sm font-medium text-secondary-600">Email</p>
                    <p className="text-secondary-900 font-medium">
                      {auth.user?.email || 'N/A'}
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-sm font-medium text-secondary-600">Account Created</p>
                    <p className="text-secondary-900 font-medium">
                      {auth.user?.created_at ? new Date(auth.user.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      }) : 'N/A'}
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

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-secondary-900">SMS Notifications</p>
                      <p className="text-xs text-secondary-500">Receive text message alerts</p>
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
                    className="w-full text-amber-600 hover:text-amber-700 border-amber-200 hover:bg-amber-50"
                    onClick={() => setShowClearDataModal(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear Cache
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="w-full text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50"
                    onClick={() => auth.logout()}
                  >
                    <Lock className="h-4 w-4 mr-2" />
                    Logout
                  </Button>
                  
                  <Button 
                    variant="danger" 
                    className="w-full"
                    onClick={() => setShowDeleteModal(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Account
                  </Button>
                </div>
                
                <div className="mt-4 p-3 bg-secondary-50 rounded-lg">
                  <p className="text-xs text-secondary-500">
                    <strong>Note:</strong> Deleting your account will permanently remove all your data from our servers. This action cannot be undone.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Delete Account Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteAccount}
        title="Delete Account"
        description="Are you sure you want to delete your account? This action is permanent and cannot be undone."
        confirmText="Delete Account"
        cancelText="Cancel"
        variant="danger"
        loading={deleteAccountLoading}
      >
        <div className="mt-4 p-3 bg-red-50 rounded-md">
          <ul className="text-xs text-red-700 list-disc pl-4 space-y-1">
            <li>All your personal data will be permanently deleted</li>
            <li>Your account will be removed from our database</li>
            <li>You will not be able to login with this account again</li>
            <li>This action cannot be reversed</li>
          </ul>
        </div>
      </ConfirmationModal>

      {/* Clear Data Confirmation Modal */}
      <ConfirmationModal
        isOpen={showClearDataModal}
        onClose={() => setShowClearDataModal(false)}
        onConfirm={handleClearData}
        title="Clear All Data"
        description="Are you sure you want to clear all your data? This includes your preferences, cache, and temporary data."
        confirmText="Clear Data"
        cancelText="Cancel"
        variant="warning"
        loading={clearDataLoading}
      >
        <div className="mt-4 p-3 bg-amber-50 rounded-md">
          <ul className="text-xs text-amber-700 list-disc pl-4 space-y-1">
            <li>Your app preferences will be reset to default</li>
            <li>Local cache and temporary files will be removed</li>
            <li>Your account information will remain intact</li>
            <li>You may need to reconfigure your settings</li>
          </ul>
        </div>
      </ConfirmationModal>
    </>
  );
}

export default withAuth(SettingsPage);