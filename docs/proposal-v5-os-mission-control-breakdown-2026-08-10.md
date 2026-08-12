# Proposal V5, ClinicGrower OS And Mission Control Breakdown

Date: 10 August 2026

This is my current breakdown of the V5 proposal work in Mission Control. The aim is to make the proposal flow feel ready for real client use: personal to the clinic, commercially clear, proof-led and consistent with the ClinicGrower OS sales material.

The V5 direction replaces the earlier proposal versions. The detailed A4 brochure is the main print reference, and the mobile and post-call references guide how the online version should feel.

## Current Position

The proposal system is now being treated as a live sales workflow, not a draft template.

The current V5 image set is the release asset pack. If replacement images are supplied later, they can be swapped through the same clinic-type asset structure without changing the renderer.

The main focus for this release is the client-facing experience: the V5 sequence, readiness checks, commercial calculations, proof handling, mobile view, PDF output and browser verification.

## What Is In Place

Mission Control now has the main proposal foundations needed for the V5 flow:

- Proposals can be created, edited, previewed, shared and moved through the main sales statuses.
- Public proposal links are tied to proposal records and can be opened externally.
- Accepted proposals are locked so the accepted version cannot be silently changed.
- Package, fee, setup, VAT, term, notice, start date and expiry are stored.
- Scope is handled as structured deliverables instead of loose feature text.
- Proof assets can be stored, selected and shown on the proposal.
- The eight website clinic types, plus a general ClinicGrower variant, are supported.
- The V5 proposal data model supports evidence, economics, journey, scope, proof, images, versioning and approval.
- Discovery sessions autosave, track answer states, show missing/conflict warnings and create proposal drafts.
- The V5 package ladder is versioned and aligned to the confirmed package list.

## Discovery Call Flow

The discovery call flow gives the team one place to capture the commercial discussion and turn it into a proposal without re-entering the same information later.

What has been built:

- Discovery sessions link to the lead/contact, account, deal and proposal draft.
- A call can be started or resumed from contact and client-account pages.
- CRM prefill helps speed things up without overwriting call-confirmed answers.
- Structured answers and free notes autosave during the call.
- Each answer has a state: Confirmed on call, Working diagnosis, Provisional or To confirm.
- Source timestamp and original customer wording can be kept.
- Missing fields and commercial conflicts show during the call.
- Clinic type and recommended package can be selected during the call.
- Proposal drafts are generated only after the call.
- Call completion and draft creation are recorded on the activity timeline and audit trail.

Before relying on this live, I would still run one full call rehearsal from start to finish: start the call, refresh and resume it, generate the proposal, check the saved answers are used, and confirm the timeline shows the outcome and next step.

## ClinicGrower OS Positioning

The proposal should keep the ClinicGrower OS message consistent:

> ClinicGrower tells clinic owners exactly where they are losing patients and revenue, who or what is causing it, and what needs fixing first.

The proposal narrative should stay focused on these points:

- The lead is only the beginning.
- A booking is not revenue.
- The full journey matters: visibility, enquiry, response, booking, attendance, consultation, treatment, revenue, follow-up and retention.
- ClinicGrower OS is the commercial intelligence and accountability layer above marketing, enquiries, team response and revenue data where connected.
- ClinicGrower OS works alongside the clinic's existing CRM, diary and booking systems. It does not require replacement unless that is part of the agreed work.
- Product screens should be shown as OS views, with live figures dependent on connected sources.

## Package Catalogue

The confirmed V5 package ladder is:

- Free Clinic Growth Audit: GBP 0.
- Growth Diagnostic: GBP 395/month.
- Lead Concierge: GBP 595/month.
- Starter Engine: GBP 995/month plus agreed ad spend.
- Growth Partner: GBP 1,695/month plus agreed ad spend.
- Clinic Growth Engine: GBP 2,495/month plus agreed ad spend.
- Growth Engine Plus: GBP 3,495/month plus agreed ad spend.
- Market Leader: from GBP 4,995/month plus agreed ad spend.

The package catalogue now supports catalogue version and commercial notes. Sent proposals keep the selected package, price, setup, media, VAT, term, notice and scope snapshot so later package updates do not change what the client saw.

## Economics And Break-Even Controls

The commercial case should only show a break-even calculation when the required numbers are confirmed.

The calculation is:

- Recurring break-even: monthly fee plus selected media, divided by contribution per unit, rounded up to a whole unit.
- First-month break-even: monthly fee plus selected media plus setup fee, divided by contribution per unit, rounded up to a whole unit.

Rules I want to keep in place:

- Use whole units only.
- Use clinic-confirmed contribution after relevant variable delivery costs.
- Do not invent contribution, capacity or ROI.
- Keep media spend separate from ClinicGrower's fee.
- Hide derived break-even counts until contribution, capacity and selected media are confirmed.

## Clinic Type Variants

The proposal supports these clinic types:

- Aesthetic Clinics, using treatment interest, response, consultation, treatment and repeat-treatment language.
- Dental Practices, using high-value enquiry, coordinator, consultation and accepted-plan language.
- Cosmetic Surgery Clinics, using procedure research, suitability, consultation and deposit language.
- Dermatology Clinics, using condition search, private route, appointment and care-pathway language.
- Hair Transplant Clinics, using research, nurture, assessment and deposit language.
- Wellness Clinics, using education, discovery, enrolment and renewal language.
- Private GP & Medical Clinics, using private access, booking, appointment and attributable-value language.
- Medical Spas, using positioning, treatment page, plan and repeat or membership language.

The important rule is that clinic type and package stay independent. Changing the clinic type should update language, proof and imagery, but it should not silently change the selected package. Changing the package should update scope and investment, but it should not change the clinic type.

## Proof And Claim Controls

The proof system is in place for awards, product screenshots, case studies, testimonials, performance results and team or founder imagery.

The rules are:

- Do not present historic PPC, SEO or website results as guaranteed OS outcomes.
- Do not imply guarantees.
- State timeframe and delivery context for performance-result proof.
- Use named testimonials only where permission exists.
- Keep product claims tied to connected data where relevant.
- Use clinic-type filtering so proof feels relevant to the prospect.

## Design And PDF Requirements

The V5 proposal needs to keep the agreed A4 editorial rhythm:

- A4 portrait with 17mm safe margins.
- Dark pages on 1, 3, 5, 8, 11, 18 and 19.
- Around 19 purposeful pages.
- The same locked proposal data should drive desktop, mobile and PDF.
- No localhost URLs, internal UUIDs, browser counters, clipped headings, unreadable dark-on-dark text or internal template commentary.
- PDF links and QR code should point back to the secure online proposal and approval route.

Before release, I would check desktop, mobile and PDF from the same proposal record and make sure spacing, contrast, page rhythm and clickable links are all right.

## Acceptance And Post-Acceptance Flow

The acceptance foundation is in place: accepted proposal snapshot, accepted-version locking and acceptance record support.

The required behaviour is:

- The client approves the exact proposal version shown.
- Expired or superseded versions cannot be accepted.
- The acceptance record stores recipient, package, scope, price, setup, media, VAT, term, notice, expiry, start date, authorised name, role and timestamp.
- Accepted proposals stay linked to the exact scope, price and terms accepted.
- Post-acceptance should create the operational handover: services, invoice/payment step, onboarding workflow, access requests, owners, deadlines and kickoff scheduling.

## Final Client-Use Checklist

Before a live proposal is sent, I would check:

- A proposal call can be started from a real contact/account.
- Discovery answers include states and customer wording.
- Clinic type and package are selected correctly.
- Price, setup, media, VAT, term, notice, start date and expiry are complete.
- Contribution and capacity are either confirmed or the commercial calculation stays hidden.
- Relevant proof assets are selected.
- Desktop, mobile and PDF previews all use the same proposal data.
- No internal wording is visible.
- PDF page rhythm and dark-page contrast look right.
- The review gate blocks incomplete proposals.
- The approval route stores the locked version after acceptance.
