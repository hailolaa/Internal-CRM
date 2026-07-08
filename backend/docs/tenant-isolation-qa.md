# Tenant Isolation QA

## 2026-05-26 checks

- Protected role routes now re-read the active user row before authorising, so deleted, inactive, or role-changed users cannot rely on a stale JWT role.
- Permission checks require the user to be active and clinic-scoped, then resolve role aliases through the shared role helper before reading `role_permission`.
- Contacts, treatments, team, settings, billing, calls, reports, and related Phase 1 modules should continue to take `clinicId` from the authenticated user or API key context, not request payloads.
- Contact CRUD/list/timeline queries were checked for `clinic_id = ?` and `deleted_at IS NULL` scoping.
- Team invite, remove, and role-change flows now write audit events for admin traceability.

## 2026-05-26 manual QA notes

- Confirmed protected routes read `clinicId` from authenticated user or API key context.
- Confirmed the current tenant-scoped modules keep `clinic_id = ?` constraints in list, detail, update, and delete queries.
- Confirmed the contact timeline read endpoint uses clinic scoping and excludes soft-deleted activity rows.
- Confirmed contact, call, appointment, consult, SLA, and pipeline timeline writes use the shared metadata envelope.
- Confirmed validation failures now return structured field-level errors through the shared error handler.
- Cross-clinic attempts should resolve as not found or forbidden, not as a record from the wrong clinic.
- Team invitation acceptance now writes an audit event alongside invite creation, resend, cancel, remove, and role updates.
- Authenticated requests now re-read the active user record before hitting protected routes, blocking stale or deactivated JWT sessions.
