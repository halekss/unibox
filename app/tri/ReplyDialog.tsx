"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { motion } from "motion/react";
import { badge, DONE, senderName, toValidate } from "@/lib/triage.ts";
import { mailBody, replyDraft } from "../actions.ts";
import { MailFrame } from "../MailFrame.tsx";
import { Pill, spring } from "./Pill.tsx";
import type { Mail } from "./Triage.tsx";

const btn = "rounded-full px-4 py-2 text-sm font-bold transition-colors disabled:opacity-50 cursor-pointer";
// DESIGN_TOKENS "bouton secondaire" / "bouton principal".
const secondary = `${btn} border border-border-strong bg-surface text-text hover:bg-surface-muted`;
const primary = `${btn} border-0 bg-accent text-on-accent hover:bg-accent-hover`;

// Act 4: the received email on the left, the prepared reply on the right. "Créer le brouillon" saves it in the
// mailbox's drafts; nothing is ever sent from here.
export function ReplyDialog({ mail, onClose, onDrafted, onDone }: { mail: Mail; onClose: () => void; onDrafted: (id: number, text: string) => void; onDone: (id: number, done: boolean) => void }) {
  const t = mail.triage!;
  const ref = useRef<HTMLDialogElement>(null);
  const [body, setBody] = useState<{ html: string | null; text: string | null } | null>(null);
  const [text, setText] = useState(t.draft ?? "");
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const canReply = t.category === "repondre" || editing;

  useEffect(() => {
    ref.current?.showModal();
    mailBody(mail.id).then(setBody, () => setBody({ html: null, text: "Impossible de charger ce mail." }));
  }, [mail.id]);

  const save = () =>
    start(async () => {
      setError(null);
      const r = await replyDraft(mail.id, text);
      if (r.error) setError(r.error);
      else onDrafted(mail.id, text.trim());
    });

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-label={`Mail de ${senderName(mail.sender)}`}
      className="m-auto h-[min(760px,92vh)] w-[min(1120px,94vw)] max-w-none border-0 bg-transparent p-0 backdrop:bg-overlay"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={spring}
        className="grid h-full grid-rows-[1fr_1fr] gap-3 rounded-panel border border-border bg-bg p-3 text-text shadow-card md:grid-cols-2 md:grid-rows-1"
      >
        <section className="flex min-h-0 flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
          <header className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-lg font-extrabold">{senderName(mail.sender)}</p>
              <p className="truncate text-sm text-text-secondary">{mail.subject ?? "(sans objet)"}</p>
            </div>
            <Pill category={t.category} />
          </header>
          <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-surface">
            {!body ? (
              <p className="p-4 text-sm text-text-secondary">Chargement…</p>
            ) : (
              <MailFrame
                html={body.html}
                text={body.text}
                className={body.html ? "h-full w-full border-0" : "m-0 h-full overflow-auto whitespace-pre-wrap p-4 font-sans text-sm text-text [&_a]:text-accent [&_a]:underline"}
              />
            )}
          </div>
        </section>

        <section className="flex min-h-0 flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
          <header className="flex items-center justify-between gap-3">
            <p className="text-lg font-extrabold">{canReply ? "Réponse préparée" : "Ce que j'ai compris"}</p>
            <div className="flex gap-2">
              {t.category !== "archiver" && (
                <button
                  onClick={() => {
                    onDone(mail.id, !t.done);
                    ref.current?.close();
                  }}
                  className={secondary}
                >
                  {t.done ? "Remettre dans sa colonne" : DONE[t.category].button}
                </button>
              )}
              <button onClick={() => ref.current?.close()} className={secondary} aria-label="Fermer">
                Fermer
              </button>
            </div>
          </header>
          <p className="text-sm text-text-secondary">
            {t.summary} · <Pill category={t.category} tone={toValidate(t) ? "ai" : t.drafted || t.done ? "success" : undefined}>{badge(t)}</Pill>
          </p>
          {canReply ? (
            <>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                readOnly={!editing && !!t.draft}
                placeholder="Écris ta réponse…"
                aria-label="Réponse"
                className={`min-h-0 flex-1 resize-none rounded-xl border p-3 text-sm leading-relaxed outline-none focus:border-accent ${!editing && !!t.draft && !t.drafted ? "border-dashed border-ai bg-ai-soft text-ai-text" : "border-border-strong bg-surface text-text"}`}
              />
              {error && <p role="alert" className="text-sm font-semibold text-text">{error}</p>}
              <footer className="flex flex-wrap items-center justify-end gap-2">
                <span className="mr-auto text-xs text-text-secondary">Rien n&apos;est envoyé : le brouillon attend dans ta boîte.</span>
                {!editing && !!t.draft && (
                  <button onClick={() => setEditing(true)} className={secondary}>
                    Modifier
                  </button>
                )}
                <button onClick={save} disabled={pending || t.drafted || !text.trim()} className={primary}>
                  {t.drafted ? "Brouillon déjà créé" : pending ? "Création…" : "Créer le brouillon"}
                </button>
              </footer>
            </>
          ) : (
            <button onClick={() => setEditing(true)} className={`${secondary} self-start`}>
              Répondre quand même
            </button>
          )}
        </section>
      </motion.div>
    </dialog>
  );
}
