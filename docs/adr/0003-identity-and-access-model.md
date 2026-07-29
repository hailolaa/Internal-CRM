# Identity And Access Model

## Status

Accepted.

## Context

Mission Control is for internal team members only. Prospects and clients are not users of this MVP. The system needs a practical permission model that can support sales, delivery, finance, administrators and internal viewers without exposing sensitive notes or commercial fields to the wrong audience.

## Decision

Authentication uses JWT-backed sessions for internal users, with the active workspace embedded in the token and revalidated against active workspace membership on every authenticated request.

Authorization is permission based, with roles resolved through workspace membership. System roles provide the core access shape, and workspace-scoped roles can be created for finer control.

Public registration is disabled for normal Mission Control usage. User access should come through controlled invitation or approved identity-provider auto-provisioning.

## Consequences

The system avoids prospect/client access in the MVP and keeps internal records internal.

Sensitive changes can be restricted by role and audited. Where a route handles commercial, proposal, payment, access, file or permission data, it should require explicit permission checks rather than relying on broad login status.

Because workspace membership is reloaded on each authenticated request, disabled users and changed roles stop taking effect without waiting for token expiry.

## Implementation Notes

- `backend/src/middleware/authenticate.ts` verifies the token and reloads the active user/workspace membership.
- `backend/src/middleware/authorize.ts` resolves roles and permission keys from the database.
- `clinic_membership` is the current physical table for workspace membership.
- Internal role and permission changes should write audit events.
- OAuth auto-provisioning must be limited by allowed domains and configured workspace/role settings.
