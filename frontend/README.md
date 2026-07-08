# ClinicGrower CRM Frontend

Next.js frontend for the ClinicGrower CRM / Clinic Performance OS.

The app is an authenticated, work-focused CRM and performance command centre for clinics and the ClinicGrower internal team. It connects to the Express/MySQL backend and exposes revenue, leakage, leads, tasks, reports, operations, AI workspace and settings workflows.

## Current Features

- Authenticated app shell with sidebar navigation, settings, billing and account flows.
- Signup and embedded Stripe checkout flow.
- Performance Dashboard at `/app/revenue` with live backend data, executive summary, revenue, leakage, opportunities, source/channel, treatment and funnel cards.
- Revenue Leakage workspace at `/app/leakage` with live leakage categories, dedicated backend detail records, drill-down tables and Revenue Insights panel.
- Revenue Insights actions from `/app/leakage`: generate insights, resolve insights and create linked clinic action tasks.
- Monthly Action Plan workspace at `/app/action-plan` with month selector, deterministic plan generation, summary metrics, active/completed action items, plan completion and item complete/skip actions.
- Lead & Conversion page at `/app/leads` with live lead list, search/filter behavior and lead detail drawer with metadata, interests, tags, notes, timeline events and linked calls/forms/bookings/messages.
- CRM pages for contacts, pipeline, calendar, forms and tasks.
- Communications pages for calls, inbox, templates and sequences.
- SLA / speed-to-lead page and call list/detail/recording views.
- Reports pages for overview, leads, ads and no-shows, plus generated monthly report detail, print/PDF and secure share-link views.
- Treatment plan, treatment settings, deposit tracking, manual spend and manual consult workflows.
- Marketing pages for attribution, campaigns, offers and reviews.
- Client account operations dashboard at `/app/ops/client-accounts` with all-client summary, risk and delivery pressure alerts, current-month action plan health, internal tasks, QA and strategy context.
- Operations pages for team, roles, SOPs, integrations, compliance and background jobs.
- AI workspace and AI tool pages, including growth brief, campaign analyst, sales assistant, show-rate predictor, LTV optimiser, projects, runs and agent directory.
- API reference, database schema view, audit log and definitions pages.

## In Progress / Partial Features

- OpenAI-backed insights are not connected yet; current revenue insights are deterministic backend records from leakage data.
- Monthly Action Plan v1 is usable, and internal client account pages now surface current-month plan health/status.
- Revenue Leakage has detail tables, but deeper links to message/form/booking/treatment/monthly-plan context are still pending.
- Reporting Centre pages include generated monthly reports, authenticated detail views, browser print/PDF output and secure public share links.
- Lead detail now includes linked calls, messages, forms and bookings; deeper edit/actions from those linked records are still pending.
- Call intelligence has call list/detail/recording support, but transcript ingestion, AI summaries and quality scoring are incomplete.
- Treatment intelligence has catalog/settings and revenue reporting, but treatment performance detail pages and per-treatment ROI are still pending.
- Internal Control Centre has client summaries, alerts and action-plan status, but package-level plan data and richer owner/status fields are pending.

## Pending Features

- OpenAI/service-backed insight generation and call summaries.
- Dedicated alert inbox/detail views if alerts become separate from insights.
- Team performance dashboard and individual team accountability views.
- Dedicated report share revocation/expiry management if pilots need shared links to be managed after creation.
- Production Google Ads, Meta, GBP, GA4, SEO and OpenAI integration UX.
- Complete end-to-end attribution journey from lead source to revenue, insight and action.
- More browser-level verification for key workflows once a browser environment is available.

## Tech Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Lucide React icons
- Stripe React SDK
- Vitest
- ESLint

## Install

```bash
npm install
cp .env.example .env
```

Minimum local `.env` values:

```bash
NEXT_PUBLIC_API_BASE_URL="http://localhost:3000/api"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_LOGO_URL="https://example.com/logo.png"
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
```

Only put browser-safe values in `NEXT_PUBLIC_*` variables. Next.js bundles those values into browser code.

## Run

Development:

```bash
npm run dev
```

Production build:

```bash
npm run build
```

Production-style start:

```bash
npm run start
```

The default Next.js dev server runs on `http://localhost:3000`. If your backend is also on port `3000`, run one service on a different port and update `NEXT_PUBLIC_API_BASE_URL` accordingly.

## Verification

```bash
npm run lint
npm run typecheck
npm run build
npm run test
```

The most recent verified checks for the Phase 1 work were:

```bash
npm run lint
npm run typecheck
npm run build
```

## Backend Dependency

The frontend expects the backend API to expose these current contracts:

- `/api/auth`
- `/api/reports/dashboard/summary`
- `/api/reports/dashboard/funnel`
- `/api/reports/dashboard/revenue-by-channel`
- `/api/reports/dashboard/revenue-by-treatment`
- `/api/reports/dashboard/revenue-leaks`
- `/api/reports/dashboard/revenue-leak-details`
- `/api/reports/dashboard/top-opportunities`
- `/api/insights`
- `/api/insights/generate`
- `/api/insights/:id/status`
- `/api/insights/:id/task`
- `/api/monthly-action-plans`
- `/api/monthly-action-plans/generate`
- `/api/monthly-action-plans/:id/status`
- `/api/monthly-action-plans/:planId/items/:itemId/status`
- `/api/tasks`
- `/api/client-accounts`

Set `NEXT_PUBLIC_API_BASE_URL` to the backend `/api` URL.

## Key Routes

- `/app/revenue` - Performance Dashboard
- `/app/leakage` - Revenue Leakage and Revenue Insights
- `/app/action-plan` - Monthly Action Plan
- `/app/leads` - Lead & Conversion
- `/app/crm/tasks` - Clinic Tasks
- `/app/comms/calls` - Call Log
- `/app/sla` - Speed-to-Lead
- `/app/reports/overview` - Reports
- `/app/ops/client-accounts` - Internal Client Accounts
- `/app/settings` - Settings

## Project Notes

- API clients live under `lib/api-client`.
- Shared API response types live under `lib/api-types`.
- Feature hooks live under `hooks`.
- Page-level UI is usually split between `app/app/.../page.tsx`, `components/...` and a matching hook.
- Current build-state documentation lives in `docs/current-phase-1-build-state.md`.
- Monthly Action Plan implementation plan lives in `docs/monthly-action-plan/plan.md`.
