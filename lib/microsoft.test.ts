import { test } from "node:test";
import assert from "node:assert/strict";
import { outlookPath } from "./microsoft.ts";

test("app folder names map under the Inbox, full paths are kept", () => {
  assert.equal(outlookPath("Epitech"), "Boîte de réception/Epitech");
  assert.equal(outlookPath("Voiture/Test"), "Boîte de réception/Voiture/Test");
  assert.equal(outlookPath("Boîte de réception/Santé/AON"), "Boîte de réception/Santé/AON");
});
