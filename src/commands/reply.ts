import { Command } from "commander";
import { createClient } from "../api.js";
import { success, error } from "../output.js";

export function registerReplyCommand(program: Command): void {
  program
    .command("reply <thread_id>")
    .description("Reply to a thread")
    .option("--mailbox <id>", "Mailbox id (required for SMS/iMessage; e.g. 133)")
    .option("--from <address>", "From email address (email reply)")
    .requiredOption("--to <address>", "Recipient email or E.164 phone")
    .requiredOption("--body <body>", "Reply body")
    .option("--subject <subject>", "Custom subject (email only; default: auto-generated Re: ...)")
    .action(async (threadId, opts) => {
      try {
        if (!opts.mailbox && !opts.from) {
          error("--mailbox or --from is required");
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
        const data = await client.post(`/api/v1/threads/${threadId}/reply`, payload);
        success(data);
      } catch (e: any) {
        error(e.message);
      }
    });
}
