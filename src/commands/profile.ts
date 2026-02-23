import { Command } from "commander";
import { createClient } from "../api.js";
import { success, error } from "../output.js";

export function registerProfileCommand(program: Command): void {
  const profile = program
    .command("profile")
    .description("Show current user profile")
    .action(async () => {
      try {
        const client = createClient();
        const data = await client.get("/api/v1/profile");
        success(data);
      } catch (e: any) {
        error(e.message);
      }
    });

  profile
    .command("update")
    .description("Update profile")
    .requiredOption("--name <name>", "New profile name")
    .action(async (opts) => {
      try {
        const client = createClient();
        const data = await client.patch("/api/v1/profile", { name: opts.name });
        success(data);
      } catch (e: any) {
        error(e.message);
      }
    });
}
