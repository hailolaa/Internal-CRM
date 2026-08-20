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
12. Verifies the promoted deployment against the signed manifest when promotion is approved.
13. Stores release, rollback and deployment-verification artifacts for review.

## Required Secrets

Configure these secrets per GitHub environment:

| Secret | Purpose |
| --- | --- |
| `RELEASE_MANIFEST_SIGNING_KEY` | Signs and verifies release manifests. |
| `PROMOTION_DEPLOY_WEBHOOK_URL` | Receives the signed release payload and performs the hosting deployment. |
| `PROMOTION_DEPLOY_WEBHOOK_TOKEN` | Authenticates the deployment webhook call. |

The deployment webhook belongs to the hosting layer. The application repo does not store hosting credentials.

Configure these environment variables per GitHub environment when promotion should run post-deploy verification:

- `RELEASE_BACKEND_URL`: public API base URL, for example `https://staging.example.com/api`.
- `RELEASE_FRONTEND_URL`: public frontend URL, for example `https://staging.example.com`.
- `RELEASE_AUTHENTICATED_API_HEALTH_URL`: optional read-only authenticated smoke URL.
- `RELEASE_SMOKE_AUTH_TOKEN`: optional smoke-test token for the authenticated URL.

If promotion is requested and the backend or frontend release URL is missing, the workflow fails with an external-dependency message. That is intentional; a release should not be marked verified when the deployed environment cannot be checked.

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

Verify a promoted deployment without making destructive requests:

```bash
node scripts/verify-deployment.mjs \
  --environment staging \
  --backend-url <api_base_url> \
  --frontend-url <frontend_url> \
  --require-signature
```

The verifier checks:

- backend `/health/live`
- backend `/health/ready`
- backend `/health/version`
- frontend availability
- optional authenticated API health URL
- deployed release ID, environment and Mission Control revision
- paired Clinic OS frontend/backend revisions when recorded in the manifest
- database schema checksum and migration count from the deployed version endpoint

The verifier writes `release/deployment-verification.json`. The signed manifest remains immutable, so deployed revision and verification time are recorded in the verification artifact rather than mutating the signed manifest after deployment.

## Version Visibility

The backend exposes current release information at:

- `/api/health/version`
- `/health/version`

The endpoint reads the deployed release manifest when present. If no manifest file exists, it falls back to release environment variables such as `RELEASE_ID`, `RELEASE_VERSION`, `RELEASE_COMMIT_SHA` and `RELEASE_MANIFEST_SHA256`.

The Admin Console also displays the release ID, Mission Control revision, paired Clinic OS revisions, manifest signature state and deployment-verification state from the backend version endpoint.

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

## Operator Checklist

### Pre-Deploy

- Confirm the target environment is staging or production.
- Confirm the release commit and branch.
- Confirm paired Clinic OS frontend/backend revisions if this release depends on them.
- Confirm a recent backup reference when database state may need restore.
- Run the promotion workflow with `promote` disabled first if evidence needs review before deployment.
- Confirm the signed manifest verifies.
- Confirm migrations apply cleanly in CI and no migration checksum mismatch is reported.

### Deploy

- PRODUCTION OWNER ACTION: configure the deployment webhook secret and token in the target GitHub environment.
- PRODUCTION OWNER ACTION: configure `RELEASE_BACKEND_URL` and `RELEASE_FRONTEND_URL`.
- PRODUCTION OWNER ACTION: run the workflow with `promote` enabled only after the release evidence is accepted.
- Wait for the deployment webhook to return success.

### Post-Deploy

- The workflow runs `scripts/verify-deployment.mjs` when `promote` is enabled.
- Confirm backend health and readiness pass.
- Confirm `/health/version` matches the signed manifest release ID, environment and revision.
- Confirm paired Clinic OS revisions match where recorded.
- Confirm frontend availability.
- Confirm optional authenticated smoke health when a safe token and endpoint are configured.
- Attach `release/deployment-verification.json` to the release record.

### Rollback

- Use `scripts/rehearse-rollback.mjs --mode planned` for a planning review.
- Use `--mode rehearsed` only when a staging rollback is actually performed and a post-rollback health URL is checked.
- Use `--mode actual` only for a real rollback event.
- Supply `--previous-manifest` when recording rehearsed or actual rollback evidence.
- Check migration compatibility warnings. If migrations are forward-only or data-destructive, stop and use the backup/restore or fix-forward procedure.
- PRODUCTION OWNER ACTION: perform hosting rollback to the previous known-good revision.
- PRODUCTION OWNER ACTION: restore data only when the signed rollback owner confirms restore is safer than fix-forward.
- Verify health/version after rollback and record the result.

## Known External Dependencies

The repository can create, verify and compare release evidence. It cannot by itself prove:

- the hosting webhook is configured;
- the hosting provider deployed the revision;
- production secrets are present;
- a real staging rollback was executed;
- a database restore is safe for a specific incident.

Those items require production-owner action and must be attached as release evidence before marking a production release operationally complete.
