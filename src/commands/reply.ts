import { Command } from "commander";
import { createClient } from "../api.js";
import { success, error } from "../output.js";
import { ALLOWED_TYPES_HELP, buildForm, checkRecipients, collect, describe, guardScan, inspectAttachments } from "../attachments.js";

export function registerReplyCommand(program: Command): void {
  program
    .command("reply <thread_id>")
    .description("Reply to a thread")
    .option("--mailbox <id>", "Mailbox id (required for SMS/iMessage; e.g. 133)")
    .option("--from <address>", "From email address (email reply)")
    .requiredOption("--to <address>", "Recipient email or E.164 phone")
    .requiredOption("--body <body>", "Reply body")
    .option("--subject <subject>", "Custom subject (email only; default: auto-generated Re: ...)")
    .option("--attach <path>", `Attach a file to an email reply (repeat; ${ALLOWED_TYPES_HELP}; from your outbox)`, collect)
    .option("--outbox <name>", "Your outbox folder name: files must be in ~/tmp/mail-outbox/<name> (mode 0700)")
    .option("--new-recipient", "Allow attachments to a recipient that is not in the thread or on the mailbox's domain list")
    .option("--reply-to <message_id>", "iMessage inline reply: quote one message of THIS thread (direct 1:1 only; groups, SMS and email refuse)")
    .option("--effect <style>", "iMessage effect (e.g. slam, gentle, confetti; direct Sendblue threads only, the server checks the name)")
    .option("--dry-run", "Check the options and files, print names and sizes, send nothing")
    .action(async (threadId, opts) => {
      try {
        // Check the files first, before any request. Names and sizes only.
        const attachments = inspectAttachments(opts.attach ?? [], opts.outbox);
        if (!opts.mailbox && !opts.from) {
          error("--mailbox or --from is required");
        }
        const payload: Record<string, string> = {
          to: opts.to,
          body: opts.body,
        };
        if (opts.mailbox) {
          payload.mailbox_id = String(opts.mailbox);
        } else if (opts.from) {
          payload.from = opts.from;
        }
        if (opts.subject) payload.subject = opts.subject;
        if (opts.replyTo) {
          if (!/^\d+$/.test(String(opts.replyTo))) error("--reply-to takes a numeric message id");
          payload.reply_to_message_id = String(opts.replyTo);
        }
        if (opts.effect) payload.effect = String(opts.effect);
        if (attachments.length) {
          checkRecipients([opts.to]);
          guardScan(attachments);
          if (opts.newRecipient) payload.allow_new_recipient = "1";
        }
        if (opts.dryRun) {
          const { body, ...fields } = payload;
          success({ dry_run: true, would_send: { thread_id: threadId, ...fields, body_chars: body.length, attachments: describe(attachments) } });
          return;
        }
        const client = createClient();
        const path = `/api/v1/threads/${threadId}/reply`;
        const data = attachments.length ? await client.postForm(path, buildForm(payload, attachments)) : await client.post(path, payload);
        success(data);
      } catch (e: any) {
        error(e.message);
      }
    });
}
