# Landing Page Lead Capture API

Mission Control exposes a private server-to-server intake endpoint for custom landing pages:

```http
POST /api/public/landing-page-leads
Authorization: Bearer <landing-page-api-key>
Content-Type: application/json
```

The key must be created in Mission Control under `Settings -> API Keys` with the `Landing-page lead capture` purpose. Keys are source-specific, can be revoked or rotated independently, and the raw secret is only shown once when created or rotated.

## Secret storage

The private key belongs in the landing-page backend environment or managed secret store, for example:

```env
MISSION_CONTROL_API_URL=https://crm.clinicgrower.co.uk
MISSION_CONTROL_LEAD_API_KEY=<paste-key-shown-once-from-mission-control>
```

Do not create `NEXT_PUBLIC_MISSION_CONTROL_LEAD_API_KEY`, `VITE_MISSION_CONTROL_LEAD_API_KEY` or any other browser-public variable. The browser should submit to the landing-page backend, and only that backend should call Mission Control.

## Required fields

Each submission must include either an account/company name or contact name, plus at least one contact method:

```json
{
  "idempotencyKey": "unique-form-submit-id",
  "accountName": "BristolDent Harbourside",
  "fullName": "Sarah Thompson",
  "email": "sarah@example.com",
  "phone": "+447700900123"
}
```

## Optional fields

The endpoint also accepts website, message, service/package interest, landing page URL, referrer, UTM fields, click IDs, consent assertions, Calendly/schedule-call fields, guide-download fields and chatbot transcript fields. Supplied attribution and consent data is retained; consent is not invented when the form did not supply it.

## Behaviour

Valid submissions reuse the existing website lead workflow. Mission Control creates or updates the prospect by normalised email/phone, places the lead in the configured sales stage, stores attribution and consent, and creates the configured follow-up task unless the source key has follow-ups disabled.

Retries should send the same `idempotencyKey`. Mission Control reserves that key per workspace/source so timeout retries do not create duplicate prospects, deals or tasks.

## Server-side example

```js
const response = await fetch(`${process.env.MISSION_CONTROL_API_URL}/api/public/landing-page-leads`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.MISSION_CONTROL_LEAD_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    idempotencyKey: submission.id,
    accountName: submission.company,
    fullName: submission.name,
    email: submission.email,
    phone: submission.phone,
    landingPage: submission.pageUrl,
    referrer: submission.referrer,
    utmSource: submission.utm_source,
    utmMedium: submission.utm_medium,
    utmCampaign: submission.utm_campaign,
    gclid: submission.gclid,
    consent: {
      email: submission.emailConsent === true,
      phone: submission.phoneConsent === true,
      whatsapp: submission.whatsappConsent === true,
      permissionSource: "Landing page form checkbox",
    },
  }),
});

if (!response.ok) {
  const error = await response.json();
  throw new Error(error.message || "Mission Control lead capture failed");
}
```

Do not put the private API key in browser JavaScript. The public form should submit to the landing page backend first, and that backend should call Mission Control.
