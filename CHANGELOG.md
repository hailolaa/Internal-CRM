# Changelog

Mission Control changes are recorded here in a stakeholder-readable format. This file should describe meaningful product, operational and release changes without requiring someone to read commits.

The format follows these sections:

- Added
- Changed
- Fixed
- Security
- Operational

## Unreleased

### Added

- Branch, pull request and code ownership controls for protected review flow.
- Architecture decision record pack covering tenancy, data boundaries, identity, provider integrations, background jobs and cross-system release traceability.
- Continuous integration release gate covering backend build/database checks and frontend typecheck/lint/test/build.
- Pull request template with release traceability, verification, safety checks, review notes and known-risk prompts.
- Bug report template for production-style issue triage.
- Reviewer checklist for consistent code review.
- Branch and commit convention guide.
- System architecture diagram for the Mission Control application and its external integrations.

### Operational

- Release documentation now separates architecture decisions, CI gates, review controls and operational handoff material.
- GitHub branch protection remains the enforcement point for required reviews and status checks.
