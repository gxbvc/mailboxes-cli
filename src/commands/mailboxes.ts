import { Command } from "commander";
import { createClient } from "../api.js";
import { success, error } from "../output.js";

export function registerMailboxesCommand(program: Command): void {
  const mailboxes = program
    .command("mailboxes")
    .description("List all mailboxes")
    .option("--domain <id>", "Filter by domain ID")
    .action(async (opts) => {
      try {
        const client = createClient();
        const params: Record<string, string> = {};
        if (opts.domain) {
          params.domain_id = opts.domain;
        }
        const data = await client.get("/api/v1/mailboxes", Object.keys(params).length ? params : undefined);
        success(data);
      } catch (e: any) {
        error(e.message);
      }
    });

  mailboxes
    .command("show <id>")
    .description("Show a single mailbox")
    .action(async (id) => {
      try {
        const client = createClient();
        const data = await client.get(`/api/v1/mailboxes/${id}`);
        success(data);
      } catch (e: any) {
        error(e.message);
      }
    });
}
