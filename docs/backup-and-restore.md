# Backup And Restore

Mission Control needs recoverable database and file backups before the team relies on it as the daily source of truth.

The backup process now creates an integrity-checked backup artifact, encrypts it when the backup key is configured, copies it to the off-site destination when configured, and writes a manifest that can be used as restore evidence.

## What Is Backed Up

- MySQL database dump, including routines, triggers and events.
- Optional file directories listed in `BACKUP_FILE_DIRS`, such as uploaded task files or operational document caches.
- A JSON manifest with backup ID, timestamp, artifact paths, off-site paths, checksums, size, encryption state, retention window, service name, source environment, release/version metadata and migration evidence.

## Required Configuration

```bash
BACKUP_DIR=backups/production
BACKUP_RETENTION_DAYS=30
BACKUP_ENCRYPTION_KEY=
BACKUP_OFFSITE_DIR=
BACKUP_FILE_DIRS=
BACKUP_OFFSITE_PROVIDER=
BACKUP_ENCRYPTION_KEY_ID=
BACKUP_SCHEMA_PATH=db.sql
BACKUP_MIGRATION_DIR=scripts/migrations
BACKUP_RESTORE_RTO_MINUTES=60
BACKUP_RESTORE_RPO_MINUTES=1440
RESTORE_REHEARSAL_DB_USER=
RESTORE_REHEARSAL_DB_PASSWORD=
RESTORE_REHEARSAL_REPORT_PATH=
RESTORE_REHEARSAL_STARTUP_COMMAND=
RESTORE_REHEARSAL_HEALTH_URL=
RESTORE_REHEARSAL_VERSION_URL=
RESTORE_REHEARSAL_SMOKE_COMMAND=
BACKUP_KEEP_PLAINTEXT=false
MYSQLDUMP_BIN=mysqldump
MYSQL_BIN=mysql
TAR_BIN=tar
```

`BACKUP_ENCRYPTION_KEY` must be at least 32 characters. Production and off-site backups should not run without it.

`BACKUP_ENCRYPTION_KEY_ID` is a label or vault reference for operator evidence. It must not contain the key value.

`BACKUP_OFFSITE_DIR` should point to the approved off-site storage mount or synced object-storage location. If the backup runs from a deployment host rather than GitHub Actions, this can be a mounted S3, GCS, Azure, Backblaze, SFTP or provider-managed backup path.

`BACKUP_OFFSITE_PROVIDER` is the provider label to record in the manifest, for example `mounted-s3`, `managed-database-backup` or `encrypted-offsite-filesystem`.

`BACKUP_FILE_DIRS` is comma-separated. Leave it blank if there are no app-managed file directories to back up.

`RESTORE_REHEARSAL_DB_USER` and `RESTORE_REHEARSAL_DB_PASSWORD` are optional dedicated credentials for the temporary rehearsal database. Configure a restricted account that can create and drop rehearsal databases when the normal application user does not have those privileges.

## Commands

Create a backup:

```bash
cd backend
npm run db:backup
```

Restore a backup:

```bash
cd backend
npm run db:restore -- path/to/backup.sql.enc
```

Rehearse a restore into a fresh database:

```bash
cd backend
npm run db:restore:rehearse -- path/to/backup.sql.enc.manifest.json
```

The rehearsal creates a temporary restore database, verifies the manifest and checksum, restores the selected backup, verifies that tables exist, records migration compatibility evidence, optionally checks application startup, health, version and smoke commands, reports RTO/RPO evidence, then drops the temporary database unless `RESTORE_REHEARSAL_KEEP_DB=true`.

Use `RESTORE_REHEARSAL_REPORT_PATH` to write a JSON evidence report. The report includes backup ID, checksum, source environment, backup timestamp, restore target, migration evidence, release/version evidence, duration, health/smoke states, table reconciliation, failure reason and cleanup result. It must not contain secrets or customer data.

The restore report uses truthful states:

- `PLANNED`: documented or configured for an operator to run later.
- `REHEARSABLE`: enough information exists to run the rehearsal.
- `REHEARSED`: the restore path was exercised, but optional live health/smoke checks were not all verified.
- `VERIFIED`: configured health/startup/version/smoke checks passed for the rehearsal target.

## Schedule

A scheduled workflow is included and is disabled until `BACKUP_WORKFLOW_ENABLED=true` is set in repository variables.

If the production database is not reachable from GitHub Actions, the same commands should run from the production host or backup runner on a daily schedule. The important rule is that the run must use the same encryption key, off-site destination and alert webhook.

## Failure Alerts

Backup failures and restore rehearsal failures send an alert to:

```bash
OBSERVABILITY_ALERT_WEBHOOK_URL
OBSERVABILITY_ALERT_WEBHOOK_TOKEN
```

The alert includes service name, environment, failure type, database name, backup path and context needed for follow-up.

## Release Relationship

Release promotion can optionally require backup evidence when an operator enables the backup gate. This does not affect local builds.

Use the release workflow inputs when a database-sensitive release needs rollback evidence:

- `database_backup`
- `database_backup_checksum`
- `database_backup_timestamp`
- `restore_readiness`
- `require_database_backup`

For production releases, the production owner must confirm the backup reference, checksum, timestamp and restore readiness before promotion. The repository can enforce the presence of evidence, but it does not perform a real production backup or restore.

## Engineering Defaults

The current defaults are engineering defaults only:

- RPO: `BACKUP_RESTORE_RPO_MINUTES=1440`
- RTO: `BACKUP_RESTORE_RTO_MINUTES=60`
- Retention: `BACKUP_RETENTION_DAYS=30` for production examples
- Frequency: daily scheduled workflow when enabled

Business approval is still required for final RPO, RTO, retention, immutability/versioning and frequency.

## Restore Checklist

### Pre-Restore

- Confirm the approved backup ID and artifact path.
- Confirm the artifact checksum and manifest checksum.
- Confirm the backup key is available from the approved vault or secret manager.
- Confirm the target database is isolated and not a live production database.
- Confirm schema and migration compatibility against the release being restored.

### Restore

- Decrypt the artifact using `BACKUP_ENCRYPTION_KEY`.
- Restore into the isolated target database.
- Validate schema/migration evidence.
- Record start time, finish time and duration.

### Post-Restore

- Run health and version checks where configured.
- Run the agreed smoke command where configured.
- Record table reconciliation and any row-level reconciliation approved for staging.
- Save the JSON evidence artifact.
- Drop the temporary database unless retention was explicitly approved.

Actual staging rehearsal remains a production owner action. Do not mark it complete from local tooling alone.

## Reviewer Proof

Before this is treated as production-ready, the reviewer should confirm:

- a production backup completes successfully
- encrypted artifacts and tag files are present
- off-site copies exist and checksums match
- the manifest is retained as evidence
- a restore rehearsal completes into a fresh database within the agreed RTO/RPO
- a forced backup or restore failure produces an alert
