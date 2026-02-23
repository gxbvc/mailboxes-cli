import { Command } from "commander";
import { createClient } from "../api.js";
import { success, error } from "../output.js";

export function registerMessagesCommand(program: Command): void {
  const messages = program
    .command("messages")
    .description("Manage messages");

  messages
    .command("show <id>")
    .description("Show a single message with full body")
    .action(async (id) => {
      try {
        const client = createClient();
        const data = await client.get(`/api/v1/messages/${id}`);
        success(data);
      } catch (e: any) {
        error(e.message);
      }
    });
}
