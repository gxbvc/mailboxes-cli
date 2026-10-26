import { Command } from "commander";
import { createClient, MailboxesAPI } from "../api.js";
import { success, error } from "../output.js";

// The mailbox-key commands: the mailbox comes from the key, so there is no
// --mailbox. The key is a per-mailbox key (mbk_...) from the
// MAILBOXES_MAILBOX_KEY env var (or .env); it is never printed. The user key
// (MAILBOXES_API_KEY) keeps working for every pre-existing command.
export function mailboxKeyClient(): MailboxesAPI {
  const key = process.env.MAILBOXES_MAILBOX_KEY;
  if (!key) {
    error("MAILBOXES_MAILBOX_KEY is not set. Action commands need a per-mailbox key (mbk_...); add it to .env");
  }
  return createClient(key);
}

export function registerActionsCommands(program: Command): void {
  program
    .command("react <message_id>")
    .description("React to an inbound message: love/like/dislike/laugh/emphasize/question or one emoji; - prefix removes (mailbox key)")
    .requiredOption("--reaction <reaction>", "Reaction name or emoji, - prefix to remove")
    .action(async (messageId, opts) => {
      try {
        const data = await mailboxKeyClient().post(`/api/v1/mailbox/messages/${encodeURIComponent(messageId)}/reactions`, {
          reaction: opts.reaction,
        });
        success(data);
      } catch (e: any) {
        error(e.message, e.code);
      }
    });

  program
    .command("typing")
    .description("Start or stop a typing indicator for one recipient, 1:1 only (mailbox key)")
    .requiredOption("--to <e164>", "Recipient E.164 phone")
    .option("--stop", "Stop the indicator")
    .action(async (opts) => {
      try {
        const data = await mailboxKeyClient().post("/api/v1/mailbox/typing", {
          to: opts.to,
          state: opts.stop ? "stop" : "start",
        });
        success(data);
      } catch (e: any) {
        error(e.message, e.code);
      }
    });

  program
    .command("mark-read")
    .description("Mark the conversation with one recipient as read, 1:1 only (mailbox key)")
    .requiredOption("--to <e164>", "Recipient E.164 phone")
    .action(async (opts) => {
      try {
        const data = await mailboxKeyClient().post("/api/v1/mailbox/read", { to: opts.to });
        success(data);
      } catch (e: any) {
        error(e.message, e.code);
      }
    });

  program
    .command("capabilities")
    .description("Show what this mailbox's provider supports (mailbox key)")
    .action(async () => {
      try {
        const data = await mailboxKeyClient().get("/api/v1/mailbox/capabilities");
        success(data);
      } catch (e: any) {
        error(e.message, e.code);
      }
    });

  program
    .command("health")
    .description("This line's status and reputation (mailbox key, Linq)")
    .action(async () => {
      try {
        const data = await mailboxKeyClient().get("/api/v1/mailbox/health");
        success(data);
      } catch (e: any) {
        error(e.message, e.code);
      }
    });

  program
    .command("check")
    .description("Check iMessage/RCS availability for one recipient (mailbox key, Linq)")
    .requiredOption("--to <e164>", "Recipient E.164 phone (or email for imessage)")
    .option("--service <service>", "imessage or rcs (default: both)")
    .action(async (opts) => {
      try {
        const params: Record<string, string> = { to: opts.to };
        if (opts.service) params.service = String(opts.service);
        const data = await mailboxKeyClient().get("/api/v1/mailbox/capabilities/check", params);
        success(data);
      } catch (e: any) {
        error(e.message, e.code);
      }
    });
}
