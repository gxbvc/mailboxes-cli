# mailboxes-cli

CLI for managing email across all your domains via the [Mailgun Mailboxes](https://mailboxes.gen.co) app. Send, receive, read, search, archive, trash, star, and reply to email from any domain you control — all from the terminal.

**Status:** Not yet implemented. See `plans/` for the implementation plan.

## Prerequisites

- Node.js 20+
- An account on [mailboxes.gen.co](https://mailboxes.gen.co) with an API key

## Setup

```bash
cd ~/tools/mailboxes-cli
ln -s ../.env .env       # Shared credentials from ~/tools/.env
npm install
npm run build
npm link
```

## Quick Start

```bash
mailboxes-cli profile                    # Check your connection
mailboxes-cli threads                    # List inbox threads
mailboxes-cli threads show <thread_id>   # Read a thread
mailboxes-cli send --from 1 --to "bob@example.com" --subject "Hi" --body "Hello!"
```
