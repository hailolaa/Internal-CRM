# Duplicate Detection And Review

Mission Control checks new manual leads and imported contacts against existing records in the same workspace before creating a duplicate.

## Strong Matches

These are treated as the same lead/contact:

- Email match
- Phone match
- Website domain match, including `www` and path differences

When a strong match is found, Mission Control updates the existing record with any missing useful fields from the new submission. It also writes audit and timeline history so the update is traceable.

## Possible Matches

These are flagged for human review:

- Account/client name match
- Contact first and last name match

Possible matches are stored in `contact_duplicate_candidate` and appear in Sales -> Duplicate Review. A user with `contacts:write` can mark each item as merged, not duplicate, or ignored.

## Workspace Safety

Duplicate checks are scoped to the authenticated workspace only. Records from another workspace are not considered matches and cannot be resolved through the current workspace review queue.
