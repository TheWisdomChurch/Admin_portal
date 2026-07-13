export const MAX_EMAIL_IMAGE_MB = 5;
export const MAX_EMAIL_IMAGE_BYTES = MAX_EMAIL_IMAGE_MB * 1024 * 1024;
export const ACCEPTED_EMAIL_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
// Defaults mirror internal/email/theme.go's colorAccent — the single brass
// accent used across every other rebuilt email in this system. A form can
// still override accentColor/surfaceColor per-event; this is just the
// starting point so an untouched form gets the current design, not the old
// amber one.
export const DEFAULT_EMAIL_ACCENT_COLOR = '#8a6d2f';
export const DEFAULT_EMAIL_SURFACE_COLOR = '#f7f5f0';

// Design tokens shared with the header/card chrome below — mirrors
// internal/email/theme.go on the backend and the email-marketing compose
// page's EMAIL_COLOR_* constants. Keep all three in sync.
const INK = '#0e1420';
const PAPER = '#ffffff';
const GROUND = '#eef0f3';
const LINE = '#dadfe6';
const MUTED = '#5b6472';
const FAINT = '#8a93a3';
const BODY_COLOR = '#3a414d';
const FONT_STACK = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

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
  { platform: 'facebook', url: 'https://www.facebook.com/wisdomhousehq' },
  { platform: 'youtube', url: 'https://www.youtube.com/@wisdomhousehq' },
  { platform: 'instagram', url: 'https://www.instagram.com/wisdomhousehq' },
  { platform: 'twitter', url: 'https://x.com/wisdomhousehq' },
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
      };
    })
    .filter((item): item is { platform: FormEmailSocialPlatform; url: string; label: string } => Boolean(item));
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
    return `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.7;color:${BODY_COLOR};">Thank you for registering.</p>`;
  }

  return paragraphs
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.7;color:${BODY_COLOR};">${escapeTemplateHtml(paragraph).replace(/\n/g, '<br />')}</p>`
    )
    .join('');
}

function styleRichEmailMarkup(markup: string, accentColor: string) {
  let styled = stripTemplateMeta(markup || '').trim();
  if (!styled) return '';

  styled = applyInlineStyle(
    styled,
    'p',
    `margin:0 0 16px 0;font-size:15px;line-height:1.7;color:${BODY_COLOR};`
  );
  styled = applyInlineStyle(
    styled,
    'h1',
    `margin:0 0 16px 0;font-size:24px;line-height:1.3;color:${INK};font-weight:800;`
  );
  styled = applyInlineStyle(
    styled,
    'h2',
    `margin:6px 0 14px 0;font-size:20px;line-height:1.3;color:${INK};font-weight:800;`
  );
  styled = applyInlineStyle(
    styled,
    'h3',
    `margin:6px 0 12px 0;font-size:17px;line-height:1.4;color:${INK};font-weight:700;`
  );
  styled = applyInlineStyle(
    styled,
    'ul',
    `margin:0 0 16px 0;padding-left:22px;color:${BODY_COLOR};font-size:15px;line-height:1.7;`
  );
  styled = applyInlineStyle(
    styled,
    'ol',
    `margin:0 0 16px 0;padding-left:22px;color:${BODY_COLOR};font-size:15px;line-height:1.7;`
  );
  styled = applyInlineStyle(styled, 'li', 'margin:0 0 8px 0;');
  styled = applyInlineStyle(
    styled,
    'blockquote',
    `margin:20px 0;padding:16px 20px;border-left:3px solid ${accentColor};background:${GROUND};font-size:16px;line-height:1.7;color:${BODY_COLOR};font-family:Georgia,'Times New Roman',serif;`
  );
  styled = applyInlineStyle(styled, 'strong', `color:${INK};font-weight:800;`);
  styled = applyInlineStyle(styled, 'em', `color:${MUTED};font-style:italic;`);
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

  // Mirrors internal/email/theme.go's renderHeaderBlock: logo, a vertical
  // hairline divider, then "The" / "Wisdom Church" stacked with a tagline —
  // on the card's paper background, not a dark filled block.
  const brandHeader = `
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td style="width:56px;vertical-align:middle;">
        ${safeLogoUrl
          ? `<img src="${safeLogoUrl}" alt="The Wisdom Church" width="56" height="56" style="display:block;width:56px;height:56px;border-radius:14px;object-fit:cover;" />`
          : `<div style="width:56px;height:56px;background:${INK};font-size:22px;font-weight:800;line-height:56px;text-align:center;color:${accentColor};">W</div>`}
      </td>
      <td style="width:1px;padding:0 10px;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr><td width="1" height="52" style="width:1px;font-size:0;line-height:0;background:${LINE};">&nbsp;</td></tr></table>
      </td>
      <td style="vertical-align:middle;">
        <div style="font-size:13px;font-weight:400;color:${MUTED};line-height:1.3;">The</div>
        <div style="font-size:18px;font-weight:800;letter-spacing:-.01em;color:${INK};line-height:1.25;">Wisdom Church</div>
        <div style="font-size:10.5px;font-style:italic;font-weight:500;color:${accentColor};letter-spacing:.01em;margin-top:5px;">Equipped. Empowered for Greatness</div>
      </td>
    </tr></table>`;

  // A bordered, hairline-separated box — the shared "highlight block" used
  // for the calendar summary, spotlight, and resources sections below,
  // replacing the old solid-color filled panels. Tinted with the form's
  // configured surfaceColor (subtle, not a bold fill) so that control still
  // does something now that the old filled-panel look is gone.
  const highlightBox = (label: string, innerHTML: string) => `
    <div style="margin:0 0 24px 0;border:1px solid ${LINE};background:${surfaceColor};padding:18px 20px;">
      <p style="margin:0 0 14px 0;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:${accentColor};font-weight:700;">${label}</p>
      ${innerHTML}
    </div>`;

  return `
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:${GROUND};font-family:${FONT_STACK};color:${INK};">
    <div style="display:none;overflow:hidden;max-height:0;max-width:0;opacity:0;color:transparent;font-size:1px;line-height:1px;">
      ${safePreheader || safeHeading}
    </div>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:${GROUND};"><tr><td align="center" style="padding:40px 16px;">
      <table width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:${PAPER};border:1px solid ${LINE};">
        <tr><td style="height:3px;line-height:3px;font-size:0;background:${accentColor};">&nbsp;</td></tr>
        <tr><td style="padding:36px 40px 28px;">${brandHeader}</td></tr>
        <tr><td style="padding:0 40px;"><div style="border-top:1px solid ${LINE};"></div></td></tr>
        <tr>
          <td style="padding:32px 40px 8px;">
            <p style="margin:0 0 10px 0;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:${FAINT};font-weight:700;">${safeTitle}</p>
            ${safeEyebrow ? `<p style="margin:0 0 10px 0;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:${accentColor};font-weight:700;">${safeEyebrow}</p>` : ''}
            <h1 style="margin:0 0 4px;font-size:24px;line-height:1.3;font-weight:800;letter-spacing:-.01em;color:${INK};">${safeHeading}</h1>
          </td>
        </tr>
        ${safeImageUrl ? `<tr><td style="padding:20px 40px 0;"><img src="${safeImageUrl}" alt="${safeTitle}" style="display:block;width:100%;height:auto;border:1px solid ${LINE};" /></td></tr>` : ''}
        <tr>
          <td style="padding:24px 40px 8px;font-size:15px;line-height:1.7;color:${BODY_COLOR};">
            <p style="margin:0 0 20px 0;font-size:16px;line-height:1.7;color:${INK};font-weight:600;">${safeGreeting}</p>
            ${calendarSummaryRows.length > 0 ? highlightBox('Event reminder', calendarSummaryRows
              .map(
                (row) => `
              <div style="margin:0 0 12px 0;">
                <p style="margin:0 0 4px 0;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:${FAINT};font-weight:700;">${escapeTemplateHtml(row.label)}</p>
                <p style="margin:0;font-size:15px;line-height:1.6;color:${INK};font-weight:700;">${escapeTemplateHtml(row.value)}</p>
              </div>`
              )
              .join('')) : ''}
            ${safeSpotlightText ? highlightBox(safeSpotlightLabel || 'Highlight', `<p style="margin:0;font-size:16px;line-height:1.75;color:${BODY_COLOR};font-family:Georgia,'Times New Roman',serif;">${safeSpotlightText}</p>`) : ''}
            <div style="margin:0;">${messageBlock}</div>
            ${resourceLinks.length > 0 ? highlightBox('Resources', resourceLinks
              .map((resource) => {
                const kindLabel = escapeTemplateHtml(formatResourceKindLabel(resource.kind));
                const actionLabel = escapeTemplateHtml(buildResourceActionLabel(resource.kind));
                return `
              <div style="margin:0 0 16px 0;">
                <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:${FAINT};font-weight:700;">${kindLabel}</p>
                <p style="margin:0 0 6px 0;font-size:16px;line-height:1.5;color:${INK};font-weight:700;">${escapeTemplateHtml(resource.label)}</p>
                ${resource.description ? `<p style="margin:0 0 10px 0;font-size:14px;line-height:1.7;color:${MUTED};">${escapeTemplateHtml(resource.description)}</p>` : ''}
                <a href="${escapeTemplateHtml(resource.url)}" style="color:${accentColor};font-size:14px;font-weight:700;text-decoration:underline;">${actionLabel}</a>
              </div>`;
              })
              .join('')) : ''}
            ${safeCtaLabel && safeCtaUrl ? `
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;"><tr>
              <td style="background:${accentColor};"><a href="${safeCtaUrl}" style="display:block;padding:14px 26px;font-size:14px;font-weight:600;letter-spacing:.01em;color:${PAPER};text-decoration:none;">${safeCtaLabel}</a></td>
            </tr></table>` : ''}
            ${includeRegistrationCode ? `
            {{if .RegistrationCode}}
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;"><tr><td style="border:1px solid ${LINE};padding:16px 20px;">
              <div style="font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${FAINT};margin-bottom:6px;">Registration Number</div>
              <div style="font-size:22px;font-weight:700;letter-spacing:.06em;color:${INK};">{{.RegistrationCode}}</div>
            </td></tr></table>
            {{end}}` : ''}
            ${includeCalendarOptIn ? `
            ${safeCalendarUrl ? '' : '{{if .CalendarOptInURL}}'}
            <div style="margin:0 0 24px;border:1px solid ${LINE};padding:20px;">
              <p style="margin:0 0 8px 0;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:${accentColor};font-weight:700;">Save the date</p>
              <p style="margin:0 0 16px 0;font-size:15px;line-height:1.7;color:${BODY_COLOR};">Open your calendar now and lock this event into your schedule before the email gets buried.</p>
              <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                <td style="border:1px solid ${LINE};"><a href="${safeCalendarUrl || '{{.CalendarOptInURL}}'}" style="display:block;padding:13px 24px;font-size:14px;font-weight:600;color:${INK};text-decoration:none;">${safeCalendarLabel}</a></td>
              </tr></table>
            </div>
            ${safeCalendarUrl ? '' : '{{end}}'}` : ''}
          </td>
        </tr>
        <tr><td style="padding:0 40px;"><div style="border-top:1px solid ${LINE};"></div></td></tr>
        <tr><td style="padding:24px 40px 32px;">
          <p style="margin:0 0 4px;font-size:12px;color:${FAINT};">The Wisdom Church</p>
          ${safeFooterNote ? `<p style="margin:0 0 10px;font-size:12px;line-height:1.6;color:${FAINT};">${safeFooterNote}</p>` : ''}
          <p style="margin:0 0 10px;font-size:12px;color:${FAINT};">
            {{if .SubscribeURL}}<a href="{{.SubscribeURL}}" style="color:${accentColor};text-decoration:none;">Subscribe</a>{{end}}
            {{if .SubscribeURL}}{{if .UnsubscribeURL}}&nbsp;&middot;&nbsp;{{end}}{{end}}
            {{if .UnsubscribeURL}}<a href="{{.UnsubscribeURL}}" style="color:${accentColor};text-decoration:none;">Unsubscribe</a>{{end}}
          </p>
          ${socialLinks.length > 0 ? `<p style="margin:0;font-size:12px;">${socialLinks
            .map((social) => `<a href="${escapeTemplateHtml(social.url)}" style="color:${MUTED};text-decoration:none;">${escapeTemplateHtml(social.label)}</a>`)
            .join('&nbsp;&nbsp;&middot;&nbsp;&nbsp;')}</p>` : ''}
        </td></tr>
      </table>
    </td></tr></table>
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
