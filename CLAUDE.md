# NoLimits Support

> **Monorepo Integration Note:** This app will be integrated into the nolimitsOS monorepo (pnpm workspaces). It should eventually live at `apps/support-desk/` and use shared packages from `packages/*`.

## Overview

Internal customer support helpdesk built with Next.js 16, TypeScript, Tailwind CSS v4, and Supabase.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Database:** Supabase (PostgreSQL + Auth + Realtime)
- **Styling:** Tailwind CSS v4
- **UI Components:** Radix UI primitives
- **Validation:** Zod
- **Charts:** Recharts

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Auth routes (login)
│   └── (dashboard)/       # Protected dashboard routes
├── components/
│   ├── layout/            # Sidebar, header
│   ├── providers/         # Auth, realtime providers
│   ├── reports/           # Dashboard charts
│   ├── settings/          # Settings page components
│   ├── tickets/           # Ticket management components
│   └── ui/                # Base UI components
├── lib/
│   ├── actions/           # Server actions with Zod validation
│   ├── supabase/          # Supabase client utilities
│   ├── validations/       # Zod schemas (shared)
│   └── utils.ts           # Utility functions
supabase/
└── migrations/            # SQL migrations
```

## Key Patterns

- **Data Mutations:** Server Actions with Zod validation
- **Auth:** Supabase Auth with middleware protection
- **Security:** Row-Level Security (RLS) at database level
- **State:** URL params for filters, React Context for auth/theme only
- **Realtime:** Supabase channels for live updates

## Development

```bash
pnpm dev      # Start dev server
pnpm build    # Production build
pnpm lint     # Run ESLint
```

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```
