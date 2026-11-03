import { Command } from "commander";
import { success, error } from "../output.js";
import { mailboxKeyClient } from "./actions.js";
import { ALLOWED_TYPES_HELP, buildForm, collect, guardScan, inspectAttachments } from "../attachments.js";

const SHA8 = /^[0-9a-f]{8}$/i;
const SHA256 = /^[0-9a-f]{64}$/i;

// reply-all on the mailbox-key endpoint (POST /api/v1/mailbox/messages with
// reply_all). The SERVER builds the recipients from the stored message and
// computes the approval hash; this command never computes it and never
// sends without the value a person approved:
//   1. --preview: prints to, cc, subject, the files (name, type, bytes,
//      sha8) and the value to approve. Sends nothing.
//   2. the send: the same message, body and files, plus the approved value:
//      --expect-sha8 for a text-only reply, --expect-sha256 (the full 64 hex
//      approval_sha256) for a reply with files. Anything changed after the
//      preview is refused by the server.
export function registerReplyAllCommand(program: Command): void {
  program
    .command("reply-all <message_id>")
    .description("Reply to everyone on a stored inbound email: --preview first, then send with the approved value (mailbox key)")
    .requiredOption("--body <body>", "Reply text (part of the approval when files are attached)")
    .option("--attach <path>", `Attach a file (repeat; ${ALLOWED_TYPES_HELP}; from your outbox)`, collect)
    .option("--outbox <name>", "Your outbox folder name: files must be in ~/tmp/mail-outbox/<name> (mode 0700)")
    .option("--preview", "Show the recipients, files and the value to approve; send nothing")
    .option("--expect-sha8 <sha8>", "Text-only send: the recipients_sha8 from the preview")
    .option("--expect-sha256 <sha256>", "Send with files: the full approval_sha256 (64 hex) from the preview")
    .action(async (messageId: string, opts) => {
      try {
        if (!process.env.MAILBOXES_MAILBOX_KEY) {
          error("reply-all needs a per-mailbox key in MAILBOXES_MAILBOX_KEY");
          return;
        }
        if (!/^\d+$/.test(messageId)) {
          error("message_id must be the stored message's number");
          return;
        }
        // Files first, before any request: names, places and sizes, then the
        // known-secret scan of the text parts.
        const attachments = inspectAttachments(opts.attach ?? [], opts.outbox);
        if (attachments.length) guardScan(attachments);

        const fields: Record<string, string | undefined> = {
          reply_all: "true",
          reply_to_message_id: messageId,
          body: opts.body,
        };
        if (opts.preview) {
          if (opts.expectSha8 || opts.expectSha256) {
            error("--preview takes no --expect-sha8 or --expect-sha256");
            return;
          }
          fields.preview = "true";
        } else if (attachments.length) {
          if (!opts.expectSha256 || !SHA256.test(opts.expectSha256)) {
            error("a reply-all with files needs --expect-sha256: the full approval_sha256 (64 hex) from --preview; nothing was sent");
            return;
          }
          fields.expect_approval_sha256 = opts.expectSha256.toLowerCase();
          if (opts.expectSha8) {
            if (!SHA8.test(opts.expectSha8)) {
              error("--expect-sha8 must be 8 hex characters; nothing was sent");
              return;
            }
            fields.expect_recipients_sha8 = opts.expectSha8.toLowerCase();
          }
        } else {
          if (opts.expectSha256) {
            error("--expect-sha256 is for a reply with files; a text-only reply-all takes --expect-sha8; nothing was sent");
            return;
          }
          if (!opts.expectSha8 || !SHA8.test(opts.expectSha8)) {
            error("reply-all needs --expect-sha8: the recipients_sha8 from --preview; nothing was sent");
            return;
          }
          fields.expect_recipients_sha8 = opts.expectSha8.toLowerCase();
        }

        const client = mailboxKeyClient();
        const data = attachments.length
          ? await client.postForm("/api/v1/mailbox/messages", buildForm(fields, attachments))
          : await client.post("/api/v1/mailbox/messages", fields);

        if (opts.preview && data?.reply_all) {
          const preview = data.reply_all;
          const approve = preview.approval_sha256
            ? { expect_sha256: preview.approval_sha256, card_sha8: preview.recipients_sha8, send_with: `--expect-sha256 ${preview.approval_sha256}` }
            : { expect_sha8: preview.recipients_sha8, send_with: `--expect-sha8 ${preview.recipients_sha8}` };
          success({ ...data, approve });
          return;
        }
        success(data);
      } catch (e: any) {
        error(e.message, e.code);
      }
    });
}
