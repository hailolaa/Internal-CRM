# Continuous Integration And Release Gates

Mission Control uses pull request checks to protect main branch changes before review, merge and deployment.

## Workflow

The release gate is defined in:

- `.github/workflows/mission-control-ci.yml`

It runs on:

- Pull requests
- Pushes to `main`
- Manual workflow dispatch

## Required Checks

Backend:

- Installs dependencies with `npm ci`
- Starts a MySQL 8.4 service
- Loads `backend/db.sql`
- Runs migrations
- Builds the backend
- Runs the backend smoke/database test pack
- Validates the Scoro import templates

Frontend:

- Installs dependencies with `npm ci`
- Runs typecheck
- Runs scoped source lint for `app`, `components`, `hooks` and `lib`
- Runs frontend tests
- Runs the production build

## Review Artifacts

- Backend build/test logs
- Scoro template validation log
- Frontend typecheck/lint/test/build logs
- Frontend `.next` build output

Artifacts are retained for 14 days so failures can be reviewed without rerunning everything.

Failures are visible through GitHub required checks, job logs and the release summary. Task-board visibility depends on the existing GitHub/task-board integration being enabled at workspace level.

## Branch Protection

GitHub branch protection should require these checks before merging:

- `Backend build, migrations and database tests`
- `Frontend typecheck, lint, tests and production build`
- `Release review summary`

Recommended branch protection:

- Require pull request before merge
- Require status checks to pass
- Require branches to be up to date before merge
- Block force pushes
- Dismiss stale approvals after new commits

## Scope

This workflow protects the Mission Control repository. The same release-gate pattern should be applied to any paired repository that ships in the same release stream.

Backend does not currently have a separate ESLint setup. The backend CI currently enforces TypeScript build and backend tests. Frontend lint is enforced.

## Verification

Standard verification commands:

```powershell
cd backend
npm run build
npm run validate:scoro-import

cd ..\frontend
npm run typecheck
node --max-old-space-size=4096 ./node_modules/eslint/bin/eslint.js app components hooks lib
npm run test
npm run build
```

The database-backed backend smoke pack needs MySQL available. On Windows, run it with the environment variable set in PowerShell:

```powershell
cd backend
$env:NODE_ENV='test'
node --test --test-force-exit --test-concurrency=1 dist/test/test-csv.js dist/test/test-command-palette.js dist/test/test-internal-delivery-tasks.js dist/test/test-strategy-logs.js dist/test/test-sops.js dist/test/test-client-accounts.js dist/test/test-lead-hub.js dist/test/test-proposals-public.js dist/test/test-proposals.js dist/test/test-roles-management.js dist/test/test-scoro-import-templates.js
```
