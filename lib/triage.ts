// "Email Triage" flow (langflow/create_triage_flow.py): what an email asks of the user, stored in emails.triage.
// No server imports here: the client components share these categories.

// Order = kanban column order. Keys must match the flow's prompt. Colors: tokens from app/tokens.css
// (DESIGN_TOKENS.md, pale background + dark text of the same hue).
export const CATEGORIES = {
  repondre: { label: "À répondre", verb: "Je prépare une réponse.", bg: "var(--cat-repondre-bg)", text: "var(--cat-repondre-text)" },
  faire: { label: "À faire", verb: "Je le note à faire.", bg: "var(--cat-faire-bg)", text: "var(--cat-faire-text)" },
  argent: { label: "Argent", verb: "Je le range dans Argent.", bg: "var(--cat-argent-bg)", text: "var(--cat-argent-text)" },
  lire: { label: "À lire", verb: "Je le garde à lire.", bg: "var(--cat-lire-bg)", text: "var(--cat-lire-text)" },
  archiver: { label: "Archivé", verb: "J'archive.", bg: "var(--cat-archiver-bg)", text: "var(--cat-archiver-text)" },
} as const;
export type Category = keyof typeof CATEGORIES;

// `drafted`: the reply was saved as a draft in the mailbox (set by createReplyDraft, never by the model).
// `done`: the user said it is handled (replied, done, read); set by markDone, never by the model.
export type Triage = { category: Category; summary: string; amount: string | null; draft: string | null; drafted?: boolean; done?: boolean };

// What "done" means per category (button label and card badge). Archivé has nothing left to do.
export const DONE: Record<Exclude<Category, "archiver">, { button: string; badge: string }> = {
  repondre: { button: "Déjà répondu", badge: "Répondu" },
  faire: { button: "C'est fait", badge: "Fait" },
  argent: { button: "C'est réglé", badge: "Réglé" },
  lire: { button: "Lu", badge: "Lu" },
};

// Board column: a handled email joins Archivé, whatever its category.
export const column = (t: Triage): Category => (t.done ? "archiver" : t.category);

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

// Pulls the first {...} out of the answer. An unreadable answer or unknown category becomes "lire" with an
// honest summary, so the run goes on and the email still gets a column.
export function parseTriage(answer: string): Triage {
  try {
    const raw = JSON.parse(answer.match(/\{[\s\S]*\}/)![0]);
    const category: Category = raw.category in CATEGORIES ? raw.category : "lire";
    return {
      category,
      summary: str(raw.summary) ?? "Sans résumé",
      amount: str(raw.amount),
      draft: category === "repondre" ? str(raw.draft) : null,
    };
  } catch {
    return { category: "lire", summary: "Réponse de l'IA illisible, à lire toi-même", amount: null, draft: null };
  }
}

const BODY_CHARS = 2000;

export const triageInput = (e: { sender: string | null; subject: string | null; body_text: string | null }) =>
  [`De : ${e.sender ?? ""}`, `Objet : ${e.subject ?? ""}`, (e.body_text ?? "").slice(0, BODY_CHARS)].join("\n");

// Card badge: what was prepared for this email.
export function badge(t: Triage): string {
  if (t.done && t.category !== "archiver") return DONE[t.category].badge;
  if (t.category === "repondre") return t.drafted ? "Brouillon créé" : t.draft ? "Réponse rédigée" : "Réponse à écrire";
  if (t.category === "argent") return t.amount ?? "Montant à vérifier";
  return { faire: "Action à faire", lire: "À lire", archiver: "Archivé" }[t.category];
}

// Replies waiting for the user's validation.
export const toValidate = (t: Triage | null) => t?.category === "repondre" && !!t.draft && !t.drafted && !t.done;

// "Jane Doe <jane@x.fr>" -> "Jane Doe"; a bare address stays as is.
export const senderName = (s: string | null) => (s ?? "Inconnu").replace(/\s*<[^>]*>$/, "").replace(/^"|"$/g, "") || (s ?? "Inconnu");
