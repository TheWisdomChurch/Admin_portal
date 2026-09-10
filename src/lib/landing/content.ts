/**
 * Landing page content — the single source of truth for every string and
 * list the marketing page renders. The page component holds layout only;
 * nothing structural (copy, nav items, metrics, capability pillars) is
 * hardcoded in JSX. Swap wording or reorder sections here without touching
 * markup.
 */
import type { LucideIcon } from 'lucide-react';
import {
  BellRing,
  CalendarCheck2,
  ClipboardCheck,
  Fingerprint,
  HeartHandshake,
  History,
  MessagesSquare,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';

export const ORG = {
  name: 'The Wisdom Church',
  system: 'Administration',
  /** Lives in /public so it is served same-origin (CSP img-src 'self'). */
  logoSrc: '/OIP.webp',
} as const;

export const ROUTES = {
  signIn: '/login',
  requestAccess: '/register',
  home: '/',
} as const;

/**
 * Optional cinematic hero clip. Drop a short, muted, ~6–12s loop into
 * /public (e.g. /public/hero.mp4) and set NEXT_PUBLIC_HERO_VIDEO_URL=/hero.mp4.
 * It must be same-origin — the CSP blocks cross-origin media. When unset the
 * hero falls back to the animated aurora field alone, which is the default.
 */
export const HERO_MEDIA = {
  videoUrl: process.env.NEXT_PUBLIC_HERO_VIDEO_URL?.trim() ?? '',
  posterUrl: process.env.NEXT_PUBLIC_HERO_POSTER_URL?.trim() ?? '',
} as const;

export interface CtaLink {
  label: string;
  href: string;
}

export const HEADER = {
  assurance: 'Secure staff access',
  signIn: { label: 'Sign in', href: ROUTES.signIn } satisfies CtaLink,
  requestAccess: { label: 'Request access', href: ROUTES.requestAccess } satisfies CtaLink,
} as const;

export const HERO = {
  eyebrow: 'Ministry operations, elevated',
  titleLead: 'Lead with clarity.',
  titleAccent: 'Care with intention.',
  subtitle:
    `One secure command centre for the people, communication, governance, and daily operations behind ${ORG.name}.`,
  primaryCta: { label: 'Enter administration', href: ROUTES.signIn } satisfies CtaLink,
  secondaryCta: { label: 'Request an account', href: ROUTES.requestAccess } satisfies CtaLink,
  markers: ['Role-based access', 'Protected member data', 'Auditable approvals'],
} as const;

export interface Capability {
  icon: LucideIcon;
  title: string;
  description: string;
}

export const CAPABILITIES: Capability[] = [
  {
    icon: UsersRound,
    title: 'People care',
    description:
      'Members, workforce, leadership, birthdays and anniversaries in one accountable workspace.',
  },
  {
    icon: ClipboardCheck,
    title: 'Intelligent forms',
    description:
      'Build structured intake journeys, review responses, and export leadership-ready information.',
  },
  {
    icon: CalendarCheck2,
    title: 'Church operations',
    description:
      'Coordinate events, attendance, ministries, cell groups, approvals and service activity.',
  },
  {
    icon: MessagesSquare,
    title: 'Communication',
    description:
      'Deliver relevant campaigns, notifications, greetings and follow-up from trusted data.',
  },
];

export interface AssurancePoint {
  icon: LucideIcon;
  title: string;
  description: string;
}

export const ASSURANCE = {
  eyebrow: 'Built for trust',
  title: 'Governance and security are the foundation, not an add-on.',
  description:
    'Every action is scoped to a role, verified at sign-in, and recorded — so leadership can delegate with confidence.',
  points: [
    {
      icon: Fingerprint,
      title: 'Verified access',
      description: 'Multi-factor sign-in and secure sessions for every staff account.',
    },
    {
      icon: ShieldCheck,
      title: 'Role-scoped permissions',
      description: 'People only see and change what their responsibility allows.',
    },
    {
      icon: History,
      title: 'Auditable approvals',
      description: 'Sensitive changes route through review and leave a full history.',
    },
    {
      icon: BellRing,
      title: 'Governed communication',
      description: 'Outreach draws from current, consented records — never stale exports.',
    },
  ] satisfies AssurancePoint[],
} as const;

export type ReadinessTone = 'success' | 'warning' | 'info';

export const PREVIEW = {
  label: 'Operations overview',
  status: 'Live',
  nav: ['Overview', 'People', 'Forms', 'Events', 'Campaigns'],
  workspaceEyebrow: 'Secure workspace',
  heading: 'Ministry at a glance',
  guard: {
    title: 'Protected workspace',
    note: 'Security and governance are active.',
  },
  metrics: [
    { label: 'People', value: 'Unified' },
    { label: 'Events', value: 'Planned' },
    { label: 'Responses', value: 'Tracked' },
    { label: 'Serving', value: 'Visible' },
  ],
  readiness: {
    title: 'Operational readiness',
    note: 'Live after secure sign-in',
    status: 'Connected',
    rows: [
      { label: 'Member engagement', value: 'Connected', tone: 'success' as ReadinessTone },
      { label: 'Volunteer care', value: 'Visible', tone: 'warning' as ReadinessTone },
      { label: 'Follow-up workflow', value: 'Ready', tone: 'info' as ReadinessTone },
    ],
  },
  care: {
    title: 'People care today',
    note: 'Keep important moments and follow-up visible.',
    items: ['Birthdays', 'Anniversaries', 'Approval requests'],
  },
  insight: {
    icon: HeartHandshake,
    title: 'Leadership intelligence',
    note: 'Recommendations generated from current operational data.',
  },
  float: {
    icon: ShieldCheck,
    title: 'Secure by design',
    note: 'MFA · permissions · audit history',
  },
} as const;

export const CTA = {
  eyebrow: 'Authorized personnel only',
  title: 'Ready to continue the work?',
  subtitle:
    'Access is protected by role permissions, multi-factor authentication, secure sessions and auditable governance.',
  primary: { label: 'Sign in securely', href: ROUTES.signIn } satisfies CtaLink,
  secondary: { label: 'Request access', href: ROUTES.requestAccess } satisfies CtaLink,
} as const;

export const FOOTER = {
  note: 'Internal administration system.',
  links: [
    { label: 'Sign in', href: ROUTES.signIn },
    { label: 'Request access', href: ROUTES.requestAccess },
  ] satisfies CtaLink[],
} as const;
