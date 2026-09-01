# ClickUp Task Operating Model

CG-024 defines how Mission Control and ClickUp share delivery task state without duplicate task creation or silent overwrites.

## Status

- Engineering contract: implemented in `backend/src/modules/clickup/clickup-operating-model.ts`.
- Duplicate prevention evidence: covered by `backend/src/test/test-clickup-mappings.ts` and `backend/src/test/test-clickup-operating-model.ts`.
- Business approval: Max approval is still required before CG-024 can be accepted as complete.

## Boundary

Mission Control is the governed CRM and operations roll-up. ClickUp remains the delivery execution workspace for delivery task activity unless a specific client workflow is moved into Mission Control later.

Mission Control may create a ClickUp task only from an existing internal task, client account mapping, category mapping and priority mapping. ClickUp lifecycle events can then update the governed fields listed below when the task is already mapped and the webhook event is signed, current and idempotent.

## Field Source Of Truth

| Field | Source of truth | Sync visibility | Edit location | Conflict rule |
|---|---|---|---|---|
| Mission Control task ID | Mission Control | ClickUp reference | Mission Control | Immutable. Provider references are mapped, not rewritten. |
| ClickUp task ID | ClickUp | Mission Control mapping | ClickUp | One ClickUp task ID can be linked once per Mission Control task and then only reviewed or archived. |
| Client account profile ID | Mission Control | ClickUp mapping context | Mission Control | Client ownership follows Mission Control profile ID. Cross-client ClickUp reuse is rejected. |
| Delivery workspace/list/root task | ClickUp | Mission Control mapping | ClickUp and approved Mission Control mapping screens | Reused or moved delivery structures are held for review. |
| Title | Mission Control | ClickUp task title | Mission Control | Mission Control title changes may sync out. Provider title changes are not allowed to silently replace internal context. |
| Description | Mission Control | ClickUp task description | Mission Control | Mission Control description changes may sync out. Provider description changes are not allowed to silently replace internal context. |
| Status | ClickUp | Mission Control task status | ClickUp and mapped Mission Control task edit | Latest signed provider lifecycle status applies when mapped. Stale events are ignored and conflicts go to reconciliation. |
| Priority | Mission Control | ClickUp priority | Mission Control | Uses the approved priority mapping table. Unmapped provider values are held for review. |
| Due date | ClickUp | Mission Control task due date | ClickUp and mapped Mission Control task edit | Provider timestamp ordering applies. Stale or unmapped updates are quarantined. |
| Assignee | ClickUp | Mission Control assigned-to display | ClickUp and mapped Mission Control task edit | ClickUp assignee IDs are retained. Unmapped Mission Control names mark the mapping as `needs_review`. |
| Workstream/category | Mission Control | ClickUp destination list | Mission Control | Category must use the approved per-client category mapping before task creation. |
| Dependencies and blockers | ClickUp | Mission Control exception roll-up | ClickUp | Mission Control displays delivery exceptions and does not duplicate client delivery execution tasks. |
| Evidence and attachments | ClickUp/client workspace | Mission Control evidence visibility | ClickUp and client workspace | Mission Control may send initial attachments, but provider evidence remains reviewable and is not silently overwritten. |
| Reviewer acceptance | Reviewer | Mission Control and ClickUp status evidence | Reviewer | Reviewer acceptance is separate from engineering status. Status alone is not acceptance evidence. |
| Comments and activity | ClickUp | Mission Control summary/read surface | ClickUp | Comments remain provider activity history. Mission Control must not impersonate actors. |

## Duplicate Prevention

| Identity | Prevention | Recovery |
|---|---|---|
| `internalTaskId` | One active or `needs_review` ClickUp mapping may exist for a Mission Control internal task. | Retries reuse or recover the stored mapping before another provider create call is allowed. |
| `clickupTaskId` | One active ClickUp task ID may map to one client account in a Mission Control workspace. | Cross-client reuse is rejected and moved/provider-created tasks are marked `needs_review`. |
| `providerEventKey` | One signed ClickUp webhook history item is stored by provider event key. | Duplicate webhooks return the existing event receipt and do not apply another lifecycle update. |
| `clientAccountProfileId + workspace/list/rootTask` | One active delivery structure may be assigned to one client account in the workspace. | Reused folders, lists or root tasks are rejected before they can overwrite another client mapping. |

## Approval Gate

CG-024 still needs Max to approve this operating model. Until then, the engineering state is ready for review, not business complete.
