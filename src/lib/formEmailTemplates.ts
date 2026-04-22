export const MAX_EMAIL_IMAGE_MB = 5;
export const MAX_EMAIL_IMAGE_BYTES = MAX_EMAIL_IMAGE_MB * 1024 * 1024;
export const ACCEPTED_EMAIL_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const DEFAULT_EMAIL_ACCENT_COLOR = '#92400e';
export const DEFAULT_EMAIL_SURFACE_COLOR = '#fff7ed';

const META_PREFIX = '<!--WH_FORM_TEMPLATE_META:';
const META_SUFFIX = '-->';

export type FormEmailCalendarEvent = {
  title: string;
  startAt: string;
  endAt?: string;
  location?: string;
  description?: string;
  timeZone?: string;
};

export type FormEmailResourceLink = {
  label: string;
  url: string;
  description?: string;
  kind?: string;
};

export type FormEmailSocialPlatform = 'facebook' | 'youtube' | 'instagram' | 'twitter';

export type FormEmailSocialLink = {
  platform: FormEmailSocialPlatform;
  url: string;
};

type FormEmailResourceKind = 'flyer' | 'document' | 'guide' | 'schedule' | 'resource';

type PreparedFormEmailResourceLink = {
  label: string;
  url: string;
  description?: string;
  kind: FormEmailResourceKind;
};

export type StoredFormEmailTemplateMeta = {
  preheader?: string;
  eyebrow?: string;
  heading?: string;
  message?: string;
  messageHtml?: string;
  logoUrl?: string;
  imageUrl?: string;
  customHtml?: string;
  ctaEnabled?: boolean;
  ctaLabel?: string;
  ctaUrl?: string;
  calendarLabel?: string;
  calendarUrl?: string;
  calendarEvent?: FormEmailCalendarEvent;
  resourceLinks?: FormEmailResourceLink[];
  spotlightLabel?: string;
  spotlightText?: string;
  accentColor?: string;
  surfaceColor?: string;
  footerNote?: string;
  socialLinks?: FormEmailSocialLink[];
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

function formatGoogleCalendarDate(value: Date) {
  return value.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

export function buildGoogleCalendarUrl(event?: FormEmailCalendarEvent): string {
  if (!event) return '';

  const title = event.title?.trim() || '';
  const startRaw = event.startAt?.trim() || '';
  if (!title || !startRaw) return '';

  const startsAt = new Date(startRaw);
  if (Number.isNaN(startsAt.getTime())) return '';

  let endsAt: Date;
  if (event.endAt?.trim()) {
    const parsedEnd = new Date(event.endAt);
    if (Number.isNaN(parsedEnd.getTime())) return '';
    endsAt = parsedEnd;
  } else {
    endsAt = new Date(startsAt.getTime() + 2 * 60 * 60 * 1000);
  }

  if (endsAt.getTime() <= startsAt.getTime()) {
    endsAt = new Date(startsAt.getTime() + 2 * 60 * 60 * 1000);
  }

  const query = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${formatGoogleCalendarDate(startsAt)}/${formatGoogleCalendarDate(endsAt)}`,
  });

  if (event.location?.trim()) {
    query.set('location', event.location.trim());
  }
  if (event.description?.trim()) {
    query.set('details', event.description.trim());
  }
  if (event.timeZone?.trim()) {
    query.set('ctz', event.timeZone.trim());
  }

  return `https://calendar.google.com/calendar/render?${query.toString()}`;
}

function normalizeHexColor(rawValue: string | undefined, fallback: string) {
  const candidate = rawValue?.trim() || '';
  if (/^#[0-9a-f]{6}$/i.test(candidate)) {
    return candidate.toLowerCase();
  }
  if (/^#[0-9a-f]{3}$/i.test(candidate)) {
    const [r, g, b] = candidate.slice(1).split('');
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return fallback;
}

function parseCalendarDate(value?: string) {
  if (!value?.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatCalendarValue(
  value: Date,
  options: Intl.DateTimeFormatOptions,
  timeZone?: string
) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      ...options,
      ...(timeZone ? { timeZone } : {}),
    }).format(value);
  } catch {
    return new Intl.DateTimeFormat(undefined, options).format(value);
  }
}

function buildCalendarSummaryRows(event?: FormEmailCalendarEvent) {
  if (!event) return [] as Array<{ label: string; value: string }>;

  const rows: Array<{ label: string; value: string }> = [];
  const title = event.title?.trim();
  const location = event.location?.trim();
  const timeZone = event.timeZone?.trim() || undefined;
  const start = parseCalendarDate(event.startAt);
  const end = parseCalendarDate(event.endAt);

  if (title) {
    rows.push({ label: 'Event', value: title });
  }

  if (start) {
    const startDateLabel = formatCalendarValue(
      start,
      { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' },
      timeZone
    );
    const endDateLabel = end
      ? formatCalendarValue(
          end,
          { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' },
          timeZone
        )
      : '';

    rows.push({
      label: 'Date',
      value: endDateLabel && endDateLabel !== startDateLabel ? `${startDateLabel} - ${endDateLabel}` : startDateLabel,
    });

    const startTimeLabel = formatCalendarValue(
      start,
      { hour: 'numeric', minute: '2-digit', timeZoneName: timeZone ? 'short' : undefined },
      timeZone
    );

    if (end) {
      const endTimeLabel = formatCalendarValue(
        end,
        { hour: 'numeric', minute: '2-digit', timeZoneName: timeZone ? 'short' : undefined },
        timeZone
      );
      rows.push({ label: 'Time', value: `${startTimeLabel} - ${endTimeLabel}` });
    } else {
      rows.push({ label: 'Time', value: startTimeLabel });
    }
  }

  if (location) {
    rows.push({ label: 'Venue', value: location });
  }

  return rows;
}

function normalizeResourceKind(value?: string): FormEmailResourceKind {
  const candidate = value?.trim().toLowerCase() || '';
  switch (candidate) {
    case 'flyer':
    case 'document':
    case 'guide':
    case 'schedule':
    case 'resource':
      return candidate;
    default:
      return 'resource';
  }
}

function formatResourceKindLabel(kind: FormEmailResourceKind) {
  switch (kind) {
    case 'flyer':
      return 'Flyer';
    case 'document':
      return 'Document';
    case 'guide':
      return 'Guide';
    case 'schedule':
      return 'Schedule';
    default:
      return 'Resource';
  }
}

function buildResourceActionLabel(kind: FormEmailResourceKind) {
  switch (kind) {
    case 'flyer':
      return 'Download flyer';
    case 'document':
      return 'Download document';
    case 'guide':
      return 'Open guide';
    case 'schedule':
      return 'Open schedule';
    default:
      return 'Open resource';
  }
}

function isPreparedResourceLink(
  resource: PreparedFormEmailResourceLink | null
): resource is PreparedFormEmailResourceLink {
  return resource !== null;
}

function prepareResourceLinks(resourceLinks?: FormEmailResourceLink[]) {
  if (!resourceLinks?.length) return [] as PreparedFormEmailResourceLink[];

  return resourceLinks
    .map<PreparedFormEmailResourceLink | null>((resource) => {
      const label = resource.label?.trim() || '';
      const url = resource.url?.trim() || '';
      const description = resource.description?.trim() || undefined;
      if (!label || !url) return null;
      return {
        label,
        url,
        description,
        kind: normalizeResourceKind(resource.kind),
      };
    })
    .filter(isPreparedResourceLink);
}

const DEFAULT_SOCIAL_LINKS: FormEmailSocialLink[] = [
  { platform: 'facebook', url: 'https://facebook.com/wisdomchurchhq' },
  { platform: 'youtube', url: 'https://youtube.com/@wisdomchurchhq' },
  { platform: 'instagram', url: 'https://instagram.com/wisdomchurchhq' },
  { platform: 'twitter', url: 'https://x.com/wisdomchurchhq' },
];

function socialLabel(platform: FormEmailSocialPlatform) {
  switch (platform) {
    case 'facebook':
      return 'Facebook';
    case 'youtube':
      return 'YouTube';
    case 'instagram':
      return 'Instagram';
    default:
      return 'X';
  }
}

function socialGlyph(platform: FormEmailSocialPlatform) {
  switch (platform) {
    case 'facebook':
      return 'f';
    case 'youtube':
      return '▶';
    case 'instagram':
      return '◎';
    default:
      return '𝕏';
  }
}

function prepareSocialLinks(socialLinks?: FormEmailSocialLink[]) {
  const source = socialLinks && socialLinks.length > 0 ? socialLinks : DEFAULT_SOCIAL_LINKS;
  return source
    .map((item) => {
      const url = normalizeAbsoluteHttpUrl(item.url || '');
      if (!url) return null;
      return {
        platform: item.platform,
        url,
        label: socialLabel(item.platform),
        glyph: socialGlyph(item.platform),
      };
    })
    .filter((item): item is { platform: FormEmailSocialPlatform; url: string; label: string; glyph: string } => Boolean(item));
}

function applyInlineStyle(markup: string, tagName: string, inlineStyle: string) {
  const pattern = new RegExp(`<${tagName}(\\s[^>]*)?>`, 'gi');
  return markup.replace(pattern, (match, attrs = '') => {
    if (/style=/i.test(match)) return match;
    return `<${tagName}${attrs} style="${inlineStyle}">`;
  });
}

function plainTextToHtmlParagraphs(value: string) {
  const paragraphs = value
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) {
    return '<p style="margin:0 0 16px 0;font-size:16px;line-height:1.8;color:#334155;">Thank you for registering.</p>';
  }

  return paragraphs
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px 0;font-size:16px;line-height:1.8;color:#334155;">${escapeTemplateHtml(paragraph).replace(/\n/g, '<br />')}</p>`
    )
    .join('');
}

function styleRichEmailMarkup(markup: string, accentColor: string) {
  let styled = stripTemplateMeta(markup || '').trim();
  if (!styled) return '';

  styled = applyInlineStyle(
    styled,
    'p',
    'margin:0 0 16px 0;font-size:16px;line-height:1.8;color:#334155;'
  );
  styled = applyInlineStyle(
    styled,
    'h1',
    'margin:0 0 16px 0;font-size:28px;line-height:1.2;color:#0f172a;font-weight:800;'
  );
  styled = applyInlineStyle(
    styled,
    'h2',
    'margin:6px 0 14px 0;font-size:22px;line-height:1.3;color:#0f172a;font-weight:800;'
  );
  styled = applyInlineStyle(
    styled,
    'h3',
    'margin:6px 0 12px 0;font-size:18px;line-height:1.4;color:#0f172a;font-weight:700;'
  );
  styled = applyInlineStyle(
    styled,
    'ul',
    'margin:0 0 16px 0;padding-left:22px;color:#334155;font-size:16px;line-height:1.8;'
  );
  styled = applyInlineStyle(
    styled,
    'ol',
    'margin:0 0 16px 0;padding-left:22px;color:#334155;font-size:16px;line-height:1.8;'
  );
  styled = applyInlineStyle(styled, 'li', 'margin:0 0 8px 0;');
  styled = applyInlineStyle(
    styled,
    'blockquote',
    `margin:20px 0;padding:18px 20px;border-left:4px solid ${accentColor};background:#fffaf0;border-radius:14px;font-size:17px;line-height:1.8;color:#1f2937;font-family:Georgia,'Times New Roman',serif;`
  );
  styled = applyInlineStyle(styled, 'strong', 'color:#0f172a;font-weight:800;');
  styled = applyInlineStyle(styled, 'em', 'color:#475569;font-style:italic;');
  styled = applyInlineStyle(styled, 'u', `text-decoration-color:${accentColor};`);
  styled = applyInlineStyle(
    styled,
    'a',
    `color:${accentColor};text-decoration:underline;font-weight:700;`
  );

  return styled;
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function convertEmailHtmlToText(value: string) {
  const normalized = stripTemplateMeta(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h1|h2|h3|blockquote|ul|ol)>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, '');

  return decodeHtmlEntities(normalized)
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function renderTemplateVariables(
  html: string,
  variables: Partial<Record<'RecipientName' | 'RegistrationCode' | 'SubscribeURL' | 'UnsubscribeURL' | 'CalendarOptInURL', string>>
) {
  const conditionalPattern = /{{if\s+\.([A-Za-z0-9_]+)}}([\s\S]*?){{end}}/g;
  let rendered = stripTemplateMeta(html).replace(conditionalPattern, (_, key: string, inner: string) => {
    const value = variables[key as keyof typeof variables];
    return value ? inner : '';
  });

  Object.entries(variables).forEach(([key, value]) => {
    const safeValue = value ?? '';
    rendered = rendered.replace(new RegExp(`{{\\.${key}}}`, 'g'), safeValue);
  });

  return rendered.replace(/{{\.[A-Za-z0-9_]+}}/g, '');
}

export function toEmailPreview(html: string) {
  return renderTemplateVariables(html, {
    RecipientName: 'John Doe',
    RegistrationCode: 'WHC-WPC-26-000001',
    SubscribeURL: '#',
    UnsubscribeURL: '#',
    CalendarOptInURL: '#',
  });
}

export function buildFormEmailHTML(opts: {
  title: string;
  preheader?: string;
  eyebrow?: string;
  heading: string;
  message: string;
  messageHtml?: string;
  logoUrl?: string;
  imageUrl?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  calendarLabel?: string;
  calendarUrl?: string;
  calendarEvent?: FormEmailCalendarEvent;
  resourceLinks?: FormEmailResourceLink[];
  includeRegistrationCode?: boolean;
  includeCalendarOptIn?: boolean;
  greeting?: string;
  spotlightLabel?: string;
  spotlightText?: string;
  accentColor?: string;
  surfaceColor?: string;
  footerNote?: string;
  socialLinks?: FormEmailSocialLink[];
}) {
  const safeTitle = escapeTemplateHtml(opts.title || 'Registration');
  const safePreheader = escapeTemplateHtml(opts.preheader || '');
  const safeEyebrow = escapeTemplateHtml(opts.eyebrow || '');
  const safeHeading = escapeTemplateHtml(opts.heading || 'Registration Confirmed');
  const safeGreeting = escapeTemplateHtml(opts.greeting || 'Hello {{.RecipientName}},');
  const safeLogoUrl = opts.logoUrl ? escapeTemplateHtml(opts.logoUrl) : '';
  const safeImageUrl = opts.imageUrl ? escapeTemplateHtml(opts.imageUrl) : '';
  const safeCtaLabel = opts.ctaLabel ? escapeTemplateHtml(opts.ctaLabel) : '';
  const safeCtaUrl = opts.ctaUrl ? escapeTemplateHtml(opts.ctaUrl) : '';
  const safeCalendarLabel = escapeTemplateHtml(opts.calendarLabel || 'Add event to calendar');
  const safeCalendarUrl = opts.calendarUrl?.trim() ? escapeTemplateHtml(opts.calendarUrl.trim()) : '';
  const safeSpotlightLabel = escapeTemplateHtml(opts.spotlightLabel || '');
  const safeSpotlightText = escapeTemplateHtml(opts.spotlightText || '').replace(/\n/g, '<br />');
  const safeFooterNote = escapeTemplateHtml(opts.footerNote || '').replace(/\n/g, '<br />');
  const includeRegistrationCode = opts.includeRegistrationCode !== false;
  const includeCalendarOptIn = opts.includeCalendarOptIn === true || Boolean(safeCalendarUrl);
  const accentColor = normalizeHexColor(opts.accentColor, DEFAULT_EMAIL_ACCENT_COLOR);
  const surfaceColor = normalizeHexColor(opts.surfaceColor, DEFAULT_EMAIL_SURFACE_COLOR);
  const calendarSummaryRows = buildCalendarSummaryRows(opts.calendarEvent);
  const resourceLinks = prepareResourceLinks(opts.resourceLinks);
  const socialLinks = prepareSocialLinks(opts.socialLinks);
  const formattedMessageHtml = opts.messageHtml?.trim()
    ? styleRichEmailMarkup(opts.messageHtml, accentColor)
    : plainTextToHtmlParagraphs(opts.message || 'Thank you for registering.');
  const messageBlock = formattedMessageHtml || plainTextToHtmlParagraphs(opts.message || 'Thank you for registering.');

  return `
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#eef2f7;font-family:'Segoe UI',Arial,sans-serif;color:#111827;">
    <div style="display:none;overflow:hidden;max-height:0;max-width:0;opacity:0;color:transparent;font-size:1px;line-height:1px;">
      ${safePreheader || safeHeading}
    </div>
    <table width="100%" cellpadding="0" cellspacing="0" style="padding:22px 10px;background:#eef2f7;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width:760px;background:#ffffff;overflow:hidden;">
            <tr>
              <td style="padding:0;background:#111827;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:22px 30px;">
                      ${safeLogoUrl
                        ? `<div style="display:inline-block;background:#ffffff;padding:10px 14px;"><img src="${safeLogoUrl}" alt="Wisdom Church" style="display:block;max-width:170px;height:auto;" /></div>`
                        : `<p style="margin:0;font-size:22px;font-weight:800;letter-spacing:0.03em;color:#ffffff;">WISDOM CHURCH</p>`}
                    </td>
                    <td align="right" style="padding:22px 30px;vertical-align:top;">
                      {{if .SubscribeURL}}<a href="{{.SubscribeURL}}" style="font-size:12px;color:#f8fafc;text-decoration:underline;font-weight:700;">subscribe</a>{{end}}
                      {{if .UnsubscribeURL}}&nbsp;|&nbsp;<a href="{{.UnsubscribeURL}}" style="font-size:12px;color:#f8fafc;text-decoration:underline;font-weight:700;">unsubscribe</a>{{end}}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:34px 34px 14px 34px;">
                <p style="margin:0 0 12px 0;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#64748b;font-weight:800;">${safeTitle}</p>
                ${safeEyebrow ? `<p style="margin:0 0 12px 0;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:${accentColor};font-weight:800;">${safeEyebrow}</p>` : ''}
                <h2 style="margin:0;font-size:36px;line-height:1.1;color:#0f172a;font-weight:900;">${safeHeading}</h2>
              </td>
            </tr>
            ${safeImageUrl ? `<tr><td style="padding:8px 34px 0 34px;"><img src="${safeImageUrl}" alt="${safeTitle}" style="display:block;width:100%;height:auto;" /></td></tr>` : ''}
            <tr>
              <td style="padding:24px 34px 34px 34px;">
                <p style="margin:0 0 20px 0;font-size:18px;line-height:1.7;color:#0f172a;font-weight:600;">${safeGreeting}</p>
                ${calendarSummaryRows.length > 0 ? `
                <div style="margin:0 0 24px 0;padding:18px;background:${surfaceColor};border-left:5px solid ${accentColor};">
                  <p style="margin:0 0 14px 0;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:${accentColor};font-weight:800;">Event Reminder</p>
                  ${calendarSummaryRows
                    .map(
                      (row) => `
                  <div style="margin:0 0 12px 0;">
                    <p style="margin:0 0 4px 0;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;font-weight:800;">${escapeTemplateHtml(row.label)}</p>
                    <p style="margin:0;font-size:15px;line-height:1.6;color:#0f172a;font-weight:700;">${escapeTemplateHtml(row.value)}</p>
                  </div>`
                    )
                    .join('')}
                </div>` : ''}
                ${safeSpotlightText ? `
                <div style="margin:0 0 24px 0;padding:18px;background:${surfaceColor};border-left:5px solid ${accentColor};">
                  ${safeSpotlightLabel ? `<p style="margin:0 0 10px 0;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:${accentColor};font-weight:800;">${safeSpotlightLabel}</p>` : ''}
                  <p style="margin:0;font-size:19px;line-height:1.8;color:#1f2937;font-family:Georgia,'Times New Roman',serif;">${safeSpotlightText}</p>
                </div>` : ''}
                <div style="margin:0;">${messageBlock}</div>
                ${resourceLinks.length > 0 ? `
                <div style="margin:26px 0 0;padding:20px;background:#f8fafc;border-left:5px solid ${accentColor};">
                  <p style="margin:0 0 14px 0;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:${accentColor};font-weight:800;">Event Resources</p>
                  ${resourceLinks
                    .map((resource) => {
                      const kindLabel = escapeTemplateHtml(formatResourceKindLabel(resource.kind));
                      const actionLabel = escapeTemplateHtml(buildResourceActionLabel(resource.kind));
                      return `
                  <div style="margin:0 0 14px 0;padding:14px;background:${surfaceColor};">
                    <p style="margin:0 0 8px 0;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;font-weight:800;">${kindLabel}</p>
                    <p style="margin:0 0 8px 0;font-size:17px;line-height:1.5;color:#0f172a;font-weight:800;">${escapeTemplateHtml(resource.label)}</p>
                    ${resource.description ? `<p style="margin:0 0 12px 0;font-size:14px;line-height:1.7;color:#475569;">${escapeTemplateHtml(resource.description)}</p>` : ''}
                    <a href="${escapeTemplateHtml(resource.url)}" style="display:inline-block;padding:11px 16px;background:#ffffff;color:${accentColor};font-size:14px;font-weight:800;text-decoration:none;border:1px solid ${accentColor}33;">
                      ${actionLabel}
                    </a>
                  </div>`;
                    })
                    .join('')}
                </div>` : ''}
                ${safeCtaLabel && safeCtaUrl ? `
                <p style="margin:24px 0 0;">
                  <a href="${safeCtaUrl}" style="display:inline-block;padding:14px 22px;background:${accentColor};color:#ffffff;font-size:15px;font-weight:800;text-decoration:none;">
                    ${safeCtaLabel}
                  </a>
                </p>` : ''}
                ${includeRegistrationCode ? `
                {{if .RegistrationCode}}
                <div style="margin-top:20px;display:inline-block;padding:12px 16px;background:${surfaceColor};border-left:4px solid ${accentColor};font-size:13px;color:#111827;">
                  Registration Number: <strong>{{.RegistrationCode}}</strong>
                </div>
                {{end}}` : ''}
                ${includeCalendarOptIn ? `
                ${safeCalendarUrl ? '' : '{{if .CalendarOptInURL}}'}
                <div style="margin-top:26px;padding:20px;background:#0f172a;color:#ffffff;">
                  <p style="margin:0 0 8px 0;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#fcd34d;font-weight:800;">
                    Save the date
                  </p>
                  <p style="margin:0 0 14px 0;font-size:15px;line-height:1.7;color:#ffffff;">
                    Open your calendar now and lock this event into your schedule before the email gets buried.
                  </p>
                  <a href="${safeCalendarUrl || '{{.CalendarOptInURL}}'}" style="display:inline-block;padding:12px 18px;background:#ffffff;color:#0f172a;font-size:14px;font-weight:800;text-decoration:none;">
                    ${safeCalendarLabel}
                  </a>
                </div>
                ${safeCalendarUrl ? '' : '{{end}}'}` : ''}
                ${socialLinks.length > 0 ? `
                <div style="margin-top:28px;padding-top:18px;border-top:1px solid #e2e8f0;">
                  <p style="margin:0 0 12px 0;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#475569;font-weight:800;">Follow us on</p>
                  <table cellpadding="0" cellspacing="0">
                    <tr>
                      ${socialLinks
                        .map(
                          (social) => `
                      <td style="padding-right:8px;">
                        <a href="${escapeTemplateHtml(social.url)}" title="${escapeTemplateHtml(social.label)}" aria-label="${escapeTemplateHtml(social.label)}" style="display:inline-block;width:34px;height:34px;line-height:34px;text-align:center;background:#111827;color:#ffffff;text-decoration:none;font-size:16px;font-weight:800;">
                          ${escapeTemplateHtml(social.glyph)}
                        </a>
                      </td>`
                        )
                        .join('')}
                    </tr>
                  </table>
                </div>` : ''}
                ${safeFooterNote ? `<p style="margin:22px 0 0;font-size:13px;line-height:1.7;color:#64748b;">${safeFooterNote}</p>` : ''}
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
  preheader?: string;
  eyebrow?: string;
  heading: string;
  message: string;
  messageHtml?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  calendarLabel?: string;
  calendarUrl?: string;
  calendarEvent?: FormEmailCalendarEvent;
  resourceLinks?: FormEmailResourceLink[];
  includeRegistrationCode?: boolean;
  includeCalendarOptIn?: boolean;
  spotlightLabel?: string;
  spotlightText?: string;
  footerNote?: string;
  socialLinks?: FormEmailSocialLink[];
}) {
  const includeRegistrationCode = opts.includeRegistrationCode !== false;
  const includeCalendarOptIn = opts.includeCalendarOptIn === true || Boolean(opts.calendarUrl?.trim());
  const calendarSummaryRows = buildCalendarSummaryRows(opts.calendarEvent);
  const resourceLinks = prepareResourceLinks(opts.resourceLinks);
  const socialLinks = prepareSocialLinks(opts.socialLinks);
  const messageText = opts.messageHtml?.trim()
    ? convertEmailHtmlToText(opts.messageHtml)
    : opts.message?.trim() || 'Thank you for registering.';
  const lines = [opts.title?.trim() || 'Registration'];

  if (opts.preheader?.trim()) {
    lines.push('', opts.preheader.trim());
  }

  if (opts.eyebrow?.trim()) {
    lines.push('', opts.eyebrow.trim());
  }

  lines.push('', opts.heading?.trim() || 'Registration Confirmed');

  if (calendarSummaryRows.length > 0) {
    lines.push('', 'Event Details');
    calendarSummaryRows.forEach((row) => {
      lines.push(`${row.label}: ${row.value}`);
    });
  }

  if (opts.spotlightLabel?.trim() || opts.spotlightText?.trim()) {
    if (opts.spotlightLabel?.trim()) {
      lines.push('', opts.spotlightLabel.trim());
    }
    if (opts.spotlightText?.trim()) {
      lines.push(opts.spotlightText.trim());
    }
  }

  lines.push('', 'Hello {{.RecipientName}},', '', messageText);

  if (resourceLinks.length > 0) {
    lines.push('', 'Event Resources');
    resourceLinks.forEach((resource) => {
      lines.push(`${formatResourceKindLabel(resource.kind)}: ${resource.label}`);
      if (resource.description) {
        lines.push(resource.description);
      }
      lines.push(`${buildResourceActionLabel(resource.kind)}: ${resource.url}`);
      lines.push('');
    });
    while (lines[lines.length - 1] === '') {
      lines.pop();
    }
  }

  if (opts.ctaLabel?.trim() && opts.ctaUrl?.trim()) {
    lines.push('', `${opts.ctaLabel.trim()}: ${opts.ctaUrl.trim()}`);
  }

  if (includeCalendarOptIn) {
    lines.push(
      '',
      'Calendar reminder: open your calendar now and save the event.',
      `${opts.calendarLabel?.trim() || 'Add event to calendar'}: ${opts.calendarUrl?.trim() || '{{.CalendarOptInURL}}'}`
    );
  }

  if (opts.footerNote?.trim()) {
    lines.push('', opts.footerNote.trim());
  }

  if (socialLinks.length > 0) {
    lines.push('', 'Follow us on');
    socialLinks.forEach((social) => {
      lines.push(`${social.label}: ${social.url}`);
    });
  }

  if (includeRegistrationCode) {
    lines.push('', 'Registration Number: {{.RegistrationCode}}');
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
