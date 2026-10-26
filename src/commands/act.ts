import { Command } from "commander";
import { success, error } from "../output.js";
import { mailboxKeyClient } from "./actions.js";

// act: one verb on one message or thread.
//   act MESSAGE_ID react love     (also unreact --reaction love)
//   act MESSAGE_ID unsend
//   act --thread THREAD_ID read
//   act --thread THREAD_ID typing [--stop]
export function registerActCommand(program: Command): void {
  const act = program
    .command("act <target>")
    .description("Act on a message or thread (mailbox key). target: a message id, or --thread for a thread action");

  act
    .command("react <reaction>")
    .description("React to a message: love/like/dislike/laugh/emphasize/question or one emoji")
    .option("--thread", "target is a thread id (not valid for react)")
    .action(async (reaction, opts, command) => {
      try {
        if (opts.thread) {
          error("react acts on a message: act MESSAGE_ID react love");
        }
        const messageId = command.parent.args[0];
        const data = await mailboxKeyClient().post(`/api/v1/mailbox/messages/${encodeURIComponent(messageId)}/actions`, {
          type: "react",
          reaction,
        });
        success(data);
      } catch (e: any) {
        error(e.message, e.code);
      }
    });

  act
    .command("unreact")
    .description("Remove a reaction (name it: the providers remove one named reaction)")
    .requiredOption("--reaction <reaction>", "The reaction to remove")
    .action(async (_positional, opts, command) => {
      try {
        const messageId = command.parent.args[0];
        const data = await mailboxKeyClient().post(`/api/v1/mailbox/messages/${encodeURIComponent(messageId)}/actions`, {
          type: "unreact",
          reaction: opts.reaction,
        });
        success(data);
      } catch (e: any) {
        error(e.message, e.code);
      }
    });

  act
    .command("read")
    .description("Mark a thread as read")
    .option("--thread", "target is a thread id")
    .action(async (_positional, opts, command) => {
      try {
        if (!opts.thread) {
          error("read acts on a thread: act --thread THREAD_ID read");
        }
        const threadId = command.parent.args[0];
        const data = await mailboxKeyClient().post(`/api/v1/mailbox/threads/${encodeURIComponent(threadId)}/actions`, {
          type: "read",
        });
        success(data);
      } catch (e: any) {
        error(e.message, e.code);
      }
    });

  act
    .command("typing")
    .description("Start or stop the typing indicator on a thread")
    .option("--thread", "target is a thread id")
    .option("--stop", "Stop the indicator")
    .action(async (_positional, opts, command) => {
      try {
        if (!opts.thread) {
          error("typing acts on a thread: act --thread THREAD_ID typing [--stop]");
        }
        const threadId = command.parent.args[0];
        const data = await mailboxKeyClient().post(`/api/v1/mailbox/threads/${encodeURIComponent(threadId)}/actions`, {
          type: "typing",
          state: opts.stop ? "stop" : "start",
        });
        success(data);
      } catch (e: any) {
        error(e.message, e.code);
      }
    });
}
