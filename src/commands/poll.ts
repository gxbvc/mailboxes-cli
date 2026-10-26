import { Command } from "commander";
import { success, error } from "../output.js";
import { mailboxKeyClient } from "./actions.js";

const E164 = /^\+[1-9]\d{7,14}$/;

export function registerPollCommand(program: Command): void {
  program
    .command("poll")
    .description("Send a poll to one recipient (mailbox key, Linq only)")
    .requiredOption("--to <e164>", "Recipient E.164 phone")
    .option("--question <text>", "Question sent as a normal text before the poll")
    .requiredOption("--option <text>", "Poll option (repeat: --option A --option B); 2 to 10 options, 1 to 100 chars each", (value, previous: string[]) => (previous ?? []).concat([value]))
    .action(async (opts) => {
      try {
        if (!E164.test(opts.to)) {
          error("--to must be one E.164 phone number, for example +15551234567");
        }
        const options: string[] = opts.option ?? [];
        if (options.length < 2 || options.length > 10) {
          error("a poll needs 2 to 10 options");
          return;
        }
        if (options.some((option) => option.length < 1 || option.length > 100)) {
          error("each poll option must be 1 to 100 characters");
        }

        const payload: Record<string, unknown> = {
          to: opts.to,
          options,
        };
        if (opts.question) payload.question = opts.question;
        const data = await mailboxKeyClient().post("/api/v1/mailbox/polls", payload);
        success(data);
      } catch (e: any) {
        error(e.message, e.code);
      }
    });
}
