import { Command } from "commander";
import { createClient } from "../api.js";
import { success, error } from "../output.js";

export function registerSendCommand(program: Command): void {
  program
    .command("send")
    .description("Send email, SMS, or iMessage")
    .option("--mailbox <id>", "Mailbox id (required for SMS/iMessage; e.g. 133)")
    .option("--from <address>", "From email address (email send)")
    .requiredOption("--to <address>", "Recipient email or E.164 phone")
    .option("--subject <subject>", "Email subject (email only)")
    .requiredOption("--body <body>", "Message body")
    .option("--cc <cc>", "CC address (email only)")
    .option("--bcc <bcc>", "BCC address (email only)")
    .action(async (opts) => {
      try {
        if (!opts.mailbox && !opts.from) {
          error("--mailbox or --from is required");
        }
        if (!opts.mailbox && !opts.subject) {
          error("--subject is required when sending email with --from");
        }
        const client = createClient();
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
        const data = await client.post("/api/v1/messages", payload);
        success(data);
      } catch (e: any) {
        error(e.message);
      }
    });
}
