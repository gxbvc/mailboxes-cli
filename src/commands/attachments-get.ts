import { Command } from "commander";
import { closeSync, openSync, writeSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "../api.js";
import { success, error } from "../output.js";

// Fetch one stored attachment or voice memo to a local file (mailboxes PR 36:
// message JSON carries a path, never a keyless link). User key by default;
// --mailbox-key uses MAILBOXES_MAILBOX_KEY and the /api/v1/mailbox/ path.
// The file is new (never overwritten) and 0600: incoming media can be private.
const MAX_BYTES = 50 * 1024 * 1024;

function digits(value: string, name: string): string {
  if (!/^\d{1,18}$/.test(String(value))) error(`${name} must be a numeric id`);
  return String(value);
}

async function fetchTo(path: string, out: string, mailboxKey: boolean): Promise<void> {
  const key = mailboxKey ? process.env.MAILBOXES_MAILBOX_KEY : undefined;
  if (mailboxKey && !key) error("--mailbox-key needs MAILBOXES_MAILBOX_KEY");
  const client = createClient(key);
  const { data, contentType } = await client.download(path, MAX_BYTES);
  const file = resolve(out);
  let fd: number;
  try {
    fd = openSync(file, "wx", 0o600); // wx: fail if the file exists
  } catch (e: any) {
    error(e.code === "EEXIST" ? `refused: ${file} exists` : e.message);
    return;
  }
  try {
    writeSync(fd, data);
  } finally {
    closeSync(fd);
  }
  success({ file, bytes: data.length, content_type: contentType });
}

export function registerAttachmentsCommand(program: Command): void {
  const attachments = program.command("attachments").description("Fetch stored message attachments and voice memos");

  attachments
    .command("get <message_id> <attachment_id>")
    .description("Save one attachment (an id from the message's media list) to a new file")
    .requiredOption("--out <file>", "New file to write (never overwritten; mode 0600)")
    .option("--mailbox-key", "Use the per-mailbox key (MAILBOXES_MAILBOX_KEY) instead of the user key")
    .action(async (messageId, attachmentId, opts) => {
      try {
        const mid = digits(messageId, "message_id");
        const aid = digits(attachmentId, "attachment_id");
        const prefix = opts.mailboxKey ? "/api/v1/mailbox/messages" : "/api/v1/messages";
        await fetchTo(`${prefix}/${mid}/attachments/${aid}`, opts.out, Boolean(opts.mailboxKey));
      } catch (e: any) {
        error(e.message);
      }
    });

  attachments
    .command("voice-memo <message_id>")
    .description("Save a message's stored voice memo to a new file")
    .requiredOption("--out <file>", "New file to write (never overwritten; mode 0600)")
    .option("--mailbox-key", "Use the per-mailbox key (MAILBOXES_MAILBOX_KEY) instead of the user key")
    .action(async (messageId, opts) => {
      try {
        const mid = digits(messageId, "message_id");
        const prefix = opts.mailboxKey ? "/api/v1/mailbox/messages" : "/api/v1/messages";
        await fetchTo(`${prefix}/${mid}/voice_memo`, opts.out, Boolean(opts.mailboxKey));
      } catch (e: any) {
        error(e.message);
      }
    });
}
