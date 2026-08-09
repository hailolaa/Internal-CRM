# Twilio WhatsApp Setup

Mission Control can use Twilio as the active WhatsApp provider while Meta is left disabled.

## What the app does

- Receives inbound Twilio WhatsApp webhooks at `/api/webhooks/whatsapp/inbound`.
- Validates `X-Twilio-Signature` using the Twilio auth token and exact public webhook URL.
- Routes the message to the correct workspace from the receiving WhatsApp number.
- Creates or updates the matching prospect/contact.
- Stores the message in the WhatsApp inbox and creates the AI draft/human-review state.
- Sends outbound WhatsApp replies through Twilio when `WHATSAPP_PROVIDER=twilio`.
- Keeps duplicate inbound `MessageSid` posts from creating duplicate inbox messages.

## Required backend environment

```env
WHATSAPP_PROVIDER=twilio
TWILIO_ACCOUNT_SID=<from Twilio>
TWILIO_AUTH_TOKEN=<from Twilio>
TWILIO_WHATSAPP_SENDER=whatsapp:+447000000000
TWILIO_WHATSAPP_WEBHOOK_URL=https://crm.clinicgrower.co.uk/api/webhooks/whatsapp/inbound
WHATSAPP_WEBHOOK_WORKSPACE_ID=clinic-001
```

Use `WHATSAPP_WEBHOOK_WORKSPACE_MAP` instead of `WHATSAPP_WEBHOOK_WORKSPACE_ID` if multiple Twilio WhatsApp senders need to route into different workspaces:

```env
WHATSAPP_WEBHOOK_WORKSPACE_MAP={"whatsapp:+447000000000":"clinic-001"}
```

Do not put Twilio credentials in frontend env files, Trello, ClickUp comments, or browser code.

## Twilio console setup

1. Open the Twilio WhatsApp sender, sandbox, or messaging service being used.
2. Set the inbound message webhook URL to:

   `https://crm.clinicgrower.co.uk/api/webhooks/whatsapp/inbound`

3. Use `POST`.
4. Make sure the value in `TWILIO_WHATSAPP_WEBHOOK_URL` exactly matches the URL configured in Twilio. The signature check depends on the exact URL.
5. Restart the backend after setting env vars.

## Safe checks before live testing

Run:

```bash
npm run test:twilio-whatsapp
```

This verifies:

- Twilio WhatsApp addresses are normalised correctly.
- Twilio webhook signatures are rejected when invalid.
- The real webhook route accepts signed form posts.
- Inbound messages are stored once and duplicate Twilio retries do not duplicate the message.

## Manual live test

After the backend is reachable on the public URL:

1. Send a WhatsApp message to the Twilio WhatsApp number.
2. Open Mission Control.
3. Go to Communications Centre / Inbox.
4. Confirm the conversation appears with the inbound message.
5. Open the thread and confirm the AI suggestion/human-review state appears.
6. Send a short internal-approved reply.
7. Confirm the reply appears in Mission Control and in the recipient WhatsApp chat.

If Twilio shows a webhook failure, check the backend logs for the request ID and verify the exact webhook URL and auth token.
