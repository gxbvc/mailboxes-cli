// threads show their_typing line (mailboxes PR: Sendblue typing_indicator
// webhook). fetch is stubbed; the JSON stays on stdout, the human line on stderr.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { Command } from "commander";

process.env.MAILBOXES_API_KEY = "user-key-for-tests";
process.env.MAILBOXES_API_URL = "https://mailboxes.example.test";

import { registerThreadsCommand } from "./threads.js";

type Call = { url: string };
let calls: Call[] = [];
let stdout: string[] = [];
let stderr: string[] = [];
let replyBody: any = {};

beforeEach(() => {
  calls = [];
  stdout = [];
  stderr = [];
  replyBody = { ok: true };
  globalThis.fetch = (async (url: any) => {
    calls.push({ url: String(url) });
    return new Response(JSON.stringify(replyBody), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  console.log = (...args: any[]) => { stdout.push(args.join(" ")); };
  console.error = (...args: any[]) => { stderr.push(args.join(" ")); };
});

async function run(argv: string[]): Promise<void> {
  const program = new Command();
  program.exitOverride();
  registerThreadsCommand(program);
  await program.parseAsync(argv, { from: "user" });
}

test("show prints 'typing now' on stderr when the counterparty is typing", async () => {
  replyBody = { thread: { thread_id: "t1", their_typing: { is_typing: true, at: new Date().toISOString() } } };
  await run(["threads", "show", "t1"]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://mailboxes.example.test/api/v1/threads/t1");
  const parsed = JSON.parse(stdout.join("\n"));
  assert.equal(parsed.ok, true);
  assert.equal(parsed.data.thread.their_typing.is_typing, true);
  assert.equal(stderr.join("\n"), "their_typing: typing now");
});

test("show prints 'stopped typing Ns ago' when typing stopped", async () => {
  const at = new Date(Date.now() - 5000).toISOString();
  replyBody = { thread: { thread_id: "t1", their_typing: { is_typing: false, at } } };
  await run(["threads", "show", "t1"]);
  assert.equal(stderr.join("\n"), "their_typing: stopped typing 5s ago");
});

test("show prints nothing when their_typing is null", async () => {
  replyBody = { thread: { thread_id: "t1", their_typing: null } };
  await run(["threads", "show", "t1"]);
  assert.equal(stderr.join("\n"), "");
  const parsed = JSON.parse(stdout.join("\n"));
  assert.equal(parsed.data.thread.their_typing, null);
});

test("show prints nothing extra when the response has no their_typing key", async () => {
  replyBody = { thread: { thread_id: "t1" } };
  await run(["threads", "show", "t1"]);
  assert.equal(stderr.join("\n"), "");
});
