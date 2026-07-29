# Scoro Import And Cutover Runbook

This is the phase-one route for moving live Scoro leads, clients, contacts, tasks, and follow-ups into Mission Control without losing traceability or creating avoidable duplicates.

## Scope

The cutover covers operational CRM records only:

- Leads and pipeline follow-ups
- Client/account records
- Contacts
- Tasks and follow-ups

Scoro remains the source backup until the Mission Control import is signed off.

## Source Backup

Before any import:

1. Export Scoro leads, clients, contacts, tasks, and follow-ups as CSV.
2. Save the untouched originals in a dated folder outside the repo, for example `Scoro exports/2026-07-29`.
3. Keep the Scoro export filenames unchanged.
4. Record who exported the files, the export time, and the Scoro filters used.
5. Run `npm run db:backup` from `backend` before importing into an existing Mission Control environment.

Do not edit the raw Scoro export. Copy rows into the Mission Control templates instead.

## Templates

Use the files in `docs/import-templates/scoro`:

- `scoro-leads-template.csv`
- `scoro-clients-template.csv`
- `scoro-contacts-template.csv`
- `scoro-tasks-followups-template.csv`

Every row should include `scoro_record_id`, `scoro_url`, and `scoro_exported_at` where available. These fields are required for traceability and rollback review.

Run this before rehearsal:

```powershell
cd backend
npm run validate:scoro-import
```

## Staging Rehearsal

1. Take a staging database backup with `npm run db:backup`.
2. Import a small sample first: 10 leads, 10 clients, their contacts, and related open tasks.
3. Review duplicate candidates before importing the full file.
4. Confirm counts against Scoro: leads, clients, contacts, open tasks, overdue follow-ups.
5. Spot-check at least five accounts with multiple contacts and multiple activities.
6. Confirm that task owners, follow-up dates, package fields, and do-not-contact flags are visible.
7. Only then run the full staging import.

## Duplicate Review Rules

Strong matches can update existing records:

- Email
- Phone
- Website/domain

Possible matches must be reviewed:

- Same account/client name
- Same contact first and last name
- Similar website domain

Do not silently merge ambiguous records. Use the duplicate review queue and keep the original Scoro IDs in notes or import metadata.

## Production Cutover

1. Agree a short Scoro edit freeze window.
2. Export the final Scoro files and store the originals in the backup folder.
3. Back up production Mission Control with `npm run db:backup`.
4. Validate the completed templates.
5. Import contacts/leads first.
6. Import clients/accounts second.
7. Import tasks/follow-ups last.
8. Review duplicate candidates.
9. Compare final counts and spot-check live records.
10. Keep Scoro read-only until the team signs off Mission Control.

## Rollback

If the production import is wrong:

- Stop new Mission Control edits.
- Restore the pre-import Mission Control backup.
- Keep Scoro as the operating source.
- Fix the templates and repeat the staging rehearsal.

## Sign-Off Checklist

- Raw Scoro export is backed up.
- Mission Control DB backup exists.
- Templates pass validation.
- Staging rehearsal has been completed.
- Duplicate candidates have been reviewed.
- Counts match expected Scoro totals.
- Sample records show contacts, lead/client status, package data, tasks, follow-ups, and notes correctly.
