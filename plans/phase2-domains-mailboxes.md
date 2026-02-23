# Phase 2: Domains & Mailboxes Commands

## Goal
Implement all domain and mailbox commands.

## API Endpoints

```
GET    /api/v1/domains           → { domains: [...] }
GET    /api/v1/domains/:id       → { domain: { ..., mailboxes: [...] } }
DELETE /api/v1/domains/:id       → { message: "..." }
POST   /api/v1/domains/reimport  → { message: "..." }

GET    /api/v1/mailboxes         → { mailboxes: [...] }  (optional ?domain_id=X)
GET    /api/v1/mailboxes/:id     → { mailbox: { ... } }
```

## Steps

### 1. src/commands/domains.ts

Register commands:

```bash
mailboxes-cli domains                        # GET /api/v1/domains
mailboxes-cli domains show <id>              # GET /api/v1/domains/:id
mailboxes-cli domains delete <id>            # DELETE /api/v1/domains/:id
mailboxes-cli domains reimport [--days 30]   # POST /api/v1/domains/reimport
```

- `domains` (no subcommand) → list all domains. Wrap response in `{ok: true, data: response}`.
- `domains show <id>` → show single domain with mailboxes.
- `domains delete <id>` → delete domain. Output the response message.
- `domains reimport` → POST with `days_back` param. Output the response message.

### 2. src/commands/mailboxes.ts

Register commands:

```bash
mailboxes-cli mailboxes [--domain <id>]      # GET /api/v1/mailboxes?domain_id=X
mailboxes-cli mailboxes show <id>            # GET /api/v1/mailboxes/:id
```

- `mailboxes` → list all mailboxes. If `--domain` is provided, add `?domain_id=X`.
- `mailboxes show <id>` → show single mailbox.

### 3. Register in cli.ts

Import and register both command groups.

### 4. Build and test

```bash
npm run build
mailboxes-cli domains
mailboxes-cli domains show 1
mailboxes-cli mailboxes
mailboxes-cli mailboxes --domain 1
mailboxes-cli mailboxes show 1
```

## Verification
- All 5 commands return valid `{ok: true, data: ...}` JSON
- `mailboxes-cli domains` lists all domains with names and mailbox counts
- `mailboxes-cli domains show 1` includes nested mailboxes array
- `mailboxes-cli mailboxes --domain 1` filters correctly
- Error cases (invalid ID) return `{ok: false, error: "..."}` with exit code 1
