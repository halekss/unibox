import { db } from "@/lib/db.ts";
import { FOLDER_LABEL, INBOX, langflowUp } from "@/lib/classify.ts";
import { disconnectAccount, syncNow } from "../actions.ts";
import { ConfirmButton } from "../ConfirmButton.tsx";
import { Icon } from "../Icons.tsx";
import { PendingButton } from "../Pending.tsx";
import { Num } from "../Num.tsx";
import { ThemeSwitch } from "../ThemeSwitch.tsx";

export const dynamic = "force-dynamic";

const LANGFLOW_START = "LANGFLOW_OPEN_BROWSER=false ~/ProjetsWSL/langflow/.venv/bin/langflow run --host 127.0.0.1 --port 7860";

export default async function Accounts() {
  const [{ rows: accounts }, up] = await Promise.all([
    db.query(
      `SELECT a.id, a.provider, a.email,
              (SELECT count(*)::int FROM emails e WHERE e.account_id = a.id) AS mails,
              CASE WHEN a.provider = 'outlook'
                THEN (SELECT count(*)::int FROM folders f WHERE f.account_id = a.id AND f.path LIKE $1 || '/%')
                ELSE (SELECT count(DISTINCT ${FOLDER_LABEL})::int FROM emails e WHERE e.account_id = a.id AND ${FOLDER_LABEL} <> $1)
              END AS folders
       FROM accounts a ORDER BY a.id`,
      [INBOX],
    ),
    langflowUp(),
  ]);

  return (
    <>
      <div className="head">
        <div>
          <h1>Comptes et IA</h1>
          <p>Tes boîtes connectées et le modèle qui trie, en local sur ta machine.</p>
        </div>
      </div>

      <h2 className="section-title">Boîtes mail</h2>
      <div className="accounts">
        {accounts.map((a) => {
          const gmail = a.provider === "gmail";
          return (
            <div key={a.id} className="panel account">
              <div className="who">
                <span className={`mark ${a.provider}`}>{gmail ? "G" : "O"}</span>
                <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                  <strong style={{ fontSize: 15 }}>{gmail ? "Gmail" : "Outlook"}</strong>
                  <span className="small muted ellip">{a.email}</span>
                </span>
              </div>
              <div className="stats">
                <span><b><Num value={a.mails} /></b><span className="small muted">mails</span></span>
                <span><b><Num value={a.folders} /></b><span className="small muted">{gmail ? "libellés" : "dossiers"}</span></span>
              </div>
              <span className="small muted">
                {gmail ? "Boîte de réception (onglets compris) et libellés." : "Boîte de réception et ses sous-dossiers."} Lecture, rangement et corbeille autorisés.
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <form action={syncNow}>
                  <PendingButton busy="Synchro…">Synchroniser</PendingButton>
                </form>
                <form action={disconnectAccount.bind(null, a.id)}>
                  <ConfirmButton
                    className="btn link-danger"
                    message={`Déconnecter ${a.email} ?\n\nUnibox oublie ce compte et efface ses ${a.mails} copies locales (propositions et tris en attente compris). Tes mails restent intacts dans ta boîte ${gmail ? "Gmail" : "Outlook"}.`}
                  >
                    Déconnecter
                  </ConfirmButton>
                </form>
              </div>
            </div>
          );
        })}
        <div className="connect">
          <Icon name="plus" size={28} />
          <strong style={{ fontSize: 15 }}>Connecter une boîte</strong>
          <span className="small">
            <a href="/api/auth/login">Outlook</a> <span className="muted">ou</span> <a href="/api/auth/google/login">Gmail</a>
          </span>
        </div>
      </div>

      <h2 className="section-title">IA locale</h2>
      <div className="ia">
        <div className={up ? "panel" : "panel down"}>
          <div className="ia-title">
            <span className={up ? "light ok" : "light down"} />
            {up ? "Prête à trier" : "Langflow ne répond pas"}
          </div>
          <p className="muted" style={{ margin: 0, maxWidth: "60ch" }}>
            {up
              ? "Langflow répond. Les analyses tournent sur ta carte graphique, par lots de 20 mails."
              : "Le tri et le nettoyage sont en pause. Lance Langflow dans un terminal avec cette commande, puis vérifie à nouveau."}
          </p>
          {!up && (
            <>
              <code className="cmd">{LANGFLOW_START}</code>
              <a href="/comptes" className="btn primary" style={{ alignSelf: "flex-start" }}>Vérifier à nouveau</a>
            </>
          )}
        </div>
        <div className="panel facts">
          <div><span className="muted">Modèle</span><strong>Qwen 2.5, 14 milliards de paramètres</strong></div>
          <div><span className="muted">Où</span><strong>Ollama, sur ta carte graphique</strong></div>
          <div><span className="muted">Vitesse</span><strong>Environ 2 min par lot de 20</strong></div>
          <div><span className="muted">Coût</span><strong>Gratuit, rien ne sort de ta machine</strong></div>
        </div>
      </div>

      <h2 className="section-title" style={{ marginTop: 32 }}>Apparence</h2>
      <p className="muted" style={{ margin: "0 0 12px" }}>Retenu sur cet appareil. « Système » suit le réglage clair/sombre du téléphone ou du PC.</p>
      <ThemeSwitch />
    </>
  );
}
