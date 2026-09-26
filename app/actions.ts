"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db.ts";
import { tagInbox } from "@/lib/classify.ts";
import { applyAppFolders, trashMessage } from "@/lib/microsoft.ts";

function selection(form: FormData) {
  return { tag: String(form.get("tag")), ids: form.getAll("ids").map(Number).filter(Number.isInteger) };
}

// Files the checked emails into the (possibly renamed) folder: recorded in the app first, then created and
// moved in Outlook. Emails Outlook refused stay filed in the app with an "à appliquer" badge.
export async function confirmProposal(form: FormData) {
  const { tag, ids } = selection(form);
  const name = String(form.get("name") ?? "").trim().replace(/\/+$/, "");
  if (!name || ids.length === 0) return;
  await db.query("UPDATE emails SET app_folder = $1, tags = tags - $2 WHERE id = ANY($3)", [name, tag, ids]);
  const { failed } = await applyAppFolders(ids);
  revalidatePath("/");
  revalidatePath("/boite");
  if (failed.length) throw new Error(`Rangé dans l'app, mais ${failed.length} mail(s) non déplacé(s) dans Outlook : ${failed[0].error}`);
}

// Retries every email filed in the app but not yet moved in Outlook.
export async function applyPendingToOutlook() {
  const { failed } = await applyAppFolders();
  revalidatePath("/boite");
  if (failed.length) throw new Error(`${failed.length} mail(s) non déplacé(s) dans Outlook : ${failed[0].error}`);
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
  revalidatePath("/");
}

// ponytail: in-process lock, enough for one local dev server; move to a DB lock if the app ever runs on several processes.
let analyzing = false;

export async function analyzeInbox(_prev: null): Promise<null> {
  if (analyzing) return null;
  analyzing = true;
  try {
    await tagInbox(20);
  } finally {
    analyzing = false;
  }
  revalidatePath("/");
  return null;
}

// Moves the email to Outlook's trash, then removes it from the app.
async function trashOne(id: number) {
  const { rows } = await db.query(
    `SELECT e.external_id, a.* FROM emails e JOIN accounts a ON a.id = e.account_id WHERE e.id = $1`,
    [id],
  );
  if (!rows[0]) return;
  try {
    await trashMessage(rows[0], rows[0].external_id);
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    // 404: already gone from the mailbox, so removing it from the app is still right.
    if (status !== 404) {
      throw new Error(
        status === 403 || /invalid_grant|consent/i.test((e as Error).message)
          ? "Permission Outlook manquante : reconnecte-toi via /api/auth/login pour accepter Mail.ReadWrite."
          : `Suppression dans Outlook impossible : ${(e as Error).message}`,
      );
    }
  }
  await db.query("DELETE FROM emails WHERE id = $1", [id]);
}

function refreshPages() {
  for (const path of ["/", "/boite", "/nettoyage"]) revalidatePath(path);
}

// Bound per email: deleteEmail.bind(null, id).
export async function deleteEmail(id: number) {
  await trashOne(id);
  refreshPages();
}

export async function deleteSelected(form: FormData) {
  for (const id of form.getAll("ids").map(Number).filter(Number.isInteger)) await trashOne(id);
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
