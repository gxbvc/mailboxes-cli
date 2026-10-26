import { Command } from "commander";
import { success, error } from "../output.js";
import { mailboxKeyClient } from "./actions.js";

// act: one verb on one message or thread.
//   act MESSAGE_ID react love
//   act MESSAGE_ID unreact --reaction love
//   act read --thread THREAD_ID
//   act typing --thread THREAD_ID [--stop]
// --thread names the thread and is required for the thread verbs.
export function registerActCommand(program: Command): void {
  program
    .command("act [target] [verb] [arg]")
    .description("Act on a message or thread (mailbox key): act MESSAGE_ID react love | act MESSAGE_ID unreact --reaction love | act MESSAGE_ID edit --text T | act MESSAGE_ID delete_record | act read --thread ID | act typing --thread ID [--stop] | act location-request --thread ID")
    .option("--thread <thread_id>", "The thread id (required for read and typing)")
    .option("--reaction <reaction>", "The reaction to remove (unreact)")
    .option("--text <text>", "The new text (edit)")
    .option("--stop", "Stop the typing indicator")
    .action(async (target, verb, arg, opts) => {
      try {
        verb = verb ?? target;
        const messageAction = verb === "react" || verb === "unreact" || verb === "edit" || verb === "unsend" || verb === "delete_record";

        if (messageAction) {
          if (opts.thread) {
            error(`${verb} acts on a message: act MESSAGE_ID ${verb} ...`);
            return;
          }
          if (!target) {
            error(`usage: act MESSAGE_ID ${verb} ...`);
            return;
          }
          let payload: Record<string, unknown>;
          if (verb === "edit") {
            if (!opts.text) {
              error("edit needs the new text: act MESSAGE_ID edit --text ...");
              return;
            }
            payload = { type: "edit", text: opts.text };
          } else if (verb === "unsend" || verb === "delete_record") {
            // The server renames unsend: it removes Linq's stored copy; the
            // person still sees the message.
            payload = { type: "delete_record" };
          } else {
            const reaction = verb === "unreact" ? (opts.reaction ?? arg) : arg;
            if (!reaction) {
              error("unreact needs the reaction name: act MESSAGE_ID unreact --reaction love");
              return;
            }
            payload = { type: verb, reaction };
          }
          const data = await mailboxKeyClient().post(`/api/v1/mailbox/messages/${encodeURIComponent(target)}/actions`, payload);
          success(data);
          return;
        }

        if (verb === "location-request") {
          const threadId = opts.thread;
          if (!threadId) {
            error("location-request acts on a thread: act location-request --thread THREAD_ID");
            return;
          }
          const data = await mailboxKeyClient().post(`/api/v1/mailbox/threads/${encodeURIComponent(threadId)}/actions`, {
            type: "location_request",
          });
          success(data);
          return;
        }

        if (verb === "location") {
          const threadId = opts.thread;
          if (!threadId) {
            error("location reads one thread: act location --thread THREAD_ID");
            return;
          }
          const data = await mailboxKeyClient().get(`/api/v1/mailbox/threads/${encodeURIComponent(threadId)}/location`);
          success(data);
          return;
        }

        if (verb === "read" || verb === "typing") {
          const threadId = opts.thread;
          if (!threadId) {
            error(`${verb} acts on a thread: act ${verb} --thread THREAD_ID`);
            return;
          }
          const payload: Record<string, unknown> = { type: verb };
          if (verb === "typing") payload.state = opts.stop ? "stop" : "start";
          const data = await mailboxKeyClient().post(`/api/v1/mailbox/threads/${encodeURIComponent(threadId)}/actions`, payload);
          success(data);
          return;
        }

        error("unknown verb; use react, unreact, read or typing");
      } catch (e: any) {
        error(e.message, e.code);
      }
    });
}
