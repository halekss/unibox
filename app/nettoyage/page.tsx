import { db } from "@/lib/db.ts";
import { REFUSALS_BEFORE_DELETE } from "@/lib/classify.ts";
import { plain } from "../text.ts";
import { deleteSelected, keepSelected } from "../actions.ts";

export const dynamic = "force-dynamic";

const label = (f: string) => f.replace("Boîte de réception/", "");

export default async function Cleanup() {
  // Candidates: flagged by the AI, or refused too often. Emails marked "keep" never come back.
  const { rows } = await db.query(
    `SELECT id, subject, sender, received_at, folder, left(body_text, 800) AS preview,
            (SELECT substr(t, 18) FROM jsonb_array_elements_text(tags) t WHERE t LIKE 'delete_suggested:%' LIMIT 1) AS ai_reason,
            (SELECT count(*)::int FROM jsonb_array_elements_text(tags) t WHERE t LIKE 'rejected:%') AS refusals
     FROM emails
     WHERE NOT tags ? 'keep'
       AND (tags::text LIKE '%"delete_suggested:%'
            OR (SELECT count(*) FROM jsonb_array_elements_text(tags) t WHERE t LIKE 'rejected:%') >= $1)
     ORDER BY received_at`,
    [REFUSALS_BEFORE_DELETE],
  );

  return (
    <>
      <h1>Nettoyage</h1>
      <p className="muted">
        Mails que l'IA juge inutiles, ou dont tu as refusé le classement {REFUSALS_BEFORE_DELETE} fois ou plus. Supprimer
        les envoie dans « Éléments supprimés » d'Outlook (récupérables). Garder les retire définitivement de cette liste.
      </p>
      {rows.length === 0 ? (
        <p className="muted">Aucun mail à nettoyer.</p>
      ) : (
        <form className="card">
          <ul>
            {rows.map((e) => (
              <li key={e.id}>
                <label>
                  <input type="checkbox" name="ids" value={e.id} defaultChecked />
                  <span>
                    <strong>{e.subject || "(sans objet)"}</strong>{" "}
                    <span className="muted">
                      — {e.sender?.replace(/<.*>/, "").trim()} · {e.received_at.toLocaleDateString("fr-FR")} · {label(e.folder)}
                    </span>{" "}
                    {e.ai_reason && <span className="badge">IA : {e.ai_reason}</span>}{" "}
                    {e.refusals >= REFUSALS_BEFORE_DELETE && <span className="badge">refusé {e.refusals} fois</span>}
                  </span>
                </label>
                <details>
                  <summary>Aperçu</summary>
                  <pre>{plain(e.preview)}</pre>
                </details>
              </li>
            ))}
          </ul>
          <div className="actions">
            <button formAction={keepSelected}>Garder la sélection</button>
            <button className="danger" formAction={deleteSelected}>Supprimer la sélection</button>
          </div>
        </form>
      )}
    </>
  );
}
