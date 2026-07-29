# Cross-System Release Traceability

## Status

Accepted.

## Context

Mission Control can ship independently, but some changes need to line up with website, backend, frontend, provider or Clinic OS changes. Without a release record, related revisions can be reviewed or deployed out of order.

## Decision

Every pull request that depends on another repository, migration, provider setting or deployment action must record those dependencies in the pull request release traceability section.

Release records should identify:

- Mission Control frontend revision
- Mission Control backend revision
- Related external app revision
- Database migration
- Provider or environment setting
- Deployment note
- Rollback note

Main branch should be protected by required pull requests, review, code-owner review and passing checks.

## Consequences

Reviewers can understand which changes ship together and avoid frontend/backend/API mismatches.

Deployment can promote a known set of revisions instead of guessing from chat history.

When a release fails, rollback has a documented target and context.

## Implementation Notes

- Pull request requirements are defined in `.github/PULL_REQUEST_TEMPLATE.md`.
- Code ownership is defined in `.github/CODEOWNERS`.
- Release gate checks are defined in `.github/workflows/mission-control-ci.yml`.
- Branch protection must be enabled in GitHub repository settings to make these controls enforceable.
