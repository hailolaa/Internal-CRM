# Mission Control Handover Notes

These are the main notes the team should use when taking over Mission Control for daily work.

## Start Here

The most important document is:

- `docs/mission-control-daily-use-sop.md`

That explains the day-to-day workflow: adding leads, setting follow-ups, moving pipeline stages, using Growth Scores and audits, creating proposals, converting won deals to clients, and checking onboarding/Drive links.

## Other Useful Notes

- `docs/phase-one-mvp-qa.md`  
  Current MVP QA status and what still needs browser evidence.

- `docs/scoro-import-cutover.md`  
  How to move live Scoro data into Mission Control safely.

- `docs/mission-control-internal-go-live-cutover.md`  
  The live cutover plan and what still needs sign-off.

- `docs/mission-control-go-live-backlog.md`  
  Known issues and follow-up items.

- `docs/duplicate-review.md`  
  How duplicate lead/contact review should be handled.

- `docs/proposal-send-workflow.md`  
  How proposal links are sent and logged in phase one.

- `docs/next-best-action.md`  
  Current logic behind the suggested next actions.

## How I Would Explain Mission Control To The Team

Mission Control should become the main internal record for sales and client operations.

If someone opens a lead or client, they should be able to see:

- Who owns it
- What stage it is in
- What was last done
- What needs to happen next
- What package is involved
- What proposal, Drive folder, onboarding item or missing access is attached

If that information only exists in Scoro, email, WhatsApp or someone's memory, then Mission Control is not doing its job yet.

## Current Go-Live Caveat

The automated QA is passing, but the final manual browser pass still needs to be captured for MC-055.

MC-058 also needs team/leadership sign-off before it is complete. The system is live, but we still need confirmation that:

- Core users can log in.
- Live data is in the CRM.
- The daily dashboard is usable with live data.
- Scoro is no longer the main tracker.

Before wider rollout, someone should open the real app on desktop and mobile and check the main working flows:

- Add/edit lead
- Move pipeline
- Add note/task/follow-up
- Create/preview proposal
- Convert won lead to client
- Check onboarding/files/missing access
- Confirm internal-only wording and permissions

Any issue found there should become a Trello card.
