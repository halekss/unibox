"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { motion } from "motion/react";
import { badge, DONE, senderName } from "@/lib/triage.ts";
import { mailBody, replyDraft } from "../actions.ts";
import { MailFrame } from "../MailFrame.tsx";
import { Pill, spring } from "./Pill.tsx";
import type { Mail } from "./Triage.tsx";

const btn = "rounded-full px-4 py-2 text-sm font-bold transition-opacity disabled:opacity-50 cursor-pointer";

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
      className="m-auto h-[min(760px,92vh)] w-[min(1120px,94vw)] max-w-none border-0 bg-transparent p-0 backdrop:bg-night-950/70 backdrop:backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={spring}
        className="grid h-full grid-rows-[1fr_1fr] gap-3 rounded-panel border border-rim bg-night-900/90 p-3 text-white shadow-glow backdrop-blur-glass md:grid-cols-2 md:grid-rows-1"
      >
        <section className="flex min-h-0 flex-col gap-3 rounded-2xl border border-rim bg-glass p-4">
          <header className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-lg font-extrabold">{senderName(mail.sender)}</p>
              <p className="truncate text-sm text-mist">{mail.subject ?? "(sans objet)"}</p>
            </div>
            <Pill category={t.category} />
          </header>
          <div className="min-h-0 flex-1 overflow-hidden rounded-xl bg-white">
            {!body ? (
              <p className="p-4 text-sm text-night-800">Chargement…</p>
            ) : (
              <MailFrame
                html={body.html}
                text={body.text}
                className={body.html ? "h-full w-full border-0" : "m-0 h-full overflow-auto whitespace-pre-wrap p-4 font-sans text-sm text-night-900 [&_a]:text-night-800 [&_a]:underline"}
              />
            )}
          </div>
        </section>

        <section className="flex min-h-0 flex-col gap-3 rounded-2xl border border-rim bg-glass p-4">
          <header className="flex items-center justify-between gap-3">
            <p className="text-lg font-extrabold">{canReply ? "Réponse préparée" : "Ce que j'ai compris"}</p>
            <div className="flex gap-2">
              {t.category !== "archiver" && (
                <button
                  onClick={() => {
                    onDone(mail.id, !t.done);
                    ref.current?.close();
                  }}
                  className={`${btn} ${t.done ? "border border-rim bg-transparent" : "border-0 bg-halo-soft text-night-950"}`}
                >
                  {t.done ? "Remettre dans sa colonne" : DONE[t.category].button}
                </button>
              )}
              <button onClick={() => ref.current?.close()} className={`${btn} border border-rim bg-transparent text-mist`} aria-label="Fermer">
                Fermer
              </button>
            </div>
          </header>
          <p className="text-sm text-mist">
            {t.summary} · <Pill category={t.category}>{badge(t)}</Pill>
          </p>
          {canReply ? (
            <>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                readOnly={!editing && !!t.draft}
                placeholder="Écris ta réponse…"
                aria-label="Réponse"
                className="min-h-0 flex-1 resize-none rounded-xl border border-rim bg-night-950/60 p-3 text-sm leading-relaxed text-white outline-none focus:border-halo read-only:text-halo-soft"
              />
              {error && <p role="alert" className="text-sm text-cat-faire">{error}</p>}
              <footer className="flex flex-wrap items-center justify-end gap-2">
                <span className="mr-auto text-xs text-mist">Rien n&apos;est envoyé : le brouillon attend dans ta boîte.</span>
                {!editing && !!t.draft && (
                  <button onClick={() => setEditing(true)} className={`${btn} border border-rim bg-transparent`}>
                    Modifier
                  </button>
                )}
                <button onClick={save} disabled={pending || t.drafted || !text.trim()} className={`${btn} border-0 bg-halo text-night-950`}>
                  {t.drafted ? "Brouillon déjà créé" : pending ? "Création…" : "Créer le brouillon"}
                </button>
              </footer>
            </>
          ) : (
            <button onClick={() => setEditing(true)} className={`${btn} self-start border border-rim bg-transparent`}>
              Répondre quand même
            </button>
          )}
        </section>
      </motion.div>
    </dialog>
  );
}
