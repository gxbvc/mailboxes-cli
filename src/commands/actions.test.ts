// Tests for the mailbox-key action commands and the send flags. Run with:
//   npm test   (node --import tsx --test src/*.test.ts)
// fetch is stubbed, so nothing leaves the machine and the key is never sent
// anywhere but the stub.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { Command } from "commander";

process.env.MAILBOXES_API_KEY = "user-key-for-tests";
process.env.MAILBOXES_MAILBOX_KEY = "mbk-test-key";

import { registerActionsCommands } from "./actions.js";
import { registerSendCommand } from "./send.js";

type Call = { url: string; method: string; body?: any; authorization?: string };
let calls: Call[] = [];

function stubFetch(status = 200, body: any = {}): void {
  globalThis.fetch = async (url: any, init: any) => {
    const parsedBody = init?.body ? JSON.parse(init.body) : undefined;
    calls.push({
      url: String(url),
      method: init?.method || "GET",
      body: parsedBody,
      authorization: init?.headers?.["Authorization"],
    });
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  };
}

function program(): Command {
  const program = new Command();
  registerActionsCommands(program);
  registerSendCommand(program);
  return program;
}

async function run(argv: string[]): Promise<void> {
  await program().parseAsync(argv, { from: "user" });
}

beforeEach(() => {
  calls = [];
  stubFetch();
});

test("react posts to the reactions endpoint with the mailbox key", async () => {
  await run(["react", "123", "--reaction", "love"]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.endsWith("/api/v1/mailbox/messages/123/reactions"), true);
  assert.deepEqual(calls[0].body, { reaction: "love" });
  assert.equal(calls[0].authorization, "Bearer mbk-test-key");
});

test("typing defaults to start and --stop sends stop", async () => {
  await run(["typing", "--to", "+15551234567"]);
  assert.equal(calls[0].url.endsWith("/api/v1/mailbox/typing"), true);
  assert.deepEqual(calls[0].body, { to: "+15551234567", state: "start" });

  await run(["typing", "--to", "+15551234567", "--stop"]);
  assert.deepEqual(calls[1].body, { to: "+15551234567", state: "stop" });
});

test("mark-read posts to the read endpoint", async () => {
  await run(["mark-read", "--to", "+15551234567"]);
  assert.equal(calls[0].url.endsWith("/api/v1/mailbox/read"), true);
  assert.deepEqual(calls[0].body, { to: "+15551234567" });
});

test("capabilities gets the capability map with the mailbox key", async () => {
  await run(["capabilities"]);
  assert.equal(calls[0].url.endsWith("/api/v1/mailbox/capabilities"), true);
  assert.equal(calls[0].method, "GET");
  assert.equal(calls[0].authorization, "Bearer mbk-test-key");
});

test("send flags ride on the mailbox-key endpoint", async () => {
  await run([
    "send", "--to", "+15551234567", "--body", "hi",
    "--effect", "confetti", "--reply-to", "45", "--voice-note", "https://example.com/note.caf",
  ]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.endsWith("/api/v1/mailbox/messages"), true);
  assert.deepEqual(calls[0].body, {
    to: "+15551234567",
    body: "hi",
    send_style: "confetti",
    reply_to_message_id: "45",
    voice_note_url: "https://example.com/note.caf",
  });
  assert.equal(calls[0].authorization, "Bearer mbk-test-key");
});

test("send without flags and with both keys keeps the user-key path", async () => {
  await run(["send", "--mailbox", "133", "--to", "+15551234567", "--body", "hi"]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.endsWith("/api/v1/messages"), true);
  assert.deepEqual(calls[0].body, { to: "+15551234567", body: "hi", mailbox_id: "133" });
  assert.equal(calls[0].authorization, "Bearer user-key-for-tests");
});

test("send flags without a mailbox key is an error, not a silent drop", async () => {
  delete process.env.MAILBOXES_MAILBOX_KEY;
  let exitCode: number | undefined;
  const originalExit = process.exit;
  // error() prints and calls process.exit(1); stub the exit so the test
  // process survives.
  process.exit = (code?: number) => {
    exitCode = code;
    return undefined as never;
  };
  try {
    await run(["send", "--to", "+15551234567", "--body", "hi", "--effect", "confetti"]);
  } finally {
    process.exit = originalExit;
  }
  assert.equal(exitCode, 1);
  assert.equal(calls.length, 0);
  process.env.MAILBOXES_MAILBOX_KEY = "mbk-test-key";
});
