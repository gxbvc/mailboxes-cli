// Tests for --attach and --dry-run on send and reply. Run with npm test.
// fetch is stubbed; the files are invented and live in a temp directory.
import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, symlinkSync, truncateSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Command } from "commander";

process.env.MAILBOXES_API_KEY = "user-key-for-tests";
delete process.env.MAILBOXES_MAILBOX_KEY;

import { registerSendCommand } from "./send.js";
import { registerReplyCommand } from "./reply.js";

type Call = { url: string; method: string; body: any; headers: Record<string, string> };
let calls: Call[] = [];
let stdout: string[] = [];
let stderr: string[] = [];

const dir = mkdtempSync(join(tmpdir(), "mbx-attach-test-"));
after(() => rmSync(dir, { recursive: true, force: true }));

function file(name: string, content: string | Buffer = "invented,test,data\n1,2,3\n"): string {
  const path = join(dir, name);
  writeFileSync(path, content);
  return path;
}

class Exit extends Error {}

beforeEach(() => {
  calls = [];
  stdout = [];
  stderr = [];
  globalThis.fetch = (async (url: any, init: any) => {
    calls.push({ url: String(url), method: init?.method || "GET", body: init?.body, headers: init?.headers ?? {} });
    return new Response(JSON.stringify({ message: "Message queued for delivery" }), { status: 202, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  console.log = (...args: any[]) => { stdout.push(args.join(" ")); };
  console.error = (...args: any[]) => { stderr.push(args.join(" ")); };
  process.exit = ((code?: number) => { throw new Exit(`exit ${code}`); }) as typeof process.exit;
});

async function run(argv: string[]): Promise<void> {
  const program = new Command();
  program.exitOverride();
  registerSendCommand(program);
  registerReplyCommand(program);
  await program.parseAsync(argv, { from: "user" });
}

async function refused(argv: string[], pattern: RegExp): Promise<void> {
  await assert.rejects(run(argv), Exit);
  assert.equal(calls.length, 0, "nothing is sent");
  assert.match(stderr.join("\n"), pattern);
}

const base = ["send", "--mailbox", "174", "--to", "a@example.com", "--subject", "S", "--body", "hello"];

test("a send with files posts multipart with attachments[] parts and the fixed content types", async () => {
  const xlsx = file("report.xlsx", "PK-invented");
  const csv = file("data.CSV");
  await run([...base, "--attach", xlsx, "--attach", csv]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.endsWith("/api/v1/messages"), true);
  assert.equal(calls[0].method, "POST");
  assert.equal(calls[0].headers["Authorization"], "Bearer user-key-for-tests");
  // fetch sets the multipart boundary itself, so no Content-Type is set here.
  assert.equal(calls[0].headers["Content-Type"], undefined);
  const form = calls[0].body as FormData;
  assert.ok(form instanceof FormData);
  assert.equal(form.get("to"), "a@example.com");
  assert.equal(form.get("mailbox_id"), "174");
  assert.equal(form.get("subject"), "S");
  assert.equal(form.get("body"), "hello");
  const parts = form.getAll("attachments[]") as File[];
  assert.deepEqual(parts.map((p) => [p.name, p.type, p.size]), [
    ["report.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", 11],
    ["data.CSV", "text/csv", 25],
  ]);
  assert.equal(await parts[0].text(), "PK-invented");
});

test("a send without files stays JSON", async () => {
  await run(base);
  assert.equal(calls[0].headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(calls[0].body), { to: "a@example.com", body: "hello", mailbox_id: "174", subject: "S" });
});

test("a reply with files posts multipart to the reply endpoint", async () => {
  await run(["reply", "thread-1", "--mailbox", "174", "--to", "a@example.com", "--body", "hi", "--attach", file("a.pdf"), "--attach", file("b.png"), "--attach", file("c.jpg")]);
  assert.equal(calls[0].url.endsWith("/api/v1/threads/thread-1/reply"), true);
  const form = calls[0].body as FormData;
  assert.deepEqual((form.getAll("attachments[]") as File[]).map((p) => [p.name, p.type]), [
    ["a.pdf", "application/pdf"],
    ["b.png", "image/png"],
    ["c.jpg", "image/jpeg"],
  ]);
  assert.equal(form.get("body"), "hi");
});

test("a file type outside the allow-list is refused before any request", async () => {
  for (const name of ["x.exe", "x.xlsm", "x.zip", "x.jpeg", "x.txt", "noext"]) {
    calls = [];
    await refused([...base, "--attach", file(name)], /type not allowed/);
  }
});

test("a missing file, a directory and a symlink are refused", async () => {
  await refused([...base, "--attach", join(dir, "missing.pdf")], /file not found/);
  const folder = join(dir, "folder.pdf");
  mkdirSync(folder);
  await refused([...base, "--attach", folder], /not a regular file/);
  const target = file("real.pdf");
  const link = join(dir, "link.pdf");
  symlinkSync(target, link);
  await refused([...base, "--attach", link], /not a regular file/);
});

test("the total over 10 MB is refused; exactly 10 MB is allowed", async () => {
  const big = join(dir, "big.pdf");
  writeFileSync(big, "");
  truncateSync(big, 10 * 1024 * 1024 + 1);
  await refused([...base, "--attach", big], /limit is 10485760/);

  const half = join(dir, "half.csv");
  writeFileSync(half, "");
  truncateSync(half, 6 * 1024 * 1024);
  const half2 = join(dir, "half2.csv");
  writeFileSync(half2, "");
  truncateSync(half2, 6 * 1024 * 1024);
  await refused([...base, "--attach", half, "--attach", half2], /limit is 10485760/);

  const exact = join(dir, "exact.pdf");
  writeFileSync(exact, "");
  truncateSync(exact, 10 * 1024 * 1024);
  await run([...base, "--attach", exact]);
  assert.equal(calls.length, 1);
});

test("more than 5 files are refused", async () => {
  const six = Array.from({ length: 6 }, (_, i) => ["--attach", file(`f${i}.csv`)]).flat();
  await refused([...base, ...six], /at most 5/);
});

test("--dry-run prints names and sizes only, sends nothing, needs no network", async () => {
  const secret = "TOP-SECRET-INVENTED-CONTENT";
  await run([...base, "--attach", file("plan.csv", secret), "--dry-run"]);
  assert.equal(calls.length, 0);
  const out = stdout.join("\n");
  assert.deepEqual(JSON.parse(out), {
    ok: true,
    data: {
      dry_run: true,
      would_send: {
        to: "a@example.com",
        mailbox_id: "174",
        subject: "S",
        body_chars: 5,
        attachments: [{ filename: "plan.csv", content_type: "text/csv", bytes: secret.length }],
      },
    },
  });
  assert.equal(out.includes(secret), false);
  assert.equal(out.includes(dir), false, "no directory path is printed");
});

test("--dry-run on a reply, and dry-run still refuses a bad file", async () => {
  await run(["reply", "t1", "--mailbox", "174", "--to", "a@example.com", "--body", "hi", "--attach", file("r.pdf"), "--dry-run"]);
  assert.equal(calls.length, 0);
  assert.equal(JSON.parse(stdout.join("\n")).data.would_send.attachments[0].filename, "r.pdf");
  await refused(["reply", "t1", "--mailbox", "174", "--to", "a@example.com", "--body", "hi", "--attach", file("r.exe"), "--dry-run"], /type not allowed/);
});

test("--attach cannot be mixed with parts or --thread", async () => {
  process.env.MAILBOXES_MAILBOX_KEY = "mbk-test";
  try {
    await refused([...base, "--text", "x", "--attach", file("m.pdf")], /cannot be mixed/);
    await refused(["send", "--to", "a@example.com", "--attach", file("m.pdf")], /--attach needs --mailbox or --from/);
  } finally {
    delete process.env.MAILBOXES_MAILBOX_KEY;
  }
});

test("an error message names the file and never its contents or directory", async () => {
  const path = file("leak.exe", "TOP-SECRET-INVENTED-CONTENT");
  await refused([...base, "--attach", path], /leak\.exe/);
  const err = stderr.join("\n");
  assert.equal(err.includes("TOP-SECRET"), false);
  assert.equal(err.includes(dir), false);
});
