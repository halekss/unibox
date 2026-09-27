import Link from "next/link";
import { db } from "@/lib/db.ts";
import { EFFECTIVE_FOLDER, INBOX } from "@/lib/classify.ts";
import { MailRow, type Mail } from "./MailRow.tsx";
import { SelectAll } from "./SelectAll.tsx";
import { Shortcuts } from "./Shortcuts.tsx";
import { Icon, Prov } from "./Icons.tsx";
import { PendingButton } from "./Pending.tsx";
import { folderList } from "./queries.ts";
import { analyzeInbox, confirmProposal, deleteEmail, rejectProposal } from "./actions.ts";
import { AnalyzeForm } from "./AnalyzeForm.tsx";
import { Num } from "./Num.tsx";

export const dynamic = "force-dynamic";

type Row = Mail & { tag: string };

const label = (tag: string) => tag.slice(tag.indexOf(":") + 1).replace(`${INBOX}/`, "");
const casierHref = (tag: string) => `/?casier=${encodeURIComponent(tag)}`;

export default async function Proposals({ searchParams }: { searchParams: Promise<{ casier?: string }> }) {
  const [{ rows }, { rows: [left] }, folders, { casier }] = await Promise.all([
    db.query<Row>(
      `SELECT e.id, e.provider, e.subject, e.sender, e.received_at, left(e.body_text, 800) AS preview, t AS tag
       FROM emails e, jsonb_array_elements_text(e.tags) t
       WHERE t LIKE 'folder:%' OR t LIKE 'new_folder_idea:%'
       ORDER BY e.received_at DESC`,
    ),
    db.query(`SELECT count(*)::int AS n FROM emails WHERE ${EFFECTIVE_FOLDER} = $1 AND NOT tags ? 'ai:qwen2.5:14b'`, [INBOX]),
    folderList(),
    searchParams,
  ]);

  const groups = new Map<string, Row[]>();
  for (const r of rows) groups.set(r.tag, [...(groups.get(r.tag) ?? []), r]);
  // Biggest casiers first: that is where one decision files the most emails.
  const bins = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
  const max = bins[0]?.[1].length ?? 1;
  const where = new Map(folders.map((f) => [f.f, f.provs]));
  const i = Math.max(0, bins.findIndex(([tag]) => tag === casier));
  const [tag, emails] = bins[i] ?? [];
  const name = tag && label(tag);
  const isNew = tag?.startsWith("new_folder_idea:");
  const provs = (name && where.get(name)) || [];

  const hint = isNew || provs.length === 0
    ? "Nouveau dossier : il sera créé dans la boîte de chaque mail (dossier Outlook, libellé Gmail)."
    : provs.length === 2
      ? "Existe déjà dans Outlook et dans Gmail. Renomme-le ici pour ranger ailleurs."
      : `Existe dans ${provs[0] === "gmail" ? "Gmail" : "Outlook"} ; il sera créé dans l'autre boîte si besoin. Renomme-le ici pour ranger ailleurs.`;

  return (
    <>
      <div className="head">
        <div>
          <h1>À ranger</h1>
          <p>
            {bins.length > 0
              ? `L'IA a préparé ${bins.length} casier(s) pour ${rows.length} mail(s). Vérifie, ajuste, range : rien ne bouge dans tes boîtes sans ton accord.`
              : "Aucune proposition en attente. Lance une analyse pour remplir les casiers."}
          </p>
        </div>
        <AnalyzeForm left={left.n} run={analyzeInbox} text={`${left.n} mail(s) à analyser, environ 2 min par lot de 20`} />
      </div>

      {tag && (
        <div className="sorter">
          <nav className="bins" aria-label="Casiers proposés">
            {bins.map(([t, list]) => {
              const n = label(t);
              return (
                <Link key={t} href={casierHref(t)} className="bin" aria-current={t === tag ? "true" : undefined}>
                  <span className="plate-row">
                    <span className={t.startsWith("new_folder_idea:") ? "plate new" : "plate"}>{n}</span>
                    {(where.get(n) ?? []).map((p) => <Prov key={p} p={p} />)}
                  </span>
                  <span className="big">
                    <b><Num value={list.length} /></b>
                    <span className="muted small">{t.startsWith("new_folder_idea:") ? "nouveau dossier" : list.length > 1 ? "mails" : "mail"}</span>
                  </span>
                  <span className="stack" aria-hidden="true">
                    <i style={{ width: `${(list.length / max) * 100}%` }} />
                    <i style={{ width: `${(list.length / max) * 70}%` }} />
                  </span>
                </Link>
              );
            })}
          </nav>

          <form key={tag} className="panel detail">
            {/* First submit button = what Enter in the name field does: rank, never the row "Supprimer". */}
            <button hidden formAction={confirmProposal} tabIndex={-1} aria-hidden="true" />
            <input type="hidden" name="tag" value={tag} />
            <input type="hidden" name="back" value="/" />
            <div className="detail-head">
              <label>
                <span className="muted" style={{ fontSize: 15, whiteSpace: "nowrap" }}>Ranger dans</span>
                <input type="text" name="name" defaultValue={name} aria-label="Nom du dossier" />
              </label>
              <span className="small muted">{hint}</span>
            </div>
            <div>
              {emails!.map((e) => (
                <MailRow
                  key={e.id}
                  e={e}
                  actions={
                    <button className="btn icon" style={{ width: 32, height: 32 }} formAction={deleteEmail.bind(null, e.id)} aria-label="Supprimer ce mail" title="Supprimer (corbeille de sa boîte, récupérable)">
                      <Icon name="trash" size={16} />
                    </button>
                  }
                />
              ))}
            </div>
            <div className="detail-foot">
              {emails!.length > 1 ? <SelectAll /> : <span style={{ marginRight: "auto" }} />}
              <span className="keys"><kbd>R</kbd> refuser <kbd>Entrée</kbd> ranger <kbd>J</kbd><kbd>K</kbd> casier suivant</span>
              <button id="reject" className="btn" formAction={rejectProposal}>Refuser</button>
              <PendingButton id="confirm" busy="Rangement…" className="btn primary" formAction={confirmProposal}>Ranger la sélection</PendingButton>
            </div>
            <Shortcuts next={bins[i + 1] && casierHref(bins[i + 1][0])} prev={bins[i - 1] && casierHref(bins[i - 1][0])} />
          </form>
        </div>
      )}
    </>
  );
}
