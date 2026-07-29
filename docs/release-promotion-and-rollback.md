# Release Promotion And Rollback

Mission Control releases are promoted through a signed release manifest. The manifest records the exact application revision, database schema order, migration checksums, related system revisions and rollback target.

## Promotion Workflow

The promotion workflow is:

- `.github/workflows/release-promotion.yml`

It is started manually from GitHub Actions and requires:

- Target environment
- Previous Mission Control revision for rollback
- Related Clinic OS frontend revision when applicable
- Related Clinic OS backend revision when applicable
- Database backup reference when a database change is involved
- Deployment webhook secrets configured in the GitHub environment

The workflow:

1. Installs backend and frontend dependencies.
2. Loads `backend/db.sql`.
3. Runs ordered migrations through `npm run db:migrate`.
4. Builds the backend.
5. Runs backend smoke/database tests.
6. Validates import templates.
7. Runs frontend typecheck, scoped lint, tests and production build.
8. Creates a signed release manifest.
9. Verifies the manifest signature and file checksums.
10. Rehearses the rollback plan from the manifest.
11. Calls the configured deployment webhook when promotion is approved.
12. Stores release and rollback artifacts for review.

## Required Secrets

Configure these secrets per GitHub environment:

| Secret | Purpose |
| --- | --- |
| `RELEASE_MANIFEST_SIGNING_KEY` | Signs and verifies release manifests. |
| `PROMOTION_DEPLOY_WEBHOOK_URL` | Receives the signed release payload and performs the hosting deployment. |
| `PROMOTION_DEPLOY_WEBHOOK_TOKEN` | Authenticates the deployment webhook call. |

The deployment webhook belongs to the hosting layer. The application repo does not store hosting credentials.

## One-Command Manifest Creation

Create and sign a release manifest:

```bash
node scripts/create-release-manifest.mjs \
  --environment staging \
  --mission-control-revision <mission_control_revision> \
  --branch <release_branch> \
  --previous-mission-control-revision <previous_revision> \
  --clinic-os-frontend-revision <frontend_revision_if_needed> \
  --clinic-os-backend-revision <backend_revision_if_needed> \
  --database-backup <backup_reference_if_needed> \
  --require-signature
```

Verify the manifest:

```bash
node scripts/verify-release-manifest.mjs --require-signature
```

Rehearse rollback:

```bash
node scripts/rehearse-rollback.mjs --require-previous
```

Promote through the configured deployment webhook:

```bash
node scripts/promote-release.mjs --environment staging
```

## Version Visibility

The backend exposes current release information at:

- `/api/health/version`
- `/health/version`

The endpoint reads the deployed release manifest when present. If no manifest file exists, it falls back to release environment variables such as `RELEASE_ID`, `RELEASE_VERSION`, `RELEASE_COMMIT_SHA` and `RELEASE_MANIFEST_SHA256`.

## Migration Ordering

The release manifest records:

- `backend/db.sql` checksum
- Every migration file in filename order
- Each migration checksum
- The required order: load base schema first, then run migrations through `npm run db:migrate`

The migration runner protects against edited already-applied migrations by storing migration filenames and checksums.

## Rollback Rule

Rollback must use the previous known-good application revision from the release manifest.

Database restore should only happen when fix-forward is unsafe or the release changed data/schema in a way that cannot be corrected safely.

Rollback steps:

1. Pause writes if the release is actively corrupting data.
2. Redeploy the previous application revision.
3. Restore the database backup only when required.
4. Confirm backend readiness and frontend login.
5. Run the agreed smoke path.
6. Record the result in the release record.

## Staging Rehearsal

Before production promotion, staging should prove:

- The signed manifest verifies.
- Migration order runs cleanly.
- The previous revision is recorded.
- The backup reference is known when database changes are involved.
- The rollback rehearsal artifact is produced and reviewed.

Production promotion should not proceed when the rollback rehearsal is blocked.
