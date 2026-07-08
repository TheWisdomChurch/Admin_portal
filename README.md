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

## Contributing

- Reuse `src/ui/` primitives (`Button`, `Card`, `Input`, `Badge`, `Modal`, `Table`,
  `StatCard`, `EmptyState`, etc.) instead of hand-rolling page-local versions — this is
  enforced by lint rules, not just convention.
- A pre-commit hook (`.githooks/pre-commit`, wired up via the `prepare` npm script) runs
  lint + typecheck before every commit.
