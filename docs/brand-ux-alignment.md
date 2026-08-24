# ClinicGrower Brand and UX Alignment

This note records the shared front-end conventions used across Mission Control, Clinic OS-facing surfaces and analytics/reporting views.

## Shared Identity

- Product family: ClinicGrower
- Internal operating product: ClinicGrower Mission Control
- Clinic-facing language: Clinic OS or ClinicGrower OS, depending on the surface
- Analytics/reporting language: ClinicGrower analytics, benchmarks, reports and score views

The shared logo source is `frontend/components/brand/ClinicGrowerLogo.tsx`, backed by the checked-in assets under `frontend/public/brand/`.

## Typography

The app root loads Inter and Plus Jakarta Sans in `frontend/app/layout.tsx`.

- Inter is the default application UI typeface.
- Plus Jakarta Sans is available through `--font-jakarta` for proposal and brand-forward surfaces.

## Palette

The canonical Mission Control palette lives in `frontend/styles/tokens.css`.

- Primary dark: `#151f21`
- Secondary surface: `#eaedeb`
- Accent green: `#60b4af`
- Muted teal: `#5e8a8d`
- Copper: `#b7672e`

New Mission Control, Clinic OS and analytics UI should use these tokens or existing component classes before introducing new colours.

## Components

Shared UI primitives live in `frontend/components/ui/`. Product pages should prefer these components and the global component classes from `frontend/app/globals.css` for cards, buttons, forms, tables, badges and layout rhythm.

## Product Boundaries

- Mission Control is the internal CRM and operations layer.
- Clinic OS / ClinicGrower OS is the clinic-facing operating-system language.
- Analytics views should use the same palette and component primitives, but should not introduce a separate analytics brand.

## Guardrails

- Do not introduce a second logo system.
- Do not introduce a competing colour palette for analytics or Clinic OS surfaces.
- Do not mix legacy Internal CRM wording with client-facing ClinicGrower OS proposal language.
- Keep public/proposal-specific V19 styling inside the proposal renderer, not general CRM screens.
