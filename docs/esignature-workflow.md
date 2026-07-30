# E-signature workflow

Mission Control now has the internal structure needed to request signatures against proposals and store signature evidence against the proposal record.

The first provider mode is `log`. This is intentional. It lets the team create signature requests, link them to proposals, and test signed callback handling without sending anything to a live provider before the provider account is approved.

## What is covered

- Internal users with proposal write access can create a signature request from the proposal preview screen.
- Signature requests are tied to one proposal, one workspace and one signer.
- The provider callback endpoint verifies an HMAC signature before accepting any event.
- Provider events are idempotent. A repeated callback with the same provider event ID does not create a duplicate signed record.
- Signed evidence is stored separately from normal proposal status updates and is append-only from the application layer.
- Evidence can store signer name, signer email, signed time, signed PDF URL, audit certificate URL and a SHA-256 evidence hash.
- Signature activity is added to the proposal timeline and audit log for internal review.

## Environment

Use these variables in the backend environment:

```env
ESIGN_PROVIDER=log
ESIGN_API_KEY=
ESIGN_WEBHOOK_SECRET=
```

For a real provider, set:

```env
ESIGN_PROVIDER=pandadoc
ESIGN_API_KEY=<provider-api-key>
ESIGN_WEBHOOK_SECRET=<provider-webhook-secret>
```

`docusign` is also reserved as a supported provider key, but the live provider mapping should be completed after the provider account and webhook payload format are confirmed.

## Provider callback

Webhook URL:

```text
POST /api/webhooks/esign/:provider
```

The callback must include:

```http
X-Esign-Signature-256: sha256=<hmac-sha256-of-raw-json-body>
```

Expected JSON shape:

```json
{
  "providerRequestId": "log_request_id",
  "providerEventId": "event_id_from_provider",
  "eventType": "document.completed",
  "status": "signed",
  "signerName": "Decision Maker",
  "signerEmail": "owner@example.com",
  "signedAt": "2026-07-30T12:00:00.000Z",
  "signedPdfUrl": "https://provider.example/signed.pdf",
  "auditCertificateUrl": "https://provider.example/audit.pdf",
  "evidence": {
    "ipAddress": "203.0.113.10",
    "providerEnvelopeId": "abc123"
  }
}
```

## Review note

The internal data model and safe callback handling are ready for review. A true live signing test still needs the chosen e-sign provider account, API key, webhook secret and final provider payload mapping.
