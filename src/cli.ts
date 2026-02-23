import { Command } from "commander";
import { registerProfileCommand } from "./commands/profile.js";
import { registerDomainsCommand } from "./commands/domains.js";
import { registerMailboxesCommand } from "./commands/mailboxes.js";
import { registerThreadsCommand } from "./commands/threads.js";
import { registerMessagesCommand } from "./commands/messages.js";

const program = new Command();
program
  .name("mailboxes-cli")
  .version("0.1.0")
  .description("CLI for managing email via Mailgun Mailboxes");

registerProfileCommand(program);
registerDomainsCommand(program);
registerMailboxesCommand(program);
registerThreadsCommand(program);
registerMessagesCommand(program);
program.parse();
