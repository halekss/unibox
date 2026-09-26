import Link from "next/link";
import { db } from "@/lib/db.ts";
import { FOLDER_LABEL, INBOX } from "@/lib/classify.ts";
import { plain, senderAddr, senderName, shortDate } from "../text.ts";
import { applyPendingToOutlook, confirmProposal, deleteEmail, syncNow } from "../actions.ts";
import { Icon, Prov } from "../Icons.tsx";
import { PendingButton } from "../Pending.tsx";

export const dynamic = "force-dynamic";

type Params = { dossier?: string; id?: string; p?: string; q?: string; ai?: string };

const proposalOf = (tags: string[]) => tags.find((t) => t.startsWith("folder:") || t.startsWith("new_folder_idea:"));
const label = (tag: string) => tag.slice(tag.indexOf(":") + 1).replace(`${INBOX}/`, "");

export default async function Inbox({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const folder = sp.dossier ?? INBOX;
  const provider = sp.p === "outlook" || sp.p === "gmail" ? sp.p : null;
  const q = sp.q?.trim() || null;
  const onlyAi = sp.ai === "1";

  const [{ rows: emails }, { rows: [pending] }] = await Promise.all([
    db.query(
      `SELECT id, provider, subject, sender, received_at, left(body_text, 200) AS snippet, tags FROM emails
       WHERE ${FOLDER_LABEL} = $1
         AND ($2::text IS NULL OR provider = $2)
         AND ($3::text IS NULL OR subject ILIKE '%' || $3 || '%' OR sender ILIKE '%' || $3 || '%')
         AND (NOT $4 OR tags::text ~ '"(folder|new_folder_idea):')
       ORDER BY received_at DESC LIMIT 200`,
      [folder, provider, q, onlyAi],
    ),
    db.query("SELECT count(*)::int AS n FROM emails WHERE app_folder IS NOT NULL"),
  ]);
  const selectedId = Number(sp.id) || emails[0]?.id;
  const { rows: [mail] } = selectedId
    ? await db.query("SELECT id, provider, subject, sender, received_at, body_text, tags FROM emails WHERE id = $1", [selectedId])
    : { rows: [] };

  // Keeps the current filters when changing one of them.
  const href = (over: Partial<Params>) => {
    const u = new URLSearchParams(Object.entries({ ...sp, ...over }).filter(([, v]) => v) as [string, string][]);
    return `/boite?${u}`;
  };
  const proposal = mail && proposalOf(mail.tags);

  return (
    <div className="inbox">
      <section className="list" aria-label="Liste des mails">
        <div className="list-head">
          <div className="row1">
            <h1>{folder}</h1>
            <form action={syncNow}>
              <PendingButton busy="Synchro…" className="btn small">Synchroniser</PendingButton>
            </form>
          </div>
          <form className="search" role="search">
            <Icon name="search" size={16} />
            {sp.dossier && <input type="hidden" name="dossier" value={sp.dossier} />}
            {provider && <input type="hidden" name="p" value={provider} />}
            <input type="text" name="q" defaultValue={q ?? ""} placeholder="Rechercher un expéditeur, un objet" aria-label="Rechercher" />
          </form>
          <nav className="filters" aria-label="Filtres">
            <Link href={href({ p: undefined, ai: undefined, id: undefined })} aria-current={!provider && !onlyAi ? "page" : undefined}>Tout</Link>
            <Link href={href({ p: "outlook", id: undefined })} aria-current={provider === "outlook" ? "page" : undefined}><Prov p="outlook" />Outlook</Link>
            <Link href={href({ p: "gmail", id: undefined })} aria-current={provider === "gmail" ? "page" : undefined}><Prov p="gmail" />Gmail</Link>
            <Link href={href({ ai: onlyAi ? undefined : "1", id: undefined })} aria-current={onlyAi ? "page" : undefined}>Avec proposition</Link>
          </nav>
        </div>
        {pending.n > 0 && (
          <form action={applyPendingToOutlook} className="banner" style={{ borderBottom: "1px solid var(--line)", marginBottom: 0 }}>
            <span className="small">{pending.n} mail(s) rangé(s) dans l'app mais pas encore dans leur boîte.</span>
            <PendingButton busy="En cours…" className="btn small primary">Appliquer</PendingButton>
          </form>
        )}
        <div className="mails-list">
          {emails.length === 0 && <p className="empty">{q ? "Aucun mail ne correspond à ta recherche." : "Aucun mail ici."}</p>}
          {emails.map((e) => {
            const prop = proposalOf(e.tags);
            return (
              <Link key={e.id} href={href({ id: String(e.id) })} className="mitem" aria-current={e.id === mail?.id ? "true" : undefined}>
                <span className="top">
                  <Prov p={e.provider} />
                  <span className="from">{senderName(e.sender)}</span>
                  <time dateTime={e.received_at.toISOString()}>{shortDate(e.received_at)}</time>
                </span>
                <span className="ellip" style={{ fontWeight: 500 }}>{e.subject || "(sans objet)"}</span>
                <span className="ellip small muted">{plain(e.snippet)}</span>
                {prop && <span className="chip ai">Proposé : {label(prop)}</span>}
              </Link>
            );
          })}
        </div>
      </section>

      <article className="reader" aria-label="Lecture">
        {!mail ? (
          <p className="empty">Choisis un mail dans la liste.</p>
        ) : (
          <>
            {proposal && (
              <form action={confirmProposal} className="aibar">
                <input type="hidden" name="tag" value={proposal} />
                <input type="hidden" name="name" value={label(proposal)} />
                <input type="hidden" name="ids" value={mail.id} />
                <Icon name="sort" size={20} />
                <span>
                  L'IA propose de ranger ce mail dans <strong>{label(proposal)}</strong>
                </span>
                <Link href={`/?casier=${encodeURIComponent(proposal)}`} className="btn">Voir dans À ranger</Link>
                <PendingButton busy="Rangement…" className="btn primary">{`Ranger dans ${label(proposal)}`}</PendingButton>
              </form>
            )}
            <h2>{mail.subject || "(sans objet)"}</h2>
            <div className="meta">
              <span className="avatar">{senderName(mail.sender)[0]?.toUpperCase()}</span>
              <div>
                <strong>{senderName(mail.sender)}</strong>
                <span className="small muted">
                  {senderAddr(mail.sender)}, reçu sur {mail.provider === "gmail" ? "Gmail" : "Outlook"} le{" "}
                  {mail.received_at.toLocaleString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <form action={deleteEmail.bind(null, mail.id)}>
                <button className="btn icon" aria-label="Supprimer (corbeille de la boîte, récupérable)" title="Supprimer (corbeille, récupérable)">
                  <Icon name="trash" />
                </button>
              </form>
            </div>
            <pre className="body">{plain(mail.body_text) || "(mail vide)"}</pre>
          </>
        )}
      </article>
    </div>
  );
}
