import { Command } from "commander";
import { registerProfileCommand } from "./commands/profile.js";
import { registerDomainsCommand } from "./commands/domains.js";
import { registerMailboxesCommand } from "./commands/mailboxes.js";
import { registerThreadsCommand } from "./commands/threads.js";
import { registerMessagesCommand } from "./commands/messages.js";
import { registerSendCommand } from "./commands/send.js";
import { registerReplyCommand } from "./commands/reply.js";
import { registerActionsCommands } from "./commands/actions.js";
import { registerPollCommand } from "./commands/poll.js";
import { registerActCommand } from "./commands/act.js";
import { registerReplyAllCommand } from "./commands/reply-all.js";

const program = new Command();
program
  .name("mailboxes-cli")
  .version("0.1.0")
  .description("CLI for email, SMS, and iMessage via Mailgun Mailboxes");

registerProfileCommand(program);
registerDomainsCommand(program);
registerMailboxesCommand(program);
registerThreadsCommand(program);
registerMessagesCommand(program);
registerSendCommand(program);
registerReplyCommand(program);
registerActionsCommands(program);
registerPollCommand(program);
registerActCommand(program);
registerReplyAllCommand(program);
program.parse();
