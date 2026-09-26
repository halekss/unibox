import { Client } from "@microsoft/microsoft-graph-client";
import { db } from "./db.ts";
import { encrypt, decrypt } from "./crypto.ts";

const AUTHORITY = "https://login.microsoftonline.com/consumers/oauth2/v2.0";
const SCOPES = "offline_access User.Read Mail.Read";

export function authorizeUrl(state: string): string {
  const q = new URLSearchParams({
    client_id: process.env.MS_CLIENT_ID!,
    response_type: "code",
    redirect_uri: process.env.MS_REDIRECT_URI!,
    response_mode: "query",
    scope: SCOPES,
    state,
  });
  return `${AUTHORITY}/authorize?${q}`;
}

type TokenResponse = { access_token: string; refresh_token: string; expires_in: number };

async function tokenRequest(params: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(`${AUTHORITY}/token`, {
    method: "POST",
    body: new URLSearchParams({
      client_id: process.env.MS_CLIENT_ID!,
      client_secret: process.env.MS_CLIENT_SECRET!,
      scope: SCOPES,
      ...params,
    }),
  });
  const json = await res.json();
  // Only the error code/description is surfaced: never the raw body (it can echo tokens).
  if (!res.ok) throw new Error(`Token endpoint: ${json.error}: ${json.error_description}`);
  return json;
}

function graph(accessToken: string): Client {
  return Client.init({ authProvider: (done) => done(null, accessToken) });
}

async function saveTokens(email: string, t: TokenResponse): Promise<number> {
  const { rows } = await db.query(
    `INSERT INTO accounts (provider, email, access_token_enc, refresh_token_enc, expires_at)
     VALUES ('outlook', $1, $2, $3, now() + make_interval(secs => $4))
     ON CONFLICT (provider, email) DO UPDATE SET
       access_token_enc = EXCLUDED.access_token_enc,
       refresh_token_enc = EXCLUDED.refresh_token_enc,
       expires_at = EXCLUDED.expires_at
     RETURNING id`,
    [email, encrypt(t.access_token), encrypt(t.refresh_token), t.expires_in],
  );
  return rows[0].id;
}

export async function connectAccount(code: string): Promise<string> {
  const t = await tokenRequest({
    grant_type: "authorization_code",
    code,
    redirect_uri: process.env.MS_REDIRECT_URI!,
  });
  const me = await graph(t.access_token).api("/me").select("mail,userPrincipalName").get();
  const email: string = me.mail ?? me.userPrincipalName;
  await saveTokens(email, t);
  return email;
}

type Account = {
  id: number;
  email: string;
  access_token_enc: string;
  refresh_token_enc: string;
  expires_at: Date;
};

// Refreshes when the access token has < 5 min left. Microsoft rotates refresh tokens, so both are re-saved.
// `acc` is updated in place so a long sync keeps using the fresh token.
export async function getAccessToken(acc: Account): Promise<string> {
  if (acc.expires_at.getTime() - Date.now() > 5 * 60_000) return decrypt(acc.access_token_enc);
  const t = await tokenRequest({ grant_type: "refresh_token", refresh_token: decrypt(acc.refresh_token_enc) });
  await saveTokens(acc.email, t);
  acc.access_token_enc = encrypt(t.access_token);
  acc.refresh_token_enc = encrypt(t.refresh_token);
  acc.expires_at = new Date(Date.now() + t.expires_in * 1000);
  return t.access_token;
}

type GraphMessage = {
  id: string;
  subject: string | null;
  receivedDateTime: string;
  from?: { emailAddress: { name?: string; address?: string } };
  body: { contentType: string; content: string };
  "@removed"?: unknown;
};

// ImmutableId: Outlook otherwise changes a message's id when it is moved between folders.
const IMMUTABLE = 'IdType="ImmutableId"';
const PAGE = { Prefer: `odata.maxpagesize=50, ${IMMUTABLE}` };

// Inbox and all its subfolders, as "Boîte de réception/Parent/Child" paths.
// ponytail: first 100 child folders per level; follow @odata.nextLink if a folder ever has more.
async function listFolders(client: Client): Promise<{ id: string; path: string }[]> {
  const inbox = await client.api("/me/mailFolders/inbox").select("id,displayName").get();
  const out = [{ id: inbox.id as string, path: inbox.displayName as string }];
  for (let i = 0; i < out.length; i++) {
    const res = await client.api(`/me/mailFolders/${out[i].id}/childFolders`).select("id,displayName").top(100).get();
    for (const f of res.value) out.push({ id: f.id, path: `${out[i].path}/${f.displayName}` });
  }
  return out;
}

// Graph returns one body format per request: delta gives HTML, plain text comes from a $batch (max 20 per call).
async function fetchTextBodies(client: Client, ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 20) {
    const requests = ids.slice(i, i + 20).map((id) => ({
      id,
      method: "GET",
      url: `/me/messages/${encodeURIComponent(id)}?$select=body`,
      headers: { Prefer: `outlook.body-content-type="text", ${IMMUTABLE}` },
    }));
    const { responses } = await client.api("/$batch").post({ requests });
    for (const r of responses) if (r.status === 200) out.set(r.id, r.body.body.content);
  }
  return out;
}

type Stats = { fetched: number; inserted: number; removed: string[] };

// Full sync on first run, then incremental via the folder's stored deltaLink. Progress (nextLink) is saved
// after every page, so an interrupted sync resumes where it stopped.
// A message moved between synced folders keeps its id: the upsert only updates its folder.
// Ids reported "@removed" are returned, not deleted here: see syncAccount.
async function syncFolder(client: Client, accountId: number, folder: { id: string; path: string }, deltaLink: string | null): Promise<Stats> {
  const stats: Stats = { fetched: 0, inserted: 0, removed: [] };
  let page;
  try {
    page = deltaLink
      ? await client.api(deltaLink).headers(PAGE).get()
      : await client.api(`/me/mailFolders/${folder.id}/messages/delta`).select("id,subject,receivedDateTime,from,body").headers(PAGE).get();
  } catch (e) {
    // 410 Gone = delta token expired: restart a full sync of this folder (upserts are idempotent).
    // ponytail: a full resync does not report removals, so mails deleted meanwhile stay in the DB.
    if ((e as { statusCode?: number }).statusCode !== 410 || !deltaLink) throw e;
    return syncFolder(client, accountId, folder, null);
  }

  while (true) {
    const value = page.value as GraphMessage[];
    stats.removed.push(...value.filter((m) => "@removed" in m).map((m) => m.id));
    const messages = value.filter((m) => !("@removed" in m));
    const texts = await fetchTextBodies(client, messages.map((m) => m.id));
    for (const m of messages) {
      const from = m.from?.emailAddress;
      const { rows } = await db.query(
        `INSERT INTO emails (account_id, provider, external_id, folder, sender, subject, body_html, body_text, received_at)
         VALUES ($1, 'outlook', $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (account_id, external_id) DO UPDATE SET folder = EXCLUDED.folder
         RETURNING (xmax = 0) AS inserted`,
        [
          accountId,
          m.id,
          folder.path,
          from ? (from.name ? `${from.name} <${from.address}>` : from.address) : null,
          m.subject,
          m.body.contentType === "html" ? m.body.content : null,
          texts.get(m.id) ?? null,
          m.receivedDateTime,
        ],
      );
      if (rows[0].inserted) stats.inserted++;
    }
    stats.fetched += messages.length;

    const link: string = page["@odata.nextLink"] ?? page["@odata.deltaLink"];
    await db.query("UPDATE folders SET delta_link = $1 WHERE account_id = $2 AND external_id = $3", [link, accountId, folder.id]);
    if (!page["@odata.nextLink"]) break;
    page = await client.api(link).headers(PAGE).get();
  }
  return stats;
}

export async function syncAccount(acc: Account) {
  const client = Client.init({
    authProvider: (done) => getAccessToken(acc).then((t) => done(null, t), (e) => done(e, null)),
  });
  const total = { folders: 0, fetched: 0, inserted: 0, deleted: 0 };
  const { rows: known } = await db.query("SELECT external_id, path, delta_link FROM folders WHERE account_id = $1", [acc.id]);
  const knownById = new Map(known.map((f) => [f.external_id as string, f]));
  const removed: { id: string; path: string }[] = [];

  for (const folder of await listFolders(client)) {
    const prev = knownById.get(folder.id);
    knownById.delete(folder.id);
    if (!prev) {
      await db.query("INSERT INTO folders (account_id, external_id, path) VALUES ($1, $2, $3)", [acc.id, folder.id, folder.path]);
    } else if (prev.path !== folder.path) {
      // Renamed (or parent renamed): delta does not resend unchanged messages, so relabel them here.
      await db.query("UPDATE folders SET path = $1 WHERE account_id = $2 AND external_id = $3", [folder.path, acc.id, folder.id]);
      await db.query("UPDATE emails SET folder = $1 WHERE account_id = $2 AND folder = $3", [folder.path, acc.id, prev.path]);
    }
    const s = await syncFolder(client, acc.id, folder, prev?.delta_link ?? null);
    removed.push(...s.removed.map((id) => ({ id, path: folder.path })));
    total.folders++;
    total.fetched += s.fetched;
    total.inserted += s.inserted;
  }

  // Deletions run after every folder is synced: a message moved to another synced folder has already been
  // relabelled there, so the `folder = path` guard keeps it (and its tags).
  // ponytail: if the sync crashes before this point, those removals are lost (rows stay); persist them if that matters.
  for (const r of removed) {
    const res = await db.query("DELETE FROM emails WHERE account_id = $1 AND external_id = $2 AND folder = $3", [acc.id, r.id, r.path]);
    total.deleted += res.rowCount ?? 0;
  }
  // Folders gone from the Inbox tree (deleted, or moved out): drop them and their mails.
  for (const f of knownById.values()) {
    const res = await db.query("DELETE FROM emails WHERE account_id = $1 AND folder = $2", [acc.id, f.path]);
    await db.query("DELETE FROM folders WHERE account_id = $1 AND external_id = $2", [acc.id, f.external_id]);
    total.deleted += res.rowCount ?? 0;
  }
  return total;
}
