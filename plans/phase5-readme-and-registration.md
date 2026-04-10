# Phase 5: README, Registration & Final Polish

## Goal
Write the full README.md, register the tool in sync.sh and ~/tools/AGENTS.md, create the GitHub repo, and verify everything works end-to-end.

## Steps

### 1. README.md

Write a comprehensive README following the best practices template. Include:

- **One-line description**: CLI for managing email across all your domains via Mailgun Mailboxes
- **Prerequisites**: Node.js 20+, an account on mailboxes.gen.co with an API key
- **Setup instructions**:
  ```bash
  cd ~/tools/mailboxes-cli
  ln -s ../.env .env    # or cp .env.example .env and fill in
  npm install
  npm run build
  npm link
  ```
- **Full command reference** with examples for every command:
  - `profile`, `profile update`
  - `domains`, `domains show`, `domains delete`, `domains reimport`
  - `mailboxes`, `mailboxes show`
  - `threads` (with all filter options), `threads show`
  - `threads archive/trash/star/read/unread/move-to-inbox`
  - `messages show`
  - `send`
  - `reply`
- **Output format** section explaining the JSON envelope
- **API** section noting it talks to mailboxes.gen.co (or custom URL via MAILBOXES_API_URL)
- **Rate limits** section noting 60 req/min per API key

### 2. Update AGENTS.md

Review and update `~/tools/mailboxes-cli/AGENTS.md` if any command signatures changed during implementation. Ensure it's terse and accurate.

### 3. Register in ~/tools/AGENTS.md

Add a row to the tool index table (alphabetical order):
```markdown
| [mailboxes-cli](mailboxes-cli/) | Manage email across all your domains via Mailgun Mailboxes |
```

### 4. Register in ~/tools/sync.sh

Add to the `REPOS` array:
```bash
"mailboxes-cli|https://github.com/gxbvc/mailboxes-cli.git|main"
```

Add to the `npmdir` loop in `cmd_clone()` since it's a Node tool.

### 5. Create GitHub repo

```bash
cd ~/tools/mailboxes-cli
git init
git add -A
git commit -m "Initial commit: mailboxes-cli"
gh repo create gxbvc/mailboxes-cli --public --source=. --push
```

### 6. Clean up old mailbox-cli stub

The old `~/tools/mailbox-cli/` (singular) was a placeholder. Check if it should be removed or kept as a redirect. If removing:
```bash
# Only if the user confirms
rm -rf ~/tools/mailbox-cli
# Remove from sync.sh if present
# Remove from AGENTS.md if present
```

### 7. End-to-end verification

Run every command and verify output:

```bash
mailboxes-cli --help
mailboxes-cli profile
mailboxes-cli domains
mailboxes-cli domains show 1
mailboxes-cli mailboxes
mailboxes-cli mailboxes --domain 1
mailboxes-cli mailboxes show 1
mailboxes-cli threads
mailboxes-cli threads --status archived
mailboxes-cli threads --starred
mailboxes-cli threads --search "test"
mailboxes-cli threads --page 1 --per-page 3
mailboxes-cli threads show <thread_id>
mailboxes-cli threads star <thread_id>
mailboxes-cli threads star <thread_id>        # toggle back
mailboxes-cli messages show <message_id>
mailboxes-cli send --from <mailbox_id> --to "test@example.com" --subject "CLI test" --body "works"
mailboxes-cli reply <thread_id> --from <mailbox_id> --to "test@example.com" --body "reply works"
```

All should return valid `{ok: true, data: ...}` JSON with exit code 0.

## Verification
- `which mailboxes-cli` resolves to the npm-linked binary
- Every command listed above works
- `grep mailboxes-cli ~/tools/AGENTS.md` finds the entry
- `grep mailboxes-cli ~/tools/sync.sh` finds the entry
- GitHub repo exists at gxbvc/mailboxes-cli
