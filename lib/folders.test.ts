import { test } from "node:test";
import assert from "node:assert/strict";
import { folderTree } from "./folders.ts";

test("folderTree: nests X/XX under X, creates missing parents, sums counts and badges", () => {
  const root = folderTree([
    { f: "Banque", provs: ["outlook"], n: 3 },
    { f: "Epitech/Stages", provs: ["gmail"], n: 2 },
    { f: "Epitech", provs: ["outlook"], n: 5 },
    { f: "Perso/Voyages/Lyon", provs: ["outlook"], n: 1 },
  ]);
  assert.deepEqual([...root.children.keys()], ["Banque", "Epitech", "Perso"]);
  const epitech = root.children.get("Epitech")!;
  assert.equal(epitech.n, 7);
  assert.deepEqual([...epitech.provs].sort(), ["gmail", "outlook"]);
  assert.equal(epitech.children.get("Stages")!.path, "Epitech/Stages");
  const perso = root.children.get("Perso")!; // exists only through its child
  assert.equal(perso.n, 1);
  assert.equal(perso.children.get("Voyages")!.children.get("Lyon")!.path, "Perso/Voyages/Lyon");
});
