import nodemailer from 'nodemailer';
import { NextRequest, NextResponse } from 'next/server';

import { renderTemplateVariables } from '@/lib/formEmailTemplates';
import { extractFormCampaignRecipients } from '@/lib/formSubmissions';
import type { AdminForm, ApiResponse, FormSubmission, SimplePaginatedResponse, User } from '@/lib/types';
import type { SendFormCampaignRequest, SendFormCampaignResult } from '@/lib/formCampaigns';

const RAW_API_ORIGIN =
  process.env.API_PROXY_ORIGIN ??
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.NEXT_PUBLIC_BACKEND_URL ??
  process.env.APP_PUBLIC_URL ??
  (process.env.API_DOMAIN ? `https://${process.env.API_DOMAIN}` : undefined);

type RouteContext = {
  params:
    | {
        id?: string;
      }
    | Promise<{
        id?: string;
      }>;
};

type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
};

function normalizeOrigin(raw?: string | null): string {
  if (!raw || !raw.trim()) {
    throw new Error('[campaign send] Missing API origin. Set API_PROXY_ORIGIN or NEXT_PUBLIC_API_URL.');
  }

  let base = raw.trim().replace(/\/+$/, '');
  if (base.endsWith('/api/v1')) base = base.slice(0, -'/api/v1'.length);
  return base;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hasDataProperty(value: unknown): value is { data?: unknown } {
  return isRecord(value) && Object.prototype.hasOwnProperty.call(value, 'data');
}

function getPayloadMessage(payload: unknown, fallback: string) {
  if (!isRecord(payload)) return fallback;
  const candidate = payload.message ?? payload.error;
  return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : fallback;
}

function getBackendHeaders(request: NextRequest) {
  const headers = new Headers({
    Accept: 'application/json',
  });

  const cookie = request.headers.get('cookie');
  if (cookie) headers.set('cookie', cookie);

  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) headers.set('x-forwarded-for', forwardedFor);

  const forwardedHost = request.headers.get('host');
  if (forwardedHost) headers.set('x-forwarded-host', forwardedHost);

  headers.set('x-forwarded-proto', request.nextUrl.protocol.replace(':', '') || 'https');
  return headers;
}

async function backendFetch<T>(request: NextRequest, path: string, init?: RequestInit): Promise<T> {
  const origin = normalizeOrigin(RAW_API_ORIGIN);
  const response = await fetch(`${origin}/api/v1${path}`, {
    ...init,
    headers: {
      ...Object.fromEntries(getBackendHeaders(request).entries()),
      ...(init?.headers ? Object.fromEntries(new Headers(init.headers).entries()) : {}),
    },
    cache: 'no-store',
  });

  const payload = (await response.json().catch(() => null)) as T | ApiResponse<T> | null;

  if (!response.ok) {
    throw new Error(getPayloadMessage(payload, 'Backend request failed.'));
  }

  if (hasDataProperty(payload)) {
    return (payload.data ?? null) as T;
  }

  return payload as T;
}

async function requireAdmin(request: NextRequest) {
  const user = await backendFetch<User>(request, '/auth/me', { method: 'GET' });
  if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
    throw new Error('You are not authorized to send campaigns.');
  }
  return user;
}

async function fetchAllFormSubmissions(request: NextRequest, formId: string) {
  const submissions: FormSubmission[] = [];
  let page = 1;
  const limit = 100;

  while (true) {
    const payload = await backendFetch<SimplePaginatedResponse<FormSubmission>>(
      request,
      `/admin/forms/${encodeURIComponent(formId)}/submissions?page=${page}&limit=${limit}`,
      { method: 'GET' }
    );

    submissions.push(...(payload.data || []));

    const total = Number(payload.total || 0);
    if (submissions.length >= total || (payload.data || []).length < limit) {
      break;
    }

    page += 1;
  }

  return submissions;
}

function resolveSmtpConfig(): SmtpConfig {
  const host = (process.env.SMTP_HOST || process.env.APP_SMTP_HOST || '').trim();
  const portRaw = (process.env.SMTP_PORT || process.env.APP_SMTP_PORT || '25').trim();
  const user = (process.env.SMTP_USER || process.env.APP_SMTP_USER || '').trim();
  const pass = (process.env.SMTP_PASS || process.env.APP_SMTP_PASS || '').trim();
  const secureFlag = (process.env.SMTP_TLS || process.env.APP_SMTP_TLS || '').trim().toLowerCase();
  const fromEmail = (process.env.APP_SMTP_FROM_EMAIL || '').trim();
  const fromName = (process.env.APP_SMTP_FROM_NAME || '').trim();
  const from =
    (process.env.SMTP_FROM || '').trim() ||
    (fromEmail ? (fromName ? `${fromName} <${fromEmail}>` : fromEmail) : '') ||
    (process.env.APP_SUPPORT_EMAIL || '').trim() ||
    user;

  const port = Number(portRaw);
  const secure = secureFlag === 'true' || secureFlag === '1' || port === 465;

  if (!host) {
    throw new Error('SMTP is not configured. Set SMTP_HOST or APP_SMTP_HOST before sending campaigns.');
  }
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error('SMTP port is invalid.');
  }
  if (!from) {
    throw new Error('SMTP from address is not configured.');
  }

  return {
    host,
    port,
    secure,
    user: user || undefined,
    pass: pass || undefined,
    from,
  };
}

function buildUnsubscribeUrl(request: NextRequest, email: string) {
  const publicOrigin =
    (process.env.NEXT_PUBLIC_PUBLIC_URL || process.env.APP_PUBLIC_URL || request.nextUrl.origin).replace(/\/+$/, '');
  return `${publicOrigin}/api/v1/notifications/unsubscribe?email=${encodeURIComponent(email)}`;
}

function validatePayload(payload: unknown): payload is SendFormCampaignRequest {
  if (!isRecord(payload)) return false;
  return (
    typeof payload.subject === 'string' &&
    payload.subject.trim().length > 0 &&
    typeof payload.title === 'string' &&
    payload.title.trim().length > 0 &&
    typeof payload.htmlBody === 'string' &&
    payload.htmlBody.trim().length > 0 &&
    typeof payload.textBody === 'string' &&
    payload.textBody.trim().length > 0
  );
}

async function sendCampaignEmails(
  transporter: nodemailer.Transporter,
  smtpConfig: SmtpConfig,
  request: NextRequest,
  form: AdminForm,
  recipients: ReturnType<typeof extractFormCampaignRecipients>,
  payload: SendFormCampaignRequest
) {
  let sent = 0;
  let failed = 0;
  const failedRecipients: string[] = [];
  let index = 0;
  const concurrency = Math.min(4, recipients.length);

  const worker = async () => {
    while (index < recipients.length) {
      const current = recipients[index];
      index += 1;

      const unsubscribeUrl = buildUnsubscribeUrl(request, current.email);
      const variables = {
        RecipientName: current.name,
        RegistrationCode: current.registrationCode || '',
        SubscribeURL: '',
        UnsubscribeURL: unsubscribeUrl,
        CalendarOptInURL: '',
      } as const;

      try {
        await transporter.sendMail({
          from: smtpConfig.from,
          to: current.email,
          subject: payload.subject.trim(),
          html: renderTemplateVariables(payload.htmlBody, variables),
          text: renderTemplateVariables(payload.textBody, variables),
          headers: {
            'X-Form-ID': form.id,
            'X-Form-Title': form.title || '',
            'X-Campaign-Title': payload.title.trim(),
          },
        });
        sent += 1;
      } catch {
        failed += 1;
        failedRecipients.push(current.email);
      }
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return { sent, failed, failedRecipients };
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const params = await context.params;
    const formId = params.id?.trim();
    if (!formId) {
      return NextResponse.json({ message: 'Form id is required.' }, { status: 400 });
    }

    await requireAdmin(request);

    const payload = (await request.json().catch(() => null)) as unknown;
    if (!validatePayload(payload)) {
      return NextResponse.json({ message: 'Subject, title, HTML body, and text body are required.' }, { status: 400 });
    }

    const form = await backendFetch<AdminForm>(request, `/admin/forms/${encodeURIComponent(formId)}`, {
      method: 'GET',
    });
    const submissions = await fetchAllFormSubmissions(request, formId);
    const recipients = extractFormCampaignRecipients(submissions);

    if (recipients.length === 0) {
      return NextResponse.json({ message: 'No valid registrant email addresses were found for this form.' }, { status: 400 });
    }

    const smtpConfig = resolveSmtpConfig();
    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      auth: smtpConfig.user && smtpConfig.pass ? { user: smtpConfig.user, pass: smtpConfig.pass } : undefined,
    });

    await transporter.verify();

    const startedAt = new Date().toISOString();
    const outcome = await sendCampaignEmails(transporter, smtpConfig, request, form, recipients, payload);
    const completedAt = new Date().toISOString();

    const result: SendFormCampaignResult = {
      formId,
      subject: payload.subject.trim(),
      totalRecipients: recipients.length,
      sent: outcome.sent,
      failed: outcome.failed,
      failedRecipients: outcome.failedRecipients.slice(0, 25),
      startedAt,
      completedAt,
    };

    return NextResponse.json({ data: result, message: 'Campaign processed.' }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send campaign.';
    const status = /authorized/i.test(message) ? 403 : /unauth|login|session/i.test(message) ? 401 : 500;
    return NextResponse.json({ message }, { status });
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
