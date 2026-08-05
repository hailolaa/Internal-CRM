# ClickUp Delivery Integration

Mission Control now has the backend foundation needed to connect ClickUp safely and map delivery work to the right client accounts.

## What is in place

- ClickUp OAuth and backend-configured API-token connection records are stored per Mission Control workspace.
- Access tokens are encrypted with the provider credential encryption key, not the JWT secret.
- A connection can be revoked from Mission Control, which clears stored tokens and records who revoked it.
- Client accounts map to ClickUp by stable `client_account_profile_id`, not by client name.
- Internal tasks can be mapped to ClickUp task IDs while still keeping the client account relationship explicit.
- Cross-client mapping is blocked. The same ClickUp folder/list/root task or ClickUp task cannot be reused for another active client in the same workspace.
- Audit logs are written for OAuth start, connection, revocation, client mapping changes and task mapping saves.

## API shape

Admin-only setup endpoints:

- `POST /api/clickup/oauth/start`
- `GET /api/clickup/oauth/callback`
- `POST /api/clickup/oauth/callback`
- `POST /api/clickup/api-token/connect`
- `POST /api/clickup/revoke`

Internal mapping endpoints:

- `GET /api/clickup/status`
- `GET /api/clickup/client-mappings/:clientAccountProfileId`
- `PUT /api/clickup/client-mappings/:clientAccountProfileId`
- `DELETE /api/clickup/client-mappings/:clientAccountProfileId`
- `GET /api/clickup/task-mappings?clientAccountProfileId=...`
- `POST /api/clickup/task-mappings`

The API does not return raw ClickUp tokens.

## Environment values needed

These belong in the approved secret manager or hosting environment, not in Git:

```env
CLICKUP_CLIENT_ID=
CLICKUP_CLIENT_SECRET=
CLICKUP_API_TOKEN=
CLICKUP_TEAM_ID=
CLICKUP_API_BASE_URL=https://api.clickup.com/api/v2
CLICKUP_APP_AUTH_URL=https://app.clickup.com/api
CREDENTIAL_ENCRYPTION_KEY=
```

For the current MVP, the fastest approved path is the backend-configured API token:

1. Put the real ClickUp API token in `CLICKUP_API_TOKEN`.
2. Put the approved ClickUp Workspace/Team ID in `CLICKUP_TEAM_ID`.
3. Keep both values in the backend environment or secret manager only.
4. Restart the backend.
5. Open `Integrations` in Mission Control and click `Connect API Token` on the ClickUp card.

The token is sent only from the backend to ClickUp, then stored encrypted in Mission Control. It is not exposed to browser JavaScript.

The ClickUp OAuth callback URL should be:

```text
{API_PUBLIC_URL}/clickup/oauth/callback
```

For example, if `API_PUBLIC_URL` is `https://api-mission-control.thegrowthgroup.com/api`, the callback becomes:

```text
https://api-mission-control.thegrowthgroup.com/api/clickup/oauth/callback
```

## External steps still needed

- Approve the ClickUp operating model: which Workspace, Spaces, Folders, Lists, statuses and custom fields Mission Control is allowed to map to.
- Put `CLICKUP_API_TOKEN`, `CLICKUP_TEAM_ID` and `CREDENTIAL_ENCRYPTION_KEY` into the backend secret manager for the MVP API-token connection.
- Create or approve the ClickUp OAuth app later if the team wants a user-consent OAuth flow instead of a managed workspace token.
- Add the callback URL above in ClickUp when OAuth is enabled.
- Put `CLICKUP_CLIENT_ID`, `CLICKUP_CLIENT_SECRET` and `CREDENTIAL_ENCRYPTION_KEY` into the deployment secret manager if OAuth is enabled.
- Run the new migration before testing the endpoints.
- Connect the approved Workspace through the Integrations page using the configured API token, or through the OAuth start/callback flow if OAuth is enabled.
- Map one real client account to its ClickUp delivery structure and confirm the mapping is deterministic.
- Map one internal task to one ClickUp task and confirm it cannot be mapped to another client.

## Notes for review

ClickUp’s current OAuth documentation says access tokens do not expire at the moment, but the implementation still stores optional refresh-token and expiry fields because the provider can change token behaviour later. The important point for this phase is that token storage, revocation and client/task identity mapping are ready before any live delivery sync is turned on.

References:

- https://developer.clickup.com/docs/authentication
- https://developer.clickup.com/reference/authorization
- https://developer.clickup.com/docs/faq
