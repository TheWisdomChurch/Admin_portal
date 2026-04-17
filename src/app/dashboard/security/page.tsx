'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Lock, RefreshCw, Shield, UserCheck, Users } from 'lucide-react';
import toast from 'react-hot-toast';

import { PageHeader } from '@/layouts';
import { apiClient } from '@/lib/api';
import type { AuthSecurityProfile, SecurityOverview } from '@/lib/types';
import { withAuth } from '@/providers/withAuth';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';

function scoreTone(score: number): 'strong' | 'medium' | 'weak' {
  if (score >= 75) return 'strong';
  if (score >= 45) return 'medium';
  return 'weak';
}

function SecurityPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [overview, setOverview] = useState<SecurityOverview | null>(null);
  const [profile, setProfile] = useState<AuthSecurityProfile | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const [overviewRes, profileRes] = await Promise.all([
        apiClient.getSecurityOverview(),
        apiClient.getMFASecurityProfile(),
      ]);

      setOverview(overviewRes);
      setProfile(profileRes);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load security posture';
      toast.error(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const securityScore = overview?.securityScore ?? 0;
  const tone = useMemo(() => scoreTone(securityScore), [securityScore]);

  const scoreClass =
    tone === 'strong'
      ? 'text-emerald-500'
      : tone === 'medium'
        ? 'text-amber-500'
        : 'text-rose-500';

  const statusText =
    tone === 'strong'
      ? 'Security posture is healthy.'
      : tone === 'medium'
        ? 'Security posture is fair. Hardening recommended.'
        : 'Security posture is weak. Action required.';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <PageHeader
          title="Security Control Center"
          subtitle="Monitor access posture, admin approvals, and authentication readiness from one place."
        />
        <Button variant="outline" onClick={() => void load(true)} disabled={refreshing}>
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Card>
        <div className="p-6">
          {loading ? (
            <p className="text-sm text-[var(--color-text-tertiary)]">Loading security posture...</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">Security score</p>
                <p className={`mt-2 text-3xl font-semibold ${scoreClass}`}>{securityScore}%</p>
                <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">{statusText}</p>
              </div>

              <div className="rounded-xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">Pending admin approvals</p>
                <p className="mt-2 text-3xl font-semibold text-[var(--color-text-primary)]">{overview?.pendingAdminApprovals ?? 0}</p>
                <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">Accounts waiting for super-admin approval</p>
              </div>

              <div className="rounded-xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">Approval queue</p>
                <p className="mt-2 text-3xl font-semibold text-[var(--color-text-primary)]">{overview?.pendingApprovalRequests ?? 0}</p>
                <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">Operational requests pending review</p>
              </div>

              <div className="rounded-xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">TOTP-enabled users</p>
                <p className="mt-2 text-3xl font-semibold text-[var(--color-text-primary)]">{overview?.totpEnabledUsers ?? 0}</p>
                <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">Users protected by authenticator app</p>
              </div>
            </div>
          )}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-[var(--color-accent-primary)]" />
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Access posture</h2>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between rounded-lg border border-[var(--color-border-secondary)] p-3">
                <span className="text-[var(--color-text-tertiary)]">Total users</span>
                <strong className="text-[var(--color-text-primary)]">{overview?.totalUsers ?? 0}</strong>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-[var(--color-border-secondary)] p-3">
                <span className="text-[var(--color-text-tertiary)]">Active users</span>
                <strong className="text-[var(--color-text-primary)]">{overview?.activeUsers ?? 0}</strong>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-[var(--color-border-secondary)] p-3">
                <span className="text-[var(--color-text-tertiary)]">Admin users</span>
                <strong className="text-[var(--color-text-primary)]">{overview?.adminUsers ?? 0}</strong>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-[var(--color-border-secondary)] p-3">
                <span className="text-[var(--color-text-tertiary)]">Preferred MFA method</span>
                <strong className="text-[var(--color-text-primary)]">
                  {profile?.preferredMfaMethod === 'totp' ? 'Authenticator app' : 'Email OTP'}
                </strong>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Lock className="h-5 w-5 text-[var(--color-accent-primary)]" />
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Priority actions</h2>
            </div>

            <div className="space-y-3">
              <div className="rounded-lg border border-[var(--color-border-secondary)] p-3">
                <p className="text-sm font-medium text-[var(--color-text-primary)] flex items-center gap-2">
                  {(overview?.pendingAdminApprovals ?? 0) > 0 ? (
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  )}
                  Admin account approvals
                </p>
                <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                  Super admin should approve pending admin accounts before activation.
                </p>
              </div>

              <div className="rounded-lg border border-[var(--color-border-secondary)] p-3">
                <p className="text-sm font-medium text-[var(--color-text-primary)] flex items-center gap-2">
                  {(overview?.pendingApprovalRequests ?? 0) > 0 ? (
                    <Users className="h-4 w-4 text-amber-500" />
                  ) : (
                    <UserCheck className="h-4 w-4 text-emerald-500" />
                  )}
                  Request queue governance
                </p>
                <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                  Keep testimonies, workforce, and leadership requests reviewed and approved promptly.
                </p>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 pt-2">
              <Link href="/dashboard/settings" className="rounded-lg border border-[var(--color-border-secondary)] px-3 py-2 text-sm text-center hover:bg-[var(--color-background-secondary)] transition-colors">
                Open MFA settings
              </Link>
              <Link href="/dashboard/super/requests" className="rounded-lg border border-[var(--color-border-secondary)] px-3 py-2 text-sm text-center hover:bg-[var(--color-background-secondary)] transition-colors">
                Open approval queue
              </Link>
              <Link href="/dashboard/notifications" className="rounded-lg border border-[var(--color-border-secondary)] px-3 py-2 text-sm text-center hover:bg-[var(--color-background-secondary)] transition-colors">
                View notifications
              </Link>
              <Link href="/dashboard/administration" className="rounded-lg border border-[var(--color-border-secondary)] px-3 py-2 text-sm text-center hover:bg-[var(--color-background-secondary)] transition-colors">
                Manage admins
              </Link>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

// Fixed: pass options object instead of array
export default withAuth(SecurityPage, { requiredRole: 'admin' });