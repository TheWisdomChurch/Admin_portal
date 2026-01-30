// src/app/(dashboard)/settings/page.tsx
'use client';

import { useState, useEffect, type ChangeEvent, type FormEvent } from 'react';
import { Save, Bell, Lock, User, Trash2 } from 'lucide-react';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/input';
import { Card } from '@/ui/Card';
import { useAuthContext } from '@/providers/AuthProviders';
import { apiClient } from '@/lib/api';
import toast from 'react-hot-toast';
import { withAuth } from '@/providers/withAuth';
import { ConfirmationModal } from '@/ui/ConfirmationModal';
import { PageHeader } from '@/layouts';
import { OtpModal } from '@/ui/OtpModal';


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
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [clearDataLoading, setClearDataLoading] = useState(false);
  const [deleteAccountLoading, setDeleteAccountLoading] = useState(false);
  const [otpOpen, setOtpOpen] = useState(false);
  const [otpStep, setOtpStep] = useState<'email' | 'otp'>('email');
  const [otpEmail, setOtpEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<'profile' | 'password' | null>(null);
  
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
      setOtpEmail(auth.user.email || '');
    }
  }, [auth.user]);

  const handleProfileSubmit = (e: FormEvent) => {
    e.preventDefault();
    setPendingAction('profile');
    setOtpStep('email');
    setOtpCode('');
    setOtpOpen(true);
    setOtpEmail(profileFormData.email || auth.user?.email || '');
  };

  const performProfileUpdate = async () => {
    setProfileLoading(true);
    try {
      const updateData = {
        first_name: profileFormData.username,
        email: profileFormData.email,
      };

      const updatedUser = await apiClient.updateProfile(updateData);
      auth.checkAuth();

      toast.success('Profile updated successfully');
      setProfileFormData({
        username: updatedUser.first_name || '',
        email: updatedUser.email || '',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update profile';
      toast.error(message);
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: FormEvent) => {
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
    setPendingAction('password');
    setOtpStep('email');
    setOtpCode('');
    setOtpOpen(true);
    setOtpEmail(auth.user?.email || profileFormData.email || '');
  };

  const performPasswordChange = async () => {
    setPasswordLoading(true);
    try {
      await apiClient.changePassword(
        passwordFormData.currentPassword,
        passwordFormData.newPassword,
        {
          currentPassword: passwordFormData.currentPassword,
          newPassword: passwordFormData.newPassword,
          confirmPassword: passwordFormData.confirmPassword,
        }
      );

      toast.success('Password changed successfully');
      setPasswordFormData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to change password';
      toast.error(message);
    } finally {
      setPasswordLoading(false);
    }
  };

  const requestOtp = async () => {
    const targetEmail = otpEmail.trim() || auth.user?.email || '';
    if (!pendingAction) {
      toast.error('Select an action to verify');
      return;
    }
    if (!targetEmail) {
      toast.error('Email address is required for verification');
      return;
    }

    try {
      setOtpLoading(true);
      await apiClient.sendOtp({
        email: targetEmail,
        purpose: pendingAction === 'password' ? 'password_change' : 'profile_update',
      });
      toast.success('Verification code sent');
      setOtpStep('otp');
      setOtpEmail(targetEmail);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send code';
      toast.error(message);
    } finally {
      setOtpLoading(false);
    }
  };

  const verifyOtpAndRun = async () => {
    if (!pendingAction) {
      toast.error('No pending action to verify');
      return;
    }
    if (!otpCode.trim()) {
      toast.error('Enter the code we sent to your email');
      return;
    }
    const purpose = pendingAction === 'password' ? 'password_change' : 'profile_update';
    const targetEmail = otpEmail.trim() || auth.user?.email || '';

    try {
      setOtpLoading(true);
      await apiClient.verifyOtp({ email: targetEmail, code: otpCode.trim(), purpose });

      if (pendingAction === 'profile') {
        await performProfileUpdate();
      } else if (pendingAction === 'password') {
        await performPasswordChange();
      }

      setOtpOpen(false);
      setOtpCode('');
      setOtpStep('email');
      setPendingAction(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Verification failed';
      toast.error(message);
    } finally {
      setOtpLoading(false);
    }
  };

  const handleProfileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setProfileFormData({
      ...profileFormData,
      [e.target.name]: e.target.value,
    });
  };

  const handlePasswordChange = (e: ChangeEvent<HTMLInputElement>) => {
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
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to clear data';
      toast.error(message);
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
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete account';
      toast.error(message);
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
        <PageHeader
          title="Settings"
          subtitle="Manage your account and preferences."
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Profile Settings */}
            <Card>
              <div className="p-6 space-y-6">
                <div className="flex items-start gap-3">
                  <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-background-tertiary)] text-[var(--color-accent-primary)]">
                    <User className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Profile Information</h2>
                    <p className="text-xs text-[var(--color-text-tertiary)]">Update your personal details</p>
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
              <div className="p-6 space-y-6">
                <div className="flex items-start gap-3">
                  <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-background-tertiary)] text-[var(--color-accent-primary)]">
                    <Lock className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Security</h2>
                    <p className="text-xs text-[var(--color-text-tertiary)]">Change your password</p>
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
              <div className="p-6 space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Account Information</h2>
                  <p className="text-xs text-[var(--color-text-tertiary)]">Your profile details at a glance.</p>
                </div>
                <div className="grid gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-[var(--color-text-tertiary)]">Full Name</p>
                    <p className="text-sm font-semibold text-[var(--color-text-primary)] break-words">
                      {auth.user ? `${auth.user.first_name} ${auth.user.last_name}` : 'N/A'}
                    </p>
                  </div>
                  
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-[var(--color-text-tertiary)]">Role</p>
                    <p className="text-sm font-semibold text-[var(--color-text-primary)] capitalize break-words">
                      {auth.user?.role?.replace('_', ' ') || 'N/A'}
                    </p>
                  </div>
                  
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-[var(--color-text-tertiary)]">Email</p>
                    <p className="text-sm font-semibold text-[var(--color-text-primary)] break-words">
                      {auth.user?.email || 'N/A'}
                    </p>
                  </div>
                  
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-[var(--color-text-tertiary)]">Account Created</p>
                    <p className="text-sm font-semibold text-[var(--color-text-primary)] break-words">
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
              <div className="p-6 space-y-6">
                <div className="flex items-start gap-3">
                  <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-background-tertiary)] text-[var(--color-accent-primary)]">
                    <Bell className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Preferences</h2>
                    <p className="text-xs text-[var(--color-text-tertiary)]">Manage your notification settings</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--color-text-primary)]">Email Notifications</p>
                      <p className="text-xs text-[var(--color-text-tertiary)]">Receive email updates</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-11 h-6 bg-[var(--color-background-tertiary)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[var(--color-background-primary)] after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-accent-primary)]"></div>
                    </label>
                  </div>
                  
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--color-text-primary)]">Desktop Notifications</p>
                      <p className="text-xs text-[var(--color-text-tertiary)]">Receive browser notifications</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input type="checkbox" className="sr-only peer" />
                      <div className="w-11 h-6 bg-[var(--color-background-tertiary)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[var(--color-background-primary)] after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-accent-primary)]"></div>
                    </label>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--color-text-primary)]">SMS Notifications</p>
                      <p className="text-xs text-[var(--color-text-tertiary)]">Receive text message alerts</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input type="checkbox" className="sr-only peer" />
                      <div className="w-11 h-6 bg-[var(--color-background-tertiary)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[var(--color-background-primary)] after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-accent-primary)]"></div>
                    </label>
                  </div>
                </div>
              </div>
            </Card>

            {/* Danger Zone */}
            <Card className="border border-red-200/40">
              <div className="p-6 space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Danger Zone</h2>
                  <p className="text-xs text-[var(--color-text-tertiary)]">Sensitive actions that affect your account.</p>
                </div>
                <div className="grid gap-3">
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
                
                <div className="rounded-[var(--radius-button)] border border-red-200/40 bg-red-50/60 p-3">
                  <p className="text-xs text-red-700">
                    <strong>Note:</strong> Deleting your account will permanently remove all your data from our servers. This action cannot be undone.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      <OtpModal
        open={otpOpen}
        step={otpStep}
        email={otpEmail}
        code={otpCode}
        onEmailChange={setOtpEmail}
        onCodeChange={setOtpCode}
        onRequestOtp={requestOtp}
        onVerifyOtp={verifyOtpAndRun}
        onClose={() => {
          setOtpOpen(false);
          setOtpStep('email');
          setOtpCode('');
          setPendingAction(null);
        }}
        loading={otpLoading || profileLoading || passwordLoading}
        title="Verify with email code"
        subtitle={
          otpStep === 'email'
            ? 'Enter your email to receive a one-time code for this action.'
            : `Enter the code sent to ${otpEmail}.`
        }
        confirmText="Verify & continue"
        requestText="Send code"
      />

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
