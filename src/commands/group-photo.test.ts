// Tests for `act group-photo` (Sendblue thread action, mailboxes PR 50).
// fetch is stubbed; nothing leaves the machine. The client-side pre-checks
// (regular file, 5 MB, JPEG/PNG/GIF magic bytes) must refuse with NO
// request; the server stays the real gate.
import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, chmodSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Command } from "commander";

process.env.MAILBOXES_API_KEY = "user-key-for-tests";
process.env.MAILBOXES_MAILBOX_KEY = "mbk_for_tests";

import { registerActCommand } from "./act.js";

const root = mkdtempSync(join(tmpdir(), "mbx-groupphoto-test-"));
chmodSync(root, 0o700);
after(() => rmSync(root, { recursive: true, force: true }));

const THREAD = "imessage:180:group:sb_group_test-allowed";
const PATH = `/api/v1/mailbox/threads/${encodeURIComponent(THREAD)}/actions`;

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);

type Call = { url: string; method: string; body: any; headers: Record<string, string> };
let calls: Call[] = [];
let stdout: string[] = [];
let stderr: string[] = [];
let reply: any = { action: "group_photo", ok: true };
let replyStatus = 200;

class Exit extends Error {}

beforeEach(() => {
  calls = [];
  stdout = [];
  stderr = [];
  reply = { action: "group_photo", ok: true };
  replyStatus = 200;
  process.env.MAILBOXES_MAILBOX_KEY = "mbk_for_tests";
  globalThis.fetch = (async (url: any, init: any) => {
    calls.push({ url: String(url), method: init?.method || "GET", body: init?.body, headers: init?.headers ?? {} });
    return new Response(JSON.stringify(reply), { status: replyStatus, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  console.log = (...args: any[]) => { stdout.push(args.join(" ")); };
  console.error = (...args: any[]) => { stderr.push(args.join(" ")); };
  process.exit = ((code?: number) => { throw new Exit(`exit ${code}`); }) as typeof process.exit;
});

function imageFile(name: string, content: Buffer): string {
  const path = join(root, name);
  writeFileSync(path, content);
  return path;
}

async function run(argv: string[]): Promise<void> {
  const program = new Command();
  program.exitOverride();
  registerActCommand(program);
  await program.parseAsync(argv, { from: "user" });
}

async function refused(argv: string[], pattern: RegExp): Promise<void> {
  await assert.rejects(run(argv), Exit);
  assert.equal(calls.length, 0, "nothing is sent");
  assert.match(stderr.join("\n"), pattern);
}

test("happy path: one multipart POST to the thread actions endpoint with type and the exact file bytes", async () => {
  const bytes = Buffer.concat([PNG_MAGIC, Buffer.from("png-body-bytes")]);
  const photo = imageFile("team.png", bytes);
  await run(["act", "group-photo", "--thread", THREAD, "--file", photo]);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "POST");
  assert.ok(calls[0].url.endsWith(PATH), calls[0].url);
  assert.equal(calls[0].headers["Authorization"], "Bearer mbk_for_tests");
  const form = calls[0].body as FormData;
  assert.ok(form instanceof FormData);
  assert.equal(form.get("type"), "group_photo");
  const file = form.get("file") as File;
  assert.ok(file instanceof File);
  assert.equal(file.type, "image/png");
  assert.equal(file.name, "team.png");
  assert.ok(Buffer.from(await file.arrayBuffer()).equals(bytes));
  assert.deepEqual(JSON.parse(stdout[stdout.length - 1]), { ok: true, data: { action: "group_photo", ok: true } });
});

test("JPEG and GIF magic bytes pass too", async () => {
  const jpeg = imageFile("x.jpg", Buffer.concat([JPEG_MAGIC, Buffer.from("jpeg-body")]));
  await run(["act", "group-photo", "--thread", THREAD, "--file", jpeg]);
  assert.equal((calls[0].body as FormData).get("type"), "group_photo");

  const gif = imageFile("x.gif", Buffer.concat([Buffer.from("GIF89a"), Buffer.from("gif-body")]));
  await run(["act", "group-photo", "--thread", THREAD, "--file", gif]);
  assert.equal(calls.length, 2);
  assert.equal(((calls[1].body as FormData).get("file") as File).type, "image/gif");
});

test("missing --thread or --file errors without a request", async () => {
  const photo = imageFile("team.png", Buffer.concat([PNG_MAGIC, Buffer.from("x")]));
  await refused(["act", "group-photo", "--file", photo], /--thread/);
  await refused(["act", "group-photo", "--thread", THREAD], /--file/);
});

test("a file over 5 MB errors without a request", async () => {
  const photo = imageFile("big.png", Buffer.concat([PNG_MAGIC, Buffer.alloc(5 * 1024 * 1024 + 1)]));
  await refused(["act", "group-photo", "--thread", THREAD, "--file", photo], /5 MB/);
});

test("non-image content errors without a request, whatever the extension", async () => {
  const pdf = imageFile("page.png", Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.from("not an image")]));
  await refused(["act", "group-photo", "--thread", THREAD, "--file", pdf], /JPEG, PNG or GIF/);
  const text = imageFile("notes.gif", Buffer.from("plain text, not a gif\n"));
  await refused(["act", "group-photo", "--thread", THREAD, "--file", text], /JPEG, PNG or GIF/);
});

test("a directory, and a missing file, each error without a request", async () => {
  await refused(["act", "group-photo", "--thread", THREAD, "--file", root], /regular file/);
  await refused(["act", "group-photo", "--thread", THREAD, "--file", join(root, "no-such-photo.png")], /does not exist/);
});

test("the server's error_code is kept in the error output", async () => {
  reply = { error_code: "group_refused", error: "Group changes in this group are refused (group_not_allowlisted); nothing was done." };
  replyStatus = 422;
  const photo = imageFile("team.png", Buffer.concat([PNG_MAGIC, Buffer.from("x")]));
  await assert.rejects(run(["act", "group-photo", "--thread", THREAD, "--file", photo]), Exit);
  assert.equal(calls.length, 1); // the request WAS made; the server refused
  const printed = JSON.parse(stderr[stderr.length - 1]);
  assert.equal(printed.ok, false);
  assert.equal(printed.code, "group_refused");
  assert.match(printed.error, /group_not_allowlisted/);
});

test("the key is never printed, and the help carries the privacy line", async () => {
  const photo = imageFile("team.png", Buffer.concat([PNG_MAGIC, Buffer.from("x")]));
  await run(["act", "group-photo", "--thread", THREAD, "--file", photo]);
  assert.equal(stderr.join("\n").includes("mbk_for_tests"), false);
  assert.equal(stdout.join("\n").includes("mbk_for_tests"), false);

  // The command's help text lists group-photo and the privacy line
  // (whitespace-normalized: commander wraps the description).
  const program = new Command();
  program.exitOverride();
  registerActCommand(program);
  const sub = program.commands.find((c) => c.name() === "act");
  const help: string = sub ? sub.helpInformation().replace(/\s+/g, " ") : "";
  assert.match(help, /group-photo --thread ID --file IMAGE/);
  assert.match(help, /unlisted public URL/);
  assert.match(help, /never client data/);
  assert.match(help, /reviewed staff group/);
});
