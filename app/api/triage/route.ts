import { db } from "@/lib/db.ts";
import { runFlow } from "@/lib/classify.ts";
import { parseTriage, triageInput } from "@/lib/triage.ts";

export const dynamic = "force-dynamic";

// One run at a time: two tabs would triage the same emails twice.
let running = false;

// Server-Sent Events: triages the most recent untriaged emails (all folders, ?limit=, default 20) one by one
// through the "Email Triage" flow and emits one `decision` per email as soon as it is saved.
// Events: start {total} · decision {n, mail} · failure {message} · done {}.
// Closing the page stops the run after the current email; saved decisions stay, so the next run resumes.
export async function GET(req: Request) {
  if (running) return new Response("Un tri est déjà en cours.", { status: 409 });
  running = true;
  const limit = Math.min(Number(new URL(req.url).searchParams.get("limit")) || 20, 100);
  const enc = new TextEncoder();

  const stream = new ReadableStream({
    async start(ctrl) {
      // Once the browser is gone, enqueue/close throw: ignore, the loop stops on the aborted signal.
      const send = (event: string, data: object) => {
        try {
          ctrl.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {}
      };
      try {
        const { rows } = await db.query(
          `SELECT id, provider, sender, subject, received_at, body_text FROM emails
           WHERE triage IS NULL ORDER BY received_at DESC LIMIT $1`,
          [limit],
        );
        send("start", { total: rows.length });
        for (const [i, { body_text, ...mail }] of rows.entries()) {
          if (req.signal.aborted) break;
          const triage = parseTriage(await runFlow(process.env.LANGFLOW_TRIAGE_FLOW_ID!, triageInput({ ...mail, body_text })));
          await db.query("UPDATE emails SET triage = $1 WHERE id = $2", [triage, mail.id]);
          send("decision", { n: i + 1, mail: { ...mail, triage } });
        }
        send("done", {});
      } catch (e) {
        send("failure", { message: (e as Error).message });
      } finally {
        running = false;
        try {
          ctrl.close();
        } catch {}
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" },
  });
}
