import { db } from "./db.ts";

export const INBOX = "Boîte de réception";
const BODY_CHARS = 2000;

type Email = { id: number; sender: string | null; subject: string | null; body_text: string | null; tags?: string[] };
export type Prediction = { folder: string | null; confidence: string | null; new_folder_idea: string | null; delete_reason?: string | null };
type Catalog = { text: string; paths: Set<string> };

// Where an email lives in the app: the folder confirmed in the app wins over the Outlook folder.
export const EFFECTIVE_FOLDER = "coalesce(app_folder, folder)";
// Display name of a folder: app folders are bare names ("Epitech"), mailbox folders full paths
// ("Boîte de réception/Epitech"); both map to "Epitech". The Inbox itself keeps its name.
export const FOLDER_LABEL = `regexp_replace(${EFFECTIVE_FOLDER}, '^Boîte de réception/', '')`;

// Sent to the model: every folder (Outlook subfolders + folders confirmed in the app) with 3 example
// subjects, plus the new-folder ideas already pending so the model reuses their names.
// `excludeIds` keeps the emails being evaluated out of the examples.
export async function folderCatalog(excludeIds: number[] = []): Promise<Catalog> {
  const { rows } = await db.query(
    `SELECT f, string_agg(coalesce(subject, '(sans objet)'), ' ; ') AS examples
     FROM (SELECT ${EFFECTIVE_FOLDER} AS f, subject,
                  row_number() OVER (PARTITION BY ${EFFECTIVE_FOLDER} ORDER BY received_at DESC) AS rn
           FROM emails WHERE ${EFFECTIVE_FOLDER} <> $1 AND NOT (id = ANY($2))) t
     WHERE rn <= 3 GROUP BY f ORDER BY f`,
    [INBOX, excludeIds],
  );
  const { rows: ideas } = await db.query(
    `SELECT DISTINCT substr(t, 17) AS idea FROM emails, jsonb_array_elements_text(tags) t
     WHERE t LIKE 'new_folder_idea:%' ORDER BY 1`,
  );
  const text = [
    ...rows.map((r) => `- ${r.f} (ex. : ${r.examples})`),
    "",
    `Idées de nouveaux dossiers déjà proposées : ${ideas.map((r) => r.idea).join(", ") || "aucune"}`,
  ].join("\n");
  return { text, paths: new Set(rows.map((r) => r.f as string)) };
}

// Pulls the first {...} out of the model's answer; an unknown folder path counts as null.
export function parsePrediction(answer: string, paths: Set<string>): Prediction {
  const match = answer.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`Réponse du modèle sans JSON : ${answer.slice(0, 200)}`);
  const raw = JSON.parse(match[0]);
  const folder = typeof raw.folder === "string" && paths.has(raw.folder) ? raw.folder : null;
  const confidence = typeof raw.confidence === "string" ? raw.confidence : null;
  const idea = typeof raw.new_folder_idea === "string" && raw.new_folder_idea.trim() ? raw.new_folder_idea.trim() : null;
  const del = typeof raw.delete_reason === "string" && raw.delete_reason.trim() ? raw.delete_reason.trim() : null;
  return { folder, confidence, new_folder_idea: idea, delete_reason: del };
}

// Only a confident existing-folder match is kept; otherwise the new-folder idea is suggested instead.
export function decide(p: Prediction): { folder: string | null; new_folder_idea: string | null } {
  return p.folder && p.confidence === "haute" ? { folder: p.folder, new_folder_idea: null } : { folder: null, new_folder_idea: p.new_folder_idea };
}

export const LANGFLOW_DOWN = "Langflow ne répond pas";
const LANGFLOW_START = "LANGFLOW_OPEN_BROWSER=false ~/ProjetsWSL/langflow/.venv/bin/langflow run --host 127.0.0.1 --port 7860";

export async function classify(email: Email, catalog: Catalog): Promise<Prediction> {
  const input = [
    "Dossiers :",
    catalog.text,
    "",
    "Email :",
    `De : ${email.sender ?? ""}`,
    `Objet : ${email.subject ?? ""}`,
    (email.body_text ?? "").slice(0, BODY_CHARS),
  ];
  const rejected = (email.tags ?? []).filter((t) => t.startsWith("rejected:")).map((t) => t.slice(t.indexOf(":", 9) + 1));
  if (rejected.length) input.push("", `Propositions déjà refusées par l'utilisateur pour cet email (propose autre chose) : ${rejected.join(", ")}`);


  const res = await fetch(`${process.env.LANGFLOW_URL}/api/v1/run/${process.env.LANGFLOW_FLOW_ID}?stream=false`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": process.env.LANGFLOW_API_KEY! },
    body: JSON.stringify({ input_value: input.join("\n"), input_type: "chat", output_type: "chat" }),
  }).catch(() => {
    // Network-level failure (refused, timeout): Langflow is not running, which the raw "fetch failed" hides.
    throw new Error(`${LANGFLOW_DOWN} (${process.env.LANGFLOW_URL}). Lance-le : ${LANGFLOW_START}`);
  });
  if (!res.ok) throw new Error(`Langflow ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  return parseOrNothing(json.outputs[0].outputs[0].results.message.text, catalog.paths, email.id);
}

// The model occasionally returns malformed JSON. At temperature 0 a retry gives the same answer, so an
// unreadable answer counts as "no opinion": the email is marked processed and the run goes on.
export function parseOrNothing(answer: string, paths: Set<string>, emailId?: number): Prediction {
  try {
    return parsePrediction(answer, paths);
  } catch (e) {
    console.warn(`classify: réponse illisible pour l'email ${emailId}: ${(e as Error).message}`);
    return { folder: null, confidence: null, new_folder_idea: null, delete_reason: null };
  }
}

// Stored as a flat tag list; "ai:<model>" marks the email as processed even when nothing is suggested.
// Earlier "rejected:" tags are kept: they count refusals and steer the next proposal.
// A "keep" tag (set from the Nettoyage page) is kept too and blocks new delete suggestions.
export function toTags(p: Prediction, previous: string[] = []): string[] {
  const d = decide(p);
  const keep = previous.includes("keep");
  return [
    ...previous.filter((t) => t.startsWith("rejected:") || t === "keep"),
    "ai:qwen2.5:14b",
    ...(d.folder ? [`folder:${d.folder}`] : []),
    ...(d.new_folder_idea ? [`new_folder_idea:${d.new_folder_idea}`] : []),
    ...(p.delete_reason && !keep ? [`delete_suggested:${p.delete_reason}`] : []),
  ];
}

// Emails refused this many times are offered for deletion on the Nettoyage page.
export const REFUSALS_BEFORE_DELETE = 2;

// Nettoyage candidates: flagged by the AI, or refused too often. Emails marked "keep" never come back.
export const CLEANUP_WHERE = `NOT tags ? 'keep'
  AND (tags::text LIKE '%"delete_suggested:%'
       OR (SELECT count(*) FROM jsonb_array_elements_text(tags) t WHERE t LIKE 'rejected:%') >= ${REFUSALS_BEFORE_DELETE})`;

// Status light for the sidebar and the Comptes page. Short timeout: it runs on every page render.
export async function langflowUp(): Promise<boolean> {
  try {
    return (await fetch(`${process.env.LANGFLOW_URL}/health`, { signal: AbortSignal.timeout(800) })).ok;
  } catch {
    return false;
  }
}

// Classifies the Inbox-root emails without a pending AI proposal: never-analysed first, then the ones
// whose proposals were refused (fewest refusals first). `dry` returns predictions without writing.
export async function tagInbox(limit: number, dry = false) {
  const { rows } = await db.query(
    `SELECT id, sender, subject, body_text, tags FROM emails
     WHERE ${EFFECTIVE_FOLDER} = $1 AND NOT tags ? 'ai:qwen2.5:14b'
     ORDER BY (SELECT count(*) FROM jsonb_array_elements_text(tags) t WHERE t LIKE 'rejected:%'), received_at DESC
     LIMIT $2`,
    [INBOX, limit],
  );
  const catalog = await folderCatalog();
  const results = [];
  for (const e of rows) {
    const pred = await classify(e, catalog);
    if (!dry) await db.query("UPDATE emails SET tags = $1 WHERE id = $2", [JSON.stringify(toTags(pred, e.tags)), e.id]);
    results.push({ subject: e.subject, sender: e.sender, confidence: pred.confidence, ...decide(pred) });
  }
  return results;
}

const CLEANUP_MARK = "cleanup:qwen2.5:14b";

// Asks the model only for a delete opinion on emails already filed in a folder (the folder choice is ignored).
// Each email is marked once examined, so the scan can be interrupted and resumed.
export async function scanFoldersForCleanup(limit: number) {
  const { rows } = await db.query(
    `SELECT id, sender, subject, body_text, tags, ${EFFECTIVE_FOLDER} AS f FROM emails
     WHERE ${EFFECTIVE_FOLDER} <> $1 AND NOT tags ? $2 AND NOT tags ? 'keep'
     ORDER BY received_at LIMIT $3`,
    [INBOX, CLEANUP_MARK, limit],
  );
  let suggested = 0;
  for (const e of rows) {
    const note = { text: `(aucun à choisir : cet email est déjà rangé dans « ${e.f} ». Donne seulement delete_reason.)`, paths: new Set<string>() };
    const { delete_reason } = await classify(e, note);
    const add = [CLEANUP_MARK, ...(delete_reason ? [`delete_suggested:${delete_reason}`] : [])];
    await db.query("UPDATE emails SET tags = tags || $1::jsonb WHERE id = $2", [JSON.stringify(add), e.id]);
    if (delete_reason) suggested++;
  }
  return { scanned: rows.length, suggested, left: await cleanupLeft() };
}

export async function cleanupLeft(): Promise<number> {
  const { rows } = await db.query(
    `SELECT count(*)::int AS n FROM emails WHERE ${EFFECTIVE_FOLDER} <> $1 AND NOT tags ? $2 AND NOT tags ? 'keep'`,
    [INBOX, CLEANUP_MARK],
  );
  return rows[0].n;
}
