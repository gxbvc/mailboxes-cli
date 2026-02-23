# Phase 4: Send & Reply Commands

## Goal
Implement compose (send new email) and reply commands.

## API Endpoints

```
POST   /api/v1/messages                    → { message: "Message queued for delivery" }
  Body: { mailbox_id, to, subject, body, cc?, bcc? }

POST   /api/v1/threads/:thread_id/reply    → { message: "Reply queued for delivery" }
  Body: { mailbox_id, to, body, subject? }
```

## Steps

### 1. src/commands/send.ts

Register command:

```bash
mailboxes-cli send --from <mailbox_id> --to <address> --subject <subject> --body <body> [--cc <cc>] [--bcc <bcc>]
```

- `--from` is required (mailbox ID, not email address — user can look up with `mailboxes-cli mailboxes`)
- `--to`, `--subject`, `--body` are required
- `--cc` and `--bcc` are optional
- POST to `/api/v1/messages`
- Output: `{ok: true, data: {message: "Message queued for delivery"}}`

### 2. src/commands/reply.ts

Register command:

```bash
mailboxes-cli reply <thread_id> --from <mailbox_id> --to <address> --body <body> [--subject <subject>]
```

- `<thread_id>` is a positional argument
- `--from` (mailbox ID) and `--to` and `--body` are required
- `--subject` is optional (API auto-generates "Re: ..." if omitted)
- POST to `/api/v1/threads/:thread_id/reply`
- Output: `{ok: true, data: {message: "Reply queued for delivery"}}`

### 3. Register in cli.ts

Import and register both commands.

### 4. Build and test

```bash
npm run build

# Send a test email (use a real mailbox ID from `mailboxes-cli mailboxes`)
mailboxes-cli send --from 1 --to "christian.genco@gmail.com" --subject "Test from CLI" --body "Hello from mailboxes-cli!"

# Reply to a thread (use a real thread ID from `mailboxes-cli threads`)
mailboxes-cli reply <thread_id> --from 1 --to "christian.genco@gmail.com" --body "Reply from CLI"
```

## Verification
- `mailboxes-cli send` with all required args returns `{ok: true, data: {message: "Message queued for delivery"}}`
- `mailboxes-cli send` without required args shows help/error with exit code 1
- `mailboxes-cli reply` with valid thread_id returns `{ok: true, data: {message: "Reply queued for delivery"}}`
- `mailboxes-cli reply` with invalid thread_id returns `{ok: false, error: "Not found"}`
- The emails actually get sent (verify in inbox)
