# Tenancy And Workspace Boundaries

## Status

Accepted.

## Context

Mission Control is an internal CRM and operations system. The inherited schema still uses legacy names such as `clinic`, `clinic_id` and `clinic_membership`, but the active product meaning is workspace/account ownership rather than a clinic-facing tenant product.

The system must prevent records from one workspace being visible or mutable from another workspace. This matters across contacts, opportunities, proposals, client accounts, tasks, communication history, files, audit logs and provider webhooks.

## Decision

Workspace isolation is enforced through the authenticated workspace identifier carried in the user session and stored as `clinic_id` in database rows.

The `clinic` table remains the physical workspace/account root for this stage of the system. Application copy and documentation should describe the business concept as workspace, account or client account where appropriate, while preserving the physical field names until a dedicated schema rename is planned.

Every authenticated API path must derive workspace scope from the authenticated user context. Request bodies, query strings and public webhook payloads must not be trusted to choose the workspace unless the endpoint first validates that the caller is allowed to act for that workspace.

Provider webhooks use provider-owned routing signals:

- WhatsApp derives the workspace from the configured receiving phone number ID or mapped Twilio receiving address.
- Inbound email derives the workspace from mapped recipient addresses.
- Public API keys derive the workspace from the stored API key record.

## Consequences

The system can keep compatibility with existing tables while behaving as an internal CRM.

The trade-off is that code still contains legacy column names. New implementation should avoid spreading clinic-facing terminology into UI copy, user-facing docs or new feature names unless it is describing the current physical schema.

Cross-workspace access must be tested for new client account, task, proposal, file, communication and import flows.

## Implementation Notes

- `backend/src/middleware/authenticate.ts` verifies the token, reloads the active membership and attaches the current workspace-scoped user context.
- `backend/src/middleware/authorize.ts` resolves the active role and permissions from the current workspace.
- Service-layer queries must include the current `clinic_id` or prove access through a stable workspace-scoped relationship.
- Webhook handlers in `backend/src/modules/webhooks/webhooks.controller.ts` do not trust caller-supplied workspace IDs for WhatsApp or email routing.
- The current data model mapping is documented in `docs/mission-control-data-model.md`.
