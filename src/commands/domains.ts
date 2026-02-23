import { Command } from "commander";
import { createClient } from "../api.js";
import { success, error } from "../output.js";

export function registerDomainsCommand(program: Command): void {
  const domains = program
    .command("domains")
    .description("List all domains")
    .action(async () => {
      try {
        const client = createClient();
        const data = await client.get("/api/v1/domains");
        success(data);
      } catch (e: any) {
        error(e.message);
      }
    });

  domains
    .command("show <id>")
    .description("Show a domain with its mailboxes")
    .action(async (id) => {
      try {
        const client = createClient();
        const data = await client.get(`/api/v1/domains/${id}`);
        success(data);
      } catch (e: any) {
        error(e.message);
      }
    });

  domains
    .command("delete <id>")
    .description("Delete a domain")
    .action(async (id) => {
      try {
        const client = createClient();
        const data = await client.delete(`/api/v1/domains/${id}`);
        success(data);
      } catch (e: any) {
        error(e.message);
      }
    });

  domains
    .command("reimport")
    .description("Re-import historical emails")
    .option("--days <days>", "Number of days back to reimport", "30")
    .action(async (opts) => {
      try {
        const client = createClient();
        const data = await client.post("/api/v1/domains/reimport", {
          days_back: parseInt(opts.days, 10),
        });
        success(data);
      } catch (e: any) {
        error(e.message);
      }
    });
}
