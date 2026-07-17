# Lead Priority Score

The lead priority score is an internal-only Mission Control signal used to help the team decide which prospects to contact first. It is calculated in the internal UI from CRM fields already available to the team and is not shown to prospects or clients.

## MVP Score Rules

Scores are capped at 100.

- Package interest:
  - Market Leader: +30
  - Growth Engine: +25
  - Performance OS: +22
  - Lead Concierge: +16
  - Growth Diagnostic: +12
  - Clinic Growth Score: +10
  - Any other package interest: +6
- Demo or audit intent: +20 when the lead has an audit status, Growth Score/audit/demo CTA, Growth Diagnostic signal, or similar source text.
- Free guide or lead magnet: +10 when source, CTA, or page data indicates a guide download or lead magnet.
- Multi-location signal: +10 when account/source/page text indicates multi-location, group, chain, or multiple locations.
- Proposal engagement: +18 when stage/status/source text indicates proposal activity.
- Audit follow-up due: +10 when audit follow-up is overdue or marked follow-up due.
- Sales follow-up overdue: +8.
- Response/activity:
  - SLA overdue: +14
  - Uncontacted: +8
  - Any contact activity exists: +4

## Priority Tiers

- Hot: 70-100
- Warm: 45-69
- Nurture: 20-44
- Low: 0-19

## Current UI Surfaces

- Prospect List shows the score and tier in the Priority / Owner column.
- Pipeline opportunity cards show the same score and tier.
- Hovering the score shows the reason labels used for that lead.

## Notes

The MVP score is intentionally simple and explainable. It should be revisited after the team has real usage data from website submissions, audit requests, proposals, and WhatsApp/email activity.
