import { db } from "@/lib/db.ts";
import { EFFECTIVE_FOLDER, INBOX } from "@/lib/classify.ts";
import { confirmProposal, rejectProposal } from "./actions.ts";
import { AnalyzeForm } from "./AnalyzeForm.tsx";

export const dynamic = "force-dynamic";

type Row = { id: number; subject: string | null; sender: string | null; received_at: Date; preview: string | null; tag: string };

export default async function Proposals() {
  const { rows } = await db.query<Row>(
    `SELECT e.id, e.subject, e.sender, e.received_at, left(e.body_text, 800) AS preview, t AS tag
     FROM emails e, jsonb_array_elements_text(e.tags) t
     WHERE t LIKE 'folder:%' OR t LIKE 'new_folder_idea:%'
     ORDER BY e.received_at DESC`,
  );
  const { rows: [left] } = await db.query(
    `SELECT count(*)::int AS n FROM emails WHERE ${EFFECTIVE_FOLDER} = $1 AND tags = '[]'`,
    [INBOX],
  );

  const groups = new Map<string, Row[]>();
  for (const r of rows) groups.set(r.tag, [...(groups.get(r.tag) ?? []), r]);
  // Biggest groups first: that is where one decision files the most emails.
  const sorted = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);

  return (
    <>
      <h1>Propositions de rangement</h1>
      <p className="muted">
        L'IA propose, tu décides. Confirmer range les mails cochés dans le dossier, dans l'app seulement (Outlook
        n'est pas modifié).
      </p>
      <AnalyzeForm left={left.n} />

      {sorted.length === 0 && <p className="muted">Aucune proposition en attente.</p>}

      {sorted.map(([tag, emails]) => {
        const isNew = tag.startsWith("new_folder_idea:");
        const name = tag.slice(tag.indexOf(":") + 1);
        return (
          <form key={tag} className="card">
            <input type="hidden" name="tag" value={tag} />
            <div className="head">
              <span className="badge">{isNew ? "Nouveau dossier" : "Dossier existant"}</span>
              <input type="text" name="name" defaultValue={name} aria-label="Nom du dossier" />
              <span className="muted">{emails.length} mail(s)</span>
            </div>
            <ul>
              {emails.map((e) => (
                <li key={e.id}>
                  <label>
                    <input type="checkbox" name="ids" value={e.id} defaultChecked />
                    <span>
                      <strong>{e.subject || "(sans objet)"}</strong>{" "}
                      <span className="muted">
                        — {e.sender?.replace(/<.*>/, "").trim()} · {e.received_at.toLocaleDateString("fr-FR")}
                      </span>
                    </span>
                  </label>
                  <details>
                    <summary>Aperçu</summary>
                    <pre>{e.preview}</pre>
                  </details>
                </li>
              ))}
            </ul>
            <div className="actions">
              <button className="danger" formAction={rejectProposal}>Refuser la sélection</button>
              <button className="primary" formAction={confirmProposal}>Confirmer la sélection</button>
            </div>
          </form>
        );
      })}
    </>
  );
}
