import { db } from "@/lib/db.ts";
import { CLEANUP_WHERE, cleanupLeft } from "@/lib/classify.ts";
import { senderAddr, senderName, shortDate } from "../text.ts";
import { deleteSelected, keepSelected, scanForCleanup } from "../actions.ts";
import { AnalyzeForm } from "../AnalyzeForm.tsx";
import { Prov } from "../Icons.tsx";
import { PendingButton } from "../Pending.tsx";

export const dynamic = "force-dynamic";

type Row = { id: number; provider: string; subject: string | null; sender: string | null; received_at: Date; ai_reason: string | null; refusals: number };
type Group = { addr: string; name: string; provs: Set<string>; reasons: Map<string, number>; mails: Row[] };

const TINTS = ["#E3E0F2", "#DCE4EE", "#DDEBE3", "#F0E4DA", "#E6E9D8"];

export default async function Cleanup() {
  const [{ rows }, left] = await Promise.all([
    db.query<Row>(
      `SELECT id, provider, subject, sender, received_at,
              (SELECT substr(t, 18) FROM jsonb_array_elements_text(tags) t WHERE t LIKE 'delete_suggested:%' LIMIT 1) AS ai_reason,
              (SELECT count(*)::int FROM jsonb_array_elements_text(tags) t WHERE t LIKE 'rejected:%') AS refusals
       FROM emails WHERE ${CLEANUP_WHERE}
       ORDER BY received_at DESC`,
    ),
    cleanupLeft(),
  ]);

  // One line per sender address; the most frequent AI reason speaks for the group.
  const byAddr = new Map<string, Group>();
  for (const r of rows) {
    const addr = senderAddr(r.sender);
    const g: Group = byAddr.get(addr) ?? { addr, name: senderName(r.sender), provs: new Set(), reasons: new Map(), mails: [] };
    const reason = r.ai_reason ?? `Classement refusé ${r.refusals} fois`;
    g.provs.add(r.provider);
    g.reasons.set(reason, (g.reasons.get(reason) ?? 0) + 1);
    g.mails.push(r);
    byAddr.set(addr, g);
  }
  const groups = [...byAddr.values()].sort((a, b) => b.mails.length - a.mails.length);

  return (
    <>
      <div className="head">
        <div>
          <h1>À supprimer</h1>
          <p>
            {rows.length > 0
              ? `${rows.length} mail(s) que l'IA juge inutiles, regroupés par expéditeur. Supprimer les envoie dans la corbeille de leur boîte : ils restent récupérables.`
              : "Rien à supprimer pour l'instant."}
          </p>
        </div>
        <AnalyzeForm left={left} run={scanForCleanup} text={`${left} mail(s) rangé(s) pas encore examiné(s)`} />
      </div>

      {groups.length > 0 && (
        <section className="panel" aria-label="Expéditeurs">
          <div className="groups-head">
            <span /><span>Expéditeur</span><span>Pourquoi</span><span>Mails</span><span>Le dernier</span><span />
          </div>
          {groups.map((g, i) => {
            const reason = [...g.reasons.entries()].sort((a, b) => b[1] - a[1])[0][0];
            return (
              <form key={g.addr}>
                <details className="group">
                  <summary>
                    <span className="avatar" style={{ width: 32, height: 32, fontSize: 14, background: TINTS[i % TINTS.length] }} title="Voir les mails">
                      {g.name[0]?.toUpperCase()}
                    </span>
                    <span className="gname">
                      <span>
                        <span className="ellip">{g.name}</span>
                        {[...g.provs].map((p) => <Prov key={p} p={p} />)}
                      </span>
                      <span className="ellip small muted">{g.addr}</span>
                    </span>
                    <span><span className={reason.startsWith("Classement refusé") ? "chip ai" : "chip"}>{reason}</span></span>
                    <span className="gcount">{g.mails.length}</span>
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
                        <span className="ellip">{m.subject || "(sans objet)"}</span>
                        <span className="small muted" style={{ textAlign: "right" }}>{shortDate(m.received_at)}</span>
                      </label>
                    ))}
                    {g.mails.length > 1 && <p className="small muted" style={{ margin: "8px 0 0" }}>Décoche ceux que tu veux garder : les boutons n'agissent que sur les mails cochés.</p>}
                  </div>
                </details>
              </form>
            );
          })}
        </section>
      )}
    </>
  );
}
