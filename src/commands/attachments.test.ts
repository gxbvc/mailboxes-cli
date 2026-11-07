// Tests for --attach, --outbox, --new-recipient and --dry-run on send and
// reply. Run with npm test. fetch is stubbed; the files are invented and live
// in a temp directory; guard-check is replaced by a fake script.
import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, symlinkSync, truncateSync, rmSync, chmodSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Command } from "commander";

process.env.MAILBOXES_API_KEY = "user-key-for-tests";
delete process.env.MAILBOXES_MAILBOX_KEY;

const root = mkdtempSync(join(tmpdir(), "mbx-attach-test-"));
chmodSync(root, 0o700);
const outboxRoot = join(root, "mail-outbox");
mkdirSync(outboxRoot, { mode: 0o700 });
chmodSync(outboxRoot, 0o700);
const outbox = join(outboxRoot, "tab1");
mkdirSync(outbox, { mode: 0o700 });
chmodSync(outbox, 0o700);
const elsewhere = join(root, "elsewhere");
mkdirSync(elsewhere);
process.env.MAILBOXES_OUTBOX_ROOT = outboxRoot;

// A fake guard-check: counts lines with FAKE-SECRET and reports "scrubbed N".
const guard = join(root, "fake-guard-check");
writeFileSync(guard, '#!/bin/sh\nn=$(cat | grep -c FAKE-SECRET)\necho "scrubbed $n" >&2\n');
chmodSync(guard, 0o755);
process.env.MAILBOXES_GUARD_CHECK = guard;

import { registerSendCommand } from "./send.js";
import { registerReplyCommand } from "./reply.js";

type Call = { url: string; method: string; body: any; headers: Record<string, string> };
let calls: Call[] = [];
let stdout: string[] = [];
let stderr: string[] = [];

after(() => rmSync(root, { recursive: true, force: true }));

function file(name: string, content: string | Buffer = "invented,test,data\n1,2,3\n", dir = outbox): string {
  const path = join(dir, name);
  writeFileSync(path, content);
  return path;
}

class Exit extends Error {}

beforeEach(() => {
  calls = [];
  stdout = [];
  stderr = [];
  process.env.MAILBOXES_GUARD_CHECK = guard;
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

const base = ["send", "--mailbox", "174", "--to", "a@example.com", "--subject", "S", "--body", "hello", "--outbox", "tab1"];

test("a send with files posts multipart with attachments[] parts and the fixed content types", async () => {
  const xlsx = file("report.pdf", "PK-invented");
  const csv = file("data.CSV");
  await run([...base, "--attach", xlsx, "--attach", "data.CSV"]); // a full path and a bare name
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
  assert.equal(form.get("allow_new_recipient"), null);
  assert.equal(form.get("outbox"), null, "the outbox name is a CLI rule, not sent");
  const parts = form.getAll("attachments[]") as File[];
  assert.deepEqual(parts.map((p) => [p.name, p.type, p.size]), [
    ["report.pdf", "application/pdf", 11],
    ["data.CSV", "text/csv", 25],
  ]);
  assert.equal(await parts[0].text(), "PK-invented");
  void csv;
});

test("--new-recipient sends allow_new_recipient=1", async () => {
  await run([...base, "--attach", file("a.pdf"), "--new-recipient"]);
  assert.equal((calls[0].body as FormData).get("allow_new_recipient"), "1");
});

test("a send without files stays JSON", async () => {
  await run(["send", "--mailbox", "174", "--to", "a@example.com", "--subject", "S", "--body", "hello"]);
  assert.equal(calls[0].headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(calls[0].body), { to: "a@example.com", body: "hello", mailbox_id: "174", subject: "S" });
});

test("reply --reply-to sends reply_to_message_id on the user-key reply endpoint", async () => {
  await run(["reply", "imessage:180:+15551234567", "--mailbox", "180", "--to", "+15551234567", "--body", "answer", "--reply-to", "4242"]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.endsWith("/reply"), true);
  assert.deepEqual(JSON.parse(calls[0].body), { to: "+15551234567", body: "answer", mailbox_id: "180", reply_to_message_id: "4242" });
});

test("reply --effect sends effect on the user-key reply endpoint", async () => {
  await run(["reply", "t1", "--mailbox", "180", "--to", "+15551234567", "--body", "boom", "--effect", "slam", "--reply-to", "7"]);
  assert.deepEqual(JSON.parse(calls[0].body), { to: "+15551234567", body: "boom", mailbox_id: "180", reply_to_message_id: "7", effect: "slam" });
});

test("reply --reply-to refuses a non-numeric id and sends nothing", async () => {
  await refused(["reply", "t1", "--mailbox", "180", "--to", "+15551234567", "--body", "x", "--reply-to", "abc"], /numeric message id/);
});

test("a reply with files posts multipart to the reply endpoint", async () => {
  await run(["reply", "thread-1", "--mailbox", "174", "--to", "a@example.com", "--body", "hi", "--outbox", "tab1", "--attach", file("a.pdf"), "--attach", file("b.png"), "--attach", file("c.jpg")]);
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
  for (const name of ["x.exe", "x.xlsm", "x.zip", "x.jpeg", "x.html", "x.svg", "x.rar", "x.docm", "noext"]) {
    calls = [];
    await refused([...base, "--attach", file(name)], /type not allowed/);
  }
});

test("--attach without --outbox is refused", async () => {
  await refused(["send", "--mailbox", "174", "--to", "a@example.com", "--subject", "S", "--body", "b", "--attach", file("a.pdf")], /needs --outbox NAME/);
});

test("the outbox folder must exist, be a real directory, mode 0700, and have a plain name", async () => {
  await refused([...base.slice(0, -1), "nope", "--attach", file("a.pdf")], /does not exist/);
  await refused([...base.slice(0, -1), "../tab1", "--attach", file("a.pdf")], /--outbox NAME must be/);
  await refused([...base.slice(0, -1), "Tab1", "--attach", file("a.pdf")], /--outbox NAME must be/);

  const open = join(outboxRoot, "open");
  mkdirSync(open);
  chmodSync(open, 0o755);
  writeFileSync(join(open, "a.pdf"), "x");
  await refused([...base.slice(0, -1), "open", "--attach", "a.pdf"], /mode 0700/);
  chmodSync(open, 0o770);
  await refused([...base.slice(0, -1), "open", "--attach", "a.pdf"], /mode 0700/);

  symlinkSync(outbox, join(outboxRoot, "linked"));
  await refused([...base.slice(0, -1), "linked", "--attach", file("a.pdf")], /not a real directory/);
});

test("the outbox root must not be group or world writable", async () => {
  chmodSync(outboxRoot, 0o775);
  try {
    await refused([...base, "--attach", file("a.pdf")], /not group or world writable/);
  } finally {
    chmodSync(outboxRoot, 0o700);
  }
});

test("a file outside the outbox is refused: other folder, dot-dot, symlink file, file in a symlinked folder", async () => {
  await refused([...base, "--attach", file("out.pdf", "x", elsewhere)], /not inside your outbox/);
  file("in.pdf");
  await refused([...base, "--attach", join(outbox, "..", "elsewhere", "out.pdf")], /not inside your outbox/);
  await refused([...base, "--attach", join(outbox, "sub", "..", "..", "elsewhere", "out.pdf")], /not inside your outbox/);

  symlinkSync(join(elsewhere, "out.pdf"), join(outbox, "link.pdf"));
  await refused([...base, "--attach", "link.pdf"], /not a regular file inside your outbox/);

  symlinkSync(elsewhere, join(outbox, "dirlink"));
  await refused([...base, "--attach", join(outbox, "dirlink", "out.pdf")], /not a regular file inside your outbox/);

  mkdirSync(join(outbox, "realsub"));
  await refused([...base, "--attach", join(outbox, "realsub")], /type not allowed/); // a directory without a good extension
  mkdirSync(join(outbox, "folder.pdf"));
  await refused([...base, "--attach", "folder.pdf"], /not a regular file/);
  await refused([...base, "--attach", "missing.pdf"], /file not found/);
});

test("a file in a plain sub-folder of the outbox is accepted", async () => {
  mkdirSync(join(outbox, "sub1"), { recursive: true });
  await run([...base, "--attach", file("deep.pdf", "x", join(outbox, "sub1"))]);
  assert.equal(calls.length, 1);
});

test("10 MB per file and 20 MB per mail; 5 files at most", async () => {
  const big = join(outbox, "big.pdf");
  writeFileSync(big, "");
  truncateSync(big, 10 * 1024 * 1024 + 1);
  await refused([...base, "--attach", big], /10485760.*per file/);

  const exact = join(outbox, "exact.pdf");
  writeFileSync(exact, "");
  truncateSync(exact, 10 * 1024 * 1024);
  await run([...base, "--attach", exact, "--attach", file("five.csv")]);
  assert.equal(calls.length, 1);

  calls = [];
  const a = join(outbox, "ten.pdf");
  writeFileSync(a, "");
  truncateSync(a, 10 * 1024 * 1024);
  const b = join(outbox, "six.pdf");
  writeFileSync(b, "");
  truncateSync(b, 10 * 1024 * 1024);
  const c = join(outbox, "one.pdf");
  writeFileSync(c, "x");
  await refused([...base, "--attach", a, "--attach", b, "--attach", c], /20971520.*per mail/);

  const six = Array.from({ length: 6 }, (_, i) => ["--attach", file(`f${i}.csv`)]).flat();
  await refused([...base, ...six], /at most 5/);
});

test("recipients: one or two (to and cc), never bcc", async () => {
  const withFile = ["--attach", file("a.pdf")];
  await refused([...base, ...withFile, "--cc", "b@example.com,c@example.com"], /one or two recipients.*got 3/);
  await refused([...base, ...withFile, "--bcc", "hidden@example.com"], /cannot be sent with --bcc/);
  await refused([...base, ...withFile, "--to", "b@example.com", "--to", "c@example.com"], /groups need|one or two recipients/);
  await run([...base, ...withFile, "--cc", "b@example.com"]);
  assert.equal((calls[0].body as FormData).get("cc"), "b@example.com");
  // Without files nothing changes: bcc is still allowed.
  calls = [];
  await run(["send", "--mailbox", "174", "--to", "a@example.com", "--subject", "S", "--body", "b", "--bcc", "x@example.com"]);
  assert.equal(calls.length, 1);
});

test("--attach cannot be mixed with parts or --thread", async () => {
  process.env.MAILBOXES_MAILBOX_KEY = "mbk-test";
  try {
    await refused([...base, "--text", "x", "--attach", file("m.pdf")], /cannot be mixed/);
    await refused(["send", "--to", "a@example.com", "--outbox", "tab1", "--attach", file("m.pdf")], /--attach needs --mailbox or --from/);
  } finally {
    delete process.env.MAILBOXES_MAILBOX_KEY;
  }
});

test("--dry-run prints names and sizes only, sends nothing", async () => {
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
  assert.equal(out.includes(root), false, "no directory path is printed");
});

test("--dry-run on a reply, and dry-run still refuses a bad file", async () => {
  await run(["reply", "t1", "--mailbox", "174", "--to", "a@example.com", "--body", "hi", "--outbox", "tab1", "--attach", file("r.pdf"), "--dry-run"]);
  assert.equal(calls.length, 0);
  assert.equal(JSON.parse(stdout.join("\n")).data.would_send.attachments[0].filename, "r.pdf");
  await refused(["reply", "t1", "--mailbox", "174", "--to", "a@example.com", "--body", "hi", "--outbox", "tab1", "--attach", file("r.exe"), "--dry-run"], /type not allowed/);
});

test("the secret check: a hit in csv text refuses with a count, never the value", async () => {
  const path = file("keys.csv", "name,value\na,FAKE-SECRET-1\nb,FAKE-SECRET-2\nc,ok\n");
  await refused([...base, "--attach", path], /2 known secrets found/);
  const err = stderr.join("\n");
  assert.equal(err.includes("FAKE-SECRET"), false);
  assert.equal(err.includes(root), false);
  // The same check runs on --dry-run.
  stderr = [];
  await refused([...base, "--attach", path, "--dry-run"], /2 known secrets/);
});

test("the secret check reads xlsx shared strings and sheet text", async () => {
  const dir = mkdtempSync(join(root, "xlsx-"));
  mkdirSync(join(dir, "xl", "worksheets"), { recursive: true });
  writeFileSync(join(dir, "xl", "workbook.xml"), "<workbook/>");
  writeFileSync(join(dir, "xl", "sharedStrings.xml"), "<sst><si><t>FAKE-SECRET-in-strings</t></si></sst>");
  writeFileSync(join(dir, "xl", "worksheets", "sheet1.xml"), "<sheetData/>");
  const path = join(outbox, "hit.xlsx");
  execFileSync("zip", ["-q", "-r", path, "xl"], { cwd: dir });
  await refused([...base, "--attach", path], /1 known secret found/);

  writeFileSync(join(dir, "xl", "sharedStrings.xml"), "<sst><si><t>fine</t></si></sst>");
  writeFileSync(join(dir, "xl", "worksheets", "sheet1.xml"), "<sheetData><c><is><t>FAKE-SECRET-in-sheet</t></is></c></sheetData>");
  const second = join(outbox, "hit2.xlsx");
  execFileSync("zip", ["-q", "-r", second, "xl"], { cwd: dir });
  await refused([...base, "--attach", second], /1 known secret found/);

  writeFileSync(join(dir, "xl", "worksheets", "sheet1.xml"), "<sheetData/>");
  const clean = join(outbox, "clean.xlsx");
  execFileSync("zip", ["-q", "-r", clean, "xl"], { cwd: dir });
  await run([...base, "--attach", clean]);
  assert.equal(calls.length, 1);
});

test("the secret check fails closed: no guard, a failing guard, or no count", async () => {
  const path = file("ok.csv");
  process.env.MAILBOXES_GUARD_CHECK = join(root, "missing-guard");
  await refused([...base, "--attach", path], /could not run/);

  const broken = join(root, "broken-guard");
  writeFileSync(broken, "#!/bin/sh\nexit 4\n");
  chmodSync(broken, 0o755);
  process.env.MAILBOXES_GUARD_CHECK = broken;
  await refused([...base, "--attach", path], /could not run/);

  const silent = join(root, "silent-guard");
  writeFileSync(silent, "#!/bin/sh\ncat > /dev/null\n");
  chmodSync(silent, 0o755);
  process.env.MAILBOXES_GUARD_CHECK = silent;
  await refused([...base, "--attach", path], /could not run/);
});

test("pdf, png and jpg files are not text-scanned (no guard call)", async () => {
  process.env.MAILBOXES_GUARD_CHECK = join(root, "missing-guard");
  await run([...base, "--attach", file("doc.pdf", "FAKE-SECRET")]);
  assert.equal(calls.length, 1);
});

test("an error message names the file and never its contents or directory", async () => {
  const path = file("leak.exe", "TOP-SECRET-INVENTED-CONTENT");
  await refused([...base, "--attach", path], /leak\.exe/);
  const err = stderr.join("\n");
  assert.equal(err.includes("TOP-SECRET"), false);
  assert.equal(err.includes(root), false);
});
