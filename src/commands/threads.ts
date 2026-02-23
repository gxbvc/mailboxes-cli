import { Command } from "commander";
import { createClient } from "../api.js";
import { success, error } from "../output.js";

export function registerThreadsCommand(program: Command): void {
  const threads = program
    .command("threads")
    .description("List inbox threads")
    .option("--status <status>", "Filter by status (inbox, archived, trash)", "inbox")
    .option("--starred", "Only starred threads")
    .option("--mailbox <id>", "Filter by mailbox ID")
    .option("--search <query>", "Full-text search")
    .option("--page <n>", "Page number", "1")
    .option("--per-page <n>", "Results per page", "25")
    .action(async (opts) => {
      try {
        const client = createClient();
        const params: Record<string, string> = {
          status: opts.status,
          page: opts.page,
          per_page: opts.perPage,
        };
        if (opts.starred) params.starred = "true";
        if (opts.mailbox) params.mailbox_id = opts.mailbox;
        if (opts.search) params.q = opts.search;
        const data = await client.get("/api/v1/threads", params);
        success(data);
      } catch (e: any) {
        error(e.message);
      }
    });

  threads
    .command("show <thread_id>")
    .description("Show full thread with all messages")
    .action(async (threadId) => {
      try {
        const client = createClient();
        const data = await client.get(`/api/v1/threads/${threadId}`);
        success(data);
      } catch (e: any) {
        error(e.message);
      }
    });

  threads
    .command("archive <thread_id>")
    .description("Archive a thread")
    .action(async (threadId) => {
      try {
        const client = createClient();
        const data = await client.patch(`/api/v1/threads/${threadId}/archive`);
        success(data);
      } catch (e: any) {
        error(e.message);
      }
    });

  threads
    .command("trash <thread_id>")
    .description("Trash a thread")
    .action(async (threadId) => {
      try {
        const client = createClient();
        const data = await client.patch(`/api/v1/threads/${threadId}/trash`);
        success(data);
      } catch (e: any) {
        error(e.message);
      }
    });

  threads
    .command("star <thread_id>")
    .description("Toggle star on a thread")
    .action(async (threadId) => {
      try {
        const client = createClient();
        const data = await client.patch(`/api/v1/threads/${threadId}/star`);
        success(data);
      } catch (e: any) {
        error(e.message);
      }
    });

  threads
    .command("read <thread_id>")
    .description("Mark thread as read")
    .action(async (threadId) => {
      try {
        const client = createClient();
        const data = await client.patch(`/api/v1/threads/${threadId}/mark_read`);
        success(data);
      } catch (e: any) {
        error(e.message);
      }
    });

  threads
    .command("unread <thread_id>")
    .description("Mark thread as unread")
    .action(async (threadId) => {
      try {
        const client = createClient();
        const data = await client.patch(`/api/v1/threads/${threadId}/mark_unread`);
        success(data);
      } catch (e: any) {
        error(e.message);
      }
    });

  threads
    .command("move-to-inbox <thread_id>")
    .description("Move thread back to inbox")
    .action(async (threadId) => {
      try {
        const client = createClient();
        const data = await client.patch(`/api/v1/threads/${threadId}/move_to_inbox`);
        success(data);
      } catch (e: any) {
        error(e.message);
      }
    });
}
