# Scoro Import Templates

These templates are the handoff format for moving live Scoro data into Mission Control.

Use one row per live record and keep the original Scoro export unchanged in the cutover backup folder. The `scoro_record_id`, `scoro_url`, and `scoro_exported_at` fields let us trace every imported record back to the source export.

## Import Order

1. Contacts and leads
2. Clients/accounts
3. Tasks and follow-ups

## Duplicate Review

Mission Control should treat email, phone, and website/domain as strong matches. Account name and person-name matches should be reviewed before merging because they are more likely to collide.

## Templates

- `scoro-leads-template.csv`
- `scoro-clients-template.csv`
- `scoro-contacts-template.csv`
- `scoro-tasks-followups-template.csv`

Run `npm run validate:scoro-import` from `backend` before a staging rehearsal to confirm the import pack has the expected headers.
