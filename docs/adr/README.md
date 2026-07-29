# Architecture Decision Records

This pack records the architectural decisions behind Mission Control so the system can be understood without relying on private messages or memory.

## Decision Index

| Decision | Status | Area |
| --- | --- | --- |
| [Tenancy and workspace boundaries](0001-tenancy-and-workspace-boundaries.md) | Accepted | Tenant isolation |
| [Data boundaries and source of truth](0002-data-boundaries-and-source-of-truth.md) | Accepted | CRM data ownership |
| [Identity and access model](0003-identity-and-access-model.md) | Accepted | Authentication and permissions |
| [Provider integration patterns](0004-provider-integration-patterns.md) | Accepted | WhatsApp, email, Google Drive, OAuth and AI |
| [Background jobs and queue handling](0005-background-jobs-and-queue-handling.md) | Accepted | Scheduled work and async operations |
| [Cross-system release traceability](0006-cross-system-release-traceability.md) | Accepted | Multi-repo delivery control |

## ADR Format

Each decision uses the same structure:

- Status
- Context
- Decision
- Consequences
- Implementation notes

The goal is to explain why the system works this way, where the boundaries are, and what future changes must preserve.
