import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

process.env.TOKEN_ENC_KEY = randomBytes(32).toString("base64");
const { encrypt, decrypt } = await import("./crypto.ts");

test("roundtrip, random IV, tamper detection", () => {
  const a = encrypt("secret-token");
  assert.notEqual(a, encrypt("secret-token"));
  assert.ok(!a.includes("secret-token"));
  assert.equal(decrypt(a), "secret-token");
  const bad = Buffer.from(a, "base64");
  bad[bad.length - 1] ^= 1;
  assert.throws(() => decrypt(bad.toString("base64")));
});
