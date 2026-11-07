import { Command } from "commander";
import { createClient } from "../api.js";
import { success, error } from "../output.js";

// Typing bubble on a 1:1 Sendblue thread we answer, with the USER key (the
// key tabs reply with). Server rules (mailboxes PR 44): 1:1 only, only
// threads with an earlier outbound message, at most one --on per 10 seconds
// per thread, a session lasts at most 5 minutes from its first --on, and
// --off or a sent reply ends it. Tabs: --on when you start writing a reply,
// --on again about once a minute while you still work, --off if you decide
// not to answer. Sending the reply ends it, so no --off is needed then.
// (The older `typing --to PHONE` command is the router's mailbox-key path.)
export function registerThreadTypingCommand(program: Command): void {
  program
    .command("thread-typing <thread_id>")
    .description("Typing bubble on or off for a 1:1 Sendblue thread we answer (user key; see --help)")
    .requiredOption("--mailbox <id>", "Mailbox id (e.g. 180)")
    .option("--on", "Start or renew the typing bubble")
    .option("--off", "Stop the typing bubble")
    .action(async (threadId, opts) => {
      try {
        if (Boolean(opts.on) === Boolean(opts.off)) error("give exactly one of --on or --off");
        if (!/^\d+$/.test(String(opts.mailbox))) error("--mailbox takes a numeric mailbox id");
        const data = await createClient().post(`/api/v1/threads/${encodeURIComponent(threadId)}/typing`, {
          mailbox_id: Number(opts.mailbox),
          state: opts.on ? "on" : "off",
        });
        success(data);
      } catch (e: any) {
        error(e.message);
      }
    });
}
