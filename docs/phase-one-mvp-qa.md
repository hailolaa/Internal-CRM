# Phase-One MVP QA

This is the QA note for checking Mission Control before the team starts relying on it for live leads, clients, proposals and onboarding work.

The goal here is simple: prove the core MVP flows work, catch anything obvious before go-live, and make sure we do not confuse internal Mission Control workflows with the old clinic-facing CRM.

## What Needs To Be Checked

These are the main flows I am treating as phase-one must-pass areas:

- Create and edit a lead.
- Capture a website lead into Mission Control.
- Capture a free guide lead and set the right next action.
- Detect or flag possible duplicates.
- Move leads/opportunities through the sales pipeline.
- Add notes, tasks and follow-ups.
- Use Growth Score and audit information in the sales flow.
- Create, preview, send/log and update proposal statuses.
- Convert a won deal into a client without losing sales history.
- Check onboarding, files/documents and missing access items on the client record.
- Confirm role/permission basics are safe.
- Check the main screens on desktop and mobile.

## Local QA Run - 29 July 2026

I ran the automated checks locally against the current repo.

Passed:

- Backend build passed.
- Backend targeted MVP QA passed: 28 tests passed, 0 failed.
- Frontend typecheck passed.
- Frontend lint passed with 0 errors. There are 15 existing warnings, but no blocking lint errors.
- Frontend tests passed: 43 tests passed across 11 test files.
- Frontend production build passed and generated 105 routes.
- `backend/db.sql` was not touched.

Backend flows covered by tests:

- Manual lead validation.
- Contact/lead activity.
- Website lead mapping.
- Free guide mapping.
- Pipeline movement and lost/won handling.
- Internal tasks and follow-ups.
- Client account creation, conversion, onboarding, files and access checks.
- Proposal create/preview/share/send/status logic.
- Roles and security basics.
- Scoro import template validation.

## Current Status

Automated QA is passing.


## Manual Browser QA Still Needed

Run the browser check on:

- Desktop: around `1440x900`
- Mobile: around `390x844`

Screens to check:

- Dashboard
- Prospect/lead list
- Lead detail
- Sales pipeline
- Tasks/follow-ups
- Growth Score/audit area
- Proposal list/edit/preview
- Client account detail
- Onboarding checklist
- Files/documents tab
- Missing access/assets
- Roles/permissions pages

What to look for:

- No clinic-facing wording where the screen is meant to be internal.
- No broken sidebar or subnav order.
- No horizontal overflow on mobile.
- Buttons and forms are usable.
- Records open the right detail pages.
- Back buttons return to the previous page where expected.
- Permission-restricted users cannot access admin/internal-only data.

## How To Re-Run The Checks

Backend:

```powershell
cd backend
npm run build
$env:NODE_ENV='test'; node --test --test-force-exit --test-concurrency=1 dist/test/test-contact-lead-validation.js dist/test/test-contact-linked-activity.js dist/test/test-website-lead-mapping.js dist/test/test-lead-hub.js dist/test/test-internal-delivery-tasks.js dist/test/test-client-accounts.js dist/test/test-proposals-public.js dist/test/test-proposals.js dist/test/test-roles-management.js dist/test/test-security.js dist/test/test-scoro-import-templates.js
```

Frontend:

```powershell
cd frontend
npm run typecheck
npm run lint
npm run test
npm run build
```

Checklist helper:

```powershell
cd backend
npm run qa:mvp
```

## Go-Live Call

My honest status:

The code-level MVP checks are in a good place. I would still do one proper browser pass before calling MC-055 done, especially around lead entry, proposal preview, client conversion, onboarding/files and mobile usability.

If that browser pass is clean, this card can be marked complete. If anything fails visually or in the live UI flow, it should be patched before the team starts using Mission Control for real records.
