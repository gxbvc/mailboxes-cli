import { Command } from "commander";
import { createClient } from "../api.js";
import { success, error } from "../output.js";

export function registerSendCommand(program: Command): void {
  program
    .command("send")
    .description("Send a new email")
    .requiredOption("--from <address>", "Email address to send from (any address on your verified domains)")
    .requiredOption("--to <address>", "Recipient email address")
    .requiredOption("--subject <subject>", "Email subject")
    .requiredOption("--body <body>", "Email body")
    .option("--cc <cc>", "CC address")
    .option("--bcc <bcc>", "BCC address")
    .action(async (opts) => {
      try {
        const client = createClient();
        const payload: Record<string, string> = {
          from: opts.from,
          to: opts.to,
          subject: opts.subject,
          body: opts.body,
        };
        if (opts.cc) payload.cc = opts.cc;
        if (opts.bcc) payload.bcc = opts.bcc;
        const data = await client.post("/api/v1/messages", payload);
        success(data);
      } catch (e: any) {
        error(e.message);
      }
    });
}
