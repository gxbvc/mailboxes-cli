// Tests for reply-all (board #53): --preview, then the send with the
// approved value; files need the full approval_sha256. fetch is stubbed;
// the files are invented and live in a temp directory; guard-check is a
// fake script.
import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, chmodSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Command } from "commander";

process.env.MAILBOXES_API_KEY = "user-key-for-tests";
process.env.MAILBOXES_MAILBOX_KEY = "mbk_for_tests";

const root = mkdtempSync(join(tmpdir(), "mbx-replyall-test-"));
chmodSync(root, 0o700);
const outboxRoot = join(root, "mail-outbox");
mkdirSync(outboxRoot, { mode: 0o700 });
chmodSync(outboxRoot, 0o700);
const outbox = join(outboxRoot, "tab1");
mkdirSync(outbox, { mode: 0o700 });
chmodSync(outbox, 0o700);
process.env.MAILBOXES_OUTBOX_ROOT = outboxRoot;

const guard = join(root, "fake-guard-check");
writeFileSync(guard, '#!/bin/sh\nn=$(cat | grep -c FAKE-SECRET)\necho "scrubbed $n" >&2\n');
chmodSync(guard, 0o755);
process.env.MAILBOXES_GUARD_CHECK = guard;

import { registerReplyAllCommand } from "./reply-all.js";

const FULL = "ab12cd34" + "0".repeat(56);
type Call = { url: string; method: string; body: any; headers: Record<string, string> };
let calls: Call[] = [];
let stdout: string[] = [];
let stderr: string[] = [];
let reply: any = { message: "Message queued for delivery" };

after(() => rmSync(root, { recursive: true, force: true }));

function file(name: string, content: string | Buffer = "invented text\n"): string {
  const path = join(outbox, name);
  writeFileSync(path, content);
  return path;
}

class Exit extends Error {}

beforeEach(() => {
  calls = [];
  stdout = [];
  stderr = [];
  reply = { message: "Message queued for delivery" };
  process.env.MAILBOXES_MAILBOX_KEY = "mbk_for_tests";
  globalThis.fetch = (async (url: any, init: any) => {
    calls.push({ url: String(url), method: init?.method || "GET", body: init?.body, headers: init?.headers ?? {} });
    return new Response(JSON.stringify(reply), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  console.log = (...args: any[]) => { stdout.push(args.join(" ")); };
  console.error = (...args: any[]) => { stderr.push(args.join(" ")); };
  process.exit = ((code?: number) => { throw new Exit(`exit ${code}`); }) as typeof process.exit;
});

async function run(argv: string[]): Promise<void> {
  const program = new Command();
  program.exitOverride();
  registerReplyAllCommand(program);
  await program.parseAsync(argv, { from: "user" });
}

async function refused(argv: string[], pattern: RegExp): Promise<void> {
  await assert.rejects(run(argv), Exit);
  assert.equal(calls.length, 0, "nothing is sent");
  assert.match(stderr.join("\n"), pattern);
}

function printed(): any {
  return JSON.parse(stdout[stdout.length - 1]).data;
}

test("text-only --preview posts JSON with the mailbox key and prints the sha8 to approve", async () => {
  reply = { reply_all: { message_id: 77, to: "a@gxb.vc", cc: ["b@gxb.vc"], recipients_sha8: "1a2b3c4d", subject: "Re: x" } };
  await run(["reply-all", "77", "--body", "Thanks.", "--preview"]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.endsWith("/api/v1/mailbox/messages"), true);
  assert.equal(calls[0].headers["Authorization"], "Bearer mbk_for_tests");
  assert.deepEqual(JSON.parse(calls[0].body), { reply_all: "true", reply_to_message_id: "77", body: "Thanks.", preview: "true" });
  assert.deepEqual(printed().approve, { expect_sha8: "1a2b3c4d", send_with: "--expect-sha8 1a2b3c4d" });
});

test("text-only send carries expect_recipients_sha8; without it nothing is sent", async () => {
  await run(["reply-all", "77", "--body", "Thanks.", "--expect-sha8", "1A2B3C4D"]);
  assert.deepEqual(JSON.parse(calls[0].body), { reply_all: "true", reply_to_message_id: "77", body: "Thanks.", expect_recipients_sha8: "1a2b3c4d" });

  calls = [];
  await refused(["reply-all", "77", "--body", "Thanks."], /needs --expect-sha8/);
  await refused(["reply-all", "77", "--body", "Thanks.", "--expect-sha8", "1a2b3c"], /needs --expect-sha8/);
  await refused(["reply-all", "77", "--body", "Thanks.", "--expect-sha256", FULL], /text-only reply-all takes --expect-sha8/);
});

test("--preview with files posts multipart and prints the FULL approval_sha256 to send with", async () => {
  reply = { reply_all: { message_id: 77, to: "a@gxb.vc", cc: [], recipients_sha8: FULL.slice(0, 8), approval_sha256: FULL, files: [{ filename: "clip.mp3", sha8: "99aa88bb" }] } };
  await run(["reply-all", "77", "--body", "Clip.", "--outbox", "tab1", "--attach", file("clip.mp3", "ID3invented"), "--preview"]);
  const form = calls[0].body as FormData;
  assert.ok(form instanceof FormData);
  assert.equal(form.get("reply_all"), "true");
  assert.equal(form.get("reply_to_message_id"), "77");
  assert.equal(form.get("body"), "Clip.");
  assert.equal(form.get("preview"), "true");
  assert.deepEqual((form.getAll("attachments[]") as File[]).map((p) => [p.name, p.type]), [["clip.mp3", "audio/mpeg"]]);
  assert.deepEqual(printed().approve, { expect_sha256: FULL, card_sha8: FULL.slice(0, 8), send_with: `--expect-sha256 ${FULL}` });
});

test("a send with files carries expect_approval_sha256 (and the sha8 if given); the sha8 alone or a short value is refused", async () => {
  const clip = file("clip.mp3", "ID3invented");
  await run(["reply-all", "77", "--body", "Clip.", "--outbox", "tab1", "--attach", clip, "--expect-sha256", FULL.toUpperCase(), "--expect-sha8", FULL.slice(0, 8)]);
  const form = calls[0].body as FormData;
  assert.equal(form.get("expect_approval_sha256"), FULL);
  assert.equal(form.get("expect_recipients_sha8"), FULL.slice(0, 8));
  assert.equal(form.get("preview"), null);

  calls = [];
  await refused(["reply-all", "77", "--body", "Clip.", "--outbox", "tab1", "--attach", clip, "--expect-sha8", FULL.slice(0, 8)], /needs --expect-sha256/);
  await refused(["reply-all", "77", "--body", "Clip.", "--outbox", "tab1", "--attach", clip, "--expect-sha256", FULL.slice(0, 63)], /needs --expect-sha256/);
  await refused(["reply-all", "77", "--body", "Clip.", "--outbox", "tab1", "--attach", clip, "--expect-sha256", "g".repeat(64)], /needs --expect-sha256/);
  await refused(["reply-all", "77", "--body", "Clip.", "--outbox", "tab1", "--attach", clip, "--expect-sha256", FULL, "--expect-sha8", "xyz"], /8 hex/);
});

test("files are checked before any request: type, outbox, known secrets", async () => {
  await refused(["reply-all", "77", "--body", "x", "--outbox", "tab1", "--attach", file("page.html", "<html/>"), "--preview"], /type not allowed/);
  await refused(["reply-all", "77", "--body", "x", "--attach", file("a.txt"), "--preview"], /needs --outbox NAME/);
  await refused(["reply-all", "77", "--body", "x", "--outbox", "tab1", "--attach", file("notes.txt", "FAKE-SECRET here\n"), "--preview"], /1 known secret/);
});

test("needs a mailbox key and a numeric message id; --preview takes no expect value", async () => {
  delete process.env.MAILBOXES_MAILBOX_KEY;
  await refused(["reply-all", "77", "--body", "x", "--preview"], /MAILBOXES_MAILBOX_KEY/);
  process.env.MAILBOXES_MAILBOX_KEY = "mbk_for_tests";
  await refused(["reply-all", "77; rm", "--body", "x", "--preview"], /message_id/);
  await refused(["reply-all", "77", "--body", "x", "--preview", "--expect-sha8", "1a2b3c4d"], /--preview takes no/);
});

test("the new types are allowed", async () => {
  for (const name of ["a.gif", "a.mp3", "a.m4a", "a.wav", "a.txt"]) {
    calls = [];
    await run(["reply-all", "77", "--body", "x", "--outbox", "tab1", "--attach", file(name), "--preview"]);
    assert.equal(calls.length, 1, name);
  }
});

test("a docx is secret-scanned through its word/*.xml parts (a header too)", async () => {
  const dir = mkdtempSync(join(root, "docx-"));
  mkdirSync(join(dir, "word"));
  writeFileSync(join(dir, "[Content_Types].xml"), "<Types/>");
  writeFileSync(join(dir, "word", "document.xml"), "<w:document><w:t>fine</w:t></w:document>");
  writeFileSync(join(dir, "word", "header1.xml"), "<w:hdr><w:t>FAKE-SECRET-in-header</w:t></w:hdr>");
  const hit = join(outbox, "hit.docx");
  execFileSync("zip", ["-q", "-r", hit, "[Content_Types].xml", "word"], { cwd: dir });
  await refused(["reply-all", "77", "--body", "x", "--outbox", "tab1", "--attach", hit, "--preview"], /1 known secret found/);

  writeFileSync(join(dir, "word", "header1.xml"), "<w:hdr><w:t>fine</w:t></w:hdr>");
  const clean = join(outbox, "clean.docx");
  execFileSync("zip", ["-q", "-r", clean, "[Content_Types].xml", "word"], { cwd: dir });
  await run(["reply-all", "77", "--body", "x", "--outbox", "tab1", "--attach", clean, "--preview"]);
  assert.equal(calls.length, 1);
  assert.deepEqual(((calls[0].body as FormData).getAll("attachments[]") as File[]).map((p) => p.type), ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"]);
});
