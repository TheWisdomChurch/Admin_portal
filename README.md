# Wisdom Church Admin Portal

The administration portal for The Wisdom Church — used by staff to manage members, events,
forms/registrations, email/newsletter campaigns, content, and workforce/leadership records.

## Architecture

This repository is the **frontend only**. It's a Next.js (App Router) application that:

- Renders the entire admin UI (`src/app`, `src/components`, `src/ui`).
- Acts as a thin proxy/BFF to a separate backend service — every request under
  `/api/v1/*` (`src/app/api/v1/[...path]/route.ts`) is forwarded to the real API
  (`API_INTERNAL_URL` inside Docker). The backend origin remains server-side;
  browser requests stay same-origin so HttpOnly cookies and CSRF protection work
  consistently.

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
as long as `API_INTERNAL_URL` points at a reachable backend (for example,
`http://localhost:8080`). Set `NEXT_PUBLIC_API_PROXY=false` only when intentionally
running direct cross-origin API requests with the backend CORS and cookie domains
configured for that topology.

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

## Quality checks

Run `npm run precommit` before publishing changes. It validates lint rules,
TypeScript, and the optimized production build.

## Production configuration

The browser should use the same-origin `/api/v1` BFF (`NEXT_PUBLIC_API_PROXY=true`).
Keep the private service address in the runtime-only `API_INTERNAL_URL`; do not expose
database credentials, provider keys, or internal hostnames through `NEXT_PUBLIC_*`
variables.

- `API_INTERNAL_URL`: backend address reachable only from the admin container.
- `ADMIN_PUBLIC_ORIGIN`: canonical HTTPS admin origin used for trusted forwarding
  headers, for example `https://admin.wisdomchurchhq.org`.
- `NEXT_PUBLIC_SITE_URL`: public site URL used for links and metadata.
- `CSRF_HEADER_NAME`: optional custom backend CSRF header. It must match the backend
  configuration; the default is `X-CSRF-Token`.
- `NEXT_PUBLIC_PRIVACY_NOTICE_VERSION`: stable version recorded with form consent.
  Increment it only after the meaning of the privacy notice changes.

The production image runs as an unprivileged user and includes a health check. The
Compose development and production profiles build explicit Dockerfile stages; run
`docker compose --profile dev --profile prod config --quiet` when changing deployment
configuration.

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
- A pre-commit hook (`.githooks/pre-commit`, wired up via the `prepare` npm script) runs
  lint, typecheck, and the optimized production build before every commit.
