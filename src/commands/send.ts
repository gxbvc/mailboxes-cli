import { Command } from "commander";
import { createClient } from "../api.js";
import { success, error } from "../output.js";
import { mailboxKeyClient } from "./actions.js";

export function registerSendCommand(program: Command): void {
  program
    .command("send")
    .description("Send email, SMS, or iMessage")
    .option("--mailbox <id>", "Mailbox id (user key; SMS/iMessage; e.g. 133)")
    .option("--from <address>", "From email address (email send)")
    .requiredOption("--to <address>", "Recipient email or E.164 phone")
    .option("--subject <subject>", "Email subject (email only)")
    .option("--body <body>", "Message body (shortcut for one text part)")
    .option("--text <text>", "Text part (repeat; joins into the message)", (v: string, prev: string[]) => (prev ?? []).concat([v]))
    .option("--image <url>", "Image part url (repeat)", (v: string, prev: string[]) => (prev ?? []).concat([v]))
    .option("--audio <url>", "Audio (voice note) part url", undefined)
    .option("--poll <text>", "Poll option (repeat: --poll A --poll B sends a poll)", (v: string, prev: string[]) => (prev ?? []).concat([v]))
    .option("--cc <cc>", "CC address (email only)")
    .option("--bcc <bcc>", "BCC address (email only)")
    .option("--thread <thread_id>", "Thread to reply into (mailbox-key iMessage send)")
    .option("--effect <style>", "iMessage effect on a mailbox-key send")
    .option("--reply-to <message_id>", "Inline reply to one of this mailbox's messages (mailbox key)")
    .option("--voice-note <url>", "https URL to an audio file: caf, mp3, m4a, aac, wav, aiff, amr (mailbox key)")
    .action(async (opts) => {
      try {
        // The parts shape, effects, inline replies and polls ride on the
        // per-mailbox-key endpoint, where the mailbox comes from the key
        // (MAILBOXES_MAILBOX_KEY). The user-key endpoint does not carry them.
        const mailboxKey = process.env.MAILBOXES_MAILBOX_KEY;
        const wantsParts = Boolean(opts.text?.length || opts.image?.length || opts.poll?.length || opts.audio || opts.voiceNote || opts.effect || opts.replyTo);
        if (wantsParts && !mailboxKey) {
          error("parts/effects/polls need a per-mailbox key in MAILBOXES_MAILBOX_KEY");
          return;
        }
        const hasTarget = Boolean(opts.mailbox || opts.from);
        if (wantsParts || (mailboxKey && !hasTarget)) {
          const parts: Array<Record<string, unknown>> = [];
          for (const text of opts.text ?? []) {
            parts.push({ type: "text", text });
          }
          for (const url of opts.image ?? []) {
            parts.push({ type: "image", url });
          }
          if (opts.audio) parts.push({ type: "audio", url: opts.audio, voice_note: true });
          if (opts.voiceNote) parts.push({ type: "audio", url: opts.voiceNote, voice_note: true });
          if (opts.poll?.length) parts.push({ type: "poll", options: opts.poll });
          // The body shortcut: one text part.
          if (opts.body && !opts.text?.length) parts.unshift({ type: "text", text: opts.body });

          const payload: Record<string, unknown> = { to: opts.to, parts };
          if (opts.thread) payload.thread_id = String(opts.thread);
          if (opts.effect) payload.effect = String(opts.effect);
          if (opts.replyTo) payload.reply_to = String(opts.replyTo);
          const data = await mailboxKeyClient().post("/api/v1/mailbox/messages", payload);
          success(data);
          return;
        }

        if (!hasTarget) {
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
        error(e.message, e.code);
      }
    });
}
