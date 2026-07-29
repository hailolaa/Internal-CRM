# Data Boundaries And Source Of Truth

## Status

Accepted.

## Context

Mission Control is being built to become the internal source of truth for leads, opportunities, client accounts, tasks, proposals, Growth Scores, onboarding, communications and operational follow-up.

The system still needs to exchange data with the website, Google Drive, email/WhatsApp providers and existing operational exports. It must also avoid copying irrelevant patient, medical or clinic-facing demo data into the internal CRM.

## Decision

Mission Control is the source of truth for internal CRM and operations records once data has entered the system.

External systems remain source of truth only for their native assets:

- The website is the source of the original lead submission payload and attribution values.
- Google Drive is the source of actual file and folder content.
- Email and WhatsApp providers are the source of provider message identifiers and delivery metadata.
- Imported operational exports remain the source archive for historical cutover evidence.

Mission Control stores normalized records, stable IDs, timestamps, ownership, status, internal notes, and links back to external source identifiers where needed.

## Consequences

Users can work from Mission Control without relying on scattered memory, inboxes or external spreadsheets for daily operations.

External files are not duplicated into the database unless a feature explicitly requires a snapshot. Drive links and validated IDs are stored instead of copying the full file tree.

Imported data must keep traceability fields so the original export can be audited after cutover.

## Implementation Notes

- Fresh database setup starts from `backend/db.sql` and is advanced by ordered migrations.
- Lead, contact, package, Growth Score, proposal and client-account relationships are described in `docs/mission-control-data-model.md`.
- Scoro import templates include source IDs, source URLs and export timestamps for traceability.
- Duplicate checks are scoped to the current workspace before records are created or updated.
- Patient, medical and clinic-facing demo records are excluded from approved Mission Control seed data.
