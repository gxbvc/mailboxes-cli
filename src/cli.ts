import { Command } from "commander";
import { registerProfileCommand } from "./commands/profile.js";

const program = new Command();
program
  .name("mailboxes-cli")
  .version("0.1.0")
  .description("CLI for managing email via Mailgun Mailboxes");

registerProfileCommand(program);
program.parse();
