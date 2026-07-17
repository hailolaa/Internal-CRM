# Next Best Action MVP

Next Best Action is an internal Mission Control signal that gives the team a clear next step for active leads and clients. It is calculated from existing CRM fields and is not exposed to prospects or clients.

## Lead Rules

Rules are evaluated in order:

- New or uncontacted lead: suggest `Call/contact lead`.
- Free guide or lead magnet: suggest `Offer Growth Score`.
- Audit completed or Growth Score created: suggest `Proposal/dashboard follow-up`.
- Proposal stage: suggest `Chase proposal`.
- Package interest exists: suggest `Qualify package fit`.
- Otherwise: suggest `Review lead`.

## Client Rules

Rules are evaluated in order:

- Overdue client task: suggest `Clear overdue task`.
- Missing or inaccessible Google Drive/access: suggest `Fix missing access`.
- Upsell opportunity or recommended next package: suggest `Review upsell`.
- At-risk health or high churn risk: suggest `Schedule client review`.
- Onboarding or pending contract: suggest `Complete onboarding`.
- Renewal due within 30 days: suggest `Prepare renewal review`.
- Otherwise: suggest `Routine account review`.

## Current UI Surfaces

- Mission Control dashboard shows today's highest-priority next best actions.
- Prospect List shows the next action in the Stage / Action column.
- Client Accounts list shows the next action for each client.
- Client Account detail shows the next action near the top of the record.

## Notes

The MVP intentionally uses simple deterministic rules so the team can understand and correct the inputs. Later versions can add weighted scoring, owner-specific queues, and completed-action feedback.
