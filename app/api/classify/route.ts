import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db.ts";
import { classify, decide, folderCatalog, tagInbox } from "@/lib/classify.ts";

// ?eval=N : classifies N random already-sorted emails and reports accuracy, without writing anything.
// Default : tags the untagged emails sitting at the Inbox root (max ?limit=, default 20).
// &dry=1 : returns the predictions without writing tags.
// ponytail: no auth, local-only (same as /api/sync).
export async function POST(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const evalN = Number(p.get("eval") ?? 0);

  if (evalN > 0) {
    const { rows } = await db.query(
      `SELECT id, sender, subject, body_text, folder FROM emails
       WHERE folder LIKE 'Boîte de réception/%' ORDER BY random() LIMIT $1`,
      [evalN],
    );
    const catalog = await folderCatalog(rows.map((r) => r.id));
    const results = [];
    for (const e of rows) {
      const pred = await classify(e, catalog);
      const d = decide(pred);
      results.push({ subject: e.subject, expected: e.folder, predicted: d.folder, confidence: pred.confidence, idea: d.new_folder_idea, ok: d.folder === e.folder });
    }
    const ok = results.filter((r) => r.ok).length;
    return NextResponse.json({ accuracy: `${ok}/${results.length}`, results });
  }

  const dry = p.get("dry") === "1";
  const results = await tagInbox(Number(p.get("limit") ?? 20), dry);
  return NextResponse.json({ dry, count: results.length, results });
}
