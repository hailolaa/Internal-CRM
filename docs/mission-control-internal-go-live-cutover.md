# Mission Control Internal Go-Live Cutover

This is the cutover note for moving our live lead and client tracking from Scoro into Mission Control.

This is not just a feature release. It is the point where the team agrees that Mission Control becomes the main working system for leads, clients, follow-ups, proposals and onboarding.

## Where We Are Now

Mission Control is live here:

`https://crm.clinicgrower.co.uk/`

What is already ready:

- The production site is live.
- The daily-use SOP is written.
- The Scoro import/cutover notes are written.
- The phase-one QA note is written.
- Known go-live limitations are listed separately.

What is not signed off yet:

- The core team still needs to confirm they can all log in.
- Live leads, clients and tasks still need to be imported or created.
- The dashboard needs to be checked with real data.
- Leadership needs to confirm when Scoro stops being the primary tracker.

So the honest status is: Mission Control is live technically, but the operational cutover is not fully complete yet.

## Go-Live Checklist

| Area | Status | What needs to happen |
| --- | --- | --- |
| Production environment | Done | Site is live at `https://crm.clinicgrower.co.uk/`. |
| Core team login | Needs sign-off | Each core user should log in and confirm their access/role is correct. |
| Live data | Not signed off | Import from Scoro or manually create the first live leads, clients and tasks. |
| Daily dashboard | Needs live-data check | Check the dashboard once real records are in the system. |
| Scoro cutover | Not done yet | Leadership needs to confirm the switch from Scoro to Mission Control. |
| Known issues | Done | Backlog is documented in `docs/mission-control-go-live-backlog.md`. |

## Cutover Steps

### 1. Confirm users

Before moving live work, the core team should each log in and confirm:

- They can access Mission Control.
- Their role is correct.
- They can see the screens they need.
- They cannot access anything they should not access.

No clients, prospects or external users should have access in this MVP.

### 2. Move live data in

There are two practical options:

- Import from Scoro using `docs/scoro-import-cutover.md`.
- Manually create the current live records if the number is small enough.

At minimum, we need:

- Active leads
- Active clients/accounts
- Key contacts
- Open tasks and follow-ups
- Active proposal follow-ups
- Client onboarding items
- Main Drive links where available

### 3. Check the dashboard

Once live records are in, check whether the dashboard is useful for a normal working day.

It should help the team see:

- New leads
- Leads not contacted
- Priority leads
- Follow-ups due and overdue
- Audits due or in progress
- Proposals needing follow-up
- Tasks due
- Onboarding or missing access issues

The dashboard does not need to be perfect on day one. It does need to be good enough that the team can start from it every morning.

### 4. Stop using Scoro as the primary tracker

This should only happen after leadership signs off.

Once approved:

- New lead/client updates should go into Mission Control.
- Scoro should become reference/read-only during the transition.
- The team should know exactly where each type of work belongs.
- If something is updated in Scoro during the transition, it should also be reflected in Mission Control.

The simple rule should be: Mission Control is the source of truth for live sales and client operations.

### 5. First live-day check

On the first live day, confirm these actions work with real records:

- Add a lead.
- Update a lead.
- Move a lead/opportunity in the pipeline.
- Add a note.
- Add and assign a task.
- Check proposal follow-ups.
- Convert a won lead/deal to a client if needed.
- Check onboarding, files and missing access on a client record.

Any issue should go into the go-live backlog instead of being left in chat.

## Go / No-Go

I would only call MC-058 complete when:

- Core users have logged in successfully.
- Live records exist in Mission Control.
- The dashboard has been checked with live data.
- The team agrees Scoro is no longer the main tracker.
- Known issues are documented and accepted.

Until then, this should stay marked as partial, not full go-live approval.
