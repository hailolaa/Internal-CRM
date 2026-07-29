# Branch And Commit Conventions

Mission Control uses predictable branch and commit names so review, release notes and rollback decisions stay understandable.

## Branch Names

Use short-lived branches from the latest protected main branch.

Recommended format:

```text
feature/short-description
fix/short-description
docs/short-description
chore/short-description
release/short-description
```

Examples:

```text
feature/client-drive-documents
fix/proposal-status-audit
docs/release-controls
chore/ci-release-gate
```

## Commit Messages

Use a short action-based subject line.

Recommended format:

```text
type(scope): summary
```

Allowed types:

- `feat` for new user-facing capability
- `fix` for bug fixes
- `docs` for documentation
- `test` for test coverage
- `refactor` for behavior-preserving code changes
- `chore` for tooling, configuration or maintenance
- `ci` for workflow and release-gate changes

Examples:

```text
feat(proposals): store accepted proposal snapshot
fix(client-accounts): block cross-workspace task links
docs(release): add architecture decisions
ci(workflows): add backend and frontend release gate
```

## Commit Rules

- Keep one logical change per commit where practical.
- Do not mix unrelated frontend, backend, schema and documentation changes unless they are part of the same feature slice.
- Include migrations with the code that needs them.
- Do not commit secrets, generated build output, database dumps or private exports.
- Prefer clear commits over clever commits. The goal is easy review and safe rollback.

## Pull Request Size

Pull requests should be small enough to review properly.

Split the work when:

- The diff mixes unrelated modules.
- Schema changes can be reviewed separately from UI changes.
- Provider configuration work can be separated from product behavior.
- Documentation can land before or after risky code changes.

Keep the work together when splitting would make the feature impossible to verify end to end.
