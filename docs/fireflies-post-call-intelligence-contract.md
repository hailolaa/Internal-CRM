# Fireflies Post-Call Intelligence Contract

This document defines the Mission Control and Clinic OS contract for CG-095:
Fireflies meeting types, CRM matching rules and post-call outputs. It is a
product and engineering contract only. It does not enable Fireflies ingestion,
store transcripts or approve provider credentials.

## Scope

The post-call intelligence flow starts after an authorised transcript source
reports that a meeting transcript or summary is complete. It is not a live-call
cockpit and must not replace the separate live-call guidance workflow.

Supported primary source:

- Fireflies transcription or summary-complete webhook plus authorised transcript
  API.

Allowed fallback sources, only when approved for the clinic:

- Google Meet Events or REST transcript source.
- Approved Gemini smart notes.
- Gmail transcript evidence as a deduplicated fallback only.

Provider access, webhook signatures, plan eligibility, consent and retention
policy remain external prerequisites before CG-097 implementation.

## Meeting Types

Every transcript must be assigned exactly one meeting type before automated
post-call processing.

`discovery_call`

New prospect discovery or qualification call. Expected CRM anchor: lead or
contact. Default external action: none.

`proposal_call`

Proposal review, objection handling or decision call. Expected CRM anchor:
proposal plus lead/contact. Default external action: none.

`onboarding_call`

Accepted client onboarding or access collection. Expected CRM anchor: client
account. Default external action: none.

`delivery_review`

Active client delivery, reporting or performance review. Expected CRM anchor:
client account. Default external action: none.

`support_escalation`

Complaint, issue, blocked access or urgent support call. Expected CRM anchor:
client account and task/issue. Default external action: none.

`internal_planning`

Internal-only planning or handover. Expected CRM anchor: internal task/project.
Default external action: none.

`unknown`

Insufficient evidence to classify. Expected CRM anchor: review queue. Default
external action: none.

The classifier may suggest a type, but the stored value must include evidence:
source title, attendees, calendar metadata, linked CRM record and source spans.
If the evidence conflicts, use `unknown` and route to review.

## Consent And Retention

Transcript storage requires an explicit consent marker. Valid consent evidence
is one of:

- recorded consent from the call;
- written consent already stored on the CRM record;
- provider metadata showing consent was captured under an approved clinic
  policy;
- manual reviewer confirmation with reviewer, timestamp and reason.

If consent is absent or unclear, store only source metadata needed for review:
provider event ID, meeting title, timestamp, participant hints and failure
reason. Do not store transcript body, summary text or extracted facts.

Retention and erasure markers must travel with every transcript-derived record.
Deletion or erasure requests must remove or redact derived summaries, facts,
tasks and proposed CRM updates that depend on the transcript.

## Matching Rules

The matching process must deterministically produce one of three outcomes:

- `matched`: one confident CRM record was selected;
- `unmatched`: no eligible CRM record was found;
- `ambiguous`: more than one plausible CRM record exists or the evidence
  conflicts.

Matching confidence is built from these signals:

- Provider meeting ID or source event ID: used for idempotency and update
  detection, not person identity.
- Attendee email: strong identity signal after normalisation.
- Attendee phone: strong identity signal after E.164 normalisation.
- Calendar invite owner/account: tenant and clinic boundary signal.
- Existing proposal ID/reference: strong proposal-call anchor.
- Existing client account ID/reference: strong client-call anchor.
- Clinic name/domain: supporting signal only.
- Person name only: warning signal only; never sufficient by itself.

Required behavior:

- Tenant/workspace scope is applied before matching.
- A transcript may match only records visible to the tenant/workspace.
- Name-only matches are routed to review.
- Cross-tenant or cross-client matches are rejected and logged safely.
- Confident prospect matches link to lead/contact.
- Confident client matches link to client account and related contact.
- If no lead/contact exists and there is exactly one usable attendee identity,
  create one lead/contact once, with source provenance.
- Duplicate source event IDs update the same transcript record and never create
  duplicate leads, tasks or summaries.

## Post-Call Outputs

All outputs are advisory until reviewed or explicitly approved by a permitted
user. The system must never auto-send messages externally from transcript
content.

Every extracted fact must include:

- field key;
- value;
- source span ID;
- confidence: `confirmed`, `likely`, `unclear` or `conflicting`;
- whether it may update CRM automatically, requires approval or is review-only;
- source event ID and transcript version.

Required outputs by meeting type:

- Discovery calls: clinic context, treatment interests, goal, urgency,
  budget/capacity hints, objections, missing questions and next action.
- Proposal calls: decision status, objections, package/price questions,
  legal/commercial concerns, next action and proposal readiness risks.
- Onboarding calls: access items requested/provided, blockers, owners,
  deadlines and dependency updates.
- Delivery reviews: performance facts, commitments, risks, client sentiment,
  support needs and next review actions.
- Support escalations: issue summary, severity, affected system, promised
  response, owner and SLA risk.
- Internal planning: internal decisions, owners, dependencies, risks and
  follow-up tasks.
- Unknown calls: source metadata, possible match candidates and reason for
  review.

## CRM Update Rules

Transcript-derived output can only become a confirmed CRM fact when:

- the source span supports the fact directly;
- the target field is allowed for the meeting type;
- the update does not overwrite a more trusted current source;
- tenant and record identity are unambiguous;
- required consent and retention markers are present.

Otherwise, create a proposed update for human review. Contradictions must be
shown as contradictions, not resolved by the model.

## Edge Cases

Duplicate webhook:

Same provider event ID and transcript version are idempotent.

Changed transcript:

Store a new transcript version and re-evaluate derived output.

Missing contact detail:

Route to review. Do not create a name-only lead.

Ambiguous clinic identity:

Route to review with candidates.

Cross-tenant participant overlap:

Reject automated match and log a safe audit event.

Provider outage:

Queue retry without creating partial CRM updates.

Replay attack:

Reject when provider signature/timestamp check fails.

No consent:

Store metadata only and block transcript body/fact storage.

Sensitive data:

Flag for review and avoid copying unnecessary sensitive content.

Correction request:

Preserve audit trail and supersede the prior derived output.

Erasure request:

Redact transcript body and dependent derived output.

## Acceptance Gate For CG-097 And CG-098

CG-097 may implement ingestion only after:

- provider authentication/signature method is confirmed;
- tenant mapping and consent/retention policy are approved;
- this contract is used as the storage, matching and idempotency baseline.

CG-098 may implement summaries only after CG-097 provides:

- tenant-scoped transcript records;
- stable source span IDs;
- transcript versioning;
- consent and retention markers;
- deletion/erasure semantics.

The acceptable hallucination threshold and evaluation set still require
reviewer approval before automated summaries can be accepted as production
evidence.
