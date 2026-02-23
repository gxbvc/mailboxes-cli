import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: resolve(__dirname, "..", ".env") });

export function getApiKey(): string {
  const key = process.env.MAILBOXES_API_KEY;
  if (!key) {
    console.error(JSON.stringify({ ok: false, error: "MAILBOXES_API_KEY is not set. Add it to .env" }));
    process.exit(1);
  }
  return key;
}

export function getApiUrl(): string {
  return process.env.MAILBOXES_API_URL || "https://mailboxes.gen.co";
}
