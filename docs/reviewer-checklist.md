# Reviewer Checklist

This checklist keeps pull request review consistent before merge.

## Scope

- The pull request explains what changed and why.
- The changed files match the stated scope.
- Related frontend, backend, database, provider or external repo changes are linked.
- Anything intentionally left out is documented.

## Product Behavior

- The implementation supports the required user flow.
- UI text uses Mission Control/internal CRM language.
- Empty, loading, error and permission states are handled.
- Mobile and desktop behavior are acceptable for the affected screens.

## Backend And Data Safety

- Authenticated routes derive workspace scope from the user session.
- Public/webhook routes authenticate the caller and derive workspace from trusted configuration or provider metadata.
- Queries are scoped to the correct workspace.
- Cross-workspace IDs are rejected.
- Validation prevents unusable or unsafe records.
- Sensitive or internal-only fields are permission protected.

## Database And Migrations

- Schema changes are in ordered migrations where required.
- Fresh database setup remains clear.
- Migrations are safe to run once and do not depend on private data.
- Backfill or cutover steps are documented when needed.

## Integrations

- Provider credentials are not committed.
- Webhooks verify signatures or shared secrets before processing.
- Outbound sends use idempotency or duplicate guards where retries are possible.
- Manual fallback is documented when a provider is not fully automated.

## Tests And Verification

- Relevant backend tests pass.
- Relevant frontend tests pass.
- Typecheck, lint and production build pass for affected apps.
- Manual smoke testing covers the main changed flow.
- Logs, request IDs or screenshots are attached where useful.

## Release And Operations

- Rollback or recovery notes are present for risky changes.
- Known risks and follow-up work are listed.
- Changelog entry is added for meaningful product, operational or release changes.
- Branch protection and required checks are expected to block unsafe merges.
