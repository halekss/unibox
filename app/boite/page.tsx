import Link from "next/link";
import { db } from "@/lib/db.ts";
import { EFFECTIVE_FOLDER, INBOX } from "@/lib/classify.ts";

export const dynamic = "force-dynamic";

const label = (f: string) => (f === INBOX ? INBOX : f.replace(`${INBOX}/`, ""));

export default async function Inbox({ searchParams }: { searchParams: Promise<{ dossier?: string }> }) {
  const selected = (await searchParams).dossier ?? INBOX;
  const { rows: folders } = await db.query(
    `SELECT ${EFFECTIVE_FOLDER} AS f, count(*)::int AS n, bool_or(app_folder IS NOT NULL) AS in_app
     FROM emails GROUP BY 1`,
  );
  // Inbox first, then alphabetical on the displayed name (Outlook paths and app folders mixed).
  folders.sort((a, b) => Number(b.f === INBOX) - Number(a.f === INBOX) || label(a.f).localeCompare(label(b.f), "fr"));
  const { rows: emails } = await db.query(
    `SELECT id, subject, sender, received_at, left(body_text, 5000) AS body, tags FROM emails
     WHERE ${EFFECTIVE_FOLDER} = $1 ORDER BY received_at DESC LIMIT 200`,
    [selected],
  );

  return (
    <>
      <h1>Boîte unifiée</h1>
      <div className="split">
        <nav aria-label="Dossiers">
          <ul>
            {folders.map((f) => (
              <li key={f.f}>
                <Link href={`/boite?dossier=${encodeURIComponent(f.f)}`} aria-current={f.f === selected ? "page" : undefined}>
                  {label(f.f)} <span className="muted">({f.n})</span> {f.in_app && <span className="badge">app</span>}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <section>
          <h2>{label(selected)}</h2>
          {emails.length === 0 && <p className="muted">Aucun mail.</p>}
          <ul>
            {emails.map((e) => {
              const pending = (e.tags as string[]).find((t) => t.startsWith("folder:") || t.startsWith("new_folder_idea:"));
              return (
                <li key={e.id}>
                  <details>
                    <summary>
                      <strong>{e.subject || "(sans objet)"}</strong>{" "}
                      <span className="muted">
                        — {e.sender?.replace(/<.*>/, "").trim()} · {e.received_at.toLocaleDateString("fr-FR")}
                      </span>{" "}
                      {pending && <span className="badge">IA : {label(pending.slice(pending.indexOf(":") + 1))}</span>}
                    </summary>
                    <pre>{e.body}</pre>
                  </details>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </>
  );
}
