# Accounting, MRR and Profitability Rules

Last updated: 2 September 2026

Task: `869egej6t` - `CG-131`: define accounting mappings, MRR and
profitability rules.

This is a Mission Control policy contract. It defines the repo-side rules that
CG-134 accounting integration and CG-135 finance summary work must follow. It
does not activate a live accounting provider, replace statutory accountant/tax
judgement, approve production credentials or authorise invoice/payment changes.

## Source-of-Truth Boundary

- The approved accounting platform is the authority for invoice, payment, tax,
  credit, refund and bank/payment facts.
- Mission Control is the operating roll-up for client/account identity,
  accepted agreements, package/service state, finance summaries, reconciliation
  exceptions and approval evidence.
- Client operating register commercial fields are provenance and reconciliation
  context unless separately verified against the accounting platform.
- Manual finance entries are allowed only as labelled interim operating inputs
  with source, timestamp, actor and evidence notes. They must not overwrite
  accounting-platform truth.
- Provider-specific naming stays generic until Max approves the accounting
  platform/provider decision.

## Accounting Mappings

| Mission Control concept | Accounting-platform concept | Required mapping key | Owner / approval |
|---|---|---|---|
| Client account profile | Customer / account | `clinic_id + client_account_profile_id + provider_customer_id` | Finance/admin approval |
| Accepted service agreement | Contract / sales agreement source | Agreement ID, version/hash and accepted package | Max/legal/commercial approval where required |
| Active package/service | Product, service or invoice line item | Service/package code and approved price version | Price approval required |
| VAT/tax treatment | Tax code/rate | Provider tax code plus jurisdiction/evidence note | Accountant/tax owner approval |
| Recurring monthly invoice | Recurring invoice template or schedule | Client, service line, start date, billing cadence | Finance approval before send |
| One-off setup/diagnostic | One-off invoice line item | Agreement/source event and approved one-off amount | Finance approval before send |
| Payment receipt | Payment allocation | Provider payment ID and invoice ID | Accounting platform authority |
| Part payment | Partial allocation | Provider payment ID, invoice ID and outstanding balance | Accounting platform authority |
| Credit/refund | Credit note or refund transaction | Provider credit/refund ID and reason | Role approval before creation |
| Supplier/freelancer/software cost | Direct delivery cost input or provider bill | Cost source ID, period and client allocation | Delivery/finance approval |

## Revenue Rules

- MRR is the recurring monthly service value for active client services at the
  period end, excluding VAT, advertising/media spend, deposits, diagnostics,
  setup/onboarding fees and other one-off charges.
- One-off revenue is tracked separately from MRR. This includes setup,
  implementation, benchmarking, diagnostics and other non-recurring charges.
- Recognised revenue for a period uses active service dates and is prorated only
  when a service starts or ends inside that calendar month.
- MRR movement is calculated per client by comparing current period-end MRR with
  the previous period-end MRR:
  - `new`: previous MRR is zero and current MRR is greater than zero.
  - `expansion`: current MRR is greater than previous MRR.
  - `contraction`: current MRR is lower than previous MRR but above zero.
  - `churn`: previous MRR is above zero and current MRR is zero.
  - `stable`: no movement.
- Multi-location pricing remains per agreed commercial package and must not be
  inferred from public package defaults without approved evidence.

## Invoice and Payment States

| State | Meaning | Mission Control behaviour |
|---|---|---|
| `draft` | Prepared but not sent | Requires approval before external send |
| `approved_to_send` | Approved by authorised role | May be sent by approved accounting flow |
| `sent` | Issued to client | Counts as receivable until paid/voided |
| `partially_paid` | One or more payments allocated, balance remains | Shows outstanding balance and ageing |
| `paid` | Fully cleared according to accounting platform | Counts as collected cash |
| `overdue` | Due date has passed with outstanding balance | Creates aged-debt/recovery visibility |
| `disputed` | Client/provider dispute recorded | Excluded from automatic positive health |
| `void` | Invoice cancelled before valid collection | Excluded from revenue and receivables |
| `credited` | Credit note offsets some or all balance | Requires reason and approval evidence |
| `refunded` | Cleared payment returned to client | Requires reason and approval evidence |
| `written_off` | Balance intentionally written off | Requires finance approval and audit trail |

## Aged Debt and Cash

- Aged debt is based on invoice due date and unpaid balance:
  - current / not yet due
  - 1-30 days overdue
  - 31-60 days overdue
  - 61-90 days overdue
  - over 90 days overdue
- Cash collected is cleared payment value by payment date.
- Cash forecast is expected collection from sent, approved recurring or approved
  one-off invoices. Forecasts must remain labelled until the accounting platform
  confirms payment.
- Bank/payment changes must not be inferred from Mission Control UI state.

## Profitability and Contribution

- Direct costs include supplier, freelancer, delivery software and other
  client-allocated delivery costs for the period.
- Client gross margin is `recognised revenue - direct costs`.
- Client gross margin percentage is `gross margin / recognised revenue`.
- Client contribution is the amount available after direct delivery costs. It
  must use verified period revenue and cost evidence, not proposal assumptions.
- Advertising/media spend is tracked separately unless the approved commercial
  model explicitly treats it as a pass-through cost.
- Revenue at risk combines current MRR, overdue/at-risk receivables, notice or
  renewal risk and approved churn/health signals. It must show reason codes and
  missing-data state.

## Reconciliation and Tolerances

- Primary identity is provider customer/invoice/payment ID plus Mission Control
  `clinic_id` and `client_account_profile_id`.
- Name-only matching is warning-only and cannot automatically overwrite an
  existing mapping.
- Cross-client or cross-tenant matches are blocked and recorded as
  reconciliation exceptions.
- Rounding differences up to one penny may be treated as tolerance-only.
  Larger amount differences require review.
- Date differences caused only by timezone boundary may be warning-only. Due
  date, tax, payment allocation and bank-account differences require review.
- Duplicate provider events are processed idempotently by provider event ID,
  object ID and action type.

## Approval Rules

The following actions require explicit role approval and audit evidence before
external provider mutation:

- new customer creation or customer merge;
- new package/service price;
- invoice send;
- recurring invoice activation or cancellation;
- credit note;
- refund;
- write-off;
- bank account, mandate or payment-method change.

Required audit evidence:

- actor;
- timestamp;
- affected client/account;
- source agreement or provider object;
- before/after state;
- reason;
- approval role;
- provider response or reconciliation result where applicable.

## Downstream Task Boundaries

- CG-131 defines the finance policy and approval contract.
- CG-134 implements the approved accounting-platform integration lifecycle.
- CG-135 owns finance-summary surfaces for MRR, aged debt, cash, costs and
  profitability.
- CG-139/executive views may consume approved finance summaries but must not
  invent missing accounting facts.

## External Acceptance Gates

- Michael must provide source evidence and policy rationale during handover.
- Max must approve the mapping/policy pack before CG-134 activation.
- Accountant/tax judgement remains external to Mission Control.
- Production provider credentials, live provider account tests and staging or
  production evidence are not provided by this document.
