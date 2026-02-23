# mailboxes-cli

CLI for managing email across all your domains via [Mailgun Mailboxes](https://mailboxes.gen.co). Send, receive, read, search, archive, trash, star, and reply to email from any domain you control — all from the terminal.

## Prerequisites

- Node.js 20+
- An account on [mailboxes.gen.co](https://mailboxes.gen.co) with an API key

## Setup

```bash
cd ~/tools/mailboxes-cli
cp .env.example .env          # Fill in MAILBOXES_API_KEY
# Or symlink from shared env:
# ln -s ../.env .env
npm install
npm run build
npm link
```

### Environment variables

| Variable            | Required | Description                                      |
| ------------------- | -------- | ------------------------------------------------ |
| `MAILBOXES_API_KEY` | Yes      | API key from mailboxes.gen.co                    |
| `MAILBOXES_API_URL` | No       | API base URL (default: `https://mailboxes.gen.co`) |

## Commands

### Profile

```bash
mailboxes-cli profile                          # Show current user profile
mailboxes-cli profile update --name "New Name" # Update profile name
```

### Domains

```bash
mailboxes-cli domains                          # List all domains
mailboxes-cli domains show <id>                # Show domain with its mailboxes
mailboxes-cli domains delete <id>              # Delete a domain
mailboxes-cli domains reimport [--days 30]     # Re-import historical emails
```

### Mailboxes

```bash
mailboxes-cli mailboxes                        # List all mailboxes
mailboxes-cli mailboxes --domain <id>          # List mailboxes for a domain
mailboxes-cli mailboxes show <id>              # Show a single mailbox
```

### Threads (conversations)

```bash
# Listing
mailboxes-cli threads                          # List inbox threads (default)
mailboxes-cli threads --status archived        # List archived threads
mailboxes-cli threads --status trash           # List trashed threads
mailboxes-cli threads --starred                # List starred threads
mailboxes-cli threads --mailbox <id>           # Filter by mailbox
mailboxes-cli threads --search "query"         # Full-text search
mailboxes-cli threads --page 2 --per-page 10   # Pagination

# Show full thread
mailboxes-cli threads show <thread_id>         # Show thread with all messages

# Actions
mailboxes-cli threads archive <thread_id>      # Archive a thread
mailboxes-cli threads trash <thread_id>        # Trash a thread
mailboxes-cli threads star <thread_id>         # Toggle star on a thread
mailboxes-cli threads read <thread_id>         # Mark thread as read
mailboxes-cli threads unread <thread_id>       # Mark thread as unread
mailboxes-cli threads move-to-inbox <thread_id> # Move thread back to inbox
```

### Messages

```bash
mailboxes-cli messages show <id>               # Show a single message with full body
```

### Send

```bash
mailboxes-cli send --from <mailbox_id> --to "addr" --subject "sub" --body "text"
mailboxes-cli send --from <mailbox_id> --to "addr" --subject "sub" --body "text" --cc "cc" --bcc "bcc"
```

### Reply

```bash
mailboxes-cli reply <thread_id> --from <mailbox_id> --to "addr" --body "text"
mailboxes-cli reply <thread_id> --from <mailbox_id> --to "addr" --body "text" --subject "Re: custom"
```

## Examples

```bash
# Check what domains and mailboxes you have
mailboxes-cli domains
mailboxes-cli mailboxes

# Read your inbox
mailboxes-cli threads
mailboxes-cli threads show 42cc0794-dbc1-49ac-bbc7-4eaec47fdf77

# Search for something
mailboxes-cli threads --search "invoice"

# Send an email
mailboxes-cli send --from 1 --to "bob@example.com" --subject "Hello" --body "Hi Bob!"

# Reply to a thread
mailboxes-cli reply abc-thread-id --from 1 --to "bob@example.com" --body "Thanks!"

# Archive and star
mailboxes-cli threads archive abc-thread-id
mailboxes-cli threads star abc-thread-id
```

## Output format

All commands output JSON to stdout:

```json
{"ok": true, "data": { ... }}
```

Errors:

```json
{"ok": false, "error": "message"}
```

Exit code is `0` on success, `1` on error.

## API

Talks to [mailboxes.gen.co](https://mailboxes.gen.co) (or a custom URL via `MAILBOXES_API_URL`). Authentication is via `Authorization: Bearer <API_KEY>` header.

## Rate limits

60 requests per minute per API key.
