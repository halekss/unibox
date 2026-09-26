import { db } from "@/lib/db.ts";
import { FOLDER_LABEL, INBOX } from "@/lib/classify.ts";

// Folders of the Inbox tree (display name), with the mailboxes they exist in and their email count.
// Outlook folders without any email are included through the `folders` table.
export async function folderList(): Promise<{ f: string; provs: string[]; n: number }[]> {
  const { rows } = await db.query(
    `SELECT f, array_agg(DISTINCT provider ORDER BY provider) AS provs, sum(n)::int AS n FROM (
       SELECT ${FOLDER_LABEL} AS f, provider, count(*) AS n FROM emails GROUP BY 1, 2
       UNION ALL
       SELECT substr(fo.path, length($1) + 2), a.provider, 0 FROM folders fo JOIN accounts a ON a.id = fo.account_id
       WHERE fo.path LIKE $1 || '/%'
     ) x WHERE f <> $1 GROUP BY f ORDER BY lower(f)`,
    [INBOX],
  );
  return rows;
}
