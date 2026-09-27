import Link from "next/link";
import { db } from "@/lib/db.ts";
import { CLEANUP_WHERE, cleanupLeft } from "@/lib/classify.ts";
import { senderAddr, senderName, shortDate } from "../text.ts";
import { deleteSelected, keepSelected, scanForCleanup } from "../actions.ts";
import { AnalyzeForm } from "../AnalyzeForm.tsx";
import { Prov } from "../Icons.tsx";
import { PendingButton } from "../Pending.tsx";
import { SelectAll } from "../SelectAll.tsx";
import { Num } from "../Num.tsx";

export const dynamic = "force-dynamic";

type Row = { id: number; provider: string; subject: string | null; sender: string | null; received_at: Date; reason: string };
type Group = { key: string; title: string; sub: string; detail: string; provs: Set<string>; mails: Row[] };
type View = "expediteur" | "raison" | "liste";

const TINTS = ["rgb(125 211 252 / .22)", "rgb(252 211 77 / .22)", "rgb(110 231 183 / .22)", "rgb(240 171 252 / .22)", "rgb(165 163 201 / .22)"];
const VIEWS: [View, string][] = [["expediteur", "Par expéditeur"], ["raison", "Par raison"], ["liste", "Un par un"]];

// Most frequent value first, then the others, as one short line.
function summary(values: string[], max = 2): string {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([v]) => v);
  return sorted.slice(0, max).join(", ") + (sorted.length > max ? ` et ${sorted.length - max} autre(s)` : "");
}

function groupBy(rows: Row[], view: "expediteur" | "raison"): Group[] {
  const byKey = new Map<string, Row[]>();
  for (const r of rows) {
    const key = view === "expediteur" ? senderAddr(r.sender) : r.reason;
    byKey.set(key, [...(byKey.get(key) ?? []), r]);
  }
  return [...byKey.entries()]
    .map(([key, mails]) => ({
      key,
      mails,
      provs: new Set(mails.map((m) => m.provider)),
      title: view === "expediteur" ? senderName(mails[0].sender) : key,
      sub: view === "expediteur" ? key : `${new Set(mails.map((m) => senderAddr(m.sender))).size} expéditeur(s)`,
      detail: view === "expediteur" ? summary(mails.map((m) => m.reason), 1) : summary(mails.map((m) => senderName(m.sender))),
    }))
    .sort((a, b) => b.mails.length - a.mails.length);
}

export default async function Cleanup({ searchParams }: { searchParams: Promise<{ vue?: string }> }) {
  const [{ rows }, left, { vue }] = await Promise.all([
    db.query<Row>(
      `SELECT id, provider, subject, sender, received_at,
              coalesce((SELECT substr(t, 18) FROM jsonb_array_elements_text(tags) t WHERE t LIKE 'delete_suggested:%' LIMIT 1),
                       'Classement refusé ' || (SELECT count(*) FROM jsonb_array_elements_text(tags) t WHERE t LIKE 'rejected:%') || ' fois') AS reason
       FROM emails WHERE ${CLEANUP_WHERE}
       ORDER BY received_at DESC`,
    ),
    cleanupLeft(),
    searchParams,
  ]);
  const view: View = vue === "raison" || vue === "liste" ? vue : "expediteur";

  return (
    <>
      <div className="head">
        <div>
          <h1>À supprimer</h1>
          <p>
            {rows.length > 0
              ? `${rows.length} mail(s) que l'IA juge inutiles. Supprimer les envoie dans la corbeille de leur boîte : ils restent récupérables.`
              : "Rien à supprimer pour l'instant."}
          </p>
        </div>
        <AnalyzeForm left={left} run={scanForCleanup} text={`${left} mail(s) rangé(s) pas encore examiné(s)`} />
      </div>

      {rows.length > 0 && (
        <>
          <nav className="tabs" aria-label="Regrouper" style={{ alignSelf: "flex-start", width: "fit-content", marginBottom: 16 }}>
            {VIEWS.map(([v, text]) => (
              <Link key={v} href={v === "expediteur" ? "/nettoyage" : `/nettoyage?vue=${v}`} aria-current={v === view ? "page" : undefined}>
                {text}
              </Link>
            ))}
          </nav>
          {view === "liste" ? <OneByOne rows={rows} /> : <Groups groups={groupBy(rows, view)} view={view} />}
        </>
      )}
    </>
  );
}

function Groups({ groups, view }: { groups: Group[]; view: "expediteur" | "raison" }) {
  return (
    <section className="panel" aria-label={view === "expediteur" ? "Expéditeurs" : "Raisons"}>
      <div className="groups-head">
        <span />
        <span>{view === "expediteur" ? "Expéditeur" : "Raison"}</span>
        <span>{view === "expediteur" ? "Pourquoi" : "Surtout"}</span>
        <span>Mails</span>
        <span>Le dernier</span>
        <span />
      </div>
      {groups.map((g, i) => (
        <form key={g.key}>
          <details className="group">
            <summary>
              <span className="avatar" style={{ width: 32, height: 32, fontSize: 14, background: TINTS[i % TINTS.length] }} title="Voir les mails">
                {g.title[0]?.toUpperCase()}
              </span>
              <span className="gname">
                <span>
                  <span className="ellip">{g.title}</span>
                  {[...g.provs].sort().map((p) => <Prov key={p} p={p} />)}
                </span>
                <span className="ellip small muted">{g.sub}</span>
              </span>
              {view === "expediteur"
                ? <span><span className={g.detail.startsWith("Classement refusé") ? "chip ai" : "chip"}>{g.detail}</span></span>
                : <span className="ellip small muted">{g.detail}</span>}
              <Num value={g.mails.length} className="gcount" />
              <span className="small muted">{shortDate(g.mails[0].received_at)}</span>
              <span className="gactions">
                <PendingButton busy="…" className="btn small" formAction={keepSelected}>Garder</PendingButton>
                <PendingButton busy="Suppression…" className="btn small danger" formAction={deleteSelected}>
                  {g.mails.length > 1 ? `Supprimer les ${g.mails.length}` : "Supprimer"}
                </PendingButton>
              </span>
            </summary>
            <div className="gmails">
              {g.mails.map((m) => (
                <label key={m.id}>
                  <input type="checkbox" name="ids" value={m.id} defaultChecked />
                  <span className="ellip">
                    {view === "raison" && <strong>{senderName(m.sender)} </strong>}
                    {m.subject || "(sans objet)"}
                  </span>
                  <span className="small muted" style={{ textAlign: "right" }}>{shortDate(m.received_at)}</span>
                </label>
              ))}
              {g.mails.length > 1 && <p className="small muted" style={{ margin: "8px 0 0" }}>Décoche ceux que tu veux garder : les boutons n'agissent que sur les mails cochés.</p>}
            </div>
          </details>
        </form>
      ))}
    </section>
  );
}

function OneByOne({ rows }: { rows: Row[] }) {
  return (
    <form className="panel detail" aria-label="Mails à supprimer">
      <div>
        {rows.map((m) => (
          <div key={m.id} className="mrow clean">
            <label>
              <input type="checkbox" name="ids" value={m.id} defaultChecked />
              <Prov p={m.provider} />
              <span className="from">{senderName(m.sender)}</span>
              <span className="ellip subj">{m.subject || "(sans objet)"}</span>
            </label>
            <span className={m.reason.startsWith("Classement refusé") ? "chip ai" : "chip"}>{m.reason}</span>
            <time dateTime={m.received_at.toISOString()}>{shortDate(m.received_at)}</time>
          </div>
        ))}
      </div>
      <div className="detail-foot">
        {rows.length > 1 ? <SelectAll /> : <span style={{ marginRight: "auto" }} />}
        <PendingButton busy="…" formAction={keepSelected}>Garder la sélection</PendingButton>
        <PendingButton busy="Suppression…" className="btn danger" formAction={deleteSelected}>Supprimer la sélection</PendingButton>
      </div>
    </form>
  );
}
