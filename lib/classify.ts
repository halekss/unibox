import { db } from "./db.ts";

export const INBOX = "Boîte de réception";
const BODY_CHARS = 2000;

type Email = { id: number; sender: string | null; subject: string | null; body_text: string | null; tags?: string[] };
export type Prediction = { folder: string | null; confidence: string | null; new_folder_idea: string | null; delete_reason?: string | null };
type Catalog = { text: string; paths: Set<string> };

// Where an email lives in the app: the folder confirmed in the app wins over the Outlook folder.
export const EFFECTIVE_FOLDER = "coalesce(app_folder, folder)";

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
  });
  if (!res.ok) throw new Error(`Langflow ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  return parsePrediction(json.outputs[0].outputs[0].results.message.text, catalog.paths);
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
