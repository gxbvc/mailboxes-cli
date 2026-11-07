// Tests for thread-typing (user key). fetch is stubbed; nothing leaves the machine.
//   npm test   (node --import tsx --test src/*.test.ts)
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { Command } from "commander";

process.env.MAILBOXES_API_KEY = "user-key-for-tests";
process.env.MAILBOXES_MAILBOX_KEY = "mbk-test-key";

import { registerThreadTypingCommand } from "./thread-typing.js";

type Call = { url: string; method: string; body?: any; authorization?: string };
let calls: Call[] = [];
let exitCode: number | undefined;

function stubFetch(status = 200, body: any = { action: "typing", result: "started" }): void {
  globalThis.fetch = async (url: any, init: any) => {
    calls.push({
      url: String(url),
      method: init?.method || "GET",
      body: init?.body ? JSON.parse(init.body) : undefined,
      authorization: init?.headers?.["Authorization"],
    });
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  };
}

async function run(argv: string[]): Promise<void> {
  const program = new Command();
  program.exitOverride();
  registerThreadTypingCommand(program);
  const realExit = process.exit;
  exitCode = undefined;
  (process as any).exit = (code?: number) => { exitCode = code ?? 0; throw new Error(`exit ${code}`); };
  try {
    await program.parseAsync(argv, { from: "user" });
  } catch {
    // error() exits; the stub turns that into a throw we ignore here.
  } finally {
    (process as any).exit = realExit;
  }
}

beforeEach(() => {
  calls = [];
  stubFetch();
});

test("--on posts state on to the thread typing endpoint with the USER key", async () => {
  await run(["thread-typing", "imsg:180:abc", "--mailbox", "180", "--on"]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "POST");
  assert.ok(calls[0].url.endsWith("/api/v1/threads/imsg%3A180%3Aabc/typing"));
  assert.deepEqual(calls[0].body, { mailbox_id: 180, state: "on" });
  assert.equal(calls[0].authorization, "Bearer user-key-for-tests");
});

test("--off posts state off", async () => {
  await run(["thread-typing", "t1", "--mailbox", "180", "--off"]);
  assert.deepEqual(calls[0].body, { mailbox_id: 180, state: "off" });
});

test("neither or both of --on/--off is refused before any request", async () => {
  await run(["thread-typing", "t1", "--mailbox", "180"]);
  await run(["thread-typing", "t1", "--mailbox", "180", "--on", "--off"]);
  assert.equal(calls.length, 0);
  assert.notEqual(exitCode, 0);
});

test("a non-numeric mailbox is refused before any request", async () => {
  await run(["thread-typing", "t1", "--mailbox", "abc", "--on"]);
  assert.equal(calls.length, 0);
});
