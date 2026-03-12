export const MAX_EMAIL_IMAGE_MB = 5;
export const MAX_EMAIL_IMAGE_BYTES = MAX_EMAIL_IMAGE_MB * 1024 * 1024;
export const ACCEPTED_EMAIL_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const META_PREFIX = '<!--WH_FORM_TEMPLATE_META:';
const META_SUFFIX = '-->';

export type StoredFormEmailTemplateMeta = {
  heading?: string;
  message?: string;
  logoUrl?: string;
  imageUrl?: string;
  customHtml?: string;
  ctaLabel?: string;
  ctaUrl?: string;
};

export function normalizeTemplateSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
}

export function escapeTemplateHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function stripTemplateMeta(html: string) {
  return html.replace(/<!--WH_FORM_TEMPLATE_META:[\s\S]*?-->\s*/g, '');
}

export function embedTemplateMeta(html: string, meta: StoredFormEmailTemplateMeta) {
  const payload = encodeURIComponent(JSON.stringify(meta));
  return `${META_PREFIX}${payload}${META_SUFFIX}\n${stripTemplateMeta(html)}`;
}

export function parseTemplateMeta(html: string): StoredFormEmailTemplateMeta | null {
  const match = html.match(/<!--WH_FORM_TEMPLATE_META:([\s\S]*?)-->/);
  if (!match?.[1]) return null;
  try {
    const decoded = decodeURIComponent(match[1]);
    const parsed = JSON.parse(decoded) as StoredFormEmailTemplateMeta;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function normalizeAbsoluteHttpUrl(rawValue: string): string {
  const raw = rawValue.trim();
  if (!raw) return '';

  let candidate = raw;
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  try {
    const parsed = new URL(candidate);
    if ((parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.host) {
      return parsed.toString();
    }
  } catch {
    return '';
  }

  return '';
}

export function toEmailPreview(html: string) {
  return html
    .replace(/{{if [^}]+}}/g, '')
    .replace(/{{end}}/g, '')
    .replace(/{{\.RecipientName}}/g, 'John Doe')
    .replace(/{{\.RegistrationCode}}/g, 'WHC-WPC-26-000001')
    .replace(/{{\.SubscribeURL}}/g, '#')
    .replace(/{{\.UnsubscribeURL}}/g, '#')
    .replace(/{{\.CalendarOptInURL}}/g, '#');
}

export function buildFormEmailHTML(opts: {
  title: string;
  heading: string;
  message: string;
  logoUrl?: string;
  imageUrl?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  includeRegistrationCode?: boolean;
  includeCalendarOptIn?: boolean;
  greeting?: string;
}) {
  const safeTitle = escapeTemplateHtml(opts.title || 'Registration');
  const safeHeading = escapeTemplateHtml(opts.heading || 'Registration Confirmed');
  const safeMessage = escapeTemplateHtml(opts.message || 'Thank you for registering.');
  const safeGreeting = escapeTemplateHtml(opts.greeting || 'Hello {{.RecipientName}},');
  const safeLogoUrl = opts.logoUrl ? escapeTemplateHtml(opts.logoUrl) : '';
  const safeImageUrl = opts.imageUrl ? escapeTemplateHtml(opts.imageUrl) : '';
  const safeCtaLabel = opts.ctaLabel ? escapeTemplateHtml(opts.ctaLabel) : '';
  const safeCtaUrl = opts.ctaUrl ? escapeTemplateHtml(opts.ctaUrl) : '';
  const includeRegistrationCode = opts.includeRegistrationCode !== false;
  const includeCalendarOptIn = opts.includeCalendarOptIn === true;

  return `
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#ffffff;font-family:Arial,sans-serif;color:#111827;">
    <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border:1px solid #fde68a;border-radius:14px;overflow:hidden;">
            <tr>
              <td style="padding:14px 24px 8px 24px;">
                <div style="height:6px;background:#facc15;border-radius:999px;margin:0 0 12px 0;"></div>
                {{if .SubscribeURL}}<a href="{{.SubscribeURL}}" style="font-size:12px;color:#111827;text-decoration:underline;font-weight:700;">subscribe</a>{{end}}
                {{if .UnsubscribeURL}}&nbsp;|&nbsp;<a href="{{.UnsubscribeURL}}" style="font-size:12px;color:#111827;text-decoration:underline;font-weight:700;">unsubscribe</a>{{end}}
              </td>
            </tr>
            <tr>
              <td style="padding:24px 24px 10px 24px;">
                ${safeLogoUrl ? `<img src="${safeLogoUrl}" alt="Logo" style="display:block;max-width:140px;height:auto;margin:0 0 14px 0;" />` : ''}
                <p style="margin:0 0 8px 0;font-size:13px;color:#111827;font-weight:700;">${safeTitle}</p>
                <h2 style="margin:0;font-size:24px;line-height:1.25;color:#111827;">${safeHeading}</h2>
              </td>
            </tr>
            ${safeImageUrl ? `<tr><td style="padding:10px 24px 0 24px;"><img src="${safeImageUrl}" alt="${safeTitle}" style="display:block;width:100%;height:auto;border-radius:10px;" /></td></tr>` : ''}
            <tr>
              <td style="padding:18px 24px 12px 24px;">
                <p style="margin:0 0 14px 0;font-size:16px;color:#111827;">${safeGreeting}</p>
                <p style="margin:0;font-size:15px;line-height:1.7;color:#374151;">${safeMessage}</p>
                ${safeCtaLabel && safeCtaUrl ? `
                <p style="margin:18px 0 0;">
                  <a href="${safeCtaUrl}" style="display:inline-block;padding:12px 18px;border-radius:999px;background:#111827;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">
                    ${safeCtaLabel}
                  </a>
                </p>` : ''}
                ${includeRegistrationCode ? `
                {{if .RegistrationCode}}
                <div style="margin-top:16px;display:inline-block;padding:10px 14px;border-radius:8px;background:#fff9db;border:1px solid #facc15;font-size:13px;color:#111827;">
                  Registration Number: <strong>{{.RegistrationCode}}</strong>
                </div>
                {{end}}` : ''}
                ${includeCalendarOptIn ? `
                {{if .CalendarOptInURL}}
                <p style="margin:14px 0 0;font-size:13px;color:#111827;">
                  <a href="{{.CalendarOptInURL}}" style="color:#111827;text-decoration:underline;font-weight:700;">Add event to calendar</a>
                </p>
                {{end}}` : ''}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`.trim();
}

export function buildFormEmailTextBody(opts: {
  title: string;
  heading: string;
  message: string;
  ctaLabel?: string;
  ctaUrl?: string;
}) {
  const lines = [
    opts.title?.trim() || 'Registration',
    '',
    opts.heading?.trim() || 'Registration Confirmed',
    '',
    'Hello {{.RecipientName}},',
    '',
    opts.message?.trim() || 'Thank you for registering.',
  ];

  if (opts.ctaLabel?.trim() && opts.ctaUrl?.trim()) {
    lines.push('', `${opts.ctaLabel.trim()}: ${opts.ctaUrl.trim()}`);
  }

  lines.push('', 'Registration Number: {{.RegistrationCode}}');
  return lines.join('\n');
}
