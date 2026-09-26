import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePrediction, toTags } from "./classify.ts";

const paths = new Set(["Boîte de réception/Candidatures"]);

test("parses JSON wrapped in text or code fences", () => {
  const p = parsePrediction('Voici :\n```json\n{"folder": "Boîte de réception/Candidatures", "confidence": "haute", "new_folder_idea": null}\n```', paths);
  assert.deepEqual(p, { folder: "Boîte de réception/Candidatures", confidence: "haute", new_folder_idea: null });
});

test("unknown folder becomes null", () => {
  assert.equal(parsePrediction('{"folder": "Inventé", "confidence": "haute", "new_folder_idea": "Banque"}', paths).folder, null);
});

test("no JSON throws", () => {
  assert.throws(() => parsePrediction("je ne sais pas", paths));
});

test("only a confident folder is kept, otherwise the idea wins", () => {
  const f = "Boîte de réception/Candidatures";
  assert.deepEqual(toTags({ folder: f, confidence: "haute", new_folder_idea: "X" }), ["ai:qwen2.5:14b", `folder:${f}`]);
  assert.deepEqual(toTags({ folder: f, confidence: "moyenne", new_folder_idea: "Epitech" }), ["ai:qwen2.5:14b", "new_folder_idea:Epitech"]);
  assert.deepEqual(toTags({ folder: null, confidence: "basse", new_folder_idea: null }), ["ai:qwen2.5:14b"]);
});

test("previous refusals are kept when re-tagging", () => {
  assert.deepEqual(toTags({ folder: null, confidence: "basse", new_folder_idea: "Epitech" }, ["rejected:folder:X", "other"]), [
    "rejected:folder:X",
    "ai:qwen2.5:14b",
    "new_folder_idea:Epitech",
  ]);
});
