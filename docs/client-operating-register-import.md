# Client Operating Register Import

The Client Operating Register is the Mission Control record of current client operating state. The authoritative source for the initial register is the ClickUp list:

`901220280295` - Client Operating Register

The register is imported into Mission Control as first-class data. It is not a temporary spreadsheet copy and it is not the accounting ledger.

## Source Contract

Supported source formats:

- ClickUp task-shaped JSON from the canonical register list.
- CSV or JSON rows after they have been normalized into the same task-shaped contract.

Only parent operating records are imported as client operating records:

- `CLIENT RECORD - ...`
- `PROSPECT RECORD - ...`
- `PROSPECT CONTROL - ...`
- `INTERNAL RECORD - ...`
- `EXCLUDED RECORD - ...`

Control, lead, sales and supporting tasks are intentionally skipped unless they are represented as one of the accepted parent record types.

## First-Class Record Fields

Each imported row stores:

- source system, list ID, source record ID, URL, source status and source update timestamp
- canonical name and deterministic match key
- record kind: client, prospect, internal or excluded
- legal/trading/brand names where present
- lifecycle status
- package/service summary
- commercial summary with invoice truth source preserved
- operating controls, provider references and vault-reference labels
- confirmation-required fields
- risk, next action and evidence/source summary
- data state, freshness state and verification metadata
- complete source payload and payload hash

Accounting remains the source of invoice and payment truth. Register commercial values are treated as provenance and reconciliation context unless the field is separately verified against accounting.

## Identity and Matching

The stable source identity is:

`clinic_id + source_system + source_record_id`

The deterministic business match key is the normalized canonical client/account name. The importer prevents duplicate source IDs and duplicate canonical match keys in the same import batch.

Existing client account profiles are linked when an exact client clinic name match exists. Otherwise the importer creates a client clinic and client account profile, then links the register record to that profile.

## Import Behaviour

Dry run is the default. Apply mode requires `dryRun: false`.

The import is idempotent:

- rerunning the same source payload updates `last_seen_at`
- no duplicate register records are created
- no duplicate client account profiles are created
- unchanged payloads do not add duplicate payload-change history

Changed source records update the register row, linked profile summary fields and audit history.

Rows missing required identity are rejected as blocking errors. Rows with `Confirmation required` values are imported with warning issues and `freshness_status = confirmation_required`.

If `markMissingSource` is enabled, records present in an earlier import but absent from the current payload are marked `missing_from_source`. Existing data is preserved for human reconciliation.

## Permissions and Tenant Boundaries

Register reads require `client_accounts:read`.

Register imports require `client_accounts:write`.

Register rows are tenant-scoped by the importing Mission Control workspace. Linked client account profiles remain separate client clinic records. Mission Control API search exposes operating-register provenance for linked client accounts without exposing secrets or vault contents.

## Maintenance

Future maintenance should use the same deterministic import contract. Manual edits can correct Mission Control client account operational fields, but imported register provenance remains source-tracked. Future imports may update imported fields, add reconciliation issues or mark missing rows, but must not silently overwrite accounting truth or delete production data.

## Downstream Consumers

The register is available to:

- client accounts and operations views
- Mission Control REST/API search and fetch surfaces
- MCP read-only search/fetch through the Mission Control API record contract
- reconciliation and delivery review workflows

Production import must be run only after the source register, CG-159 commercial confirmations and identity mappings have been approved for the target environment.
