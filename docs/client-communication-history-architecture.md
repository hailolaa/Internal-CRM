# Client Communication History Architecture

Mission Control client accounts use the client account profile as the commercial account boundary. Communication history is read from existing linked contacts rather than from account names or free-text matching.

## Scope

The first client communication history surface includes:

- Email records from `email`
- SMS records from `sms`
- WhatsApp records from `whatsapp_message`
- Twilio call records from the call table, including recording availability, transcripts and AI summaries when already present

The feature is read-only. It does not send messages, create calls, transcribe recordings or mutate client account data.

## Account Boundary

The backend resolves the requested client account through the existing `client_accounts:read` permission and client account availability checks. It then reads `client_account_contact` for linked contacts inside the requesting workspace.

Only communication rows for those linked contact IDs are included. Provider IDs and raw webhook payloads are not exposed to the frontend.

## AI Contract

The API returns a bounded `aiContext` object containing:

- A deterministic summary of available history
- A bounded searchable text corpus
- Transcript count
- Signal counts for outstanding items, commitments, complaints and decisions

This allows a future AI assistant to read the relevant relationship context without querying raw provider tables directly.

## Provider Notes

WhatsApp, email and call records appear only when those integrations have already stored messages or call data. Missing provider configuration is shown as an absence of history, not as a client account error.

Transcripts are surfaced only when the call transcription pipeline has already populated them.
