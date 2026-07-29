# Branch, Review And Release Controls

Mission Control uses branch protection, pull requests, code ownership and release traceability to keep main branch changes controlled.

## Controls

- Pull requests include scope, verification, safety checks and release traceability.
- Code ownership routes important changes for review.
- Paired frontend, backend or external repo changes are linked in one release record.
- Architecture decisions are recorded in `docs/adr/` so structural choices can be reviewed without relying on private messages.
- Stakeholder-readable release history is recorded in `CHANGELOG.md`.
- Review standards are documented in `docs/reviewer-checklist.md`.
- Branch and commit naming standards are documented in `docs/branch-and-commit-conventions.md`.
- The system architecture diagram is documented in `docs/architecture-diagram.md`.

## Branch Rule

All feature work should happen on a short-lived branch. Main should stay protected and should only receive reviewed pull requests with passing required checks.

Recommended branch naming:

```text
feature/short-description
fix/short-description
release/short-description
```

## Pull Request Requirements

Every pull request should explain:

- What changed
- Which app area is affected
- Whether database or environment changes are included
- Which checks were run before review
- Whether related repo revisions need to ship together
- Any known risks or follow-up work
- Whether the changelog needs an entry

## Paired Release Record

When a change touches more than one repo, the pull request should link the related revisions in the release traceability section.

Use this format:

```text
Release record:
Mission Control frontend:
Mission Control backend:
Clinic OS frontend:
Clinic OS backend:
Database migration:
Deployment notes:
Rollback notes:
```

This makes it clear which revisions belong together and prevents frontend/backend mismatches during review or deployment.

## Repository Settings

These settings must be enabled in GitHub repository settings:

- Require pull request before merge
- Require at least one approving review
- Require review from code owners
- Require status checks before merge
- Require branches to be up to date before merge
- Block force pushes to main
- Dismiss stale approvals when new commits are pushed

## Issue Triage

Production and release issues should use `.github/ISSUE_TEMPLATE/bug_report.md` so severity, impact, reproduction steps, evidence and rollback needs are captured consistently.

## Enforcement

The repo contains the review-control files. Repository-level branch protection is controlled in GitHub settings and must be enabled there for full enforcement.
