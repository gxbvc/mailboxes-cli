# mailboxes-cli

CLI for email, SMS, and iMessage via the Mailgun Mailboxes app (mailboxes.gen.co / mailboxes.gxb.vc). Send, receive, read, search, archive, trash, star, and reply from the terminal.

## Commands

```bash
# Profile
mailboxes-cli profile                                  # Show current user profile
mailboxes-cli profile update --name "New Name"         # Update profile name

# Domains
mailboxes-cli domains                                  # List all domains
mailboxes-cli domains show <id>                        # Show domain with its mailboxes
mailboxes-cli domains delete <id>                      # Delete a domain
mailboxes-cli domains reimport [--days 30]             # Re-import historical emails

# Mailboxes
mailboxes-cli mailboxes                                # List all mailboxes
mailboxes-cli mailboxes --domain <id>                  # List mailboxes for a domain
mailboxes-cli mailboxes show <id>                      # Show a single mailbox

# Threads (conversations)
mailboxes-cli threads                                  # List inbox threads (default)
mailboxes-cli threads --status archived                # List archived threads
mailboxes-cli threads --status trash                   # List trashed threads
mailboxes-cli threads --starred                        # List starred threads
mailboxes-cli threads --mailbox <id>                   # Filter by mailbox
mailboxes-cli threads --search "query"                 # Full-text search
mailboxes-cli threads --page 2 --per-page 10           # Pagination
mailboxes-cli threads show <thread_id>                 # Show full thread with all messages

# Thread actions
mailboxes-cli threads archive <thread_id>              # Archive a thread
mailboxes-cli threads trash <thread_id>                # Trash a thread
mailboxes-cli threads star <thread_id>                 # Toggle star on a thread
mailboxes-cli threads read <thread_id>                 # Mark thread as read
mailboxes-cli threads unread <thread_id>               # Mark thread as unread
mailboxes-cli threads move-to-inbox <thread_id>        # Move thread back to inbox

# Messages
mailboxes-cli messages show <id>                       # Show a single message with full body

# Compose (email)
mailboxes-cli send --from "you@domain" --to "addr" --subject "sub" --body "text"
mailboxes-cli send --from "you@domain" --to "addr" --subject "sub" --body "text" --cc "cc" --bcc "bcc"

# GXBot iMessage (+1 945-398-8901, mailbox 133). Linux hosts (gxbee) use this, not imessages-cli.
mailboxes-cli send --mailbox 133 --to "+18176685828" --body "text"
mailboxes-cli threads --mailbox 133
mailboxes-cli reply <thread_id> --mailbox 133 --to "+18176685828" --body "text"

# Twilio SMS (+1 817-797-7334, mailbox 127). Green bubble.
mailboxes-cli send --mailbox 127 --to "+18176685828" --body "text"

# Reply (email)
mailboxes-cli reply <thread_id> --from "you@domain" --to "addr" --body "text"
mailboxes-cli reply <thread_id> --from "you@domain" --to "addr" --body "text" --subject "Re: custom"
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
mailboxes-cli send --from "christian@gxb.vc" --to "bob@example.com" --subject "Hello" --body "Hi Bob!"

# Send from the GXBot iMessage number (1:1 only; no groups, no attachments)
mailboxes-cli send --mailbox 133 --to "+18176685828" --body "Hello from gxbee"

# Reply to a thread
mailboxes-cli reply abc-thread-id --from "christian@gxb.vc" --to "bob@example.com" --body "Thanks!"

# Archive and star
mailboxes-cli threads archive abc-thread-id
mailboxes-cli threads star abc-thread-id
```

## Response Format

All commands return:

```json
{"ok": true, "data": ...}
{"ok": false, "error": "message"}
```

### `threads`
Returns paginated thread summaries:

```json
{
  "ok": true,
  "data": {
    "threads": [
      {
        "thread_id": "2218ac60-439f-4cdb-bdd3-f76e2e7318a8",
        "subject": "Re: Cost-Effective Custom Caps & Lanyards",
        "snippet": "Hi there...",
        "participants": ["ACMEY Co."],
        "message_count": 7,
        "unread_count": 6,
        "starred": false,
        "latest_received_at": "2026-03-22T19:59:58Z"
      }
    ],
    "pagination": {
      "current_page": 1,
      "per_page": 25,
      "total_pages": 446,
      "total_count": 446
    }
  }
}
```

### `mailboxes`
Returns mailbox list:

```json
{
  "ok": true,
  "data": {
    "mailboxes": [
      {
        "id": 20,
        "address": "christian@gxb.vc",
        "display_name": null,
        "domain_id": 17,
        "created_at": "2026-02-24T23:17:16Z"
      }
    ]
  }
}
```

### `domains`
Returns domain list:

```json
{
  "ok": true,
  "data": {
    "domains": [
      {
        "id": 17,
        "name": "gxb.vc",
        "verified": true,
        "mailboxes_count": 3,
        "created_at": "2026-02-24T22:39:32Z"
      }
    ]
  }
}
```

Requires `.env` with `MAILBOXES_API_KEY` and `MAILBOXES_API_URL`. See `.env.example`.
