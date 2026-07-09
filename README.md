# Wisdom Church Admin Portal

The administration portal for The Wisdom Church — used by staff to manage members, events,
forms/registrations, email/newsletter campaigns, content, and workforce/leadership records.

## Architecture

This repository is the **frontend only**. It's a Next.js (App Router) application that:

- Renders the entire admin UI (`src/app`, `src/components`, `src/ui`).
- Acts as a thin proxy/BFF to a separate backend service — every request under
  `/api/v1/*` (`src/app/api/v1/[...path]/route.ts`) is forwarded to the real API
  (`API_INTERNAL_URL` inside Docker, `NEXT_PUBLIC_API_URL` from the browser).

There is **no database, ORM, or business logic in this repo**. Auth, sessions, and all
domain data live in the backend service (`wisdom_api`). This app only holds session
state client-side (`src/providers/AuthProviders.tsx`) and never enforces auth in
`middleware.ts` — see the comment there for why.

## Local Development

All local development runs through Docker via the `Makefile`:

```bash
make dev          # start with hot reload (attached)
make dev-detach   # start in the background
make logs-dev      # tail logs
make shell        # shell into the dev container
```

Run `make help` to see every available target. See the top of the `Makefile` for the
environment variables the dev/prod profiles and production image build expect.

Without Docker, the usual Next.js scripts also work directly (`npm install && npm run dev`),
as long as `API_INTERNAL_URL`/`NEXT_PUBLIC_API_URL` point at a reachable backend.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript** (strict mode)
- **Tailwind CSS v4** (CSS-first config — design tokens live as CSS custom properties in
  `src/app/globals.css`, not in a `tailwind.config`)
- **TanStack Query** for data fetching/caching
- Custom component library in `src/ui/` (no third-party UI kit)

## Design System

`src/app/dashboard/design-system` is the living reference for every color token, type
scale, spacing/radius/shadow value, and shared component in light and dark mode. Check
it before adding a new color or hand-rolling a component — the answer is almost always
already there.

## Testing

- **Component tests** — [Vitest](https://vitest.dev) + React Testing Library, covering
  the `src/ui/` primitives (highest leverage: every page depends on these).
  ```bash
  npm run test        # run once
  npm run test:watch  # watch mode
  ```
  Test files live next to the component they cover (`src/ui/Button.test.tsx`).
- **End-to-end tests** — [Playwright](https://playwright.dev), covering the critical
  paths: login (incl. remember-me), MFA/TOTP setup + challenge, cross-tab session
  takeover, core CRUD on members/events/forms, and role-gating. Specs live in `e2e/`.
  ```bash
  npm run test:e2e
  ```
  This repo has **no mock backend** — there's no DB or business logic here to fake, so
  e2e specs run against a real `wisdom_api` instance. Anything beyond the login-page
  smoke checks needs live credentials, supplied via env vars and skipped automatically
  when absent (see `e2e/fixtures.ts`):
  - `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` — a regular admin account
  - `E2E_SUPER_ADMIN_EMAIL` / `E2E_SUPER_ADMIN_PASSWORD` — a super-admin account
  - `E2E_LOGIN_OTP_CODE` — a fixed test-only OTP code, if the test accounts have
    email-OTP MFA enabled
  - `E2E_BASE_URL` — target a deployed staging environment instead of a local dev
    server (also gates whether CI's `e2e` job runs at all — see `.github/workflows/ci.yml`)
- CI (`.github/workflows/ci.yml`) runs lint, typecheck, Vitest, and a production build on
  every pull request; the Playwright job only runs when `E2E_BASE_URL` is configured as
  a repo variable, so forks and contributors without staging access still get a green
  required-checks build.
- Deliberately **not** covered: page-level unit tests for all ~40 routes. TypeScript
  strict mode, the ESLint drift rules, and the e2e critical paths are the intended
  safety net there — see the Phase 6 notes in project history for the reasoning.

## Adding a New Page

1. **Reuse `src/ui/` primitives** (`Button`, `Card`, `Panel`, `SectionCard`, `StatCard`,
   `EmptyState`, `Input`, `Badge`, `Modal`, `Table`, `Pagination`, etc.) instead of
   hand-rolling page-local versions — this is enforced by an ESLint rule
   (`no-restricted-syntax` in `eslint.config.mjs`), not just convention. A local
   component named `Panel`/`StatCard`/`EmptyState`/`Badge`/`Modal`, or a raw `<input>`
   outside `src/ui/Input.tsx`, fails lint.
2. **Colors and spacing come from tokens**, not raw Tailwind color classes — use
   `var(--color-*)` (see `src/app/globals.css` and the design-system page above).
   `border-primary-600`, `text-secondary-900`, etc. reference color scales that don't
   exist in this project's Tailwind v4 config and render as invisible/broken styles.
3. **Charts** pull colors from `getChartPalette(resolvedTheme)`
   (`src/lib/charts/palette.ts`) instead of hardcoded hex — this keeps chart colors
   correct in both themes and consistent with the rest of the app.
4. **Data fetching** goes through a React Query hook against the relevant `src/lib/api`
   domain module — not a hand-rolled `useState`/`useEffect`/`useCallback` fetch loop.
5. **Auth gating**: wrap the default export in `withAuth(Component, { requiredRole })`
   (`src/providers/withAuth.tsx`) unless the route is intentionally public. Role/path
   rules live once in `src/lib/access.ts` — don't re-derive them locally.
6. **Add a component test** if you added a new `src/ui/` primitive, and an e2e spec in
   `e2e/` if you added a new critical user-facing flow (see Testing above).
- A pre-commit hook (`.githooks/pre-commit`, wired up via the `prepare` npm script) runs
  lint + typecheck + the Vitest suite before every commit.
