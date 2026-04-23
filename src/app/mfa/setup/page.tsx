'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck,
  Smartphone,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/input';
import { useAuthContext } from '@/providers/AuthProviders';
import { Footer } from '@/components/Footer';
import { getServerErrorMessage } from '@/lib/serverValidation';
import type { AuthSecurityProfile, TOTPSetupResponse } from '@/lib/types';

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
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
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
      return typeof rawQrCode === 'string' && rawQrCode.startsWith('data:image')
        ? rawQrCode
        : undefined;
    })();

  const qrCodeSvg = extractString(record, 'qrCodeSvg', 'qr_code_svg');
  const secret = extractString(record, 'secret', 'totpSecret', 'totp_secret');
  const otpauthUrl = extractString(record, 'otpauthUrl', 'otpauth_url');

  return {
    qrCodeDataUrl,
    qrCodeSvg,
    secret,
    otpauthUrl,
  };
}

function isMfaEnabled(profile: AuthSecurityProfile | null): boolean {
  const record = asRecord(profile);
  if (!record) return false;

  if (
    record.enabled === true ||
    record.mfaEnabled === true ||
    record.totpEnabled === true
  ) {
    return true;
  }

  const methods = asRecord(record.methods);
  if (!methods) return false;

  const totp = asRecord(methods.totp);
  if (!totp) return false;

  return totp.enabled === true || totp.verified === true;
}

export default function MfaSetupPage() {
  const router = useRouter();

  const {
    accessStatus,
    isInitialized,
    bootstrapped,
    mfaProfile,
    beginTotpSetup,
    enableTotp,
    logout,
  } = useAuthContext();

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

  useEffect(() => {
    if (!isInitialized || !bootstrapped) return;

    if (accessStatus === 'login_required') {
      router.replace('/login');
      return;
    }

    if (accessStatus === 'ready') {
      router.replace('/dashboard');
    }
  }, [accessStatus, bootstrapped, isInitialized, router]);

  const alreadyEnabled = useMemo(() => isMfaEnabled(mfaProfile), [mfaProfile]);

  const generateSetup = async () => {
    setLoadingSetup(true);
    setSetupError('');
    setSuccessMessage('');

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

  const handleEnable = async (event: FormEvent) => {
    event.preventDefault();

    if (code.trim().length < 6) {
      setVerifyError('Enter the 6-digit code from your authenticator app.');
      return;
    }

    setSubmitting(true);
    setVerifyError('');
    setSuccessMessage('');

    try {
      await enableTotp(code.trim());
      setSuccessMessage('MFA enabled successfully. Redirecting to dashboard...');

      window.setTimeout(() => {
        router.replace('/dashboard');
      }, 900);
    } catch (error) {
      setVerifyError(getServerErrorMessage(error, 'Failed to verify MFA code.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!isInitialized || !bootstrapped || accessStatus === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-background-primary)]">
        <div className="flex items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-lg text-muted-foreground">Preparing MFA setup...</p>
        </div>
      </div>
    );
  }

  if (accessStatus === 'login_required' || accessStatus === 'ready') {
    return null;
  }

  return (
    <div className="min-h-screen bg-[var(--color-background-primary)]">
      <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 pb-12 pt-10 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
        <section className="auth-glass rounded-3xl p-8 sm:p-10">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-background-tertiary)] text-[var(--color-accent-primary)]">
            <ShieldCheck className="h-6 w-6" />
          </div>

          <p className="mt-6 text-xs uppercase tracking-[0.3em] text-[var(--color-text-tertiary)]">
            Multi-factor authentication
          </p>

          <h1 className="mt-3 text-3xl font-semibold text-[var(--color-text-primary)] sm:text-4xl">
            Secure your admin account
          </h1>

          <p className="mt-4 max-w-xl text-sm text-[var(--color-text-secondary)] sm:text-base">
            Your account is signed in, but admin access requires authenticator-based MFA before the
            dashboard can be used.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-tertiary)]">
                Step 1
              </p>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                Generate a QR code or copy the secret into Google Authenticator, Microsoft
                Authenticator, 1Password, or Authy.
              </p>
            </div>

            <div className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-tertiary)]">
                Step 2
              </p>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                Enter the current 6-digit code from your authenticator app to activate MFA.
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button onClick={generateSetup} loading={loadingSetup} disabled={loadingSetup}>
              {loadingSetup ? 'Generating setup...' : 'Generate MFA setup'}
              {!loadingSetup && <ArrowRight className="ml-2 h-4 w-4" />}
            </Button>

            <Button
              variant="outline"
              onClick={() => {
                void logout();
              }}
            >
              Sign out
            </Button>
          </div>

          {setupError ? (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 text-red-600" />
                <p className="text-sm text-red-700">{setupError}</p>
              </div>
            </div>
          ) : null}

          {alreadyEnabled ? (
            <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
                <p className="text-sm text-emerald-700">
                  MFA already appears to be enabled for this account. If you still cannot access the
                  dashboard, refresh or sign out and sign in again.
                </p>
              </div>
            </div>
          ) : null}
        </section>

        <Card className="auth-glass rounded-3xl p-8">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-background-tertiary)]">
              <Smartphone className="h-7 w-7 text-[var(--color-accent-primary)]" />
            </div>
            <h2 className="text-2xl font-semibold text-[var(--color-text-primary)]">
              Authenticator setup
            </h2>
            <p className="mt-2 text-sm text-[var(--color-text-tertiary)]">
              Scan the QR code or use the secret manually.
            </p>
          </div>

          {qrCodeDataUrl || qrCodeSvg || secret || otpauthUrl ? (
            <div className="mt-6 space-y-5">
              {qrCodeDataUrl ? (
                <div className="flex justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrCodeDataUrl}
                    alt="MFA QR code"
                    className="rounded-2xl bg-white p-3 shadow-md"
                  />
                </div>
              ) : null}

              {!qrCodeDataUrl && qrCodeSvg ? (
                <div
                  className="mx-auto flex max-w-[260px] justify-center rounded-2xl bg-white p-3 shadow-md"
                  dangerouslySetInnerHTML={{ __html: qrCodeSvg }}
                />
              ) : null}

              {secret ? (
                <div className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-tertiary)]">
                    Secret key
                  </p>
                  <code className="mt-2 block break-all text-sm text-[var(--color-text-primary)]">
                    {secret}
                  </code>
                </div>
              ) : null}

              {otpauthUrl ? (
                <div className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-tertiary)]">
                    OTP Auth URL
                  </p>
                  <code className="mt-2 block break-all text-xs text-[var(--color-text-primary)]">
                    {otpauthUrl}
                  </code>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-dashed border-[var(--color-border-secondary)] p-6 text-center">
              <p className="text-sm text-[var(--color-text-tertiary)]">
                Generate setup to display your QR code and TOTP secret.
              </p>
            </div>
          )}

          <form onSubmit={handleEnable} className="mt-6 space-y-4">
            <Input
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

            {verifyError ? (
              <div className="rounded-[var(--radius-button)] border border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-700">{verifyError}</p>
              </div>
            ) : null}

            {successMessage ? (
              <div className="rounded-[var(--radius-button)] border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-sm text-emerald-700">{successMessage}</p>
              </div>
            ) : null}

            <Button type="submit" className="w-full" loading={submitting} disabled={submitting}>
              Enable MFA
            </Button>
          </form>
        </Card>
      </main>

      <Footer />
    </div>
  );
}