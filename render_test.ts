import { buildFormEmailHTML, buildFormEmailTextBody } from './src/lib/formEmailTemplates';

const html = buildFormEmailHTML({
  title: 'Youth Conference 2026',
  eyebrow: 'Registration',
  heading: 'You are registered!',
  message: 'Thanks for signing up. We cannot wait to see you there.',
  logoUrl: 'https://api.wisdomchurchhq.org/assets/logo.webp',
  calendarEvent: { title: 'Youth Conference', startAt: '2026-08-01T10:00:00Z', location: 'Main Hall' },
  resourceLinks: [{ label: 'Event Flyer', url: 'https://example.com/flyer.pdf', kind: 'flyer' }],
  ctaLabel: 'View details',
  ctaUrl: 'https://example.com/event',
  footerNote: 'See you soon!',
});

console.log('LENGTH', html.length);
console.log('HAS_DOCTYPE', html.startsWith('<!doctype html>'));
console.log('HAS_LOGO', html.includes('assets/logo.webp'));
console.log('HAS_OLD_DARK_HEADER', html.includes('#111827'));
console.log('HAS_OLD_ROUNDED_16', html.includes('border-radius:16px'));
console.log('BALANCED_DIVS', (html.match(/<div/g) || []).length === (html.match(/<\/div>/g) || []).length);
console.log('BALANCED_TABLES', (html.match(/<table/g) || []).length === (html.match(/<\/table>/g) || []).length);
console.log('BALANCED_TRS', (html.match(/<tr>/g) || []).length === (html.match(/<\/tr>/g) || []).length);
console.log('BALANCED_TDS', (html.match(/<td/g) || []).length === (html.match(/<\/td>/g) || []).length);

const text = buildFormEmailTextBody({
  title: 'Youth Conference 2026',
  heading: 'You are registered!',
  message: 'Thanks for signing up.',
});
console.log('---TEXT---');
console.log(text);
