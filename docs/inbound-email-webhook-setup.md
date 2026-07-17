# Inbound Email Webhook Setup

Mission Control can receive inbound email through:

```text
POST /api/webhooks/email/inbound
```

The webhook saves inbound email to the existing inbox. It matches the sender to an existing contact by email, or creates a new lead when no contact exists.

## Required Backend Env

```env
BREVO_API_KEY=
BREVO_INBOUND_DOMAIN=
EMAIL_INBOUND_PUBLIC_URL=
EMAIL_INBOUND_WEBHOOK_SECRET=
EMAIL_INBOUND_WORKSPACE_ID=
EMAIL_INBOUND_WORKSPACE_MAP={"wordpresshealth@leapdigital.online":"<workspace-id>"}
```

For local testing, `backend/.env` is already configured with:

```env
EMAIL_INBOUND_WORKSPACE_ID=clinic-001
EMAIL_INBOUND_WORKSPACE_MAP={"wordpresshealth@leapdigital.online":"clinic-001"}
```

## Provider Webhook URL

Use the public backend URL, not the frontend URL:

```text
https://<public-backend-domain>/api/webhooks/email/inbound?secret=<EMAIL_INBOUND_WEBHOOK_SECRET>
```

For local ngrok testing:

```text
https://<your-ngrok-domain>/api/webhooks/email/inbound?secret=<EMAIL_INBOUND_WEBHOOK_SECRET>
```

If the provider supports custom headers, use this instead of the query string:

```text
x-webhook-secret: <EMAIL_INBOUND_WEBHOOK_SECRET>
```

## Brevo Inbound Parsing Setup

Brevo inbound parsing does not pull from Gmail/Outlook mailboxes. It receives email for a domain or subdomain that has MX records pointed to Brevo.

Use a receiving domain/subdomain that is dedicated to inbound parsing, for example:

```text
reply.leapdigital.online
```

Avoid moving the root domain MX unless all mail for that domain should be received by Brevo.

Add these DNS records for the inbound domain:

```text
reply.leapdigital.online MX 10 inbound1.sendinblue.com.
reply.leapdigital.online MX 20 inbound2.sendinblue.com.
```

Then set:

```env
BREVO_INBOUND_DOMAIN=reply.leapdigital.online
EMAIL_INBOUND_WORKSPACE_MAP={"wordpresshealth@reply.leapdigital.online":"clinic-001"}
```

Create the Brevo inbound webhook:

```powershell
cd backend
npm run setup:brevo-inbound
```

This creates a Brevo webhook with:

```json
{
  "type": "inbound",
  "events": ["inboundEmailProcessed"],
  "domain": "reply.leapdigital.online"
}
```

## Expected Payload

The webhook accepts Brevo inbound parsing payloads, SendGrid/Mailgun-style JSON, and generic JSON. These fields are enough:

```json
{
  "messageId": "provider-message-id",
  "from": "Lead Name <lead@example.com>",
  "to": "wordpresshealth@leapdigital.online",
  "subject": "Need help with SEO",
  "text": "Hi, I want help with SEO and ads.",
  "receivedAt": "2026-07-17T12:00:00.000Z"
}
```

## Local Test

```powershell
$secret = "<EMAIL_INBOUND_WEBHOOK_SECRET>"
$headers = @{ "Content-Type" = "application/json" }
$body = @{
  messageId = "local-email-001"
  from = "Test Lead <lead@example.com>"
  to = "wordpresshealth@leapdigital.online"
  subject = "Need help with SEO"
  text = "Hi, I want help with SEO and ads."
} | ConvertTo-Json

Invoke-RestMethod -Method Post `
  -Uri "http://localhost:4000/api/webhooks/email/inbound?secret=$secret" `
  -Headers $headers `
  -Body $body
```

After a successful response, open Mission Control Inbox. The message should appear under the matched or newly-created contact.

## Production Notes

- Run `backend/scripts/migrations/20260717_add_inbound_email_metadata.sql`.
- Configure the provider route after DNS/mail routing is ready.
- Map every receiving inbox address to the correct workspace in `EMAIL_INBOUND_WORKSPACE_MAP`.
- Do not use a broad default workspace in production unless all inbound mail belongs to one workspace.
