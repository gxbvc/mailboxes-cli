import { Command } from "commander";
import { createClient } from "../api.js";
import { success, error } from "../output.js";

export function registerReplyCommand(program: Command): void {
  program
    .command("reply <thread_id>")
    .description("Reply to a thread")
    .requiredOption("--from <mailbox_id>", "Mailbox ID to send from")
    .requiredOption("--to <address>", "Recipient email address")
    .requiredOption("--body <body>", "Reply body")
    .option("--subject <subject>", "Custom subject (default: auto-generated Re: ...)")
    .action(async (threadId, opts) => {
      try {
        const client = createClient();
        const payload: Record<string, string> = {
          mailbox_id: opts.from,
          to: opts.to,
          body: opts.body,
        };
        if (opts.subject) payload.subject = opts.subject;
        const data = await client.post(`/api/v1/threads/${threadId}/reply`, payload);
        success(data);
      } catch (e: any) {
        error(e.message);
      }
    });
}
