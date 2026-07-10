// src/app/(auth)/mfa/setup/page.tsx
'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import QRCode from 'qrcode';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowRight, CheckCircle2, Copy, KeyRound, Loader2, ShieldCheck, Smartphone } from 'lucide-react';

import { Footer } from '@/components/Footer';
import { getServerErrorMessage } from '@/lib/serverValidation';
import type { AuthSecurityProfile, TOTPSetupResponse } from '@/lib/types';
import { useAuthContext } from '@/providers/AuthProviders';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Input } from '@/ui/Input';

type LooseRecord = Record<string, unknown>;

function isRecord(value: unknown): value is LooseRecord {
  return typeof value === 'object' && value !== null;
}

function asRecord(value: unknown): LooseRecord | null {
  return isRecord(value) ? value : null;
}

function extractString(record: LooseRecord, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function extractSetupValues(payload: TOTPSetupResponse | unknown): {
  qrCodeDataUrl?: string;
  qrCodeSvg?: string;
  secret?: string;
  otpauthUrl?: string;
} {
  const record = asRecord(payload);
  if (!record) return {};

  const qrCodeDataUrl =
    extractString(record, 'qrCodeDataUrl', 'qr_code_data_url') ??
    (() => {
      const rawQrCode = record.qrCode;
      return typeof rawQrCode === 'string' && rawQrCode.startsWith('data:image') ? rawQrCode : undefined;
    })();

  return {
    qrCodeDataUrl,
    qrCodeSvg: extractString(record, 'qrCodeSvg', 'qr_code_svg'),
    secret: extractString(record, 'secret', 'totpSecret', 'totp_secret', 'manualEntryKey', 'manual_entry_key'),
    otpauthUrl: extractString(record, 'otpauthUrl', 'otpauth_url'),
  };
}

function isMfaEnabled(profile: AuthSecurityProfile | null): boolean {
  const record = asRecord(profile);
  if (!record) return false;
  if (record.enabled === true || record.mfaEnabled === true || record.totpEnabled === true) return true;
  const methods = asRecord(record.methods);
  const totp = methods ? asRecord(methods.totp) : null;
  return Boolean(totp && (totp.enabled === true || totp.verified === true));
}

function InfoStep({ index, title, body }: { index: number; title: string; body: string }) {
  return (
    <div className="rounded-3xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-accent-primary)] text-sm font-black text-[var(--color-text-onprimary)]">
          {index}
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-black text-[var(--color-text-primary)]">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">{body}</p>
        </div>
      </div>
    </div>
  );
}

function Notice({ type, children }: { type: 'error' | 'success' | 'warning'; children: React.ReactNode }) {
  const styles = {
    error: 'border-[var(--color-danger-border)] bg-[var(--color-danger-surface)] text-[var(--color-danger-text)]',
    success: 'border-[var(--color-success-border)] bg-[var(--color-success-surface)] text-[var(--color-success-text)]',
    warning: 'border-[var(--color-warning-border)] bg-[var(--color-warning-surface)] text-[var(--color-warning-text)]',
  }[type];
  const Icon = type === 'success' ? CheckCircle2 : AlertTriangle;
  return (
    <div className={`rounded-2xl border p-4 ${styles}`}>
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0" />
        <p className="text-sm leading-6">{children}</p>
      </div>
    </div>
  );
}

export default function MfaSetupPage() {
  const router = useRouter();
  const { accessStatus, isInitialized, bootstrapped, mfaProfile, beginTotpSetup, enableTotp, logout } = useAuthContext();

  const [loadingSetup, setLoadingSetup] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [setupError, setSetupError] = useState('');
  const [verifyError, setVerifyError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [code, setCode] = useState('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [qrCodeSvg, setQrCodeSvg] = useState('');
  const [secret, setSecret] = useState('');
  const [otpauthUrl, setOtpauthUrl] = useState('');
  const [qrBuildError, setQrBuildError] = useState('');
  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isInitialized || !bootstrapped) return;
    if (accessStatus === 'login_required') {
      router.replace('/login');
      return;
    }
    if (accessStatus === 'ready') router.replace('/dashboard');
  }, [accessStatus, bootstrapped, isInitialized, router]);

  const alreadyEnabled = useMemo(() => isMfaEnabled(mfaProfile), [mfaProfile]);

  useEffect(() => {
    let cancelled = false;
    const renderQrFromOtpAuthUrl = async () => {
      if (qrCodeDataUrl || qrCodeSvg || !otpauthUrl) return;
      setQrBuildError('');
      try {
        const dataUrl = await QRCode.toDataURL(otpauthUrl, { width: 320, margin: 1, errorCorrectionLevel: 'M' });
        if (!cancelled) setQrCodeDataUrl(dataUrl);
      } catch {
        if (!cancelled) setQrBuildError('Unable to render QR automatically. Use the secret key below for manual setup.');
      }
    };
    void renderQrFromOtpAuthUrl();
    return () => {
      cancelled = true;
    };
  }, [otpauthUrl, qrCodeDataUrl, qrCodeSvg]);

  const generateSetup = async () => {
    setLoadingSetup(true);
    setSetupError('');
    setSuccessMessage('');
    setQrBuildError('');
    try {
      const payload = await beginTotpSetup();
      const extracted = extractSetupValues(payload);
      setQrCodeDataUrl(extracted.qrCodeDataUrl ?? '');
      setQrCodeSvg(extracted.qrCodeSvg ?? '');
      setSecret(extracted.secret ?? '');
      setOtpauthUrl(extracted.otpauthUrl ?? '');
    } catch (error) {
      setSetupError(getServerErrorMessage(error, 'Failed to generate MFA setup.'));
    } finally {
      setLoadingSetup(false);
    }
  };

  const copySecret = async () => {
    if (!secret) return;
    await navigator.clipboard.writeText(secret);
    setSuccessMessage('Secret key copied.');
    window.setTimeout(() => setSuccessMessage(''), 1800);
  };

  const handleEnable = async (event: FormEvent) => {
    event.preventDefault();
    const normalizedCode = code.replace(/\D/g, '').slice(0, 6);
    if (normalizedCode.length !== 6) {
      setVerifyError('Enter the 6-digit code from your authenticator app.');
      return;
    }
    setSubmitting(true);
    setVerifyError('');
    setSuccessMessage('');
    try {
      await enableTotp(normalizedCode);
      setSuccessMessage('MFA enabled successfully. Redirecting to dashboard...');
      window.setTimeout(() => router.replace('/dashboard'), 900);
    } catch (error) {
      setVerifyError(getServerErrorMessage(error, 'Failed to verify MFA code.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!isInitialized || !bootstrapped || accessStatus === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-background-primary)]">
        <div className="rounded-3xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-8 text-center shadow-sm">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-[var(--color-accent-primary)]" />
          <p className="mt-4 text-sm font-bold text-[var(--color-text-secondary)]">Preparing MFA setup...</p>
        </div>
      </div>
    );
  }

  if (accessStatus === 'login_required' || accessStatus === 'ready') return null;

  const hasSetup = Boolean(qrCodeDataUrl || qrCodeSvg || secret || otpauthUrl);

  useEffect(() => {
    if (hasSetup) codeInputRef.current?.focus();
  }, [hasSetup]);

  return (
    <div className="min-h-screen bg-[var(--color-background-primary)]">
      <main className="mx-auto grid w-full max-w-7xl gap-6 px-4 pb-12 pt-10 sm:px-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)] lg:px-8">
        <section className="overflow-hidden rounded-3xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] shadow-sm">
          <div className="bg-[var(--color-text-primary)] p-8 text-[var(--color-text-inverse)] sm:p-10">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-text-inverse)]/10 text-[var(--color-accent-primary)]">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <p className="mt-7 text-xs font-black uppercase tracking-[0.3em] text-[var(--color-text-inverse)]/50">Multi-factor authentication</p>
            <h1 className="mt-3 max-w-2xl text-3xl font-black tracking-tight sm:text-5xl">Secure your admin account before entering the dashboard.</h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-[var(--color-text-inverse)]/70 sm:text-base">Your account is signed in, but admin access requires authenticator-based MFA. This protects church records, members, and operational data.</p>
          </div>

          <div className="grid gap-4 p-6 sm:grid-cols-2 sm:p-8">
            <InfoStep index={1} title="Generate setup" body="Create a fresh QR code and secret key for your authenticator app." />
            <InfoStep index={2} title="Verify code" body="Enter the current 6-digit code to activate MFA and continue." />
          </div>

          <div className="flex flex-wrap gap-3 border-t border-[var(--color-border-secondary)] p-6 sm:p-8">
            <Button onClick={generateSetup} loading={loadingSetup} disabled={loadingSetup}>
              {loadingSetup ? 'Generating setup...' : hasSetup ? 'Regenerate setup' : 'Generate MFA setup'}
              {!loadingSetup ? <ArrowRight className="ml-2 h-4 w-4" /> : null}
            </Button>
            <Button variant="outline" onClick={() => void logout()}>Sign out</Button>
          </div>

          <div className="space-y-3 px-6 pb-6 sm:px-8 sm:pb-8">
            {setupError ? <Notice type="error">{setupError}</Notice> : null}
            {alreadyEnabled ? <Notice type="success">MFA already appears to be enabled. If access still fails, refresh or sign out and sign in again.</Notice> : null}
            {successMessage ? <Notice type="success">{successMessage}</Notice> : null}
          </div>
        </section>

        <Card className="auth-glass rounded-3xl p-6 shadow-sm sm:p-8">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-background-tertiary)]">
              <Smartphone className="h-7 w-7 text-[var(--color-accent-primary)]" />
            </div>
            <h2 className="text-2xl font-black text-[var(--color-text-primary)]">Authenticator setup</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--color-text-tertiary)]">Scan the QR code. If scanning fails, copy the secret key into your authenticator app manually.</p>
          </div>

          <div className="mt-6 min-h-[300px] rounded-3xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-5">
            {hasSetup ? (
              <div className="space-y-5">
                {qrCodeDataUrl ? (
                  <div className="flex justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrCodeDataUrl} alt="MFA QR code" className="max-w-full rounded-3xl bg-white p-4 shadow-sm" />
                  </div>
                ) : null}
                {!qrCodeDataUrl && qrCodeSvg ? <div className="mx-auto flex max-w-[320px] justify-center rounded-3xl bg-white p-4 shadow-sm" dangerouslySetInnerHTML={{ __html: qrCodeSvg }} /> : null}
                {qrBuildError ? <Notice type="warning">{qrBuildError}</Notice> : null}
                {secret ? (
                  <div className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-[var(--color-text-tertiary)]"><KeyRound className="h-4 w-4" /> Secret key</p>
                        <code className="mt-3 block break-all text-sm font-bold text-[var(--color-text-primary)]">{secret}</code>
                      </div>
                      <Button size="sm" variant="outline" icon={<Copy className="h-4 w-4" />} onClick={() => void copySecret()}>Copy</Button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="flex h-full min-h-[260px] items-center justify-center text-center">
                <div>
                  <Smartphone className="mx-auto h-10 w-10 text-[var(--color-text-tertiary)]" />
                  <p className="mt-4 text-sm font-bold text-[var(--color-text-secondary)]">Generate setup to display your QR code and TOTP secret.</p>
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleEnable} className="mt-6 space-y-4">
            <Input
              ref={codeInputRef}
              label="Authenticator code"
              type="text"
              inputMode="numeric"
              placeholder="Enter 6-digit code"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                setVerifyError('');
              }}
              disabled={submitting}
            />
            {verifyError ? <Notice type="error">{verifyError}</Notice> : null}
            <Button type="submit" className="w-full" loading={submitting} disabled={submitting || !hasSetup}>Enable MFA</Button>
          </form>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
