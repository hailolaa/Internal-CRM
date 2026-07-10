# Mission Control Data Model

This repo uses a fresh Mission Control database created from `backend/db.sql`.
Some physical table and column names still use the legacy clinic CRM names for
compatibility, but their internal CRM meaning is defined below.

## Core Entity Mapping

| Mission Control concept | Current table | Notes |
| --- | --- | --- |
| Account / workspace / client account root | `clinic` | Legacy table name. In Mission Control this represents an internal workspace or client account container, not a patient-facing clinic module. |
| Client account profile | `client_account_profile` | One profile per account. Holds client status, current package, account manager, health, churn risk, renewal, and notes. |
| Contact / person / prospect | `contact` | People attached to an account/workspace. One account can have many contacts. |
| Lead status | `contact.lead_status` | Separate from `contact.status`, deal stage, and client account status. Used for sales qualification state. |
| Package interest | `contact.package_interest` and `contact.treatment_interests` | `package_interest` is the internal package-interest label. `treatment_interests` remains for compatibility and list-style interests. |
| Recommended package | `contact.recommended_package` | Sales recommendation before a client becomes active. |
| Deal / opportunity | `deal` | Opportunity tied to a contact and pipeline. One account/contact can have many opportunities. |
| Deal stage | `deal.stage` / `deal.pipeline_stage_id` | Separate from lead status and client account status. |
| Client status | `client_account_profile.client_status` | Separate from lead status and deal stage. Tracks account lifecycle such as prospect, onboarding, active, paused, at risk, churned. |
| Current package | `client_account_profile.current_package` | Active/current client package after conversion. Separate from prospect package interest/recommendation. |
| Activities | `activity` | Timeline events tied to contacts. |
| Tasks/actions | `task` | Internal delivery and sales work, with links to contacts and client account profiles. |
| Audits | `audit_log` | Internal audit trail. |
| Proposals | `proposal` | Lightweight proposal records tied to accounts, contacts, and/or deals. |
| Growth Scores | `account_growth_score` | Score history tied to client account profiles. |

## Important Separation Rules

- Accounts/workspaces live in `clinic`; people live in `contact`.
- A single account can have multiple contacts because `contact.clinic_id` points to `clinic.id`.
- A single account/contact can have multiple opportunities because `deal.clinic_id` and `deal.contact_id` point to those records.
- Lead status is `contact.lead_status`.
- Deal stage is `deal.stage` or `deal.pipeline_stage_id`.
- Client/account status is `client_account_profile.client_status`.
- Current package is `client_account_profile.current_package`.
- Package interest and recommended package are stored before conversion on `contact.package_interest` and `contact.recommended_package`.

## Migration Path From Clinic CRM Tables

For this MVP, do not migrate patient/medical data into Mission Control unless it is intentionally repurposed as sales/client data.

Recommended mapping from an existing clinic CRM export:

| Legacy data | Mission Control target |
| --- | --- |
| Clinic/client business record | `clinic` account/workspace row |
| Patient/contact record that is really a sales prospect or business contact | `contact` |
| Patient status such as active/prospect/lost | `contact.status` for broad contact state and `contact.lead_status` for sales qualification |
| Treatment interest | `contact.treatment_interests` and/or `contact.package_interest` |
| Recommended treatment/package | `contact.recommended_package` |
| Sales pipeline deal | `deal` |
| Pipeline stage | `deal.pipeline_stage_id` and `deal.stage` |
| Won client package | `client_account_profile.current_package` |
| Client lifecycle state | `client_account_profile.client_status` |
| Notes that are sales/client notes | `activity`, `task`, `strategy_log`, or `client_account_profile.key_notes` depending on use |
| Proposals | `proposal` |
| Growth score or health score history | `account_growth_score` |

Leave legacy clinic-specific modules such as clinical notes, treatments, treatment plans, appointment consults, deposit tracking, and reputation tooling out of the active MVP unless a later card explicitly repurposes them.
