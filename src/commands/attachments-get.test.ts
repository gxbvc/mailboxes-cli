// mailboxes-cli attachments get / voice-memo (mailboxes PR 36). fetch is stubbed; files live in a temp dir.
import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Command } from "commander";

const root = mkdtempSync(join(tmpdir(), "mbx-attget-"));
process.env.MAILBOXES_API_KEY = "user-key-for-tests";
process.env.MAILBOXES_API_URL = "https://mailboxes.example.test";

import { registerAttachmentsCommand } from "./attachments-get.js";

type Call = { url: string; headers: Record<string, string>; redirect?: string };
let calls: Call[] = [];
let stdout: string[] = [];
let stderr: string[] = [];
let reply: () => Response;
class Exit extends Error {}

after(() => rmSync(root, { recursive: true, force: true }));

beforeEach(() => {
  calls = [];
  stdout = [];
  stderr = [];
  delete process.env.MAILBOXES_MAILBOX_KEY;
  reply = () => new Response(Buffer.from("\x89PNG-invented", "latin1"), { status: 200, headers: { "Content-Type": "image/png" } });
  globalThis.fetch = (async (url: any, init: any) => {
    calls.push({ url: String(url), headers: init?.headers ?? {}, redirect: init?.redirect });
    return reply();
  }) as typeof fetch;
  console.log = (...args: any[]) => { stdout.push(args.join(" ")); };
  console.error = (...args: any[]) => { stderr.push(args.join(" ")); };
  process.exit = ((code?: number) => { throw new Exit(`exit ${code}`); }) as typeof process.exit;
});

async function run(argv: string[]): Promise<void> {
  const program = new Command();
  program.exitOverride();
  registerAttachmentsCommand(program);
  await program.parseAsync(argv, { from: "user" });
}

test("get fetches the user-key path with the key, no redirects, and writes a new 0600 file", async () => {
  const out = join(root, "a.png");
  await run(["attachments", "get", "12", "34", "--out", out]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://mailboxes.example.test/api/v1/messages/12/attachments/34");
  assert.equal(calls[0].headers["Authorization"], "Bearer user-key-for-tests");
  assert.equal(calls[0].redirect, "manual");
  assert.equal(readFileSync(out, "latin1"), "\x89PNG-invented");
  assert.equal(statSync(out).mode & 0o777, 0o600);
});

test("--mailbox-key uses the mailbox path and MAILBOXES_MAILBOX_KEY", async () => {
  process.env.MAILBOXES_MAILBOX_KEY = "mbk-for-tests";
  await run(["attachments", "get", "12", "34", "--out", join(root, "b.png"), "--mailbox-key"]);
  assert.equal(calls[0].url, "https://mailboxes.example.test/api/v1/mailbox/messages/12/attachments/34");
  assert.equal(calls[0].headers["Authorization"], "Bearer mbk-for-tests");
});

test("voice-memo fetches the voice_memo path", async () => {
  await run(["attachments", "voice-memo", "12", "--out", join(root, "v.caf")]);
  assert.equal(calls[0].url, "https://mailboxes.example.test/api/v1/messages/12/voice_memo");
});

test("a redirect is refused and nothing is written", async () => {
  reply = () => new Response(null, { status: 302, headers: { Location: "https://elsewhere.example/x" } });
  const out = join(root, "r.png");
  await assert.rejects(run(["attachments", "get", "12", "34", "--out", out]), Exit);
  assert.match(stderr.join("\n"), /redirect/);
  assert.throws(() => statSync(out));
});

test("an existing file is never overwritten", async () => {
  const out = join(root, "exists.png");
  writeFileSync(out, "keep me");
  await assert.rejects(run(["attachments", "get", "12", "34", "--out", out]), Exit);
  assert.equal(readFileSync(out, "utf8"), "keep me");
});

test("non-numeric ids are refused before any call", async () => {
  await assert.rejects(run(["attachments", "get", "12/../x", "34", "--out", join(root, "n.png")]), Exit);
  await assert.rejects(run(["attachments", "get", "12", "abc", "--out", join(root, "n2.png")]), Exit);
  assert.equal(calls.length, 0);
});

test("an http API URL is refused before the key is sent", async () => {
  process.env.MAILBOXES_API_URL = "http://mailboxes.example.test";
  try {
    await assert.rejects(run(["attachments", "get", "12", "34", "--out", join(root, "h.png")]), Exit);
    assert.equal(calls.length, 0);
    assert.match(stderr.join("\n"), /not https/);
  } finally {
    process.env.MAILBOXES_API_URL = "https://mailboxes.example.test";
  }
});

test("a body past the cap with no Content-Length is refused while streaming", async () => {
  const big = 50 * 1024 * 1024 + 1;
  reply = () => new Response(new ReadableStream({
    start(controller) {
      const chunk = new Uint8Array(1024 * 1024);
      let sent = 0;
      while (sent < big) { controller.enqueue(chunk); sent += chunk.length; }
      controller.close();
    },
  }), { status: 200 });
  const out = join(root, "big.bin");
  await assert.rejects(run(["attachments", "get", "12", "34", "--out", out]), Exit);
  assert.match(stderr.join("\n"), /larger than/);
  assert.throws(() => statSync(out));
});

test("a 404 is an error and writes nothing", async () => {
  reply = () => new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
  const out = join(root, "nf.png");
  await assert.rejects(run(["attachments", "get", "12", "34", "--out", out]), Exit);
  assert.throws(() => statSync(out));
});
