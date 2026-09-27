import "./tri.css";
import { db } from "@/lib/db.ts";
import { TriageStage, type Mail } from "./Triage.tsx";

export const dynamic = "force-dynamic";

// The next batch to triage (same order as /api/triage) + the already-triaged emails for the board.
// ponytail: the board shows the 300 most recent triaged emails; paginate if older ones ever matter.
export default async function Tri() {
  const cols = "id, provider, sender, subject, received_at, triage";
  const { rows } = await db.query(
    `(SELECT ${cols} FROM emails WHERE triage IS NULL ORDER BY received_at DESC LIMIT 20)
     UNION ALL
     (SELECT ${cols} FROM emails WHERE triage IS NOT NULL ORDER BY received_at DESC LIMIT 300)`,
  );
  const mails: Mail[] = rows.map((r) => ({ ...r, received_at: r.received_at.toISOString() }));
  return <TriageStage initial={mails} />;
}
