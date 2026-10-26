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
import { registerActCommand } from "./act.js";

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
  registerActCommand(program);
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
  // --voice-note makes it a parts send: every option is carried, none
  // dropped.
  assert.deepEqual(calls[0].body, {
    to: "+15551234567",
    parts: [
      { type: "text", text: "hi" },
      { type: "audio", url: "https://example.com/note.caf", voice_note: true },
    ],
    effect: "confetti",
    reply_to: "45",
  });
  assert.equal(calls[0].authorization, "Bearer mbk-test-key");

  // R2-M2: --body with effect/reply-to ONLY (no parts flag) posts the
  // legacy field names, read by old and new servers alike.
  await run(["send", "--to", "+15551234567", "--body", "hi", "--effect", "confetti", "--reply-to", "45"]);
  assert.deepEqual(calls[1].body, {
    to: "+15551234567",
    body: "hi",
    send_style: "confetti",
    reply_to_message_id: "45",
  });

  // R2-M1: --image is one URL, and it posts an image PART.
  await run(["send", "--to", "+15551234567", "--image", "https://example.com/pic.png"]);
  assert.equal(calls[2].url.endsWith("/api/v1/mailbox/messages"), true);
  assert.deepEqual(calls[2].body, {
    to: "+15551234567",
    parts: [{ type: "image", url: "https://example.com/pic.png" }],
  });
});

// M4: the act command parses and posts the right shape.
test("act MESSAGE_ID react love posts a message action", async () => {
  await run(["act", "14676", "react", "love"]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.endsWith("/api/v1/mailbox/messages/14676/actions"), true);
  assert.deepEqual(calls[0].body, { type: "react", reaction: "love" });
  assert.equal(calls[0].authorization, "Bearer mbk-test-key");
});

test("act MESSAGE_ID unreact --reaction love posts the removal", async () => {
  await run(["act", "14676", "unreact", "--reaction", "love"]);
  assert.equal(calls[0].url.endsWith("/api/v1/mailbox/messages/14676/actions"), true);
  assert.deepEqual(calls[0].body, { type: "unreact", reaction: "love" });
});

// 5: posted-JSON tests for the step B flags and verbs.
test("send --sticker posts a sticker part", async () => {
  await run(["send", "--to", "+15551234567", "--sticker", "https://files.gxb.vc/gxbot/linq-demo-33279f337106/demo-image.png"]);
  assert.deepEqual(calls[0].body, {
    to: "+15551234567",
    parts: [{ type: "sticker", url: "https://files.gxb.vc/gxbot/linq-demo-33279f337106/demo-image.png" }],
  });
});

test("send --link posts a link part", async () => {
  await run(["send", "--to", "+15551234567", "--link", "https://gxb.vc"]);
  assert.deepEqual(calls[0].body, {
    to: "+15551234567",
    parts: [{ type: "link", url: "https://gxb.vc" }],
  });
});

test("send --contact posts a contact part with no caller content", async () => {
  await run(["send", "--to", "+15551234567", "--contact"]);
  assert.deepEqual(calls[0].body, {
    to: "+15551234567",
    parts: [{ type: "contact" }],
  });
});

test("act ID edit --text posts the edit", async () => {
  await run(["act", "14676", "edit", "--text", "corrected"]);
  assert.equal(calls[0].url.endsWith("/api/v1/mailbox/messages/14676/actions"), true);
  assert.deepEqual(calls[0].body, { type: "edit", text: "corrected" });
});

// Removed (Christian, 08:11): unsend AND delete_record refuse with the
// explanation and post nothing.
test("act ID unsend and delete_record refuse and post nothing", async () => {
  const originalExit = process.exit;
  let exitCode: number | undefined;
  const stubbedExit = (code?: number) => {
    exitCode = code;
    return undefined as never;
  };
  process.exit = stubbedExit as typeof process.exit;
  try {
    await run(["act", "14676", "unsend"]);
    await run(["act", "14676", "delete_record"]);
  } finally {
    process.exit = originalExit;
  }
  assert.equal(exitCode, 1);
  assert.equal(calls.length, 0);
});

test("act location-request --thread ID posts the request", async () => {
  await run(["act", "location-request", "--thread", "imessage:182:abc"]);
  assert.equal(calls[0].url.endsWith("/api/v1/mailbox/threads/imessage%3A182%3Aabc/actions"), true);
  assert.deepEqual(calls[0].body, { type: "location_request" });
});

test("act MESSAGE_ID unreact love accepts the reaction positionally (R2-N3)", async () => {
  await run(["act", "14676", "unreact", "love"]);
  assert.deepEqual(calls[0].body, { type: "unreact", reaction: "love" });
});

test("act read --thread ID posts a thread action", async () => {
  await run(["act", "read", "--thread", "imessage:182:abc"]);
  assert.equal(calls[0].url.endsWith("/api/v1/mailbox/threads/imessage%3A182%3Aabc/actions"), true);
  assert.deepEqual(calls[0].body, { type: "read" });
});

test("act typing --thread ID posts start, --stop posts stop", async () => {
  await run(["act", "typing", "--thread", "imessage:182:abc"]);
  assert.deepEqual(calls[0].body, { type: "typing", state: "start" });

  await run(["act", "typing", "--thread", "imessage:182:abc", "--stop"]);
  assert.deepEqual(calls[1].body, { type: "typing", state: "stop" });
});

// M5: a body-only mailbox-key send keeps the old {to, body} shape, so it
// works with old and new servers alike.
test("a body-only mailbox-key send posts {to, body}", async () => {
  await run(["send", "--to", "+15551234567", "--body", "hi"]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.endsWith("/api/v1/mailbox/messages"), true);
  assert.deepEqual(calls[0].body, { to: "+15551234567", body: "hi" });
});

// S2: --thread without a mailbox key is an error, never ignored.
test("send --thread without a mailbox key is an error", async () => {
  delete process.env.MAILBOXES_MAILBOX_KEY;
  const originalExit = process.exit;
  let exitCode: number | undefined;
  const stubbedExit = (code?: number) => {
    exitCode = code;
    return undefined as never;
  };
  process.exit = stubbedExit as typeof process.exit;
  try {
    await run(["send", "--mailbox", "133", "--to", "+15551234567", "--body", "hi", "--thread", "imessage:182:abc"]);
  } finally {
    process.exit = originalExit;
  }
  assert.equal(exitCode, 1);
  assert.equal(calls.length, 0);
  process.env.MAILBOXES_MAILBOX_KEY = "mbk-test-key";
});

// R3-M1: --voice-note rides into the parts when a parts flag is present -
// never dropped.
test("--voice-note with --text becomes an audio part", async () => {
  await run(["send", "--to", "+15551234567", "--text", "hi", "--voice-note", "https://example.com/note.m4a"]);
  assert.equal(calls[0].url.endsWith("/api/v1/mailbox/messages"), true);
  assert.deepEqual(calls[0].body.parts, [
    { type: "text", text: "hi" },
    { type: "audio", url: "https://example.com/note.m4a", voice_note: true },
  ]);
});

test("check --to E164 asks the provider about iMessage and RCS", async () => {
  await run(["check", "--to", "+15551234567"]);
  assert.equal(calls[0].url.endsWith("/api/v1/mailbox/capabilities/check?to=%2B15551234567"), true);
  assert.equal(calls[0].authorization, "Bearer mbk-test-key");

  await run(["check", "--to", "+15551234567", "--service", "rcs"]);
  assert.ok(calls[1].url.includes("service=rcs"));
});

test("act rename and act leave post the group thread actions", async () => {
  await run(["act", "rename", "--thread", "imessage:182:group:abc", "--name", "The Group"]);
  assert.equal(calls[0].url.endsWith("/api/v1/mailbox/threads/imessage%3A182%3Agroup%3Aabc/actions"), true);
  assert.deepEqual(calls[0].body, { type: "rename", name: "The Group" });

  await run(["act", "leave", "--thread", "imessage:182:group:abc"]);
  assert.deepEqual(calls[1].body, { type: "leave" });
});

test("send with two --to values posts a group start", async () => {
  await run(["send", "--to", "+15551234567", "--to", "+15550002222", "--text", "welcome"]);
  assert.deepEqual(calls[0].body, {
    to: ["+15551234567", "+15550002222"],
    parts: [{ type: "text", text: "welcome" }],
  });
});

test("--mention attaches to the last text part", async () => {
  await run(["send", "--to", "+15551234567", "--text", "hey", "--mention", "+15550002222"]);
  assert.deepEqual(calls[0].body.parts, [
    { type: "text", text: "hey", mention: { handle: "+15550002222" } },
  ]);
});

test("health gets the line health", async () => {
  await run(["health"]);
  assert.equal(calls[0].url.endsWith("/api/v1/mailbox/health"), true);
  assert.equal(calls[0].method, "GET");
  assert.equal(calls[0].authorization, "Bearer mbk-test-key");
});

test("act location --thread ID reads the shared locations", async () => {
  await run(["act", "location", "--thread", "imessage:182:abc"]);
  assert.equal(calls[0].method, "GET");
  assert.equal(calls[0].url.endsWith("/api/v1/mailbox/threads/imessage%3A182%3Aabc/location"), true);
});

// S3: --body with --text sends both.
test("send --body with --text sends both text parts", async () => {
  await run(["send", "--to", "+15551234567", "--text", "one", "--body", "two"]);
  assert.deepEqual(calls[0].body.parts, [
    { type: "text", text: "one" },
    { type: "text", text: "two" },
  ]);
});

test("send without flags and with both keys keeps the user-key path", async () => {
  await run(["send", "--mailbox", "133", "--to", "+15551234567", "--body", "hi"]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.endsWith("/api/v1/messages"), true);
  assert.deepEqual(calls[0].body, { to: "+15551234567", body: "hi", mailbox_id: "133" });
  assert.equal(calls[0].authorization, "Bearer user-key-for-tests");
});

// Security's CLI note: two --to on the USER-key path errors, never drops one.
test("two --to with a key and --mailbox errors too", async () => {
  const originalExit = process.exit;
  let exitCode: number | undefined;
  const stubbedExit = (code?: number) => {
    exitCode = code;
    return undefined as never;
  };
  process.exit = stubbedExit as typeof process.exit;
  try {
    await run(["send", "--mailbox", "133", "--to", "+15551234567", "--to", "+15550002222", "--body", "hi"]);
  } finally {
    process.exit = originalExit;
  }
  assert.equal(exitCode, 1);
  assert.equal(calls.length, 0);
});

test("--mention with no text part errors instead of dropping", async () => {
  const originalExit = process.exit;
  let exitCode: number | undefined;
  const stubbedExit = (code?: number) => {
    exitCode = code;
    return undefined as never;
  };
  process.exit = stubbedExit as typeof process.exit;
  try {
    await run(["send", "--to", "+15551234567", "--image", "https://example.com/p.png", "--mention", "+15550002222"]);
  } finally {
    process.exit = originalExit;
  }
  assert.equal(exitCode, 1);
  assert.equal(calls.length, 0);
});

test("send with two --to values on the user-key path errors", async () => {
  delete process.env.MAILBOXES_MAILBOX_KEY;
  const originalExit = process.exit;
  let exitCode: number | undefined;
  const stubbedExit = (code?: number) => {
    exitCode = code;
    return undefined as never;
  };
  process.exit = stubbedExit as typeof process.exit;
  try {
    await run(["send", "--mailbox", "133", "--to", "+15551234567", "--to", "+15550002222", "--body", "hi"]);
  } finally {
    process.exit = originalExit;
  }
  assert.equal(exitCode, 1);
  assert.equal(calls.length, 0);
  process.env.MAILBOXES_MAILBOX_KEY = "mbk-test-key";
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
