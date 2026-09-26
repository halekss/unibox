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
  delta_link: string | null;
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

const PAGE = { Prefer: "odata.maxpagesize=50" };

// Graph returns one body format per request: delta gives HTML, plain text comes from a $batch (max 20 per call).
async function fetchTextBodies(client: Client, ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 20) {
    const requests = ids.slice(i, i + 20).map((id) => ({
      id,
      method: "GET",
      url: `/me/messages/${encodeURIComponent(id)}?$select=body`,
      headers: { Prefer: 'outlook.body-content-type="text"' },
    }));
    const { responses } = await client.api("/$batch").post({ requests });
    for (const r of responses) if (r.status === 200) out.set(r.id, r.body.body.content);
  }
  return out;
}

// Full sync on first run, then incremental via the stored deltaLink. Progress (nextLink) is saved after
// every page, so an interrupted sync resumes where it stopped.
// ponytail: messages deleted/moved out of the Inbox ("@removed") are kept in the DB; decide the policy before deleting rows.
export async function syncInbox(acc: Account): Promise<{ fetched: number; inserted: number }> {
  const client = Client.init({
    authProvider: (done) => getAccessToken(acc).then((t) => done(null, t), (e) => done(e, null)),
  });
  let fetched = 0;
  let inserted = 0;
  let page;
  try {
    page = acc.delta_link
      ? await client.api(acc.delta_link).headers(PAGE).get()
      : await client.api("/me/mailFolders/inbox/messages/delta").select("id,subject,receivedDateTime,from,body").headers(PAGE).get();
  } catch (e) {
    // 410 Gone = delta token expired: restart a full sync (inserts are idempotent).
    if ((e as { statusCode?: number }).statusCode !== 410 || !acc.delta_link) throw e;
    acc.delta_link = null;
    return syncInbox(acc);
  }

  while (true) {
    const messages = (page.value as GraphMessage[]).filter((m) => !("@removed" in m));
    const texts = await fetchTextBodies(client, messages.map((m) => m.id));
    for (const m of messages) {
      const from = m.from?.emailAddress;
      const r = await db.query(
        `INSERT INTO emails (account_id, provider, external_id, sender, subject, body_html, body_text, received_at)
         VALUES ($1, 'outlook', $2, $3, $4, $5, $6, $7)
         ON CONFLICT (account_id, external_id) DO NOTHING`,
        [
          acc.id,
          m.id,
          from ? (from.name ? `${from.name} <${from.address}>` : from.address) : null,
          m.subject,
          m.body.contentType === "html" ? m.body.content : null,
          texts.get(m.id) ?? null,
          m.receivedDateTime,
        ],
      );
      inserted += r.rowCount ?? 0;
    }
    fetched += messages.length;

    const link: string = page["@odata.nextLink"] ?? page["@odata.deltaLink"];
    await db.query("UPDATE accounts SET delta_link = $1 WHERE id = $2", [link, acc.id]);
    if (!page["@odata.nextLink"]) break;
    page = await client.api(link).headers(PAGE).get();
  }
  return { fetched, inserted };
}
