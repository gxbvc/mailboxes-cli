# Phase 3: Threads & Messages Commands

## Goal
Implement thread listing (with filtering, search, pagination), thread detail view, thread actions, and single message view.

## API Endpoints

```
GET    /api/v1/threads                              → { threads: [...], pagination: {...} }
  Query params: status (inbox|archived|trash), starred (true), mailbox_id, q, page, per_page
GET    /api/v1/threads/:thread_id                   → { thread: { thread_id, subject, ..., messages: [...] } }
PATCH  /api/v1/threads/:thread_id/archive           → { message: "..." }
PATCH  /api/v1/threads/:thread_id/trash             → { message: "..." }
PATCH  /api/v1/threads/:thread_id/star              → { message: "..." }
PATCH  /api/v1/threads/:thread_id/mark_read         → { message: "..." }
PATCH  /api/v1/threads/:thread_id/mark_unread       → { message: "..." }
PATCH  /api/v1/threads/:thread_id/move_to_inbox     → { message: "..." }

GET    /api/v1/messages/:id                         → { message: { id, body_html, body_plain, ... } }
```

## Steps

### 1. src/commands/threads.ts

Register commands:

```bash
# Listing
mailboxes-cli threads [options]
  --status <status>      # inbox (default), archived, trash
  --starred              # only starred threads
  --mailbox <id>         # filter by mailbox ID
  --search <query>       # full-text search (maps to ?q= param)
  --page <n>             # page number (default 1)
  --per-page <n>         # results per page (default 25, max 100)

# Show
mailboxes-cli threads show <thread_id>

# Actions
mailboxes-cli threads archive <thread_id>
mailboxes-cli threads trash <thread_id>
mailboxes-cli threads star <thread_id>
mailboxes-cli threads read <thread_id>
mailboxes-cli threads unread <thread_id>
mailboxes-cli threads move-to-inbox <thread_id>
```

Implementation notes:
- The default `threads` command (no subcommand) lists threads. Build query params from the options.
- `threads show` returns the full thread with all messages including bodies.
- Action commands (`archive`, `trash`, `star`, `read`, `unread`, `move-to-inbox`) each PATCH the corresponding endpoint and output the response.
- Include pagination metadata in the `data` for list responses: `{ok: true, data: {threads: [...], pagination: {...}}}`.

### 2. src/commands/messages.ts

Register command:

```bash
mailboxes-cli messages show <id>    # GET /api/v1/messages/:id
```

Returns full message with body_html, body_plain, and all metadata.

### 3. Register in cli.ts

Import and register both command groups.

### 4. Build and test

```bash
npm run build

# List threads
mailboxes-cli threads
mailboxes-cli threads --status archived
mailboxes-cli threads --starred
mailboxes-cli threads --search "test"
mailboxes-cli threads --page 2 --per-page 5

# Show thread
mailboxes-cli threads show <thread_id_from_list>

# Actions
mailboxes-cli threads star <thread_id>
mailboxes-cli threads archive <thread_id>
mailboxes-cli threads move-to-inbox <thread_id>

# Single message
mailboxes-cli messages show <message_id_from_thread>
```

## Verification
- `mailboxes-cli threads` returns paginated thread list with inbox threads
- `mailboxes-cli threads --status archived` returns only archived threads
- `mailboxes-cli threads --search "test"` returns matching threads
- `mailboxes-cli threads show <id>` returns full thread with message bodies
- Thread actions return success messages and actually mutate state (e.g., starring then listing starred shows the thread)
- `mailboxes-cli messages show <id>` returns full message with body
- All output follows `{ok: true, data: ...}` / `{ok: false, error: ...}` envelope
