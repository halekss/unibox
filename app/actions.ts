"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db.ts";
import { scanFoldersForCleanup, tagInbox } from "@/lib/classify.ts";
import { applyAppFolders, syncAll, trashEmail } from "@/lib/mailbox.ts";

function selection(form: FormData) {
  return { tag: String(form.get("tag")), ids: form.getAll("ids").map(Number).filter(Number.isInteger) };
}

// Files the checked emails into the (possibly renamed) folder: recorded in the app first, then created and
// moved in the mailbox. Emails the mailbox refused stay filed in the app with an "à appliquer" badge.
export async function confirmProposal(form: FormData) {
  const { tag, ids } = selection(form);
  const name = String(form.get("name") ?? "").trim().replace(/\/+$/, "");
  if (!name || ids.length === 0) return;
  await db.query("UPDATE emails SET app_folder = $1, tags = tags - $2 WHERE id = ANY($3)", [name, tag, ids]);
  const { failed } = await applyAppFolders(ids);
  refreshPages();
  if (failed.length) throw new Error(`Rangé dans l'app, mais ${failed.length} mail(s) non déplacé(s) dans leur boîte : ${failed[0].error}`);
}

// Retries every email filed in the app but not yet moved in its mailbox.
export async function applyPendingToOutlook() {
  const { failed } = await applyAppFolders();
  refreshPages();
  if (failed.length) throw new Error(`${failed.length} mail(s) non déplacé(s) dans leur boîte : ${failed[0].error}`);
}

// Refused emails go back in the analysis queue: the suggestion and the "ai:" marker are replaced by a
// "rejected:<suggestion>" tag, which counts refusals and tells the model not to propose it again.
export async function rejectProposal(form: FormData) {
  const { tag, ids } = selection(form);
  if (ids.length === 0) return;
  await db.query(
    `UPDATE emails SET tags = (tags - $1 - 'ai:qwen2.5:14b') || jsonb_build_array('rejected:' || $1) WHERE id = ANY($2)`,
    [tag, ids],
  );
  refreshPages();
}

// One AI batch at a time (both share the GPU).
// ponytail: in-process lock, enough for one local dev server; move to a DB lock if the app ever runs on several processes.
let analyzing = false;

async function runBatch(batch: () => Promise<unknown>) {
  if (analyzing) return null;
  analyzing = true;
  try {
    await batch();
  } finally {
    analyzing = false;
  }
  refreshPages();
  return null;
}

export async function analyzeInbox(_prev: null): Promise<null> {
  return runBatch(() => tagInbox(20));
}

export async function scanForCleanup(_prev: null): Promise<null> {
  return runBatch(() => scanFoldersForCleanup(20));
}

function refreshPages() {
  revalidatePath("/", "layout"); // every page: the sidebar counters are in the layout
}

export async function syncNow() {
  const failed = (await syncAll()).filter((r) => "error" in r);
  refreshPages();
  if (failed.length) throw new Error(`Synchro impossible pour ${failed[0].email} : ${(failed[0] as { error: string }).error}`);
}

// Bound per email: deleteEmail.bind(null, id).
export async function deleteEmail(id: number) {
  await trashEmail(id);
  refreshPages();
}

export async function deleteSelected(form: FormData) {
  for (const id of form.getAll("ids").map(Number).filter(Number.isInteger)) await trashEmail(id);
  refreshPages();
}

// "keep" is permanent: the email is never offered for deletion again (see toTags).
export async function keepSelected(form: FormData) {
  const ids = form.getAll("ids").map(Number).filter(Number.isInteger);
  await db.query(
    `UPDATE emails SET tags = jsonb_path_query_array(tags, '$[*] ? (!(@ starts with "delete_suggested:"))') || '["keep"]'
     WHERE id = ANY($1) AND NOT tags ? 'keep'`,
    [ids],
  );
  refreshPages();
}
