import { lstatSync, readFileSync } from "node:fs";
import { basename, extname } from "node:path";

// Outbound email attachments. The allow-list, the file count and the total
// cap match the server's; the server checks again (type by content too).
export const CONTENT_TYPES: Record<string, string> = {
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".csv": "text/csv",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
};
export const MAX_FILES = 5;
export const MAX_TOTAL_BYTES = 10 * 1024 * 1024;

export type AttachmentInfo = { path: string; filename: string; contentType: string; bytes: number };

// Checks only names and sizes; never reads a file. Throws an Error with a
// message that names the file, never its contents.
export function inspectAttachments(paths: string[]): AttachmentInfo[] {
  if (paths.length > MAX_FILES) {
    throw new Error(`at most ${MAX_FILES} attachments per message (got ${paths.length}); nothing was sent`);
  }
  let total = 0;
  const infos = paths.map((path) => {
    const filename = basename(path);
    const contentType = CONTENT_TYPES[extname(path).toLowerCase()];
    if (!contentType) {
      throw new Error(`attachment ${filename}: type not allowed (allowed: ${Object.keys(CONTENT_TYPES).join(" ")}); nothing was sent`);
    }
    let stat;
    try {
      // lstat: a symlink is not a regular file, so it is refused.
      stat = lstatSync(path);
    } catch {
      throw new Error(`attachment ${filename}: file not found; nothing was sent`);
    }
    if (!stat.isFile()) {
      throw new Error(`attachment ${filename}: not a regular file; nothing was sent`);
    }
    total += stat.size;
    return { path, filename, contentType, bytes: stat.size };
  });
  if (total > MAX_TOTAL_BYTES) {
    throw new Error(`attachments total ${total} bytes; the limit is ${MAX_TOTAL_BYTES} (10 MB); nothing was sent`);
  }
  return infos;
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

// Names and sizes only, for --dry-run.
export function describe(infos: AttachmentInfo[]): Array<{ filename: string; content_type: string; bytes: number }> {
  return infos.map((i) => ({ filename: i.filename, content_type: i.contentType, bytes: i.bytes }));
}

export function collect(value: string, prev: string[] = []): string[] {
  return prev.concat([value]);
}

