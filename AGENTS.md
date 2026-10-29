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

## Mailbox-key action commands (phase 2b)

`react`, `typing`, `mark-read`, and `capabilities` need a per-mailbox key
(`mbk_...`) in `MAILBOXES_MAILBOX_KEY` (env or `.env`); the mailbox comes
from the key, so there is no `--mailbox`. `send` keeps working with the user
key (`MAILBOXES_API_KEY`) as before; the new send flags `--effect`,
`--reply-to MESSAGE_ID`, `--voice-note URL` and `--thread THREAD_ID` go
through the mailbox-key endpoint and exit with an error without that key.
After pulling on another host, run `npm run build` (bin runs `dist/`, which
is not committed). Tests: `npm test` (node's built-in runner, stubbed fetch).

`poll --to E164 [--question TEXT] --option A --option B [...]` sends a Linq
poll through a mailbox key (Linq mailboxes only; 2 to 10 options).

## Email attachments (`--attach`)

`send` and `reply` take `--attach` (repeat), for EMAIL only, with the user key. Files come from the tab's outbox folder only.

```bash
mailboxes-cli reply THREAD_ID --mailbox 174 --to "person@example.com" --body "Attached." --outbox NAME --attach FILE.xlsx
mailboxes-cli reply THREAD_ID --mailbox 174 --to "person@example.com" --body "Attached." --outbox NAME --attach FILE.xlsx --dry-run
```

- `--outbox NAME` is required with `--attach`. The folder is `~/tmp/mail-outbox/NAME` (NAME is a-z 0-9 _ -). It must exist, be a real directory (not a symlink) owned by you, with mode 0700. The folder above it must not be group or world writable. `--attach` is a bare file name in that folder, or a full path into it. After realpath the file must still be inside the folder; a symlink anywhere on the way is refused.
- Allowed types: .xlsx .csv .pdf .png .jpg (case-insensitive). Regular files only. At most 5 files, 10 MB per file, 15 MB per mail. The CLI refuses before any request.
- One or two recipients (to and cc together). No `--bcc` with files.
- A recipient that is not in the thread (reply) or on the mailbox's domain list needs `--new-recipient`. The server decides; the flag only says you mean it.
- Secret check: the text parts (csv text; xlsx shared strings and sheet cell text) go through `~/projects/hq/bin/guard-check scrub` (env `MAILBOXES_GUARD_CHECK` overrides the path). A hit refuses with a count only, never the value. If guard-check cannot run, the send is refused. PDF, PNG and JPG are not text-scanned here (the server scans csv and xlsx text for key prefixes too). Note: guard-check passes everything when its hash table is missing.
- `--dry-run` checks everything (including the secret check) and prints file names, types and sizes only; it sends nothing.
- The server accepts files only for mailboxes with `allow_outbound_attachments` on, and never on a Bailey mailbox. It checks the type by content, refuses xlsx formulas, macros and links, csv cells that start with = + - @ or a tab (a plain number may start with -), and PDF script or launch actions (raw bytes only: a keyword inside a compressed object stream is not seen). It keeps each sent file encrypted with the message.
