# Sales Process Current Enforcement

Last updated: 1 September 2026

This document records the sales-stage controls Mission Control currently
enforces for `869egeh55` / CG-023. It does not replace Max's required final
approval of the complete sales process definition.

## Current Canonical Stage Order

The default Clinic Grower sales pipeline is:

1. New Lead
2. Contact Needed
3. Contact Attempted
4. Spoken To
5. Free Audit Needed
6. Free Audit In Progress
7. Audit Complete
8. Dashboard Access Given
9. Proposal Needed
10. Proposal Sent
11. Follow-up Needed
12. Negotiation
13. Won
14. Lost
15. Nurture
16. Future Opportunity

Existing clinics can customize stage labels/order. Mission Control preserves
those user-managed stages after the default pipeline is created.

## Enforced Rules

| Area | Current enforcement | Implementation |
|---|---|---|
| Won transition | Requires human commercial confirmation, final value greater than zero, package/service recorded, and direct user moves require `client_accounts:write` | `backend/src/modules/pipeline/pipeline.deals.service.ts` |
| Lost transition | Requires human commercial confirmation, lost reason and objection type | `backend/src/modules/pipeline/pipeline.deals.service.ts` |
| Pricing/value change | Requires human commercial confirmation when the opportunity value changes | `backend/src/modules/pipeline/pipeline.deals.service.ts` |
| Direct status update | Blocked; opportunity status is controlled by the pipeline stage move action | `backend/src/modules/pipeline/pipeline.deals.service.ts` |
| Booked-stage move | Requires booked date/time for stages identified as booked stages | `backend/src/modules/pipeline/pipeline.deals.service.ts` |
| Stage deletion | Blocked when active opportunities exist, and locked stages cannot be deleted | `backend/src/modules/pipeline/pipeline.service.ts` |
| SLA breach detection | Lead response SLA deadlines are initialized, checked and recorded per clinic | `backend/src/modules/sla/sla.service.ts` |
| Audit trail | Stage moves, lost outcomes, contact status updates and SLA contact actions create audit/timeline records | Pipeline, contact and SLA services |

## Operator Visibility

- Pipeline Settings exposes the current read-only enforcement policy from
  `/api/pipeline/sales-process-policy`.
- The pipeline board highlights overdue follow-ups, stage age, priority and
  lead-priority reasons.
- The SLA area exposes breached leads, response metrics and staff response
  performance.

## Not Yet Business-Approved

The following remain Max/business-policy decisions and should not be invented
in code:

- final stage names and any required stage changes beyond the current default;
- final qualification criteria for every stage;
- final business-hours calendar and SLA windows;
- final follow-up cadence and escalation rules;
- final lost-reason and objection taxonomy;
- final target thresholds for conversion, stage velocity and response-time
  dashboards;
- final rules for pricing/package changes beyond explicit human confirmation.

## Acceptance Boundary

Repo-side enforcement is stronger after this slice, but CG-023 is not complete
until Max approves the final policy and target-environment evidence is attached.
