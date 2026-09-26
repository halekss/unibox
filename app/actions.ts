"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db.ts";
import { tagInbox } from "@/lib/classify.ts";

function selection(form: FormData) {
  return { tag: String(form.get("tag")), ids: form.getAll("ids").map(Number).filter(Number.isInteger) };
}

// Files the checked emails into the (possibly renamed) folder, in the app only: Outlook is untouched.
export async function confirmProposal(form: FormData) {
  const { tag, ids } = selection(form);
  const name = String(form.get("name") ?? "").trim();
  if (!name || ids.length === 0) return;
  await db.query("UPDATE emails SET app_folder = $1, tags = tags - $2 WHERE id = ANY($3)", [name, tag, ids]);
  revalidatePath("/");
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
