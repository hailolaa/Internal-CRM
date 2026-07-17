# Task Workspace Design

## Status

Approved and implemented on 17 July 2026.

## Summary

Turn each CRM task into a proper workspace. Clicking a task will open a dedicated detail page where staff can read and edit the task, hold a threaded discussion, mention team members, upload files, and review the task's history.

The existing task list remains the quick overview. The detail page becomes the place for the work itself.

## Context and Scope

The current internal task page is list-based. A `taskId` query parameter only scrolls to and highlights a row. Notes are appended as timestamped text inside `task.description`, so they are difficult to scan and have no author identity, mentions, attachments, or individual editing controls.

The backend already provides tenant-scoped tasks, internal-task read/write permissions, team users, and audit events. It does not currently have task comments, task attachments, mention relationships, or a general notification inbox.

This design applies to both internal company tasks and client delivery tasks because both use the same `task` record. Client links remain visible only when a task is linked to a client.

## Goals

- Make every task row clickable and open a full task detail page.
- Show the task description and metadata in a readable layout.
- Add chronological comments with author and timestamp.
- Allow comments to mention one or more CRM team members using stable user IDs.
- Allow authenticated staff to upload, download, and remove files attached to a task.
- Show a unified activity history for task changes, comments, and files.
- Preserve all existing tasks and legacy notes without destructive conversion.
- Enforce clinic isolation and the existing internal-task permission model throughout.

## Non-Goals

- Replacing the task list or delivery board.
- Real-time chat, typing indicators, or live collaborative editing.
- Public/client access to task discussions or attachments.
- Email, Slack, or mobile push notifications in the first release.
- File previews and document editing in the first release.
- Migrating client Drive workspaces into task attachments.

## Constraints

- The application currently uses query-string detail routes and a statically deployable frontend. The task page should follow that established routing pattern.
- Client account files currently use client-specific Google Drive folders. Internal task files must not be silently placed in a client's Drive.
- The VPS deployment must keep uploaded files outside replaceable application build directories.
- Existing `description` content may contain timestamped legacy notes and must remain readable.
- Every query must include `clinic_id`; record IDs alone are not sufficient authorization.

## Proposed Design

### User experience

Add `/app/crm/tasks/detail/?id=<taskId>` as the task workspace.

The task list row opens this page when clicked. Interactive controls within the row, such as the completion checkbox, continue to perform their action without navigating.

The detail page contains:

1. A header with title, status, priority, due date, assignee, task type, and client link when applicable.
2. A description panel. Existing timestamped notes remain displayed as legacy notes until deliberately migrated.
3. A discussion panel with an ordered comment thread and a composer.
4. An attachments panel with file name, uploader, size, upload time, download, and remove actions.
5. An activity panel showing important task edits, comments, attachment changes, completion, QA, and archive events.

Comments display the author's current name and avatar/initials, with the original timestamp. Authors may edit or delete their own comments; users with task write permission may moderate any comment. Deleted comments become a lightweight “Comment removed” entry so conversation chronology is not misleading.

The comment composer includes a team-member picker. Selecting a person inserts a visible `@Name` token while persisting their user ID separately. Names are never parsed from plain text to determine who was mentioned.

### Data model

Add the following tenant-scoped tables:

#### `task_comment`

- `id` UUID primary key
- `clinic_id` foreign key
- `task_id` foreign key
- `author_user_id` foreign key, nullable only if a user is later removed
- `body` text
- `created_at`, `updated_at`, `deleted_at`
- indexes on `(clinic_id, task_id, created_at)` and `author_user_id`

#### `task_comment_mention`

- `comment_id` foreign key
- `mentioned_user_id` foreign key
- `created_at`
- composite primary key `(comment_id, mentioned_user_id)`

This keeps mentions valid if display names change and prevents duplicate mentions in one comment.

#### `task_attachment`

- `id` UUID primary key
- `clinic_id` foreign key
- `task_id` foreign key
- `uploaded_by_user_id` foreign key, nullable if a user is later removed
- `storage_provider` string, initially `local`
- `storage_key` opaque unique string
- `original_name`, `mime_type`, `size_bytes`, `sha256`
- `created_at`, `deleted_at`
- indexes on `(clinic_id, task_id, created_at)` and unique `storage_key`

Attachment metadata belongs in MySQL. File bytes initially live in a private, configurable VPS directory outside the repository and deployed builds. A small storage interface (`put`, `open`, `delete`) keeps a later move to S3-compatible object storage possible without changing task APIs or database records.

### API surface

- `GET /api/tasks/internal/:id` — fetch one task and summary counts.
- `GET /api/tasks/internal/:id/comments` — list comments and mentions.
- `POST /api/tasks/internal/:id/comments` — create a comment with `body` and `mentionedUserIds`.
- `PATCH /api/tasks/internal/:id/comments/:commentId` — edit a comment.
- `DELETE /api/tasks/internal/:id/comments/:commentId` — soft-delete a comment.
- `GET /api/tasks/internal/:id/attachments` — list attachment metadata.
- `POST /api/tasks/internal/:id/attachments` — multipart upload.
- `GET /api/tasks/internal/:id/attachments/:attachmentId/file` — authenticated download.
- `DELETE /api/tasks/internal/:id/attachments/:attachmentId` — soft-delete metadata and remove stored bytes.
- `GET /api/tasks/internal/:id/activity` — return the task's user-facing history.

Existing update, QA, and archive endpoints remain unchanged. Delivery and internal company tasks use the same detail APIs; visibility rules already applied to task listing must also be applied when fetching by ID.

### Mentions and notifications

Phase one adds an in-app “Mentions” view/filter rather than email delivery. A mention is unread when its comment is newer than the user's saved read marker for that task. Opening the task advances that marker. This requires:

#### `task_read_state`

- `clinic_id`
- `task_id`
- `user_id`
- `last_read_at`
- composite primary key `(task_id, user_id)`

The task navigation can show an unread mention count. Notification preferences already exist, but there is no general notification delivery system; email can be added later without coupling it to comment creation.

### Activity

Continue writing audit events for task changes and add events for comment and attachment create/update/delete operations. The activity endpoint converts relevant audit events into user-facing labels and merges them chronologically with comment and attachment events where appropriate.

The audit log remains the immutable operational record. Comments remain editable content and are not used as the audit store.

## Architecture View

```text
Task list
   |
   v
Task detail page
   |---- task metadata --------> task service --------> task
   |---- comments/mentions ----> discussion service --> task_comment
   |                                               |--> task_comment_mention
   |                                               `--> task_read_state
   |---- attachments ---------> attachment service --> task_attachment
   |                                               `--> private file storage
   `---- activity ------------> audit service -------> audit_log
```

## Security and File Handling

- Require `internal_tasks:read` for viewing/downloading and `internal_tasks:write` for changing task content, comments, or attachments.
- Permit comment authors to edit/delete their own comments only when they still have task write access; administrators/task writers may moderate all comments.
- Resolve every task, comment, mention target, and attachment using the authenticated `clinic_id`.
- Limit each file to 20 MB initially and make the limit configurable.
- Store randomized storage keys; never use the supplied filename as a filesystem path.
- Download through an authenticated API using `Content-Disposition: attachment` and safe response headers. Do not expose the storage directory through the web server.
- Reject executable/script formats initially and validate both extension and detected MIME type. Record SHA-256 for integrity and future malware-scanning integration.
- Include the attachment storage directory in VPS backup and restore procedures.
- Log attachment uploads, downloads, and removals without placing file contents in logs.

## Alternatives Considered

### Expand rows inline

Rejected as the primary experience. Comments, files, metadata, and activity would make the task list tall and difficult to scan, especially on smaller screens. A dedicated page also provides a stable URL for sharing a task internally.

### Keep appending notes to `task.description`

Rejected. It cannot reliably represent authorship, editing, deletion, mentions, unread state, or attachments.

### Store task files in client Google Drive

Rejected as the default. Internal company tasks may have no client, and task-working files should not pollute or accidentally expose a client's Drive workspace. A storage adapter still allows Google Drive to be added as an explicit provider later.

### Store files as base64 in MySQL

Rejected. It increases database and backup size, makes streaming inefficient, and couples file capacity to the primary database.

## Tradeoffs

- Private VPS storage is the smallest deployable first step, but deployment and backup processes must preserve it. The storage adapter reduces the cost of moving to object storage later.
- An in-app mention inbox is less immediate than email, but avoids introducing a partially designed notification system and respects the current application architecture.
- Leaving legacy description notes in place avoids a risky migration, but old notes and new comments will temporarily appear in separate sections.
- Soft-deleting comments and attachment metadata improves traceability at the cost of retaining some metadata until a later retention policy is defined.

## Rollout and Migration

1. Add new tables and storage configuration with a non-destructive database migration.
2. Add backend detail, comment, mention, attachment, and activity services with tenant-isolation tests.
3. Add the task detail page and make list rows navigable.
4. Add the mention count/filter and read-state updates.
5. Deploy with an empty private attachment directory and verify its ownership, persistence, size limits, backup inclusion, and download headers on the VPS.
6. Preserve all existing descriptions. Label parsed timestamp blocks as “Legacy notes”; do not automatically create comments from them.

The release can be rolled back at the application level without removing the new tables. Uploaded files and metadata remain intact for a subsequent redeploy.

## Open Questions

- Confirm that in-app mention alerts are sufficient for the first release; the recommendation is to defer email until the task workspace is in use.
- Confirm the initial 20 MB per-file limit; it can remain configurable.
- Confirm that task attachments should use private VPS storage initially; this is recommended over mixing them into client Google Drive.

## Decision

Recommended: approve the dedicated task workspace, normalized comments/mentions, private attachment storage behind an adapter, and in-app mention alerts as described above. Implementation should begin only after this design and its three defaults are confirmed.
