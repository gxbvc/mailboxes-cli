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
    .requiredOption("--to <address>", "Recipient email, E.164 phone; repeat for a group start (Linq)", (v: string, prev: string[]) => (prev ?? []).concat([v]))
    .option("--subject <subject>", "Email subject (email only)")
    .option("--body <body>", "Message body (shortcut for one text part)")
    .option("--text <text>", "Text part (repeat; joins into the message)", (v: string, prev: string[]) => (prev ?? []).concat([v]))
    .option("--image <url>", "Image part url (one per send for now)")
    .option("--audio <url>", "Audio (voice note) part url")
    .option("--sticker <url>", "Sticker part url (Linq; its own message, peelable)")
    .option("--link <url>", "Link part url (Linq; rich preview card, must be alone)")
    .option("--contact", "Share this line's contact card (Linq; the card comes from the mailbox)")
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
        const wantsParts = Boolean(opts.text?.length || opts.image || opts.poll?.length || opts.audio || opts.voiceNote || opts.effect || opts.replyTo || opts.sticker || opts.link || opts.contact);
        if (wantsParts && !mailboxKey) {
          error("parts/effects/polls need a per-mailbox key in MAILBOXES_MAILBOX_KEY");
          return;
        }
        // --thread always needs the mailbox-key endpoint.
        if (opts.thread && !mailboxKey) {
          error("--thread needs a per-mailbox key in MAILBOXES_MAILBOX_KEY");
          return;
        }
        const hasTarget = Boolean(opts.mailbox || opts.from);
        if (wantsParts || (mailboxKey && !hasTarget)) {
          // One handle: a string (a direct send). Two or more: the array
          // starts a group.
          const payload: Record<string, unknown> = { to: opts.to.length === 1 ? opts.to[0] : opts.to };

          // Body-only sends keep the old shape ({to, body}): it works with
          // old and new servers alike (review step A, M5).
          const partsOnly = Boolean(opts.text?.length || opts.image || opts.poll?.length || opts.audio || opts.voiceNote || opts.sticker || opts.link || opts.contact);
          if (partsOnly) {
            const parts: Array<Record<string, unknown>> = [];
            for (const text of opts.text ?? []) {
              parts.push({ type: "text", text });
            }
            // --body with --text: an extra text part after the others.
            if (opts.body) parts.push({ type: "text", text: opts.body });
            if (opts.image) parts.push({ type: "image", url: opts.image });
            if (opts.audio) parts.push({ type: "audio", url: opts.audio, voice_note: true });
            if (opts.voiceNote) parts.push({ type: "audio", url: opts.voiceNote, voice_note: true });
            if (opts.sticker) parts.push({ type: "sticker", url: opts.sticker });
            if (opts.link) parts.push({ type: "link", url: opts.link });
            if (opts.contact) parts.push({ type: "contact" });
            if (opts.poll?.length) parts.push({ type: "poll", options: opts.poll });
            payload.parts = parts;
            if (opts.thread) payload.thread_id = String(opts.thread);
            if (opts.effect) payload.effect = String(opts.effect);
            if (opts.replyTo) payload.reply_to = String(opts.replyTo);
          } else {
            // --body with --effect/--reply-to/--voice-note: the legacy field
            // names, read by old and new servers alike (R2-M2, R2-S1).
            payload.body = opts.body;
            if (opts.thread) payload.thread_id = String(opts.thread);
            if (opts.effect) payload.send_style = String(opts.effect);
            if (opts.replyTo) payload.reply_to_message_id = String(opts.replyTo);
            if (opts.voiceNote) payload.voice_note_url = String(opts.voiceNote);
          }
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
          to: opts.to[0],
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
