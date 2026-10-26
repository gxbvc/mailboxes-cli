// Tests for the poll command. Run with npm test (node --import tsx --test).
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { Command } from "commander";

process.env.MAILBOXES_API_KEY = "user-key-for-tests";
process.env.MAILBOXES_MAILBOX_KEY = "mbk-test-key";

import { registerPollCommand } from "./poll.js";

type Call = { url: string; method: string; body?: any; authorization?: string };
let calls: Call[] = [];

function stubFetch(): void {
  globalThis.fetch = (async (url: any, init: any) => {
    calls.push({
      url: String(url),
      method: init?.method || "GET",
      body: init?.body ? JSON.parse(init.body) : undefined,
      authorization: init?.headers?.["Authorization"],
    });
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
}

function program(): Command {
  const program = new Command();
  registerPollCommand(program);
  return program;
}

async function run(argv: string[]): Promise<void> {
  await program().parseAsync(argv, { from: "user" });
}

beforeEach(() => {
  calls = [];
  stubFetch();
});

test("poll posts the options and the question to the polls endpoint with the mailbox key", async () => {
  await run(["poll", "--to", "+15551234567", "--question", "Lunch?", "--option", "Tacos", "--option", "Sushi"]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.endsWith("/api/v1/mailbox/polls"), true);
  assert.deepEqual(calls[0].body, { to: "+15551234567", question: "Lunch?", options: ["Tacos", "Sushi"] });
  assert.equal(calls[0].authorization, "Bearer mbk-test-key");
});

test("poll works without a question", async () => {
  await run(["poll", "--to", "+15551234567", "--option", "Yes", "--option", "No"]);
  assert.deepEqual(calls[0].body, { to: "+15551234567", options: ["Yes", "No"] });
});

test("poll with fewer than two options is refused locally, nothing sent", async () => {
  const originalExit = process.exit;
  let exitCode: number | undefined;
  const stubbedExit = (code?: number) => {
    exitCode = code;
    return undefined as never;
  };
  process.exit = stubbedExit as typeof process.exit;
  try {
    await run(["poll", "--to", "+15551234567", "--option", "Only"]);
  } finally {
    process.exit = originalExit;
  }
  assert.equal(exitCode, 1);
  assert.equal(calls.length, 0);
});

test("poll refused by the server exits with the error code", async () => {
  // The server owns option validation: one option is a 422 send_refused.
  globalThis.fetch = (async (url: any, init: any) => {
    calls.push({ url: String(url), method: init?.method || "GET", body: init?.body ? JSON.parse(init.body) : undefined });
    return new Response(JSON.stringify({ ok: false, error_code: "send_refused", error: "A poll needs 2 to 10 options" }),
                        { status: 422, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;

  const originalExit = process.exit;
  let exitCode: number | undefined;
  const stubbedExit = (code?: number) => {
    exitCode = code;
    return undefined as never;
  };
  process.exit = stubbedExit as typeof process.exit;
  try {
    await run(["poll", "--to", "+15551234567", "--option", "A", "--option", "B"]);
  } finally {
    process.exit = originalExit;
  }
  assert.equal(exitCode, 1);
  assert.equal(calls.length, 1);
});
