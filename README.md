# ClinicGrower Mission Control

Internal Mission Control system forked from the existing clinic CRM codebase.

This repository is the isolated internal system for the ClinicGrower/The Growth Group team. It must not be used as the clinic-facing production launch project, and clinic-facing production API, app, database, email, Stripe, Twilio, or OAuth settings should not be copied into this environment.

## MC-001 Isolation Notes

- Separate project/repo: this working copy points at `https://github.com/hailolaa/Internal-CRM.git`.
- Separate database: fresh local/dev databases should use `growth_group_internal_crm`.
- Source of truth for a fresh database is [backend/db.sql](backend/db.sql).
- Local environment files are intentionally ignored by Git. Copy the tracked examples and fill in local/internal values only:
  - `backend/.env.example` -> `backend/.env`
  - `frontend/.env.example` -> `frontend/.env`
- The env examples are localhost-first and must stay separate from the clinic-facing production environment.

## Local Setup

1. Create the database from the root of the repo:

```bash
mysql -u root -p < backend/db.sql
```

2. Configure the backend:

```bash
cd backend
npm install
cp .env.example .env
```

Use at least:

```bash
PORT=4000
FRONTEND_URL=http://localhost:3000
API_PUBLIC_URL=http://localhost:4000/api
CORS_ORIGINS=http://localhost:3000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password_here
DB_NAME=growth_group_internal_crm
JWT_SECRET=replace-with-a-long-random-secret
```

3. Configure the frontend:

```bash
cd ../frontend
npm install
cp .env.example .env
```

Use:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

4. Run both apps in separate terminals:

```bash
cd backend
npm run dev
```

```bash
cd frontend
npm run dev
```

Then open `http://localhost:3000`.

## Safety Rules

- Do not point this app at `clinicgrower.ai` production services.
- Do not use the clinic production database name.
- Keep `.env` files local and uncommitted.
- When schema or seed data changes, update `backend/db.sql` because this internal project is expected to start from a fresh DB.

## Environment And Rollback Notes

Dev, staging, production, secrets, backup and rollback guidance lives in [docs/mission-control-environments.md](docs/mission-control-environments.md).

## Data And Webhook Isolation

Clinic-facing demo data, patient/medical seed records, and webhook credential rules are documented in [docs/mission-control-data-isolation.md](docs/mission-control-data-isolation.md).

## Data Model

Accounts, contacts, leads, deals, clients, proposals, Growth Scores, and the migration path from legacy clinic CRM tables are documented in [docs/mission-control-data-model.md](docs/mission-control-data-model.md).
