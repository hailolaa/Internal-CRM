# ClinicGrower CRM — Frontend Architecture

> Last updated: 5 May 2026
> Applies to: the Next.js 14+ App Router frontend hosted on Sintra

---

## Folder Structure & Responsibilities

src/
├── app/ # Next.js App Router — pages and layouts only
│ ├── layout.tsx # Root layout (html, body, fonts, metadata)
│ ├── globals.css # Tailwind directives + design tokens + component layer
│ ├── page.tsx # Marketing landing page (/)
│ ├── login/ # Auth pages (login, signup, forgot-password)
│ ├── onboarding/ # Post-signup onboarding wizard
│ └── app/ # Authenticated app shell
│ ├── layout.tsx # App shell (sidebar, topbar, providers, error boundary)
│ ├── page.tsx # Redirect → /app/revenue
│ ├── not-found.tsx # App-scoped 404
│ ├── revenue/ # Revenue Command Centre
│ ├── crm/ # CRM module (contacts, pipeline, calendar, tasks, forms)
│ │ └── layout.tsx # SubNav for CRM tabs
│ ├── comms/ # Communications (inbox, calls, templates, sequences)
│ │ └── layout.tsx # SubNav for comms tabs
│ ├── ai/ # AI layer (growth brief, campaign analyst, agents, etc.)
│ │ └── layout.tsx # SubNav for AI tabs
│ └── settings/ # Settings (clinic, team, billing, security, compliance)
│ └── layout.tsx # Settings sidebar nav
├── components/
│ ├── ui/ # Primitive UI components (Card, StatCard, Badge, etc.)
│ │ ├── index.ts # Barrel export — import everything from "@/components/ui"
│ │ ├── cards.tsx # Card, DarkCard, StatCard, SectionHeader
│ │ ├── badges.tsx # Badge, StatusBadge, PhaseBadge
│ │ ├── forms.tsx # FormField, SearchInput, FilterTabs
│ │ ├── tables.tsx # DataTable, TableRow, TableCell, MoreButton
│ │ ├── table-controls.tsx # SortableHeader, PaginationControls, ValidatedInput
│ │ ├── layout.tsx # PageHeader, EmptyState, FeatureGatePage, AlertBanner, ProgressBar, Avatar
│ │ ├── metrics.tsx # KPIGrid, MetricCard, SimpleStatCard
│ │ ├── toggle.tsx # Toggle, SettingRow
│ │ ├── shared.tsx # StepProgress, DashedAddButton, InfoRow, DetailGrid
│ │ ├── skeletons.tsx # Loading state skeletons
│ │ ├── toast.tsx # ToastContainer
│ │ └── error-boundary.tsx # ErrorBoundary, ErrorFallback
│ ├── templates/ # Page-level templates that eliminate duplication
│ │ ├── agent-page.tsx # AgentPageTemplate (used by 8 agent pages)
│ │ ├── tool-page.tsx # ToolPageTemplate (used by 3 AI tool pages)
│ │ ├── report-page.tsx # ReportPageTemplate, SourceTable, BreakdownBars
│ │ └── inbox-page.tsx # ConversationItem, MessagePanel (shared inbox UI)
│ ├── calls/ # Call tracking components (call-row, call-badges, etc.)
│ ├── sla/ # SLA components (lead table, breach log, config panel)
│ ├── treatment-plans/ # Treatment plan modal
│ ├── sidebar.tsx # Main navigation sidebar
│ ├── top-bar.tsx # Top bar with tenant switcher
│ ├── sub-nav.tsx # Horizontal sub-navigation tabs
│ └── tenant-switcher.tsx # Clinic/tenant switcher dropdown
├── hooks/
│ ├── index.ts # General hooks (useClipboard, useFormFields, useToggle, etc.)
│ ├── use-table.ts # usePagination, useSorting, useFilteredSortedPaginated
│ └── use-validation.ts # useFormValidation + pre-built schemas
├── lib/
│ ├── constants.ts # LOGO_URL, ROUTES, PAGE_TITLES, APP_NAME
│ ├── data.ts # Shared mock data (contacts, agents, treatments, etc.)
│ ├── mock-data.ts # Page-specific mock data (appointments, tasks, reviews)
│ ├── call-data.ts # Call tracking types, mock records, stat helpers, display config
│ ├── navigation.ts # NAV_SECTIONS, BOTTOM_NAV — sidebar structure
│ ├── types.ts # Shared TypeScript types (AuthUser, NavItem, StatCardData, etc.)
│ ├── utils.ts # Pure utility functions (cn, formatCurrency, getInitials, etc.)
│ ├── colors.ts # Accent colour maps and status colour helpers
│ ├── export-utils.ts # CSV/text export functions
│ ├── providers.tsx # AppProviders — composes all context providers
│ ├── auth-context.tsx # Auth context (JWT simulation, role permissions)
│ ├── tenant-context.tsx # Multi-tenancy context (clinic scoping)
│ ├── audit-context.tsx # Audit log context (action tracking)
│ ├── event-bus.tsx # Event bus context (event emission)
│ ├── webhook-context.tsx # Webhook ingestion context
│ └── toast-context.tsx # Toast notification context
└── docs/
└── architecture.md # This file

---

## Page File Rules

1. **Every page is a `page.tsx`** inside `src/app/`. No pages in `pages/` (App Router only).
2. **Pages are thin.** They import components and compose them. Heavy logic lives in components or hooks.
3. **`"use client"` at the top** of every page that uses hooks, state, or event handlers.
4. **No `export const metadata`** from `"use client"` files. If a page needs both metadata and interactivity, split into `layout.tsx` (server, metadata) + `page.tsx` (client, interactivity).
5. **No dynamic route segments** (`[slug]`, `[id]`). Static export requires all pages known at build time. Create each page as its own directory.
6. **Redirect pages** use `useRouter().replace()` inside `useEffect` (e.g. `/app/page.tsx` → `/app/revenue`).

---

## Component Rules

1. **UI primitives** live in `src/components/ui/`. They are generic, reusable, and have no business logic.
2. **Page templates** live in `src/components/templates/`. They eliminate duplication across similar pages (e.g. 8 agent pages share `AgentPageTemplate`).
3. **Domain components** live in named directories (e.g. `src/components/calls/`, `src/components/sla/`).
4. **Barrel exports** — `src/components/ui/index.ts` re-exports everything. Import from `@/components/ui` not from individual files.
5. **Keep files under 150 lines** where possible. Extract sections into separate components when a file grows.
6. **Every interactive component** must have `"use client"` at the top.
7. **No `next/image`** — use `<img>` tags. The static export has no image optimisation server.

---

## Hook Rules

1. **General hooks** in `src/hooks/index.ts` — `useClipboard`, `useFormFields`, `useSimulatedAction`, `useToggle`, `useStepWizard`, etc.
2. **Table hooks** in `src/hooks/use-table.ts` — `usePagination`, `useSorting`, `useFilteredSortedPaginated`.
3. **Validation hooks** in `src/hooks/use-validation.ts` — `useFormValidation` with pre-built schemas.
4. **Hooks never import components.** They return data and callbacks only.
5. **Hooks are always `"use client"`** (they use React hooks internally).

---

## Data Module Rules

1. **`src/lib/data.ts`** — shared constants used across multiple pages (contacts, agents, treatments, stage colours).
2. **`src/lib/mock-data.ts`** — page-specific mock data (appointments, tasks, reviews, integrations).
3. **`src/lib/call-data.ts`** — call tracking types, mock records, stat helpers, display config.
4. **All mock data is `as const`** where possible for type safety.
5. **No API calls.** Everything is client-side mock data. When the API layer is built, data modules will be replaced with fetch calls or React Query hooks.

---

## Context / Provider Rules

1. **All providers** are composed in `src/lib/providers.tsx` (`AppProviders`).
2. **Provider order matters** — outermost to innermost: Auth → Tenant → EventBus → Audit → Webhook → Toast.
3. **Every context** exports:
   - A `Provider` component
   - A `useX()` hook (throws if outside provider)
   - A `useXSafe()` hook (returns null if outside provider)
4. **Contexts are mock implementations.** They simulate what the real backend will do. Replace internals, keep the interface.
5. **`AppProviders` wraps the app shell** (`src/app/app/layout.tsx`), not the root layout. Auth pages don't need providers.

---

## Styling Conventions

1. **Tailwind CSS only.** No CSS modules, no styled-components, no inline `style` objects (except for dynamic `width`/`height` percentages).
2. **Design tokens** are CSS variables in `globals.css` (`:root` block) — surfaces, borders, text, accents.
3. **Component-layer classes** in `globals.css` `@layer components` — `btn-primary`, `btn-secondary`, `input-base`, `input-with-icon`, `surface-card`, `table-header`, etc.
4. **Colour convention:** use `/10` opacity variants for backgrounds, `/30` for borders, full colour for text. Example: `bg-teal-500/10 text-teal-400 border-teal-500/30`.
5. **Dark theme only.** Base background is `#0B0F1A`. Cards use `bg-white/5`. No light mode.
6. **Responsive:** mobile-first. Use `sm:`, `md:`, `lg:`, `xl:` breakpoints. Tables hide columns with `hidden md:table-cell`.
7. **Animations:** `animate-fade-in`, `animate-slide-in`, `animate-scale-in` defined in `globals.css`.

---

## TypeScript Conventions

1. **Strict mode.** All types explicit. No `any`.
2. **Shared types** in `src/lib/types.ts` — `AuthUser`, `NavItem`, `StatCardData`, `FormFieldConfig`, etc.
3. **Component props** are inline interfaces or imported types. No `React.FC` — use plain function declarations.
4. **`as const`** on static data arrays for literal type inference.
5. **Enums are string unions** (e.g. `type UserRole = "SUPER_ADMIN" | "CLINIC_ADMIN" | ...`), not TypeScript `enum`.
6. **Record types** for config maps (e.g. `Record<string, { color: string; label: string }>`).

---

## Naming Conventions

| Thing        | Convention                                        | Example                          |
| ------------ | ------------------------------------------------- | -------------------------------- |
| Page files   | `page.tsx` in route directory                     | `src/app/app/revenue/page.tsx`   |
| Layout files | `layout.tsx` in route directory                   | `src/app/app/crm/layout.tsx`     |
| Components   | `kebab-case.tsx`                                  | `call-detail-panel.tsx`          |
| Hooks        | `use-kebab-case.ts`                               | `use-table.ts`                   |
| Lib modules  | `kebab-case.ts` or `kebab-case.tsx`               | `audit-context.tsx`              |
| Types        | `PascalCase`                                      | `AuthUser`, `CallRecord`         |
| Constants    | `UPPER_SNAKE_CASE`                                | `LOGO_URL`, `ROUTES`             |
| CSS classes  | Tailwind utilities or `@layer components` classes | `btn-primary`, `surface-card`    |
| Colour props | lowercase string matching Tailwind palette        | `color="teal"`, `color="violet"` |

---

## Accessibility Conventions

1. **Every icon-only button must have `aria-label`.** Describe the action, not the icon.
2. **Interactive cards** that contain nested buttons use `role="button"` + `tabIndex={0}` + `onKeyDown` (Enter/Space) on the outer element, with real `<button>` elements inside.
3. **Focus indicators:** use `focus-visible:ring-2 focus-visible:ring-teal-400` on custom interactive elements.
4. **Semantic HTML:** `<nav>`, `<main>`, `<section>`, `<table>` with `<thead>`/`<tbody>`, `<button>` for actions, `<a>`/`<Link>` for navigation.
5. **Form labels:** every input has a visible `<label>` or `aria-label`.
6. **Status communication:** use `aria-expanded` on expandable elements, `aria-valuenow`/`aria-valuemin`/`aria-valuemax` on sliders/progress.
7. **Colour is never the only indicator.** Status badges include text labels alongside colour.

---

## What Not To Do

- **Don't create `next.config.js`**, `package.json`, or `tsconfig.json`.
- **Don't use `next/image`.** Use `<img>` tags.
- **Don't use dynamic routes** (`[slug]`, `[id]`). Static export only.
- **Don't export `metadata` from `"use client"` files.**
- **Don't put pages in `pages/`.** App Router only.
- **Don't use `React.FC`.** Use plain function declarations.
- **Don't use TypeScript `enum`.** Use string union types.
- **Don't use `any`.** Type everything.
- **Don't import unused modules.** Build will fail.
- **Don't use absolute URLs for internal links.**
- **Don't use placeholder image URLs.**
- **Don't put business logic in components.**
- **Don't create icon-only buttons without `aria-label`.**
- **Don't nest `<button>` inside `<button>`.**
- **Don't delete the website to fix build errors.**
