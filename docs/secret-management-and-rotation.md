# Secret Management And Rotation

Production secrets should live in the approved vault or hosting secret manager, not in Git, Trello, ClickUp, screenshots or chat messages. The repository should only contain blank templates and setup notes.

## Current Rule

- Real `.env` files are ignored.
- Only `.env.example`, `.env.staging.example` and `.env.production.example` are tracked.
- Provider credentials must be supplied by the deployment environment.
- Connector/OAuth tokens are encrypted before they are stored in the database.

## Required Secrets

The backend needs separate secrets for separate jobs:

```bash
JWT_SECRET=
CREDENTIAL_ENCRYPTION_KEY=
CREDENTIAL_ENCRYPTION_KEY_VERSION=v1
CREDENTIAL_ENCRYPTION_PREVIOUS_KEYS=
CREDENTIAL_ENCRYPTION_LEGACY_JWT_SECRET=
```

`JWT_SECRET` signs login/session tokens.

`CREDENTIAL_ENCRYPTION_KEY` encrypts provider credentials and connector tokens.

These two values must not be the same. Keeping them separate means a JWT rotation does not break stored Google, Meta, Twilio or other connector tokens.

## Rotation Model

New credentials are encrypted with:

```bash
CREDENTIAL_ENCRYPTION_KEY
CREDENTIAL_ENCRYPTION_KEY_VERSION
```

Old keys can stay available during a rotation window through:

```bash
CREDENTIAL_ENCRYPTION_PREVIOUS_KEYS={"v1":"old-key-material"}
```

Legacy connector tokens that were encrypted with the old JWT secret can be read during the transition by setting:

```bash
CREDENTIAL_ENCRYPTION_LEGACY_JWT_SECRET=<old-jwt-secret>
```

That value should only stay present long enough to rewrap existing credentials.

## Rewrap Process

Run a dry-run first:

```bash
cd backend
npm run credentials:rewrap
```

If the count looks correct and a backup exists, apply the rewrap:

```bash
cd backend
APPLY=true npm run credentials:rewrap
```

After successful rewrap:

- remove `CREDENTIAL_ENCRYPTION_LEGACY_JWT_SECRET`
- keep the previous credential key configured only for the agreed rotation window
- rotate `JWT_SECRET` separately
- verify connector OAuth, Google Drive and provider syncs still work

## External Setup

The team still needs to choose and configure the managed vault. Good options are the hosting provider secret manager, 1Password, Bitwarden, AWS Secrets Manager, GCP Secret Manager, Azure Key Vault or Doppler.

The vault must provide:

- audited access
- environment separation
- limited access for production values
- a clear owner for rotation
- recovery notes for emergency rotation

## Reviewer Check

Before this is treated as complete, the reviewer should confirm:

- no real production secret is committed
- no production secret has been pasted into Trello or ClickUp
- the deployment environment has `JWT_SECRET` and `CREDENTIAL_ENCRYPTION_KEY` set separately
- connector tokens can be decrypted with the current key
- the rewrap script has been dry-run before any JWT rotation
