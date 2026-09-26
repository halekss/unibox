import { createHash, timingSafeEqual } from "node:crypto";

const digest = (s: string) => createHash("sha256").update(s).digest();

// HTTP Basic auth, single user: the username is ignored, only the password counts.
// Hashing both sides gives equal-length buffers, so the comparison is constant-time.
export function isAuthorized(header: string | null, password: string | undefined): boolean {
  if (!password || !header?.startsWith("Basic ")) return false;
  const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  const given = decoded.slice(decoded.indexOf(":") + 1);
  return timingSafeEqual(digest(given), digest(password));
}

// Browsers resend Basic credentials automatically, so a foreign page could POST to /api/sync or the
// delete actions (CSRF). Writes must come from our own origin; requests without Origin (curl) pass.
export function isSameOrigin(method: string, origin: string | null, host: string | null): boolean {
  if (method === "GET" || method === "HEAD" || !origin) return true;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

// Redirect target taken from a form field: same-site paths only ("/boite?dossier=X"), never "//evil.example"
// or "/\evil.example" (browsers read both as another host).
export function safeBack(b: unknown): string {
  const s = typeof b === "string" ? b : "";
  return /^\/(?![/\\])/.test(s) ? s : "/";
}
