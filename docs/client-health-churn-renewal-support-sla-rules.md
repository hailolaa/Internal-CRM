# Client Health, Churn, Renewal and Support SLA Rules

Last updated: 2 September 2026

Task: `869egej6y` - `CG-132`: define client health, churn, renewal and support
SLA rules.

This is a Mission Control policy contract. It defines the explainable weekly
RAG model and support/renewal rules that CG-136 and the support/incident
workflow must follow. It does not claim Max/Michael approval, production UAT or
live provider evidence.

## Source-of-Truth Boundary

- Mission Control owns the weekly client-health roll-up, reason codes,
  evidence links, action creation, manual overrides and audit trail.
- Source systems own their underlying facts: performance, delivery QA, lead
  handling, communication history, complaints, accounting/payment state,
  contracts and client contact records.
- Missing, stale or provider-dependent data must lower confidence and remain
  visible. It must not be silently treated as healthy.
- Engineering acceptance proves deterministic rules and evidence handling.
  Business acceptance requires Michael/Max review of the policy and thresholds.

## Weekly RAG Inputs

| Input | Weight | Evidence source | Missing-data behaviour |
|---|---:|---|---|
| Performance vs agreed goal | 20 | Growth score, KPI targets, agreed package goals | Mark confidence low; cannot be green on this input |
| Data/tracking health | 15 | Sync health, tracking status, freshness alerts | Apply missing/stale reason code |
| Delivery and QA | 15 | Delivery work, freelancer report QA, accepted/rejected evidence | Awaiting/failed QA creates amber/red reason |
| Lead handling and conversion | 15 | Lead response, SLA, booked/attended consults, source movement | Missing connected data reduces confidence |
| Communication and sentiment | 10 | Last meaningful contact, client comms, review notes | Stale contact creates amber reason |
| Complaints and incidents | 10 | Support/incident records, complaint flags | Open serious complaint is hard red |
| Invoice/payment state | 5 | Accounting-platform invoice/payment status | Overdue/disputed creates reason code |
| Contract and notice risk | 5 | Contract status, notice date, renewal date | Notice window creates amber/red reason |
| Last meaningful contact | 5 | Account timeline, meeting/review/contact records | No recent contact creates amber reason |

Total weight: 100.

These weights are the engineering baseline for review. They must be accepted by
Michael/Max before the calculated engine is treated as business-approved.

## Minimum Data and Confidence

- A weekly score requires a client identity, current package/service state,
  at least one performance or delivery evidence source, and a current
  contract/renewal state.
- If fewer than five weighted inputs have current evidence, the health state is
  `partial` or `provider_dependent`, not green.
- If the client is missing accounting, delivery or tracking evidence, the
  missing source is listed as a reason code.
- Provider-dependent data must show the provider/state label carried by the
  sync-health and data-state model.

## RAG Thresholds

| State | Score / trigger | Required action |
|---|---|---|
| Green | 75-100 and no hard red trigger | Routine account review |
| Amber | 50-74, stale data, early deterioration, notice risk or unresolved non-critical issue | Create one recovery action |
| Red | below 50, serious complaint, critical data failure, overdue invoice escalation, rapid deterioration or high churn risk | Create one urgent Michael escalation and one concise Max brief |

Hard red triggers override the numeric score. Green is not allowed while a hard
red trigger is open.

## Reason Codes

Each score stores reason codes so the result can be explained and reviewed:

- `performance_below_goal`
- `tracking_missing`
- `tracking_stale`
- `delivery_evidence_missing`
- `delivery_qa_failed`
- `lead_response_sla_slipping`
- `conversion_declining`
- `client_contact_stale`
- `negative_sentiment`
- `complaint_open`
- `invoice_overdue`
- `invoice_disputed`
- `notice_window_open`
- `renewal_due`
- `contract_paused_or_cancelled`
- `manual_override_active`
- `provider_data_unavailable`

## Churn and Renewal Rules

- Churn risk is based on health movement, contract/notice proximity,
  performance trend, delivery QA, complaint state, invoice/payment state and
  last meaningful contact.
- Renewal review is required when the renewal date is within 45 days or notice
  date is within 30 days.
- Clients inside a notice window cannot be treated as green without an accepted
  recovery or renewal plan.
- Upsell recommendations must not be created from health alone. They require
  evidence of performance, capacity, package fit and commercial approval.

## Support SLA Rules

| Severity | Examples | First response target | Update cadence | Resolution expectation |
|---|---|---:|---:|---|
| P1 critical | Security risk, major client-visible outage, data loss risk | 1 business hour | Every 2 business hours | Same business day or accepted incident plan |
| P2 high | Lead-routing failure, payment/contract blocker, serious complaint | 4 business hours | Daily until stable | 2 business days or accepted recovery plan |
| P3 normal | Standard support request, non-blocking defect | 1 business day | Every 3 business days | 5 business days or scheduled backlog item |
| P4 low | Question, minor content/admin change | 2 business days | Weekly if open | Scheduled or closed with client agreement |

Security incidents follow the security/incident workflow even if they also have
a support SLA.

## Alert and Action Rules

- Red creates exactly one open urgent Michael escalation and one concise Max
  brief per client/reason window.
- Amber creates exactly one open recovery action per client/reason window.
- Duplicate alerts are prevented by client, reason code, severity and open
  window.
- Alerts are not auto-closed from status changes alone. Closure requires
  verified recovery evidence, reviewer notes or accepted business decision.
- Closure requires verified recovery evidence before an alert can be treated as
  operationally resolved.
- Escalations and recovery actions preserve client, source evidence, owner,
  due date, severity, reason code and audit trail.

## Manual Override Rules

- Manual override is allowed only for authorised roles.
- Override must record previous health state, new state, reason, expiry/review
  date, actor and timestamp.
- Override does not delete underlying source reasons.
- Expired overrides must be reviewed or removed before the client can be treated
  as stable.

## Test Scenarios Required by CG-136

Downstream calculated-engine work must cover:

- healthy client;
- gradual deterioration;
- rapid deterioration;
- missing/stale data;
- serious complaint;
- overdue invoice;
- notice/renewal risk;
- recovery action creation;
- duplicate alert prevention;
- manual override audit;
- cross-client and cross-tenant permission cases.

## Downstream Task Boundaries

- CG-132 defines the policy, weights, reason codes, SLAs and approval gates.
- CG-136 implements the calculated health/churn/upsell engine from this policy
  after approval.
- The support and incident workflow implements severity handling, retest,
  evidence and post-incident controls.
- CG-160 supplies canonical client identity and operating register context.
- CG-079 supplies sync-health and provider/data-state inputs.

## External Acceptance Gates

- Michael must explain the source evidence, current state, open risk and next
  action during handover.
- Max/Michael must accept the weekly RAG weights, thresholds, reason codes and
  escalation ownership before operational activation.
- Production/staging evidence, live provider data and real client UAT are not
  provided by this document.
