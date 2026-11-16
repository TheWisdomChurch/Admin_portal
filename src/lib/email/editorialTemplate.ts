// src/lib/email/editorialTemplate.ts
//
// Modern Editorial Email Template Generator
// Inspired by luxury tech & editorial newsletters (e.g. Apple Developer,
// The New Yorker, Substack Pro), optimized for churches and community announcements.
// Features modular story cards with rich in-body imagery, clean typography,
// high-contrast tags, and responsive email-client compatible table layouts.

import { CANONICAL_EMAIL_FRAME_CLASS } from '@/lib/forms/formEmailTemplates';

export interface StoryCardItem {
  id: string;
  badge?: string;
  imageUrl: string;
  imageAlt?: string;
  title: string;
  description: string;
  buttonText: string;
  buttonUrl: string;
  buttonStyle?: 'arrow' | 'button'; // 'arrow' = "Join us at the Developer Center >", 'button' = pill button
}

export interface EditorialTemplateConfig {
  theme: 'dark' | 'light';
  editionEyebrow: string; // e.g. "NOVEMBER 2026" or "SPECIAL EDITION"
  mainHeadline: string; // e.g. "Hello Wisdom Family"
  introBlurb: string; // Lead summary paragraph
  stories: StoryCardItem[];
  quoteText?: string;
  quoteAuthor?: string;
  footerNote?: string;
}

const META_PREFIX = '<!--WH_EDITORIAL_DATA:';
const META_SUFFIX = '-->';

function resolveEmailLogoURL(): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/OIP.webp`;
  }
  const raw = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_FRONTEND_URL;
  const origin = raw?.trim().replace(/\/+$/, '') || 'https://admin.wisdomchurchhq.org';
  return `${origin}/OIP.webp`;
}

export const DEFAULT_EDITORIAL_DARK_CONFIG: EditorialTemplateConfig = {
  theme: 'dark',
  editionEyebrow: 'NOVEMBER 2026',
  mainHeadline: 'Hello Wisdom Family',
  introBlurb:
    "In this packed edition: Experience the Holy Festival 26 revelations, join the new Wisdom Leadership Academy cohort, watch highlights from our weekend community outreach, and more.",
  stories: [
    {
      id: 'story-1',
      badge: 'FEATURED EVENT',
      imageUrl: 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?q=80&w=1200&auto=format&fit=crop',
      imageAlt: 'Holy Festival 26 Gathering',
      title: 'Experience Holy Festival 2026',
      description:
        'Europe and Africa converge for 3 supernatural days of kingdom impartation, worship, and apostolic breakthrough at Honour Gardens. Register your seat early.',
      buttonText: 'Reserve your seat at Holy Festival',
      buttonUrl: 'https://wisdomchurchhq.org/events/hf26',
      buttonStyle: 'arrow',
    },
    {
      id: 'story-2',
      badge: 'ACADEMY',
      imageUrl: 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?q=80&w=1200&auto=format&fit=crop',
      imageAlt: 'Wisdom Leadership Academy',
      title: 'Wisdom Leadership Academy: Winter Cohort',
      description:
        'Equip yourself with kingdom leadership principles, biblical wisdom for the marketplace, and spiritual discipleship. Enrollments are now open for the winter intake.',
      buttonText: 'Explore the curriculum & enroll',
      buttonUrl: 'https://wisdomchurchhq.org/academy',
      buttonStyle: 'arrow',
    },
    {
      id: 'story-3',
      badge: 'COMMUNITY IMPACT',
      imageUrl: 'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?q=80&w=1200&auto=format&fit=crop',
      imageAlt: 'Community Outreach Welfare',
      title: 'Community Outreach: Feeding 500 Families',
      description:
        'Through your continuous generosity, our welfare team distributed essential care packages and groceries across Lekki and Alasia communities this past weekend.',
      buttonText: 'View outreach photo gallery',
      buttonUrl: 'https://wisdomchurchhq.org/outreach',
      buttonStyle: 'arrow',
    },
  ],
  quoteText: '"For the earth will be filled with the knowledge of the glory of the LORD as the waters cover the sea."',
  quoteAuthor: 'Habakkuk 2:14',
  footerNote: 'Thank you for being an indispensable part of what God is building at The Wisdom Church.',
};

export const DEFAULT_EDITORIAL_LIGHT_CONFIG: EditorialTemplateConfig = {
  ...DEFAULT_EDITORIAL_DARK_CONFIG,
  theme: 'light',
};

export function buildEditorialEmailHTML(config: EditorialTemplateConfig): string {
  const isDark = config.theme === 'dark';
  const logoUrl = resolveEmailLogoURL();

  // Colors
  const bgOuter = isDark ? '#0C1017' : '#F4F6F9';
  const bgFrame = isDark ? '#141A23' : '#FFFFFF';
  const frameBorder = isDark ? '#232D3D' : '#E2E8F0';
  const textPrimary = isDark ? '#F8FAFC' : '#0F172A';
  const textSecondary = isDark ? '#94A3B8' : '#475569';
  const textMuted = isDark ? '#64748B' : '#94A3B8';
  const eyebrowColor = isDark ? '#94A3B8' : '#B45309';
  const dividerColor = isDark ? '#222C3B' : '#E2E8F0';

  // Story card colors
  const cardBg = isDark ? '#1B2330' : '#F8FAFC';
  const cardBorder = isDark ? '#2B374B' : '#E2E8F0';
  const cardTitleColor = isDark ? '#FFFFFF' : '#0F172A';
  const cardBodyColor = isDark ? '#CBD5E1' : '#475569';
  const arrowLinkColor = isDark ? '#60A5FA' : '#2563EB';
  const goldAccent = '#F59E0B';

  // Embed serialised config in HTML comments so editor can revive structured state
  const serializedConfig = `${META_PREFIX}${JSON.stringify(config)}${META_SUFFIX}`;

  const renderedStories = config.stories
    .map((story) => {
      const badgeHtml = story.badge?.trim()
        ? `<div style="display:inline-block;padding:3px 8px;border-radius:6px;background:${isDark ? '#273448' : '#FEF3C7'};color:${isDark ? '#FBBF24' : '#92400E'};font-size:10px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:12px;">${escapeHtml(
            story.badge.trim()
          )}</div>`
        : '';

      const imageHtml = story.imageUrl?.trim()
        ? `<tr>
            <td style="padding:0;line-height:0;font-size:0;">
              ${story.buttonUrl ? `<a href="${escapeHtml(story.buttonUrl)}" target="_blank" style="text-decoration:none;display:block;">` : ''}
                <img src="${escapeHtml(
                  story.imageUrl.trim()
                )}" width="600" alt="${escapeHtml(story.imageAlt || story.title)}" style="display:block;width:100%;max-width:600px;height:auto;aspect-ratio:16/9;object-fit:cover;border-top-left-radius:15px;border-top-right-radius:15px;border:0;" />
              ${story.buttonUrl ? `</a>` : ''}
            </td>
          </tr>`
        : '';

      const ctaHtml =
        story.buttonText?.trim() && story.buttonUrl?.trim()
          ? story.buttonStyle === 'button'
            ? `<div style="margin-top:20px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="border-radius:8px;background:${isDark ? goldAccent : '#0F172A'};">
                      <a href="${escapeHtml(story.buttonUrl)}" target="_blank" style="display:inline-block;padding:12px 24px;color:${isDark ? '#0C1017' : '#FFFFFF'};font-size:14px;font-weight:700;text-decoration:none;border-radius:8px;">${escapeHtml(
                story.buttonText
              )} &rarr;</a>
                    </td>
                  </tr>
                </table>
              </div>`
            : `<div style="margin-top:18px;">
                <a href="${escapeHtml(story.buttonUrl)}" target="_blank" style="color:${arrowLinkColor};font-size:14.5px;font-weight:600;text-decoration:none;display:inline-block;line-height:1.4;">${escapeHtml(
                story.buttonText
              )} &rsaquo;</a>
              </div>`
          : '';

      return `
      <!-- STORY CARD: ${escapeHtml(story.title)} -->
      <tr>
        <td style="padding:0 0 24px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${cardBg};border:1px solid ${cardBorder};border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,${isDark ? '0.2' : '0.04'});">
            ${imageHtml}
            <tr>
              <td style="padding:24px 26px 26px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
                ${badgeHtml}
                <h2 style="margin:0 0 10px;font-size:20px;line-height:1.35;font-weight:700;color:${cardTitleColor};letter-spacing:-0.01em;">
                  ${story.buttonUrl ? `<a href="${escapeHtml(story.buttonUrl)}" target="_blank" style="color:inherit;text-decoration:none;">${escapeHtml(story.title)}</a>` : escapeHtml(story.title)}
                </h2>
                <p style="margin:0;font-size:14.5px;line-height:1.65;color:${cardBodyColor};">
                  ${escapeHtml(story.description)}
                </p>
                ${ctaHtml}
              </td>
            </tr>
          </table>
        </td>
      </tr>`;
    })
    .join('\n');

  const quoteSectionHtml = config.quoteText?.trim()
    ? `
      <tr>
        <td style="padding:12px 0 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${isDark ? '#18212D' : '#FFFBEB'};border:1px solid ${isDark ? '#2D3B4E' : '#FDE68A'};border-radius:14px;">
            <tr>
              <td style="padding:22px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;text-align:center;">
                <p style="margin:0 0 6px;font-size:15px;font-style:italic;line-height:1.6;color:${isDark ? '#F1F5F9' : '#92400E'};">${escapeHtml(config.quoteText)}</p>
                ${config.quoteAuthor?.trim() ? `<p style="margin:0;font-size:11.5px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${isDark ? '#FBBF24' : '#B45309'};">&mdash; ${escapeHtml(config.quoteAuthor)}</p>` : ''}
              </td>
            </tr>
          </table>
        </td>
      </tr>`
    : '';

  return `${serializedConfig}<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(config.mainHeadline)} - The Wisdom Church</title>
  <style>
    body { margin: 0; padding: 0; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    @media only screen and (max-width: 620px) {
      .wc-outer-pad { padding: 16px 10px !important; }
      .wc-inner-pad { padding-left: 20px !important; padding-right: 20px !important; }
      .wc-main-title { font-size: 26px !important; }
      .wc-card-table { border-radius: 12px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:${bgOuter};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${bgOuter};">
  <tr>
    <td align="center" class="wc-outer-pad" style="padding:36px 16px;">
      
      <!-- CANONICAL CARD CONTAINER -->
      <table class="${CANONICAL_EMAIL_FRAME_CLASS}" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:620px;background:${bgFrame};border:1px solid ${frameBorder};border-radius:20px;overflow:hidden;box-shadow:0 12px 36px rgba(0,0,0,${isDark ? '0.35' : '0.06'});font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
        
        <!-- TOP BRAND ROW -->
        <tr>
          <td class="wc-inner-pad" style="padding:32px 36px 20px;">
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td style="width:48px;vertical-align:middle;">
                  <img src="${logoUrl}" width="48" height="48" alt="The Wisdom Church" style="display:block;width:48px;height:48px;border-radius:12px;object-fit:cover;" />
                </td>
                <td style="width:1px;padding:0 12px;">
                  <table role="presentation" cellpadding="0" cellspacing="0"><tr><td width="1" height="42" style="width:1px;font-size:0;line-height:0;background:${dividerColor};">&nbsp;</td></tr></table>
                </td>
                <td style="vertical-align:middle;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
                  <div style="font-size:12px;font-weight:400;color:${textMuted};line-height:1.2;">The</div>
                  <div style="font-size:17px;font-weight:800;letter-spacing:-0.01em;color:${textPrimary};line-height:1.2;">Wisdom Church</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- DIVIDER -->
        <tr>
          <td class="wc-inner-pad" style="padding:0 36px;">
            <div style="border-top:1px solid ${dividerColor};"></div>
          </td>
        </tr>

        <!-- EDITORIAL HEADER (EYEBROW + TITLE + INTRO) -->
        <tr>
          <td class="wc-inner-pad" style="padding:28px 36px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
            ${
              config.editionEyebrow?.trim()
                ? `<p style="margin:0 0 10px;font-size:11.5px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${eyebrowColor};">${escapeHtml(
                    config.editionEyebrow.trim()
                  )}</p>`
                : ''
            }
            <h1 class="wc-main-title" style="margin:0 0 14px;font-size:30px;line-height:1.2;font-weight:800;letter-spacing:-0.02em;color:${textPrimary};">${escapeHtml(
              config.mainHeadline
            )}</h1>
            ${
              config.introBlurb?.trim()
                ? `<p style="margin:0;font-size:15px;line-height:1.65;color:${textSecondary};">${escapeHtml(
                    config.introBlurb
                  )}</p>`
                : ''
            }
          </td>
        </tr>

        <!-- IN-BODY STORY CARDS -->
        <tr>
          <td class="wc-inner-pad" style="padding:0 36px 8px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              ${renderedStories}
              ${quoteSectionHtml}
            </table>
          </td>
        </tr>

        <!-- FOOTER DIVIDER -->
        <tr>
          <td class="wc-inner-pad" style="padding:0 36px;">
            <div style="border-top:1px solid ${dividerColor};"></div>
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td class="wc-inner-pad" style="padding:26px 36px 36px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
            ${
              config.footerNote?.trim()
                ? `<p style="margin:0 0 14px;font-size:13px;line-height:1.5;color:${textSecondary};">${escapeHtml(
                    config.footerNote
                  )}</p>`
                : ''
            }
            <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:${textPrimary};">The Wisdom Church</p>
            <p style="margin:0 0 14px;font-size:12px;color:${textMuted};line-height:1.5;">Honour Gardens Event Center &bull; Alasia, Lekki-Epe Expressway, Lagos</p>
            <p style="margin:0;font-size:11.5px;color:${textMuted};">Prefer not to receive these emails? <a href="{{ .UnsubscribeURL }}" style="color:${isDark ? '#FBBF24' : '#B45309'};text-decoration:none;">Unsubscribe here</a>.</p>
          </td>
        </tr>

      </table>

    </td>
  </tr>
</table>
</body>
</html>`;
}

export function buildEditorialEmailText(config: EditorialTemplateConfig): string {
  const parts: string[] = [];

  if (config.editionEyebrow?.trim()) {
    parts.push(config.editionEyebrow.trim().toUpperCase());
  }

  parts.push(config.mainHeadline.trim());
  parts.push('--------------------------------------------------');

  if (config.introBlurb?.trim()) {
    parts.push(config.introBlurb.trim());
  }

  parts.push('');

  config.stories.forEach((story, idx) => {
    parts.push(`[${idx + 1}] ${story.title.toUpperCase()}`);
    if (story.badge?.trim()) {
      parts.push(`Category: ${story.badge.trim()}`);
    }
    parts.push(story.description);
    if (story.buttonText && story.buttonUrl) {
      parts.push(`${story.buttonText}: ${story.buttonUrl}`);
    }
    parts.push('');
  });

  if (config.quoteText?.trim()) {
    parts.push(config.quoteText);
    if (config.quoteAuthor) {
      parts.push(`— ${config.quoteAuthor}`);
    }
    parts.push('');
  }

  if (config.footerNote?.trim()) {
    parts.push(config.footerNote);
    parts.push('');
  }

  parts.push('The Wisdom Church');
  parts.push('Honour Gardens Event Center, Alasia, Lekki-Epe Expressway, Lagos');
  parts.push('Unsubscribe: {{ .UnsubscribeURL }}');

  return parts.join('\n');
}

export function parseEditorialConfigFromHtml(html: string): EditorialTemplateConfig | null {
  if (!html) return null;
  const startIdx = html.indexOf(META_PREFIX);
  if (startIdx === -1) return null;
  const endIdx = html.indexOf(META_SUFFIX, startIdx);
  if (endIdx === -1) return null;
  const rawJson = html.slice(startIdx + META_PREFIX.length, endIdx);
  try {
    const parsed = JSON.parse(rawJson);
    if (parsed && Array.isArray(parsed.stories)) {
      return parsed as EditorialTemplateConfig;
    }
  } catch {
    // ignore
  }
  return null;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
