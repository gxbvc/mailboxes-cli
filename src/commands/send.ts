import { Command } from "commander";
import { createClient } from "../api.js";
import { success, error } from "../output.js";

export function registerSendCommand(program: Command): void {
  program
    .command("send")
    .description("Send email, SMS, or iMessage")
    .option("--mailbox <id>", "Mailbox id (user key; SMS/iMessage; e.g. 133)")
    .option("--from <address>", "From email address (email send)")
    .requiredOption("--to <address>", "Recipient email or E.164 phone")
    .option("--subject <subject>", "Email subject (email only)")
    .requiredOption("--body <body>", "Message body")
    .option("--cc <cc>", "CC address (email only)")
    .option("--bcc <bcc>", "BCC address (email only)")
    .option("--thread <thread_id>", "Thread to reply into (mailbox-key iMessage send)")
    .option("--effect <style>", "iMessage effect on a mailbox-key send: celebration, fireworks, lasers, love, confetti, balloons, echo, spotlight, invisible, gentle, loud, slam")
    .option("--reply-to <message_id>", "Inline reply to one of this mailbox's messages (mailbox key)")
    .option("--voice-note <url>", "https URL to an audio file: caf, mp3, m4a, aac, wav, aiff, amr (mailbox key)")
    .action(async (opts) => {
      try {
        // The iMessage send options ride on the per-mailbox-key endpoint,
        // where the mailbox comes from the key (MAILBOXES_MAILBOX_KEY). The
        // user-key endpoint does not carry them, so refuse rather than drop.
        const mailboxKey = process.env.MAILBOXES_MAILBOX_KEY;
        const wantsOptions = Boolean(opts.effect || opts.replyTo || opts.voiceNote);
        if (wantsOptions && !mailboxKey) {
          error("--effect/--reply-to/--voice-note need a per-mailbox key in MAILBOXES_MAILBOX_KEY");
          return; // unreachable: error() exits, but never leave a send path open
        }

        if (mailboxKey && (wantsOptions || (!opts.mailbox && !opts.from))) {
          const payload: Record<string, string> = {
            to: opts.to,
            body: opts.body,
          };
          if (opts.thread) payload.thread_id = String(opts.thread);
          if (opts.effect) payload.send_style = String(opts.effect);
          if (opts.replyTo) payload.reply_to_message_id = String(opts.replyTo);
          if (opts.voiceNote) payload.voice_note_url = String(opts.voiceNote);
          const data = await createClient(mailboxKey).post("/api/v1/mailbox/messages", payload);
          success(data);
          return;
        }

        if (!opts.mailbox && !opts.from) {
          error("--mailbox or --from is required");
        }
        if (!opts.mailbox && !opts.subject) {
          error("--subject is required when sending email with --from");
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
        if (opts.cc) payload.cc = opts.cc;
        if (opts.bcc) payload.bcc = opts.bcc;
        const data = await createClient().post("/api/v1/messages", payload);
        success(data);
      } catch (e: any) {
        error(e.message);
      }
    });
}
