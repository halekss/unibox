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

type Account = { id: number; email: string; access_token_enc: string; refresh_token_enc: string; expires_at: Date };

// Refreshes when the access token has < 5 min left. Microsoft rotates refresh tokens, so both are re-saved.
export async function getAccessToken(acc: Account): Promise<string> {
  if (acc.expires_at.getTime() - Date.now() > 5 * 60_000) return decrypt(acc.access_token_enc);
  const t = await tokenRequest({ grant_type: "refresh_token", refresh_token: decrypt(acc.refresh_token_enc) });
  await saveTokens(acc.email, t);
  return t.access_token;
}

type GraphMessage = {
  id: string;
  subject: string | null;
  receivedDateTime: string;
  from?: { emailAddress: { name?: string; address?: string } };
  body: { contentType: string; content: string };
};

const PAGE_SIZE = 50;

// ponytail: fetches the latest PAGE_SIZE messages per call; switch to Graph delta query for full/incremental sync.
export async function syncInbox(acc: Account): Promise<{ fetched: number; inserted: number }> {
  const client = graph(await getAccessToken(acc));
  const inbox = () =>
    client.api("/me/mailFolders/inbox/messages")
      .select("id,subject,receivedDateTime,from,body")
      .orderby("receivedDateTime desc")
      .top(PAGE_SIZE);

  // Graph returns one body format per request: fetch HTML, then plain text, and join by id.
  const html: GraphMessage[] = (await inbox().get()).value;
  const text: GraphMessage[] = (await inbox().header("Prefer", 'outlook.body-content-type="text"').get()).value;
  const textById = new Map(text.map((m) => [m.id, m.body.content]));

  let inserted = 0;
  for (const m of html) {
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
        textById.get(m.id) ?? null,
        m.receivedDateTime,
      ],
    );
    inserted += r.rowCount ?? 0;
  }
  return { fetched: html.length, inserted };
}
