import Link from "next/link";
import { db } from "@/lib/db.ts";
import { CLEANUP_WHERE, EFFECTIVE_FOLDER, INBOX, langflowUp } from "@/lib/classify.ts";
import { folderList } from "./queries.ts";
import { folderTree, type Folder } from "@/lib/folders.ts";
import { Icon, Prov } from "./Icons.tsx";
import { NavLinks } from "./NavLinks.tsx";

function FolderNode({ node }: { node: Folder }) {
  const row = (
    <>
      <Link href={`/boite?dossier=${encodeURIComponent(node.path)}`} className="fname">{node.name}</Link>
      {[...node.provs].sort().map((p) => <Prov key={p} p={p} />)}
      <span className="n">{node.n}</span>
    </>
  );
  if (node.children.size === 0) return <div className="frow leaf">{row}</div>;
  return (
    <details className="fgroup">
      <summary className="frow">
        <span className="caret" aria-hidden="true" />
        {row}
      </summary>
      <div className="fchildren">
        {[...node.children.values()].map((c) => <FolderNode key={c.path} node={c} />)}
      </div>
    </details>
  );
}

export async function Sidebar() {
  const [{ rows: [c] }, folders, up] = await Promise.all([
    db.query(
      `SELECT count(*) FILTER (WHERE ${EFFECTIVE_FOLDER} = $1)::int AS inbox,
              count(*) FILTER (WHERE tags::text ~ '"(folder|new_folder_idea):')::int AS to_sort,
              count(*) FILTER (WHERE ${CLEANUP_WHERE})::int AS to_clean
       FROM emails`,
      [INBOX],
    ),
    folderList(),
    langflowUp(),
  ]);

  return (
    <aside className="side">
      <Link href="/boite" className="brand">
        <span className="logo"><Icon name="mail" /></span>
        Unibox
      </Link>
      <NavLinks inbox={c.inbox} toSort={c.to_sort} toClean={c.to_clean} />
      <nav className="folders" aria-label="Dossiers">
        <span className="side-label">Dossiers</span>
        {[...folderTree(folders).children.values()].map((node) => <FolderNode key={node.path} node={node} />)}
      </nav>
      <Link href="/comptes" className="status">
        <span className={up ? "light ok" : "light down"} />
        <span>
          {up ? "IA locale prête" : "IA hors ligne"}
          <br />
          <span className="sub">{up ? "Langflow répond" : "Voir comment la lancer"}</span>
        </span>
      </Link>
    </aside>
  );
}
