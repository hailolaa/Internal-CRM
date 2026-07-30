# Backup And Restore

Mission Control needs recoverable database and file backups before the team relies on it as the daily source of truth.

The backup process now creates an integrity-checked backup artifact, encrypts it when the backup key is configured, copies it to the off-site destination when configured, and writes a manifest that can be used as restore evidence.

## What Is Backed Up

- MySQL database dump, including routines, triggers and events.
- Optional file directories listed in `BACKUP_FILE_DIRS`, such as uploaded task files or operational document caches.
- A JSON manifest with backup ID, timestamp, artifact paths, off-site paths, checksums, size, encryption state, retention window and service name.

## Required Configuration

```bash
BACKUP_DIR=backups/production
BACKUP_RETENTION_DAYS=30
BACKUP_ENCRYPTION_KEY=
BACKUP_OFFSITE_DIR=
BACKUP_FILE_DIRS=
BACKUP_RESTORE_RTO_MINUTES=60
BACKUP_RESTORE_RPO_MINUTES=1440
RESTORE_REHEARSAL_DB_USER=
RESTORE_REHEARSAL_DB_PASSWORD=
BACKUP_KEEP_PLAINTEXT=false
MYSQLDUMP_BIN=mysqldump
MYSQL_BIN=mysql
TAR_BIN=tar
```

`BACKUP_ENCRYPTION_KEY` must be at least 32 characters. Production and off-site backups should not run without it.

`BACKUP_OFFSITE_DIR` should point to the approved off-site storage mount or synced object-storage location. If the backup runs from a deployment host rather than GitHub Actions, this can be a mounted S3, GCS, Azure, Backblaze, SFTP or provider-managed backup path.

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

The rehearsal creates a temporary restore database, restores the selected backup, verifies that tables exist, reports RTO/RPO evidence, then drops the temporary database unless `RESTORE_REHEARSAL_KEEP_DB=true`.

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

## Reviewer Proof

Before this is treated as production-ready, the reviewer should confirm:

- a production backup completes successfully
- encrypted artifacts and tag files are present
- off-site copies exist and checksums match
- the manifest is retained as evidence
- a restore rehearsal completes into a fresh database within the agreed RTO/RPO
- a forced backup or restore failure produces an alert
