// Provider-agnostic mailbox operations: dispatch to Outlook or Gmail by account.
import { db } from "./db.ts";
import { INBOX } from "./classify.ts";
import type { Account, Provider } from "./accounts.ts";
import * as outlook from "./microsoft.ts";
import * as gmail from "./gmail.ts";

type Mailbox = {
  sync: (acc: Account) => Promise<object>;
  trash: (acc: Account, externalId: string) => Promise<void>;
  moveToFolder: (acc: Account, externalId: string, path: string, cache: Map<string, string>) => Promise<void>;
  replyDraft: (acc: Account, externalId: string, text: string) => Promise<void>;
};

const providers: Record<Provider, Mailbox> = {
  outlook: { sync: outlook.syncAccount, trash: outlook.trashMessage, moveToFolder: outlook.moveToFolder, replyDraft: outlook.createReplyDraft },
  gmail: { sync: gmail.syncAccount, trash: gmail.trashMessage, moveToFolder: gmail.moveToFolder, replyDraft: gmail.createReplyDraft },
};

export const mailbox = (acc: Account) => providers[acc.provider];

// Syncs every connected account; one failing account does not stop the others.
export async function syncAll() {
  const { rows } = await db.query("SELECT * FROM accounts ORDER BY id");
  const results = [];
  for (const acc of rows) {
    try {
      results.push({ email: acc.email, provider: acc.provider, ...(await mailbox(acc).sync(acc)) });
    } catch (e) {
      results.push({ email: acc.email, provider: acc.provider, error: (e as Error).message });
    }
  }
  return results;
}

// App folder name -> mailbox path: "Epitech" -> "Boîte de réception/Epitech"; full paths are kept.
export const folderPath = (name: string) => (name === INBOX || name.startsWith(`${INBOX}/`) ? name : `${INBOX}/${name}`);

const ACCOUNT_COLUMNS = "a.id, a.provider, a.email, a.access_token_enc, a.refresh_token_enc, a.expires_at, a.sync_cursor";

// Applies app folders to the real mailbox: creates the folder/label if needed and moves the email there. On
// success the email's folder becomes that path and app_folder is cleared; on failure app_folder stays (retry later).
export async function applyAppFolders(ids?: number[]): Promise<{ moved: number; failed: { id: number; error: string }[] }> {
  const { rows } = await db.query(
    `SELECT e.id AS email_id, e.external_id, e.app_folder, ${ACCOUNT_COLUMNS}
     FROM emails e JOIN accounts a ON a.id = e.account_id
     WHERE e.app_folder IS NOT NULL AND ($1::int[] IS NULL OR e.id = ANY($1))`,
    [ids ?? null],
  );
  const caches = new Map<number, Map<string, string>>();
  const result = { moved: 0, failed: [] as { id: number; error: string }[] };
  for (const r of rows) {
    try {
      const acc: Account = r;
      if (!caches.has(acc.id)) caches.set(acc.id, new Map());
      const path = folderPath(r.app_folder);
      await mailbox(acc).moveToFolder(acc, r.external_id, path, caches.get(acc.id)!);
      await db.query("UPDATE emails SET folder = $1, app_folder = NULL WHERE id = $2", [path, r.email_id]);
      result.moved++;
    } catch (e) {
      result.failed.push({ id: r.email_id, error: (e as Error).message });
    }
  }
  return result;
}

// Undo of a filing: moves the emails back to the Inbox root (mailbox and app) and gives them back their
// proposal tag, so they reappear in À ranger. Emails whose move never reached the mailbox are only reset in the app.
export async function returnToInbox(ids: number[], tag: string): Promise<{ failed: number }> {
  const { rows } = await db.query(
    `SELECT e.id AS email_id, e.external_id, e.folder, e.app_folder, ${ACCOUNT_COLUMNS}
     FROM emails e JOIN accounts a ON a.id = e.account_id WHERE e.id = ANY($1)`,
    [ids],
  );
  const caches = new Map<number, Map<string, string>>();
  let failed = 0;
  for (const r of rows) {
    try {
      const acc: Account = r;
      if (r.folder !== INBOX) {
        if (!caches.has(acc.id)) caches.set(acc.id, new Map());
        await mailbox(acc).moveToFolder(acc, r.external_id, INBOX, caches.get(acc.id)!);
      }
      await db.query(
        `UPDATE emails SET folder = $1, app_folder = NULL,
                tags = CASE WHEN tags ? $2 THEN tags ELSE tags || jsonb_build_array($2::text) END
         WHERE id = $3`,
        [INBOX, tag, r.email_id],
      );
    } catch {
      failed++;
    }
  }
  return { failed };
}

// Sends the email to the mailbox's trash (recoverable), then removes it from the app.
export async function trashEmail(id: number): Promise<void> {
  const { rows } = await db.query(
    `SELECT e.external_id, ${ACCOUNT_COLUMNS} FROM emails e JOIN accounts a ON a.id = e.account_id WHERE e.id = $1`,
    [id],
  );
  if (!rows[0]) return;
  try {
    await mailbox(rows[0]).trash(rows[0], rows[0].external_id);
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    // 404: already gone from the mailbox, so removing it from the app is still right.
    if (status !== 404) {
      throw new Error(
        status === 403 || /invalid_grant|consent|insufficient/i.test((e as Error).message)
          ? `Permission manquante sur ${rows[0].email} : reconnecte ce compte.`
          : `Suppression impossible dans ${rows[0].email} : ${(e as Error).message}`,
      );
    }
  }
  await db.query("DELETE FROM emails WHERE id = $1", [id]);
}

// Saves the (possibly edited) reply as a draft in the email's mailbox, then marks it drafted in the app.
// Never sends: the user sends it from Outlook/Gmail.
export async function saveReplyDraft(id: number, text: string): Promise<void> {
  const { rows } = await db.query(
    `SELECT e.external_id, ${ACCOUNT_COLUMNS} FROM emails e JOIN accounts a ON a.id = e.account_id WHERE e.id = $1`,
    [id],
  );
  if (!rows[0]) throw new Error("Mail introuvable.");
  try {
    await mailbox(rows[0]).replyDraft(rows[0], rows[0].external_id, text);
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    throw new Error(
      status === 403 || /invalid_grant|consent|insufficient/i.test((e as Error).message)
        ? `Permission manquante sur ${rows[0].email} : reconnecte ce compte.`
        : `Brouillon impossible dans ${rows[0].email} : ${(e as Error).message}`,
    );
  }
  await db.query(`UPDATE emails SET triage = triage || jsonb_build_object('draft', $1::text, 'drafted', true) WHERE id = $2`, [text, id]);
}
