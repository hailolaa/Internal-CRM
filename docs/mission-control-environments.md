# Mission Control Environments

This document covers MC-002: safe dev, staging and production configuration for The Growth Group Mission Control internal CRM.

Mission Control is separate from the clinic-facing CRM. Do not reuse clinic-facing production domains, databases, email senders, Stripe keys, Twilio keys, OAuth credentials, or deployment targets.

## Environment Matrix

| Environment | Frontend | Backend API | Database | Env Templates |
| --- | --- | --- | --- | --- |
| Dev | `http://localhost:3000` | `http://localhost:4000/api` | `growth_group_internal_crm` | `backend/.env.example`, `frontend/.env.example` |
| Staging | `https://mission-control-staging.thegrowthgroup.com` | `https://api-mission-control-staging.thegrowthgroup.com/api` | `growth_group_internal_crm_staging` | `backend/.env.staging.example`, `frontend/.env.staging.example` |
| Production | `https://mission-control.thegrowthgroup.com` | `https://api-mission-control.thegrowthgroup.com/api` | `growth_group_internal_crm_prod` | `backend/.env.production.example`, `frontend/.env.production.example` |

The staging and production URLs are documented targets. The actual hosting provider should store these values in its secret/environment manager.

## Dev Setup

1. Create the local database:

```bash
mysql -u root -p < backend/db.sql
```

2. Configure backend:

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

3. Configure frontend in another terminal:

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:3000`.

## Build Checks

Run these before staging or production deployment:

```bash
cd backend
npm run build
```

```bash
cd frontend
npm run typecheck
npm run build
```

## Staging Deploy Rules

- Deploy from the internal CRM repo/branch only.
- Use staging domains and `growth_group_internal_crm_staging`.
- Keep all provider secrets in the staging host secret manager.
- Use test/sandbox keys for Stripe, Twilio, email and OAuth until explicitly approved.
- Run a smoke test after deploy: login, open dashboard, add prospect, move pipeline stage, add/link client, create task, confirm upcoming/overdue task views.

## Production Target Rules

- Production is The Growth Group internal Mission Control, not the clinic CRM.
- Use production domains and `growth_group_internal_crm_prod`.
- Do not point production at `clinicgrower.ai`, the clinic-facing database, or clinic-facing vendor credentials.
- Require a successful staging deploy and smoke test before promoting the same source version.
- Take a database backup immediately before production deploy.

## Secrets Policy

- Real `.env` files are ignored by Git.
- Only `.env.example`, `.env.staging.example`, and `.env.production.example` files should be committed.
- Example files must keep secrets blank or clearly fake.
- Rotate any credential immediately if it is accidentally committed.

## Backup And Rollback

Before production deploy:

```bash
cd backend
npm run db:backup
```

Keep the backup file path and SHA256 from the command output in the deploy notes.

Rollback app code:

1. Redeploy the previous known-good artifact, image, tag, or commit.
2. Confirm backend health and frontend login.
3. Run the MVP smoke test.

Rollback database only when needed:

```bash
cd backend
npm run db:restore -- path/to/backup.sql
```

Use database restore only if the deploy changed data or schema in a way that cannot be fixed forward safely. Confirm the target `DB_NAME` before restore so staging and production are never crossed.

## Fresh Database Rule

For this internal CRM, `backend/db.sql` is the source of truth for fresh dev/staging database creation. If schema or seed data changes, update `backend/db.sql` and recreate the environment from that file.
