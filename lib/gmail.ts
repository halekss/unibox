// Gmail over plain REST (no SDK). Labels are mapped onto the same folder paths as Outlook:
// INBOX -> "Boîte de réception", user label "A/B" -> "Boîte de réception/A/B".
import { db } from "./db.ts";
import { INBOX } from "./classify.ts";
import { type Account, freshToken, postToken, saveTokens } from "./accounts.ts";

const API = "https://gmail.googleapis.com/gmail/v1/users/me";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
// gmail.modify: read, label and trash (no permanent delete).
const SCOPE = "https://www.googleapis.com/auth/gmail.modify";
// Messages the app mirrors: the Inbox plus anything carrying a user label (same tree as Outlook's Inbox).
const IN_TREE = "in:inbox OR has:userlabels";

export function authorizeUrl(state: string): string {
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent", // forces a refresh token even on reconnection
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

const tokenRequest = (params: Record<string, string>) =>
  postToken(TOKEN_URL, { client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, ...params });

export const getAccessToken = (acc: Account) =>
  freshToken(acc, (refresh_token) => tokenRequest({ grant_type: "refresh_token", refresh_token }));

class GmailError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

// Per-minute quota errors come back as 429 or as 403 "Quota exceeded"/"rateLimitExceeded".
export const isRateLimit = (status: number, message = "") => status === 429 || (status === 403 && /quota|rate ?limit/i.test(message));

async function call(token: string, path: string, init: RequestInit = {}, attempt = 0): Promise<any> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message: string = body.error?.message ?? res.statusText;
    // The quota is per minute: wait (Retry-After, else 15s, 30s, 60s...) and retry, up to 5 times.
    if (isRateLimit(res.status, message) && attempt < 5) {
      const wait = Number(res.headers.get("retry-after")) || 15 * 2 ** Math.min(attempt, 2);
      await new Promise((r) => setTimeout(r, wait * 1000));
      return call(token, path, init, attempt + 1);
    }
    throw new GmailError(res.status, `Gmail ${res.status}: ${message}`);
  }
  return res.status === 204 ? null : res.json();
}

const api = async (acc: Account, path: string, init?: RequestInit) => call(await getAccessToken(acc), path, init);

export async function connectAccount(code: string): Promise<string> {
  const t = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: process.env.GOOGLE_REDIRECT_URI! });
  if (!t.refresh_token) throw new Error("Google n'a pas renvoyé de refresh token : révoque l'accès de l'app dans ton compte Google puis reconnecte-toi.");
  const { emailAddress } = await call(t.access_token, "/profile");
  await saveTokens("gmail", emailAddress, t);
  return emailAddress;
}

// ---- Message parsing (pure, tested) ----

type Part = { mimeType?: string; filename?: string; body?: { data?: string }; parts?: Part[] };
export type GmailMessage = { id: string; labelIds?: string[]; internalDate: string; payload: Part & { headers?: { name: string; value: string }[] } };

// User label wins over INBOX (a labelled message counts as filed); several labels -> first path alphabetically.
// ponytail: one folder per message; Gmail's extra labels are ignored.
export function folderFor(labelIds: string[] = [], labelPaths: Map<string, string>): string | null {
  if (labelIds.includes("TRASH") || labelIds.includes("SPAM")) return null;
  const user = labelIds.map((id) => labelPaths.get(id)).filter((p): p is string => !!p && p !== INBOX).sort();
  if (user.length) return user[0];
  return labelIds.includes("INBOX") ? INBOX : null;
}

function findBody(part: Part, mime: string): string | null {
  if (part.mimeType === mime && part.body?.data && !part.filename) return Buffer.from(part.body.data, "base64url").toString("utf8");
  for (const p of part.parts ?? []) {
    const found = findBody(p, mime);
    if (found !== null) return found;
  }
  return null;
}

// ponytail: naive HTML -> text for HTML-only emails (Outlook gets Graph's own conversion); good enough for the AI.
export function htmlToText(html: string): string {
  return html
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

export function parseMessage(m: GmailMessage, labelPaths: Map<string, string>) {
  const header = (name: string) => m.payload.headers?.find((h) => h.name.toLowerCase() === name)?.value ?? null;
  const html = findBody(m.payload, "text/html");
  const text = findBody(m.payload, "text/plain") ?? (html ? htmlToText(html) : null);
  return {
    external_id: m.id,
    folder: folderFor(m.labelIds, labelPaths),
    sender: header("from"),
    subject: header("subject"),
    body_html: html,
    body_text: text,
    received_at: new Date(Number(m.internalDate)),
  };
}

// ---- Sync ----

async function labelPaths(acc: Account): Promise<Map<string, string>> {
  const { labels } = await api(acc, "/labels");
  const paths = new Map<string, string>([["INBOX", INBOX]]);
  for (const l of labels) if (l.type === "user") paths.set(l.id, `${INBOX}/${l.name}`);
  return paths;
}

async function upsert(acc: Account, m: ReturnType<typeof parseMessage>): Promise<boolean> {
  const { rows } = await db.query(
    `INSERT INTO emails (account_id, provider, external_id, folder, sender, subject, body_html, body_text, received_at)
     VALUES ($1, 'gmail', $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (account_id, external_id) DO UPDATE SET folder = EXCLUDED.folder
     RETURNING (xmax = 0) AS inserted`,
    [acc.id, m.external_id, m.folder, m.sender, m.subject, m.body_html, m.body_text, m.received_at],
  );
  return rows[0].inserted;
}

// Re-reads one message and mirrors it: upsert while it is in the Inbox tree, delete once it left it (archived
// without label, trashed, deleted).
async function refresh(acc: Account, id: string, paths: Map<string, string>): Promise<"inserted" | "updated" | "deleted"> {
  let m: GmailMessage;
  try {
    m = await api(acc, `/messages/${id}?format=full`);
  } catch (e) {
    if ((e as GmailError).statusCode !== 404) throw e;
    await db.query("DELETE FROM emails WHERE account_id = $1 AND external_id = $2", [acc.id, id]);
    return "deleted";
  }
  const parsed = parseMessage(m, paths);
  if (!parsed.folder) {
    await db.query("DELETE FROM emails WHERE account_id = $1 AND external_id = $2", [acc.id, id]);
    return "deleted";
  }
  return (await upsert(acc, parsed)) ? "inserted" : "updated";
}

// First run: imports every message of the tree (already-imported ids are skipped, so an interrupted import
// resumes cheaply), then stores the mailbox historyId. Next runs: replays Gmail's history since that id.
export async function syncAccount(acc: Account) {
  const paths = await labelPaths(acc);
  const stats = { fetched: 0, inserted: 0, deleted: 0 };
  const count = (r: string) => {
    stats.fetched++;
    if (r === "inserted") stats.inserted++;
    if (r === "deleted") stats.deleted++;
  };

  if (acc.sync_cursor) {
    try {
      const ids = new Set<string>();
      let pageToken = "";
      let historyId = acc.sync_cursor;
      do {
        const q = new URLSearchParams({ startHistoryId: acc.sync_cursor, ...(pageToken && { pageToken }) });
        const page = await api(acc, `/history?${q}`);
        for (const h of page.history ?? [])
          for (const key of ["messagesAdded", "messagesDeleted", "labelsAdded", "labelsRemoved"])
            for (const x of h[key] ?? []) ids.add(x.message.id);
        historyId = page.historyId;
        pageToken = page.nextPageToken ?? "";
      } while (pageToken);
      for (const id of ids) count(await refresh(acc, id, paths));
      await db.query("UPDATE accounts SET sync_cursor = $1 WHERE id = $2", [historyId, acc.id]);
      return stats;
    } catch (e) {
      // 404 = historyId too old: fall back to a full import below.
      if ((e as GmailError).statusCode !== 404) throw e;
    }
  }

  const { historyId } = await api(acc, "/profile");
  const { rows } = await db.query("SELECT external_id FROM emails WHERE account_id = $1", [acc.id]);
  const known = new Set(rows.map((r) => r.external_id));
  let pageToken = "";
  do {
    const q = new URLSearchParams({ q: IN_TREE, maxResults: "500", ...(pageToken && { pageToken }) });
    const page = await api(acc, `/messages?${q}`);
    for (const { id } of page.messages ?? []) if (!known.has(id)) count(await refresh(acc, id, paths));
    pageToken = page.nextPageToken ?? "";
  } while (pageToken);
  await db.query("UPDATE accounts SET sync_cursor = $1 WHERE id = $2", [historyId, acc.id]);
  return stats;
}

// ---- Writes ----

export async function trashMessage(acc: Account, externalId: string): Promise<void> {
  await api(acc, `/messages/${externalId}/trash`, { method: "POST" });
}

// "Moving" in Gmail = adding the folder's label and leaving the Inbox. The label is created if missing.
export async function moveToFolder(acc: Account, externalId: string, path: string, labelIds: Map<string, string>): Promise<void> {
  if (!labelIds.has(path)) {
    const name = path.slice(INBOX.length + 1);
    const { labels } = await api(acc, "/labels");
    const found = labels.find((l: { type: string; name: string }) => l.type === "user" && l.name.toLowerCase() === name.toLowerCase());
    const id = found ? found.id : (await api(acc, "/labels", { method: "POST", body: JSON.stringify({ name }) })).id;
    labelIds.set(path, id);
  }
  await api(acc, `/messages/${externalId}/modify`, {
    method: "POST",
    body: JSON.stringify({ addLabelIds: [labelIds.get(path)], removeLabelIds: ["INBOX"] }),
  });
}
