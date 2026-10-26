import { Command } from "commander";
import { createClient } from "../api.js";
import { success, error } from "../output.js";

export function registerPollCommand(program: Command): void {
  program
    .command("poll")
    .description("Send a poll to one recipient (mailbox key, Linq only)")
    .requiredOption("--to <e164>", "Recipient E.164 phone")
    .option("--question <text>", "Question sent as a normal text before the poll")
    .requiredOption("--option <text>", "Poll option (repeat: --option A --option B); 2 to 10 options, 1 to 100 chars each", (value, previous: string[]) => (previous ?? []).concat([value]))
    .action(async (opts) => {
      try {
        const mailboxKey = process.env.MAILBOXES_MAILBOX_KEY;
        if (!mailboxKey) {
          error("poll needs a per-mailbox key in MAILBOXES_MAILBOX_KEY");
          return;
        }
        const payload: Record<string, unknown> = {
          to: opts.to,
          options: opts.option,
        };
        if (opts.question) payload.question = opts.question;
        const data = await createClient(mailboxKey).post("/api/v1/mailbox/polls", payload);
        success(data);
      } catch (e: any) {
        error(e.message, e.code);
      }
    });
}
