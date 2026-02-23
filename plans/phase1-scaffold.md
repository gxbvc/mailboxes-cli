# Phase 1: Project Scaffold

## Goal
Set up the TypeScript project with all required files, configuration, API client, and the `profile` command as a proof of life.

## Steps

### 1. Initialize project

Create the standard TypeScript CLI structure:

```
mailboxes-cli/
├── bin/mailboxes-cli.js     # #!/usr/bin/env node → import "../dist/cli.js"
├── src/
│   ├── cli.ts               # Commander program definition
│   ├── config.ts            # dotenv loading, env var validation
│   ├── api.ts               # HTTP client wrapper for the Mailboxes API
│   └── commands/
│       └── profile.ts       # Profile commands (proof of life)
├── package.json
├── tsconfig.json
├── .env                     # Symlink to ../../.env (shared ~/tools/.env)
├── .env.example
├── .gitignore
├── AGENTS.md                # Already exists
└── README.md
```

### 2. package.json

```json
{
  "name": "mailboxes-cli",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "mailboxes-cli": "./bin/mailboxes-cli.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/cli.ts"
  },
  "dependencies": {
    "commander": "^13.1.0",
    "dotenv": "^16.4.7"
  },
  "devDependencies": {
    "@types/node": "^22.13.4",
    "tsx": "^4.19.3",
    "typescript": "^5.7.3"
  }
}
```

### 3. tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src"]
}
```

### 4. bin/mailboxes-cli.js

```js
#!/usr/bin/env node
import "../dist/cli.js";
```

### 5. .env.example

```env
MAILBOXES_API_KEY=
MAILBOXES_API_URL=https://mailboxes.gen.co
```

### 6. .env

Symlink to shared env:
```bash
ln -s ../.env .env
```

The shared `~/tools/.env` already has `MAILBOXES_API_KEY`. The API URL can default to `https://mailboxes.gen.co` in config.ts.

### 7. .gitignore

```gitignore
.env
.DS_Store
node_modules/
dist/
```

### 8. src/config.ts

Load dotenv from project root. Export:
- `getApiKey(): string` — reads `MAILBOXES_API_KEY`, exits with JSON error if missing
- `getApiUrl(): string` — reads `MAILBOXES_API_URL`, defaults to `https://mailboxes.gen.co`

### 9. src/api.ts

A thin HTTP client class:

```typescript
class MailboxesAPI {
  constructor(private baseUrl: string, private apiKey: string) {}

  async get(path: string, params?: Record<string, string>): Promise<any>
  async post(path: string, body?: Record<string, any>): Promise<any>
  async patch(path: string, body?: Record<string, any>): Promise<any>
  async delete(path: string): Promise<any>
}
```

- All methods use `fetch()` (built into Node 18+)
- Set `Authorization: Bearer <apiKey>` header
- Set `Content-Type: application/json` for POST/PATCH
- On success (2xx): return parsed JSON body
- On error (4xx/5xx): throw with error message from response JSON
- Export a `createClient()` function that reads config and returns an instance

### 10. src/commands/profile.ts

Register two commands:
- `mailboxes-cli profile` — GET /api/v1/profile, output `{ok: true, data: response}`
- `mailboxes-cli profile update --name "Name"` — PATCH /api/v1/profile, output `{ok: true, data: response}`

### 11. src/cli.ts

```typescript
import { Command } from "commander";
import { registerProfileCommand } from "./commands/profile.js";

const program = new Command();
program
  .name("mailboxes-cli")
  .version("0.1.0")
  .description("CLI for managing email via Mailgun Mailboxes");

registerProfileCommand(program);
program.parse();
```

### 12. Output format helper

Create `src/output.ts`:
```typescript
export function success(data: any): void {
  console.log(JSON.stringify({ ok: true, data }));
}

export function error(message: string, code?: string): never {
  console.error(JSON.stringify({ ok: false, error: message, ...(code && { code }) }));
  process.exit(1);
}
```

### 13. Build, link, and test

```bash
cd ~/tools/mailboxes-cli
npm install
npm run build
npm link
mailboxes-cli profile    # Should return JSON with user profile
```

## Verification
- `mailboxes-cli profile` returns `{"ok":true,"data":{"id":1,"name":"Christian Genco","email":"christian@gen.co"}}`
- `mailboxes-cli --help` shows the tool name and version
- `mailboxes-cli profile --help` shows the profile subcommand
