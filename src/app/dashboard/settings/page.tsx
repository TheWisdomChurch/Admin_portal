// src/app/(dashboard)/settings/page.tsx
'use client';

import Image from 'next/image';
import { useState, useEffect, useCallback, type ChangeEvent, type FormEvent } from 'react';
import { Save, Bell, Lock, User, Trash2, ShieldCheck, Smartphone, Copy, Link as LinkIcon } from 'lucide-react';
import QRCode from 'qrcode';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/input';
import { Card } from '@/ui/Card';
import { useAuthContext } from '@/providers/AuthProviders';
import { apiClient } from '@/lib/api';
import toast from 'react-hot-toast';
import { withAuth } from '@/providers/withAuth';
import { VerifyActionModal } from '@/ui/VerifyActionModal';
import { PageHeader } from '@/layouts';
import { OtpModal } from '@/ui/OtpModal';
import { PasswordStrengthMeter } from '@/ui/PasswordStrengthMeter';
import { extractServerFieldErrors, getFirstServerFieldError, getServerErrorMessage } from '@/lib/serverValidation';
import type {
  AuthSecurityProfile,
  MFAMethod,
  SecurityOverview,
  TOTPSetupResponse,
} from '@/lib/types';

interface ProfileFormData {
  username: string;
  email: string;
}

interface PasswordFormData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

function formatMfaMethodLabel(method?: string | null): string {
  if (method === 'totp') return 'Authenticator app';
  return 'Email verification code';
}

function formatProviderLabel(provider?: string | null): string {
  if (!provider) return 'Not connected';

  const normalized = provider.replace(/[_-]+/g, ' ').trim();
  if (!normalized) return 'Not connected';

  return normalized.replace(/\b\w/g, (letter) => letter.toUpperCase());
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

  const deletePhrase = 'DELETE MY ACCOUNT';
  const clearDataPhrase = 'CLEAR ALL DATA';
  
  const [profileFormData, setProfileFormData] = useState<ProfileFormData>({
    username: '',
    email: '',
  });
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});

  const [passwordFormData, setPasswordFormData] = useState<PasswordFormData>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});
  const [securityProfile, setSecurityProfile] = useState<AuthSecurityProfile | null>(null);
  const [securityLoading, setSecurityLoading] = useState(false);
  const [mfaSaving, setMfaSaving] = useState(false);
  const [totpSetup, setTotpSetup] = useState<TOTPSetupResponse | null>(null);
  const [totpEnableCode, setTotpEnableCode] = useState('');
  const [totpDisableCode, setTotpDisableCode] = useState('');
  const [totpQrCodeDataUrl, setTotpQrCodeDataUrl] = useState('');
  const [securityOverview, setSecurityOverview] = useState<SecurityOverview | null>(null);

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

  const loadSecurityProfile = useCallback(async () => {
    if (!auth.user) return;

    try {
      setSecurityLoading(true);
      const [profile, overview] = await Promise.all([
        apiClient.getMFASecurityProfile(),
        apiClient.getSecurityOverview(),
      ]);
      setSecurityProfile(profile);
      setSecurityOverview(overview);
    } catch (error) {
      toast.error(getServerErrorMessage(error, 'Failed to load security settings'));
    } finally {
      setSecurityLoading(false);
    }
  }, [auth.user]);

  useEffect(() => {
    void loadSecurityProfile();
  }, [loadSecurityProfile]);

  useEffect(() => {
    let cancelled = false;

    async function generateQrCode() {
      if (!totpSetup?.otpauthUrl) {
        setTotpQrCodeDataUrl('');
        return;
      }

      try {
        const dataUrl = await QRCode.toDataURL(totpSetup.otpauthUrl, {
          width: 240,
          margin: 1,
          errorCorrectionLevel: 'M',
        });

        if (!cancelled) {
          setTotpQrCodeDataUrl(dataUrl);
        }
      } catch {
        if (!cancelled) {
          setTotpQrCodeDataUrl('');
        }
      }
    }

    void generateQrCode();

    return () => {
      cancelled = true;
    };
  }, [totpSetup]);

  const syncSecurityState = useCallback(
    async (profile: AuthSecurityProfile) => {
      setSecurityProfile(profile);
      await auth.checkAuth();
    },
    [auth]
  );

  const copySecurityValue = useCallback(async (value: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(successMessage);
    } catch {
      toast.error('Failed to copy value');
    }
  }, []);

  const handleBeginTotpSetup = async () => {
    try {
      setMfaSaving(true);
      const setup = await apiClient.beginTotpSetup();
      setTotpSetup(setup);
      setTotpEnableCode('');
      toast.success('Authenticator setup is ready.');
    } catch (error) {
      toast.error(getServerErrorMessage(error, 'Failed to start authenticator setup'));
    } finally {
      setMfaSaving(false);
    }
  };

  const handleEnableTotp = async () => {
    try {
      setMfaSaving(true);
      const profile = await apiClient.enableTotp(totpEnableCode.trim());
      await syncSecurityState(profile);
      setTotpSetup(null);
      setTotpQrCodeDataUrl('');
      setTotpEnableCode('');
      toast.success('Authenticator app enabled.');
    } catch (error) {
      toast.error(getServerErrorMessage(error, 'Failed to enable authenticator app'));
    } finally {
      setMfaSaving(false);
    }
  };

  const handleDisableTotp = async () => {
    try {
      setMfaSaving(true);
      const profile = await apiClient.disableTotp(totpDisableCode.trim());
      await syncSecurityState(profile);
      setTotpDisableCode('');
      setTotpSetup(null);
      setTotpQrCodeDataUrl('');
      toast.success('Authenticator app disabled.');
    } catch (error) {
      toast.error(getServerErrorMessage(error, 'Failed to disable authenticator app'));
    } finally {
      setMfaSaving(false);
    }
  };

  const handlePreferredMethodChange = async (method: MFAMethod) => {
    try {
      setMfaSaving(true);
      const profile = await apiClient.setPreferredMfaMethod(method);
      await syncSecurityState(profile);
      toast.success(`Sign-in verification updated to ${formatMfaMethodLabel(method).toLowerCase()}.`);
    } catch (error) {
      toast.error(getServerErrorMessage(error, 'Failed to update sign-in verification'));
    } finally {
      setMfaSaving(false);
    }
  };

  const handleProfileSubmit = (e: FormEvent) => {
    e.preventDefault();
    setProfileErrors({});
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
      setProfileErrors({});
    } catch (error) {
      const fieldErrors = extractServerFieldErrors(error);
      if (Object.keys(fieldErrors).length > 0) {
        const mappedErrors: Record<string, string> = {};
        if (fieldErrors.first_name) mappedErrors.username = fieldErrors.first_name;
        if (fieldErrors.email) mappedErrors.email = fieldErrors.email;
        setProfileErrors(Object.keys(mappedErrors).length > 0 ? mappedErrors : fieldErrors);
        toast.error(getFirstServerFieldError(fieldErrors) || 'Please review your profile details.');
        return;
      }
      const message = getServerErrorMessage(error, 'Failed to update profile');
      toast.error(message);
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordErrors({});
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
      setPasswordErrors({});
    } catch (error) {
      const fieldErrors = extractServerFieldErrors(error);
      if (Object.keys(fieldErrors).length > 0) {
        const mappedErrors: Record<string, string> = {};
        if (fieldErrors.current_password) mappedErrors.currentPassword = fieldErrors.current_password;
        if (fieldErrors.new_password) mappedErrors.newPassword = fieldErrors.new_password;
        if (fieldErrors.confirm_password) mappedErrors.confirmPassword = fieldErrors.confirm_password;
        setPasswordErrors(Object.keys(mappedErrors).length > 0 ? mappedErrors : fieldErrors);
        toast.error(getFirstServerFieldError(fieldErrors) || 'Please review your password details.');
        return;
      }
      const message = getServerErrorMessage(error, 'Failed to change password');
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
    if (profileErrors[e.target.name]) {
      setProfileErrors((prev) => {
        const next = { ...prev };
        delete next[e.target.name];
        return next;
      });
    }
  };

  const handlePasswordChange = (e: ChangeEvent<HTMLInputElement>) => {
    setPasswordFormData({
      ...passwordFormData,
      [e.target.name]: e.target.value,
    });
    if (passwordErrors[e.target.name]) {
      setPasswordErrors((prev) => {
        const next = { ...prev };
        delete next[e.target.name];
        return next;
      });
    }
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

  const preferredMethod = securityProfile?.preferredMfaMethod ?? auth.user?.preferred_mfa_method ?? 'email_otp';
  const totpEnabled = securityProfile?.totpEnabled ?? auth.user?.totp_enabled ?? false;

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
                    error={profileErrors.username}
                  />
                  
                  <Input
                    label="Email Address"
                    type="email"
                    name="email"
                    value={profileFormData.email}
                    onChange={handleProfileChange}
                    placeholder="Enter your email"
                    error={profileErrors.email}
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
              <div id="security" className="p-6 pb-0">
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">Security Score</p>
                    <p className="mt-1 text-xl font-semibold text-[var(--color-text-primary)]">{securityOverview?.securityScore ?? 0}%</p>
                  </div>
                  <div className="rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">Pending Admin Approvals</p>
                    <p className="mt-1 text-xl font-semibold text-[var(--color-text-primary)]">{securityOverview?.pendingAdminApprovals ?? 0}</p>
                  </div>
                  <div className="rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">Pending Queue</p>
                    <p className="mt-1 text-xl font-semibold text-[var(--color-text-primary)]">{securityOverview?.pendingApprovalRequests ?? 0}</p>
                  </div>
                  <div className="rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">TOTP Enabled Users</p>
                    <p className="mt-1 text-xl font-semibold text-[var(--color-text-primary)]">{securityOverview?.totpEnabledUsers ?? 0}</p>
                  </div>
                </div>
              </div>
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
                    error={passwordErrors.currentPassword}
                  />
                  
                  <Input
                    label="New Password"
                    type="password"
                    name="newPassword"
                    value={passwordFormData.newPassword}
                    onChange={handlePasswordChange}
                    placeholder="Enter new password (min. 6 characters)"
                    error={passwordErrors.newPassword}
                  />
                  <PasswordStrengthMeter password={passwordFormData.newPassword} />
                  
                  <Input
                    label="Confirm New Password"
                    type="password"
                    name="confirmPassword"
                    value={passwordFormData.confirmPassword}
                    onChange={handlePasswordChange}
                    placeholder="Confirm new password"
                    error={passwordErrors.confirmPassword}
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

            <Card>
              <div className="p-6 space-y-6">
                <div className="flex items-start gap-3">
                  <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-background-tertiary)] text-[var(--color-accent-primary)]">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Authentication Methods</h2>
                    <p className="text-xs text-[var(--color-text-tertiary)]">
                      Configure Google sign-in and your preferred multi-factor verification method.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-tertiary)]">Sign-in preference</p>
                    <p className="mt-2 text-sm font-semibold text-[var(--color-text-primary)]">
                      {formatMfaMethodLabel(preferredMethod)}
                    </p>
                    <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                      {totpEnabled
                        ? 'Use your authenticator app for the strongest sign-in protection.'
                        : 'Email verification remains active until the authenticator app is enabled.'}
                    </p>
                  </div>

                  <div className="rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-tertiary)]">Connected identity</p>
                    <p className="mt-2 text-sm font-semibold text-[var(--color-text-primary)]">
                      {formatProviderLabel(securityProfile?.federatedProvider ?? auth.user?.federated_provider)}
                    </p>
                    <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                      {securityProfile?.federatedProvider ?? auth.user?.federated_provider
                        ? 'This account can sign in through the linked provider when the email is approved.'
                        : 'No external identity provider is linked to this account yet.'}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[var(--color-text-primary)]">Preferred sign-in verification</p>
                      <p className="text-xs text-[var(--color-text-tertiary)]">
                        Choose how the second factor is completed after password or Google sign-in.
                      </p>
                    </div>
                    {securityLoading ? (
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-border-primary)] border-r-transparent" />
                    ) : null}
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      variant={preferredMethod === 'email_otp' ? 'primary' : 'outline'}
                      disabled={mfaSaving || securityLoading || preferredMethod === 'email_otp'}
                      onClick={() => handlePreferredMethodChange('email_otp')}
                    >
                      Email code
                    </Button>
                    <Button
                      variant={preferredMethod === 'totp' ? 'primary' : 'outline'}
                      disabled={mfaSaving || securityLoading || !totpEnabled || preferredMethod === 'totp'}
                      onClick={() => handlePreferredMethodChange('totp')}
                    >
                      Authenticator app
                    </Button>
                  </div>
                </div>

                <div className="space-y-4 rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-background-tertiary)] text-[var(--color-accent-primary)]">
                      <Smartphone className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--color-text-primary)]">Authenticator app</p>
                      <p className="text-xs text-[var(--color-text-tertiary)]">
                        Codes refresh every 30 seconds. If a code does not verify, confirm your phone time is set automatically.
                      </p>
                    </div>
                  </div>

                  {!totpEnabled ? (
                    <div className="space-y-4">
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Button onClick={handleBeginTotpSetup} loading={mfaSaving}>
                          Start setup
                        </Button>
                        {totpSetup ? (
                          <Button
                            variant="outline"
                            onClick={() => setTotpSetup(null)}
                            disabled={mfaSaving}
                          >
                            Cancel setup
                          </Button>
                        ) : null}
                      </div>

                      {totpSetup ? (
                        <div className="space-y-4 rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4">
                          <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start">
                            <div className="space-y-2">
                              <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-tertiary)]">Scan QR code</p>
                              <div className="flex min-h-[240px] items-center justify-center rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] bg-white p-3">
                                {totpQrCodeDataUrl ? (
                                  <Image
                                    src={totpQrCodeDataUrl}
                                    alt="Authenticator setup QR code"
                                    width={220}
                                    height={220}
                                    className="h-[220px] w-[220px]"
                                    unoptimized
                                  />
                                ) : (
                                  <p className="text-center text-xs text-[var(--color-text-tertiary)]">
                                    QR code preview is unavailable. Use the manual key or setup link below.
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="space-y-4">
                              <div className="grid gap-4 md:grid-cols-2">
                                <div>
                                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-tertiary)]">Issuer</p>
                                  <p className="mt-2 text-sm font-semibold text-[var(--color-text-primary)]">{totpSetup.issuer}</p>
                                </div>
                                <div>
                                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-tertiary)]">Account</p>
                                  <p className="mt-2 text-sm font-semibold text-[var(--color-text-primary)]">{totpSetup.accountName}</p>
                                </div>
                              </div>

                              <div>
                                <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-tertiary)]">Manual entry key</p>
                                <div className="mt-2 flex flex-col gap-3 rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                                  <code className="break-all text-sm font-semibold text-[var(--color-text-primary)]">
                                    {totpSetup.manualEntryKey}
                                  </code>
                                  <Button
                                    variant="outline"
                                    onClick={() => copySecurityValue(totpSetup.manualEntryKey, 'Manual entry key copied')}
                                  >
                                    <Copy className="mr-2 h-4 w-4" />
                                    Copy key
                                  </Button>
                                </div>
                              </div>

                              <div className="flex flex-wrap gap-3">
                                <Button
                                  variant="outline"
                                  onClick={() => copySecurityValue(totpSetup.otpauthUrl, 'Authenticator setup link copied')}
                                >
                                  <LinkIcon className="mr-2 h-4 w-4" />
                                  Copy setup link
                                </Button>
                                <a
                                  href={totpSetup.otpauthUrl}
                                  className="inline-flex items-center justify-center rounded-[var(--radius-button)] border border-[var(--color-border-primary)] px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] transition hover:bg-[var(--color-background-secondary)]"
                                >
                                  Open authenticator link
                                </a>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <Input
                              label="Verification code"
                              value={totpEnableCode}
                              onChange={(event) => setTotpEnableCode(event.target.value.replace(/\D+/g, '').slice(0, 6))}
                              inputMode="numeric"
                              placeholder="Enter the current 6-digit code"
                              helperText="Add the account in Google Authenticator, Authy, or Microsoft Authenticator, then enter the live code. Keep your phone time on automatic."
                            />
                            <Button
                              onClick={handleEnableTotp}
                              loading={mfaSaving}
                              disabled={mfaSaving || totpEnableCode.trim().length !== 6}
                            >
                              Enable authenticator app
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-[var(--color-text-secondary)]">
                          Start setup to generate a secure secret for your authenticator app. The same secret is then used to verify every code in this application.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="rounded-[var(--radius-button)] border border-emerald-200/60 bg-emerald-50/70 p-4">
                        <p className="text-sm font-semibold text-emerald-900">Authenticator app is enabled</p>
                        <p className="mt-1 text-xs text-emerald-800">
                          Sign-in can now be protected with codes generated from your registered authenticator app.
                        </p>
                      </div>

                      <Input
                        label="Disable authenticator app"
                        value={totpDisableCode}
                        onChange={(event) => setTotpDisableCode(event.target.value.replace(/\D+/g, '').slice(0, 6))}
                        inputMode="numeric"
                        placeholder="Enter the current 6-digit code"
                        helperText="Provide a valid authenticator code before removing TOTP from this account."
                      />

                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Button
                          variant="outline"
                          onClick={() => handlePreferredMethodChange('totp')}
                          disabled={mfaSaving || preferredMethod === 'totp'}
                        >
                          Use authenticator for sign-in
                        </Button>
                        <Button
                          variant="danger"
                          onClick={handleDisableTotp}
                          loading={mfaSaving}
                          disabled={mfaSaving || totpDisableCode.trim().length !== 6}
                        >
                          Disable authenticator app
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
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
      <VerifyActionModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteAccount}
        title="Delete Account"
        description="Are you sure you want to delete your account? This action is permanent and cannot be undone."
        confirmText="Delete Account"
        cancelText="Cancel"
        variant="danger"
        loading={deleteAccountLoading}
        verifyText={deletePhrase}
      >
        <div className="mt-4 p-3 bg-red-50 rounded-md">
          <ul className="text-xs text-red-700 list-disc pl-4 space-y-1">
            <li>All your personal data will be permanently deleted</li>
            <li>Your account will be removed from our database</li>
            <li>You will not be able to login with this account again</li>
            <li>This action cannot be reversed</li>
          </ul>
        </div>
      </VerifyActionModal>

      {/* Clear Data Confirmation Modal */}
      <VerifyActionModal
        isOpen={showClearDataModal}
        onClose={() => setShowClearDataModal(false)}
        onConfirm={handleClearData}
        title="Clear All Data"
        description="Are you sure you want to clear all your data? This includes your preferences, cache, and temporary data."
        confirmText="Clear Data"
        cancelText="Cancel"
        variant="warning"
        loading={clearDataLoading}
        verifyText={clearDataPhrase}
      >
        <div className="mt-4 p-3 bg-amber-50 rounded-md">
          <ul className="text-xs text-amber-700 list-disc pl-4 space-y-1">
            <li>Your app preferences will be reset to default</li>
            <li>Local cache and temporary files will be removed</li>
            <li>Your account information will remain intact</li>
            <li>You may need to reconfigure your settings</li>
          </ul>
        </div>
      </VerifyActionModal>
    </>
  );
}

export default withAuth(SettingsPage);
