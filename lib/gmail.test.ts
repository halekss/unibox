import { test } from "node:test";
import assert from "node:assert/strict";
import { folderFor, htmlToText, isRateLimit, parseMessage } from "./gmail.ts";

const INBOX = "Boîte de réception";
const paths = new Map([["INBOX", INBOX], ["Label_1", `${INBOX}/Epitech`], ["Label_2", `${INBOX}/Banque`]]);
const b64 = (s: string) => Buffer.from(s).toString("base64url");

test("folder: user label wins over INBOX, first alphabetically; trash/spam/archived are out", () => {
  assert.equal(folderFor(["INBOX"], paths), INBOX);
  assert.equal(folderFor(["INBOX", "Label_1"], paths), `${INBOX}/Epitech`);
  assert.equal(folderFor(["Label_1", "Label_2"], paths), `${INBOX}/Banque`);
  assert.equal(folderFor(["INBOX", "TRASH"], paths), null);
  assert.equal(folderFor(["CATEGORY_PROMOTIONS"], paths), null);
});

test("parses headers and nested MIME bodies, skips attachments", () => {
  const m = parseMessage(
    {
      id: "abc",
      labelIds: ["INBOX"],
      internalDate: "1700000000000",
      payload: {
        mimeType: "multipart/mixed",
        headers: [{ name: "From", value: "Epitech <adm@epitech.eu>" }, { name: "Subject", value: "Rentrée" }],
        parts: [
          { mimeType: "multipart/alternative", parts: [
            { mimeType: "text/plain", body: { data: b64("Bonjour") } },
            { mimeType: "text/html", body: { data: b64("<p>Bonjour</p>") } },
          ] },
          { mimeType: "text/plain", filename: "cv.txt", body: { data: b64("pièce jointe") } },
        ],
      },
    },
    paths,
  );
  assert.deepEqual(
    { ...m, received_at: m.received_at.toISOString() },
    { external_id: "abc", folder: INBOX, sender: "Epitech <adm@epitech.eu>", subject: "Rentrée", body_html: "<p>Bonjour</p>", body_text: "Bonjour", received_at: "2023-11-14T22:13:20.000Z" },
  );
});

test("HTML-only email gets a text version", () => {
  assert.equal(htmlToText("<style>x{}</style><p>Salut&nbsp;toi</p><p>A &amp;lt; B</p>"), "Salut toi\nA &lt; B");
});

test("isRateLimit: per-minute quota errors are retried, real 403s are not", () => {
  assert.equal(isRateLimit(429), true);
  assert.equal(isRateLimit(403, "Quota exceeded for quota metric 'Total Query Cost'"), true);
  assert.equal(isRateLimit(403, "User-rate limit exceeded"), true);
  assert.equal(isRateLimit(403, "Request had insufficient authentication scopes."), false);
  assert.equal(isRateLimit(404, "Not Found"), false);
});
