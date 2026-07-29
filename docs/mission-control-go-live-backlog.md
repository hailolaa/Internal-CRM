# Mission Control Go-Live Backlog

This is the simple backlog for anything that should be known before or shortly after internal go-live.

The point is not to block launch for every small improvement. The point is to be clear about what still needs checking, what is manual for MVP, and what should not get lost in chat.

## Must Confirm Before Full Cutover

- Core team users can log in.
- Live leads, clients and tasks are in Mission Control.
- The dashboard has been checked using real records.
- Leadership confirms when Scoro stops being the primary tracker.
- Desktop and mobile browser QA evidence has been captured for the main flows.

## Known MVP Limitations

- Some integrations may still be manual or in fallback mode until live credentials are fully approved.
- Proposal sending is link/manual-send based unless automated email is configured.
- Scoro import still needs the real export and a staging rehearsal before production import.
- Browser QA still needs screenshots for desktop and mobile.
- Some old clinic architecture still exists underneath, even where the active UI is now Mission Control-focused.

## Follow-Up Items After Internal Go-Live

- Do one final wording sweep for old clinic/patient/treatment wording.
- Confirm email and WhatsApp inbound behavior in production.
- Confirm Google Drive OAuth/service-account ownership and permissions.
- Confirm who owns the Growth Score process and calculation rules.
- Decide whether Mission Control tasks replace Trello/ClickUp or only track CRM-linked work.
- Add proper browser automation for the main daily flows.

## How To Log A Go-Live Issue

For each issue, capture:

- Screen or route
- User role
- Record affected
- What happened
- What should have happened
- Priority
- Owner

If it blocks the team from using Mission Control, mark it as a blocker. If it is cleanup, keep it in the backlog and do not mix it up with go-live approval.
