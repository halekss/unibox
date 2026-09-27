import { test } from "node:test";
import assert from "node:assert/strict";
import { badge, column, parseTriage, senderName, toValidate } from "./triage.ts";

test("parses fenced JSON, drops a draft outside repondre", () => {
  const t = parseTriage('```json\n{"category": "argent", "summary": "Facture août", "amount": "4 800 €", "draft": "Merci"}\n```');
  assert.deepEqual(t, { category: "argent", summary: "Facture août", amount: "4 800 €", draft: null });
});

test("unknown category or garbage falls back to lire", () => {
  assert.equal(parseTriage('{"category": "urgent", "summary": "x"}').category, "lire");
  assert.equal(parseTriage("je ne sais pas").category, "lire");
});

test("only undrafted replies wait for validation", () => {
  const r = parseTriage('{"category": "repondre", "summary": "Question", "draft": "Bonjour"}');
  assert.equal(toValidate(r), true);
  assert.equal(toValidate({ ...r, drafted: true }), false);
});

test("sender name without the address", () => {
  assert.equal(senderName('"Jane Doe" <jane@x.fr>'), "Jane Doe");
  assert.equal(senderName("jane@x.fr"), "jane@x.fr");
});

test("a handled email moves to Archivé and stops waiting", () => {
  const r = { ...parseTriage('{"category": "repondre", "summary": "Question", "draft": "Bonjour"}'), done: true };
  assert.equal(column(r), "archiver");
  assert.equal(badge(r), "Répondu");
  assert.equal(toValidate(r), false);
  assert.equal(column({ ...r, done: false }), "repondre");
});
