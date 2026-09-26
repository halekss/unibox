import { test } from "node:test";
import assert from "node:assert/strict";
import { isAuthorized, isSameOrigin, safeBack } from "./auth.ts";

const basic = (s: string) => `Basic ${Buffer.from(s).toString("base64")}`;

test("isAuthorized: only the right password passes, any username", () => {
  assert.equal(isAuthorized(basic("moi:s3cret:avec:deux-points"), "s3cret:avec:deux-points"), true);
  assert.equal(isAuthorized(basic(":s3cret"), "s3cret"), true);
  assert.equal(isAuthorized(basic("moi:faux"), "s3cret"), false);
  assert.equal(isAuthorized(null, "s3cret"), false);
  assert.equal(isAuthorized("Bearer s3cret", "s3cret"), false);
  // No password configured = locked, even with an empty password sent.
  assert.equal(isAuthorized(basic("moi:"), ""), false);
  assert.equal(isAuthorized(basic("moi:"), undefined), false);
});

test("isSameOrigin: foreign POSTs are refused", () => {
  assert.equal(isSameOrigin("POST", "http://localhost:3000", "localhost:3000"), true);
  assert.equal(isSameOrigin("POST", "https://evil.example", "localhost:3000"), false);
  assert.equal(isSameOrigin("POST", "null", "localhost:3000"), false);
  assert.equal(isSameOrigin("POST", null, "localhost:3000"), true);
  assert.equal(isSameOrigin("GET", "https://evil.example", "localhost:3000"), true);
});

test("safeBack: only same-site paths", () => {
  assert.equal(safeBack("/boite?dossier=Epitech"), "/boite?dossier=Epitech");
  assert.equal(safeBack("//evil.example"), "/");
  assert.equal(safeBack("/\\evil.example"), "/");
  assert.equal(safeBack("https://evil.example"), "/");
  assert.equal(safeBack(null), "/");
});
