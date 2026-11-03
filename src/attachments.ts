import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { basename, extname, join, resolve, sep } from "node:path";
import { homedir } from "node:os";

// Outbound email attachments. The allow-list, the file count and the sizes
// match the server's; the server checks again (type by content, formulas,
// key prefixes). Files may only come from the tab's own outbox folder.
export const CONTENT_TYPES: Record<string, string> = {
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".csv": "text/csv",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  // Board #53: the server checks each of these by content too.
  ".gif": "image/gif",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".wav": "audio/wav",
  ".txt": "text/plain",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};
export const MAX_FILES = 5;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 20 * 1024 * 1024;
export const MAX_RECIPIENTS = 2;
const OUTBOX_NAME = /^[a-z0-9_-]{1,64}$/;

export type AttachmentInfo = { path: string; filename: string; contentType: string; bytes: number };

export function outboxRoot(): string {
  return process.env.MAILBOXES_OUTBOX_ROOT || join(homedir(), "tmp", "mail-outbox");
}

// The tab's outbox folder: ~/tmp/mail-outbox/NAME. It must exist, be a real
// directory (not a symlink) owned by the user, and have mode 0700; the
// folder above it must be a real directory that is not group or world
// writable. Returns the real path.
export function resolveOutbox(name: string): string {
  if (!OUTBOX_NAME.test(name)) {
    throw new Error("--outbox NAME must be 1 to 64 characters: a-z 0-9 _ -");
  }
  const root = outboxRoot();
  const dir = join(root, name);
  let rootStat;
  let dirStat;
  try {
    rootStat = lstatSync(root);
    dirStat = lstatSync(dir);
  } catch {
    throw new Error(`outbox folder for "${name}" does not exist (create it with mode 0700)`);
  }
  if (!rootStat.isDirectory() || (rootStat.mode & 0o022) !== 0) {
    throw new Error("the outbox root must be a real directory that is not group or world writable");
  }
  if (!dirStat.isDirectory()) {
    throw new Error(`outbox "${name}" is not a real directory (a symlink is refused)`);
  }
  if (typeof process.getuid === "function" && dirStat.uid !== process.getuid()) {
    throw new Error(`outbox "${name}" is not owned by you`);
  }
  if ((dirStat.mode & 0o077) !== 0) {
    throw new Error(`outbox "${name}" must have mode 0700 (no group or other access)`);
  }
  return realpathSync(dir);
}

// Checks names, places and sizes only; never reads a file. Throws an Error
// that names the file, never its contents or its directory.
export function inspectAttachments(paths: string[], outbox?: string): AttachmentInfo[] {
  if (paths.length === 0) return [];
  if (!outbox) {
    throw new Error("--attach needs --outbox NAME (files must come from your outbox folder)");
  }
  if (paths.length > MAX_FILES) {
    throw new Error(`at most ${MAX_FILES} attachments per message (got ${paths.length}); nothing was sent`);
  }
  const realDir = resolveOutbox(outbox);
  const lexicalDir = resolve(join(outboxRoot(), outbox));
  let total = 0;
  const infos = paths.map((path) => {
    const filename = basename(path);
    const contentType = CONTENT_TYPES[extname(path).toLowerCase()];
    if (!contentType) {
      throw new Error(`attachment ${filename}: type not allowed (allowed: ${Object.keys(CONTENT_TYPES).join(" ")}); nothing was sent`);
    }
    // A bare name is a file in the outbox; a path must already point there.
    const full = resolve(path.includes("/") ? path : join(lexicalDir, path));
    if (!full.startsWith(lexicalDir + sep)) {
      throw new Error(`attachment ${filename}: not inside your outbox folder; nothing was sent`);
    }
    let stat;
    let real;
    try {
      // lstat: a symlink is not a regular file, so it is refused.
      stat = lstatSync(full);
      real = realpathSync(full);
    } catch {
      throw new Error(`attachment ${filename}: file not found; nothing was sent`);
    }
    // The real path must be the same place under the real outbox: a symlink
    // anywhere on the way would change it.
    if (!stat.isFile() || real !== join(realDir, full.slice(lexicalDir.length))) {
      throw new Error(`attachment ${filename}: not a regular file inside your outbox (symlinks are refused); nothing was sent`);
    }
    if (stat.size > MAX_FILE_BYTES) {
      throw new Error(`attachment ${filename}: ${stat.size} bytes; the limit is ${MAX_FILE_BYTES} (10 MB) per file; nothing was sent`);
    }
    total += stat.size;
    return { path: full, filename, contentType, bytes: stat.size };
  });
  if (total > MAX_TOTAL_BYTES) {
    throw new Error(`attachments total ${total} bytes; the limit is ${MAX_TOTAL_BYTES} (20 MB) per mail; nothing was sent`);
  }
  return infos;
}

// Attachments go to one or two recipients (to and cc together), never bcc.
export function checkRecipients(to: string[], cc?: string, bcc?: string): void {
  if (bcc) throw new Error("attachments cannot be sent with --bcc; nothing was sent");
  const count = [...to, cc ?? ""].flatMap((v) => v.split(/[,;]/)).filter((v) => v.trim() !== "").length;
  if (count < 1 || count > MAX_RECIPIENTS) {
    throw new Error(`attachments go to one or two recipients (to and cc); got ${count}; nothing was sent`);
  }
}

function guardCheckPath(): string {
  return process.env.MAILBOXES_GUARD_CHECK || join(homedir(), "projects", "hq", "bin", "guard-check");
}

// The text parts of a file: the csv or txt text, the xlsx shared strings
// and sheet cell text, or the docx XML parts (document, headers, footers,
// notes, comments). Other types have no text part here.
function textParts(info: AttachmentInfo): Buffer | null {
  const ext = extname(info.path).toLowerCase();
  if (ext === ".csv" || ext === ".txt") return readFileSync(info.path);
  const patterns = ext === ".xlsx" ? ["xl/sharedStrings.xml", "xl/worksheets/*.xml"] : ext === ".docx" ? ["word/*.xml"] : null;
  if (!patterns) return null;
  const run = spawnSync("unzip", ["-p", info.path, ...patterns], { maxBuffer: 128 * 1024 * 1024 });
  // 11 = one pattern matched nothing (a workbook can have no shared strings).
  if (run.error || (run.status !== 0 && run.status !== 11)) {
    throw new Error(`attachment ${info.filename}: the document text could not be read for the secret check; nothing was sent`);
  }
  return run.stdout;
}

// Runs guard-check scrub (the known-secret hash table) over the text parts.
// Refuses on a hit with a count only, never the value. Fails closed when
// the guard cannot run.
export function guardScan(infos: AttachmentInfo[]): void {
  for (const info of infos) {
    const text = textParts(info);
    if (!text || text.length === 0) continue;
    const run = spawnSync(guardCheckPath(), ["scrub"], { input: text, maxBuffer: 256 * 1024 * 1024 });
    const count = /^scrubbed (\d+)$/m.exec(run.stderr?.toString() ?? "");
    if (run.error || run.status !== 0 || !count) {
      throw new Error(`attachment ${info.filename}: the secret check (guard-check scrub) could not run; nothing was sent`);
    }
    if (Number(count[1]) > 0) {
      throw new Error(`attachment ${info.filename}: ${count[1]} known ${count[1] === "1" ? "secret" : "secrets"} found in the text; nothing was sent`);
    }
  }
}

// Reads the files into a multipart form with the text fields. The files go
// in as attachments[] parts.
export function buildForm(fields: Record<string, string | undefined>, infos: AttachmentInfo[]): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== "") form.append(key, value);
  }
  for (const info of infos) {
    // Read after the checks; the size is checked again on the bytes read
    // (the file could have changed between the check and the read).
    const bytes = readFileSync(info.path);
    if (bytes.length !== info.bytes) {
      throw new Error(`attachment ${info.filename}: the file changed while reading; nothing was sent`);
    }
    form.append("attachments[]", new Blob([bytes], { type: info.contentType }), info.filename);
  }
  return form;
}

export const ALLOWED_TYPES_HELP = ".pdf .png .jpg .gif .mp3 .m4a .wav .csv .txt .docx .xlsx; 5 files, 10 MB each, 20 MB total";

// Names and sizes only, for --dry-run.
export function describe(infos: AttachmentInfo[]): Array<{ filename: string; content_type: string; bytes: number }> {
  return infos.map((i) => ({ filename: i.filename, content_type: i.contentType, bytes: i.bytes }));
}

export function collect(value: string, prev: string[] = []): string[] {
  return prev.concat([value]);
}
