# Unified Data Model

This document records the current Mission Control analytics contract for the ClinicGrower Performance OS. It defines the shared metric and dimension names used by dashboards, scores, API/MCP read surfaces and later AI analysis.

The implementation is intentionally deterministic. Missing source data is represented as `null` or as a data-quality issue, never as a healthy zero.

## Architecture

Source systems feed the fleet ingestion layer, then analytics facts and snapshots are written with tenant scope and lineage.

```text
Clinic OS / providers / manual inputs
  -> fleet_ingestion_source
  -> fleet_ingestion_event
  -> analytics_dimension
  -> analytics_metric_fact
  -> analytics_snapshot
  -> dashboards / API v1 / MCP / reports / scores
```

## Required Dimensions

- client
- location
- treatment
- campaign
- source_channel
- time_period
- workstream_owner

## Required Metrics

- impressions
- clicks
- spend
- leads
- qualified_leads
- calls_answered
- calls_missed
- calls_returned
- bookings
- consultations_attended
- treatment_sales_count
- treatment_sales_value
- revenue
- cancellation_rate
- no_show_rate
- lead_response_speed_minutes
- reception_follow_up_performance
- conversion_lead_to_qualified
- conversion_qualified_to_booking
- conversion_booking_to_consultation
- conversion_consultation_to_treatment
- cost_per_lead
- cost_per_qualified_lead
- cost_per_booking
- cost_per_acquired_patient
- roas
- marketing_roi
- commercial_revenue_leakage

The canonical registry lives in `backend/src/modules/analytics-store/unified-data-model.ts`.

## Calculation Rules

Conversion rates are percentages:

```text
numerator / denominator * 100
```

Cost metrics are:

```text
spend / count
```

ROAS is:

```text
revenue / spend
```

Marketing ROI is:

```text
(revenue - spend) / spend * 100
```

If a denominator or required source value is missing or zero, the calculated value is `null`. That value must be shown as a data gap or provider-dependent state, not as zero.

## Revenue Leakage

The current testable leakage model covers:

- missed calls multiplied by average treatment value
- slow-response leads multiplied by average treatment value and a confirmed dropout rate
- no-shows multiplied by average treatment value

The calculation returns each available component, a total of available components and the exact missing inputs. This allows a partially connected clinic to show a truthful partial leakage view while keeping missing data visible.

## Lineage

Analytics facts carry:

- clinic ID
- metric key
- grain and grain date
- normalized dimensions
- provenance
- source ID
- source event ID
- lineage hash

Snapshots carry:

- clinic ID
- snapshot key
- as-of date
- metric set
- source watermark
- lineage hash

## Current Acceptance Boundary

The repo-side contract, schema, idempotent fact storage, lineage, freshness and reconciliation controls are implemented.

Full business acceptance still requires connected pilot data showing that every required metric can be populated from approved source systems and reconciled against those systems.
