import { db } from "./db.ts";
import { encrypt, decrypt } from "./crypto.ts";

export type Provider = "outlook" | "gmail";

export type Account = {
  id: number;
  provider: Provider;
  email: string;
  access_token_enc: string;
  refresh_token_enc: string;
  expires_at: Date;
  sync_cursor: string | null;
};

// Google only returns a refresh token on the first consent, so it is optional here.
export type TokenResponse = { access_token: string; refresh_token?: string; expires_in: number };

export async function postToken(url: string, params: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(url, { method: "POST", body: new URLSearchParams(params) });
  const json = await res.json();
  // Only the error code/description is surfaced: never the raw body (it can echo tokens).
  if (!res.ok) throw new Error(`Token endpoint: ${json.error}: ${json.error_description}`);
  return json;
}

// A missing refresh token keeps the stored one.
export async function saveTokens(provider: Provider, email: string, t: TokenResponse): Promise<void> {
  if (!t.refresh_token) {
    await db.query(
      `UPDATE accounts SET access_token_enc = $1, expires_at = now() + make_interval(secs => $2) WHERE provider = $3 AND email = $4`,
      [encrypt(t.access_token), t.expires_in, provider, email],
    );
    return;
  }
  await db.query(
    `INSERT INTO accounts (provider, email, access_token_enc, refresh_token_enc, expires_at)
     VALUES ($1, $2, $3, $4, now() + make_interval(secs => $5))
     ON CONFLICT (provider, email) DO UPDATE SET
       access_token_enc = EXCLUDED.access_token_enc,
       refresh_token_enc = EXCLUDED.refresh_token_enc,
       expires_at = EXCLUDED.expires_at`,
    [provider, email, encrypt(t.access_token), encrypt(t.refresh_token), t.expires_in],
  );
}

// Refreshes when the access token has < 5 min left. `acc` is updated in place so a long run keeps the
// fresh token. `refresh` is the provider's refresh_token grant.
export async function freshToken(acc: Account, refresh: (refreshToken: string) => Promise<TokenResponse>): Promise<string> {
  if (acc.expires_at.getTime() - Date.now() > 5 * 60_000) return decrypt(acc.access_token_enc);
  const t = await refresh(decrypt(acc.refresh_token_enc));
  await saveTokens(acc.provider, acc.email, t);
  acc.access_token_enc = encrypt(t.access_token);
  if (t.refresh_token) acc.refresh_token_enc = encrypt(t.refresh_token);
  acc.expires_at = new Date(Date.now() + t.expires_in * 1000);
  return t.access_token;
}
