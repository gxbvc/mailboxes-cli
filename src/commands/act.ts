import { Command } from "commander";
import { statSync, readFileSync } from "node:fs";
import { basename } from "node:path";
import { success, error } from "../output.js";
import { mailboxKeyClient } from "./actions.js";

// A group photo (Sendblue, mailboxes PR 50). Client-side pre-checks only:
// the server stays the real gate (the reviewed staff group, the size and
// the pixel caps, the re-encode that strips metadata).
const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
// Magic bytes only - the extension is not trusted.
const PHOTO_MAGICS: Array<{ magic: Buffer; type: string; label: string }> = [
  { magic: Buffer.from([0xff, 0xd8, 0xff]), type: "image/jpeg", label: "JPEG" },
  { magic: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), type: "image/png", label: "PNG" },
  { magic: Buffer.from("GIF87a"), type: "image/gif", label: "GIF" },
  { magic: Buffer.from("GIF89a"), type: "image/gif", label: "GIF" },
];

// The privacy line (Security, Nov 8): a group photo is visible to EVERY
// member and Sendblue serves it from an unlisted public URL.
export const GROUP_PHOTO_WARNING =
  "The photo becomes visible to every group member, and Sendblue serves it from an unlisted public URL: " +
  "only a plain team image, never a person's photo without that person's yes, never client data. " +
  "It works only on the reviewed staff group (the server checks).";

// Reads and checks the photo BEFORE any request: a regular file, at most
// 5 MB, JPEG/PNG/GIF by magic bytes. Throws with a clear message.
function buildGroupPhotoForm(path: string): FormData {
  let stat;
  try {
    stat = statSync(path);
  } catch {
    throw new Error(`the photo file does not exist: ${path}`);
  }
  if (!stat.isFile()) {
    throw new Error(`the photo must be a regular file: ${path}`);
  }
  if (stat.size > PHOTO_MAX_BYTES) {
    throw new Error(`the photo is limited to 5 MB (the file is ${stat.size} bytes); nothing was sent`);
  }
  const bytes = readFileSync(path);
  const found = PHOTO_MAGICS.find((m) => bytes.subarray(0, m.magic.length).equals(m.magic));
  if (!found) {
    throw new Error("the photo must be a JPEG, PNG or GIF image (checked by content, not by extension); nothing was sent");
  }
  const form = new FormData();
  form.append("type", "group_photo");
  form.append("file", new Blob([bytes], { type: found.type }), basename(path));
  return form;
}

// act: one verb on one message or thread.
//   act MESSAGE_ID react love
//   act MESSAGE_ID unreact --reaction love
//   act read --thread THREAD_ID
//   act typing --thread THREAD_ID [--stop]
// --thread names the thread and is required for the thread verbs.
export function registerActCommand(program: Command): void {
  program
    .command("act [target] [verb] [arg]")
    .description("Act on a message or thread (mailbox key): act MESSAGE_ID react love | act MESSAGE_ID unreact --reaction love | act MESSAGE_ID edit --text T | act read --thread ID | act typing --thread ID [--stop] | act location-request --thread ID | act rename --thread ID --name NAME | act leave --thread ID | act group-photo --thread ID --file IMAGE")
    .option("--thread <thread_id>", "The thread id (required for read, typing, location-request, rename, leave and group-photo)")
    .option("--reaction <reaction>", "The reaction to remove (unreact)")
    .option("--text <text>", "The new text (edit)")
    .option("--name <name>", "The new group name (rename)")
    .option("--file <path>", `The image file (group-photo; JPEG/PNG/GIF, at most 5 MB). ${GROUP_PHOTO_WARNING}`)
    .option("--stop", "Stop the typing indicator")
    .action(async (target, verb, arg, opts) => {
      try {
        verb = verb ?? target;
        if (verb === "unsend" || verb === "delete_record") {
          // Removed (Christian, 08:11): Linq's delete does not unsend - the
          // person still sees the message - so the action was misleading.
          error("delete_record was removed: Linq's delete does not unsend - the person still sees the message, so the action was misleading.");
          return;
        }
        const messageAction = verb === "react" || verb === "unreact" || verb === "edit";

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

        if (verb === "rename") {
          const threadId = opts.thread;
          if (!threadId || !opts.name) {
            error("rename acts on a group thread: act rename --thread THREAD_ID --name \"The Name\"");
            return;
          }
          const data = await mailboxKeyClient().post(`/api/v1/mailbox/threads/${encodeURIComponent(threadId)}/actions`, {
            type: "rename", name: opts.name,
          });
          success(data);
          return;
        }

        if (verb === "leave") {
          const threadId = opts.thread;
          if (!threadId) {
            error("leave acts on a group thread: act leave --thread THREAD_ID");
            return;
          }
          const data = await mailboxKeyClient().post(`/api/v1/mailbox/threads/${encodeURIComponent(threadId)}/actions`, {
            type: "leave",
          });
          success(data);
          return;
        }

        if (verb === "group-photo") {
          const threadId = opts.thread;
          if (!threadId || !opts.file) {
            error(`group-photo acts on a group thread: act group-photo --thread THREAD_ID --file IMAGE. ${GROUP_PHOTO_WARNING}`);
            return;
          }
          // Pre-checks may throw; nothing is sent until they pass.
          const form = buildGroupPhotoForm(opts.file);
          const data = await mailboxKeyClient().postForm(`/api/v1/mailbox/threads/${encodeURIComponent(threadId)}/actions`, form);
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

        error("unknown verb; use react, unreact, edit, read, typing, location-request, rename, leave or group-photo");
      } catch (e: any) {
        error(e.message, e.code);
      }
    });
}
