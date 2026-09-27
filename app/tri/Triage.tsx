"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, MotionConfig, motion, useReducedMotion } from "motion/react";
import NumberFlow from "@number-flow/react";
import { Toaster, toast } from "sonner";
import { badge, CATEGORIES, type Category, column, DONE, senderName, toValidate, type Triage } from "@/lib/triage.ts";
import { markDone } from "../actions.ts";
import { Pill, spring } from "./Pill.tsx";
import { ReplyDialog } from "./ReplyDialog.tsx";

export type Mail = { id: number; provider: string; sender: string | null; subject: string | null; received_at: string; triage: Triage | null };
type Phase = "idle" | "reading" | "summary" | "sorting";

const KEYS = Object.keys(CATEGORIES) as Category[];
const VISIBLE = 5; // cards per column before "+ N autres"
// Panels: muted surface; cards inside them are plain surfaces (DESIGN_TOKENS "ligne de mail").
const glass = "rounded-panel border border-border bg-surface-muted text-text";
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
const rise = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0 } };

function when(iso: string) {
  const d = new Date(iso);
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function Orb({ size = "size-14" }: { size?: string }) {
  return (
    <motion.span
      aria-hidden
      className={`tri-orb ${size} shrink-0 rounded-full shadow-card`}
      animate={{ scale: [1, 1.08, 1] }}
      transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

// The 4 acts: reading (live SSE feed) -> summary (counts) -> sorting (cards fly to their column) -> idle
// board, where a card opens the reply dialog. Everything shown comes from the emails in the database.
export function TriageStage({ initial }: { initial: Mail[] }) {
  const [mails, setMails] = useState(initial);
  // Emails shown in a column; the others are in the list on the left.
  const [placed, setPlaced] = useState(() => new Set(initial.filter((m) => m.triage).map((m) => m.id)));
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState({ n: 0, total: 0 });
  const [feed, setFeed] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(new Set<Category>());
  const run = useRef<number[]>([]); // ids decided in the current run, in order
  const source = useRef<EventSource | null>(null);
  const reduced = useReducedMotion();

  const byId = useMemo(() => new Map(mails.map((m) => [m.id, m])), [mails]);
  const queue = mails.filter((m) => !placed.has(m.id));
  const board = mails.filter((m) => placed.has(m.id));
  const count = (list: Mail[], k: Category) => list.filter((m) => m.triage && column(m.triage) === k).length;
  const pending = board.filter((m) => toValidate(m.triage)).length;

  useEffect(() => () => source.current?.close(), []);

  function start() {
    run.current = [];
    setFeed([]);
    setError(null);
    setProgress({ n: 0, total: 0 });
    setPhase("reading");
    const es = new EventSource("/api/triage");
    source.current = es;
    const end = (message?: string) => {
      es.close();
      if (message) setError(message);
      else if (!run.current.length) toast("Rien de nouveau : les mails récents sont déjà triés.");
      setPhase(run.current.length ? "summary" : "idle");
    };
    es.addEventListener("start", (e) => setProgress({ n: 0, total: JSON.parse(e.data).total }));
    es.addEventListener("decision", (e) => {
      const { n, mail } = JSON.parse(e.data) as { n: number; mail: Mail };
      run.current.push(mail.id);
      setProgress((p) => ({ ...p, n }));
      setMails((ms) => (ms.some((m) => m.id === mail.id) ? ms.map((m) => (m.id === mail.id ? { ...m, triage: mail.triage } : m)) : [mail, ...ms]));
      setFeed((f) => [mail.id, ...f].slice(0, 7));
    });
    es.addEventListener("failure", (e) => end(JSON.parse(e.data).message));
    es.addEventListener("done", () => end());
    es.onerror = () => end("Connexion au tri perdue. Les mails déjà lus sont enregistrés : relance pour continuer.");
  }

  // Act 2 -> 3 after a moment to read the counts (or on "Ranger").
  useEffect(() => {
    if (phase !== "summary") return;
    const t = setTimeout(() => setPhase("sorting"), 3200);
    return () => clearTimeout(t);
  }, [phase]);

  // Act 3: columns stagger in, then the run's emails leave the list one by one (shared layoutId animation).
  useEffect(() => {
    if (phase !== "sorting") return;
    const ids = run.current.filter((id) => !placed.has(id));
    if (reduced) {
      setPlaced((s) => new Set([...s, ...ids]));
      setPhase("idle");
      return;
    }
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    const step = () => {
      if (i >= ids.length) return setPhase("idle");
      const id = ids[i++];
      setPlaced((s) => new Set(s).add(id));
      timer = setTimeout(step, 160);
    };
    timer = setTimeout(step, 700);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `placed` is read once, when sorting starts
  }, [phase, reduced]);

  function drafted(id: number, text: string) {
    const m = byId.get(id)!;
    setMails((ms) => ms.map((x) => (x.id === id ? { ...x, triage: { ...x.triage!, draft: text, drafted: true } } : x)));
    setOpenId(null);
    const left = pending - (toValidate(m.triage) ? 1 : 0);
    toast.custom(() => <DraftToast name={senderName(m.sender)} left={left} />, { duration: 4500 });
  }

  // Optimistic: the card flies to Archivé (or back) at once; a failed save puts it back.
  function setDone(id: number, done: boolean) {
    const patch = (d: boolean) => setMails((ms) => ms.map((x) => (x.id === id ? { ...x, triage: { ...x.triage!, done: d } } : x)));
    patch(done);
    markDone(id, done).catch(() => {
      patch(!done);
      toast("Enregistrement impossible, réessaie.");
    });
  }

  const open = openId === null ? null : byId.get(openId);

  return (
    <MotionConfig reducedMotion="user" transition={spring}>
      <LayoutGroup>
        <div className="relative isolate flex min-h-[calc(100vh-68px)] flex-col gap-5 text-text">
          <header className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="m-0 text-3xl font-black tracking-tight text-text">Tri IA</h1>
              <p className="m-0 text-sm text-text-secondary">Chaque mail lu, compris et rangé selon ce qu&apos;il attend de toi.</p>
            </div>
            <button
              onClick={start}
              disabled={phase !== "idle"}
              className="flex cursor-pointer items-center gap-3 rounded-full border-0 bg-accent py-2 pl-2 pr-5 text-sm font-bold text-on-accent transition-colors hover:bg-accent-hover disabled:cursor-default"
            >
              <Orb size="size-7" />
              {phase === "idle" ? "Traiter mes mails" : "En cours…"}
            </button>
          </header>
          {error && (
            <p role="alert" className={`${glass} m-0 border-border-strong px-4 py-3 text-sm`}>
              {error}
            </p>
          )}

          <div className="grid flex-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
            <aside className={`${glass} flex flex-col gap-3 self-start p-3`}>
              <h2 className="m-0 flex items-center justify-between px-1 text-base font-extrabold">
                À trier <NumberFlow value={queue.length} className="text-text-secondary" />
              </h2>
              {queue.length === 0 && <p className="m-0 px-1 text-sm text-text-secondary">Tout est rangé.</p>}
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {queue.map((m) => (
                  <motion.li key={m.id} layoutId={`mail-${m.id}`} className="rounded-xl border border-border bg-surface p-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-bold">{senderName(m.sender)}</span>
                      <time suppressHydrationWarning className="shrink-0 text-[11px] text-text-secondary">
                        {when(m.received_at)}
                      </time>
                    </div>
                    <p className="m-0 truncate text-xs text-text-secondary">{m.subject ?? "(sans objet)"}</p>
                    <AnimatePresence>
                      {m.triage && (
                        <motion.div initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} className="mt-2 origin-left">
                          <Pill category={m.triage.category} />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.li>
                ))}
              </ul>
            </aside>

            <section className="relative min-h-[560px]">
              {(board.length > 0 || phase === "sorting") && (
                <div className="flex flex-col gap-4 pb-24">
                  <div className="flex items-center gap-4">
                    <Orb />
                    <div>
                      <h2 className="m-0 text-2xl font-black tracking-tight md:text-3xl">
                        <NumberFlow value={board.length} /> mails lus, compris et rangés
                      </h2>
                      <p className="m-0 text-text-secondary">
                        {pending ? (
                          <>
                            Il te reste <NumberFlow value={pending} /> réponse{pending > 1 ? "s" : ""} à valider.
                          </>
                        ) : (
                          "Aucune réponse en attente de validation."
                        )}
                      </p>
                    </div>
                  </div>
                  <motion.div
                    key={phase === "sorting" ? "sorting" : "board"}
                    variants={stagger}
                    initial={phase === "sorting" ? "hidden" : false}
                    animate="show"
                    className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(200px,1fr))]"
                  >
                    {KEYS.map((k) => {
                      const list = board.filter((m) => column(m.triage!) === k);
                      const all = expanded.has(k);
                      return (
                        <motion.section key={k} variants={rise} className={`${glass} flex flex-col gap-2 self-start p-3`}>
                          <header className="flex items-center justify-between px-1">
                            <h3 className="m-0 text-base font-extrabold">{CATEGORIES[k].label}</h3>
                            <NumberFlow value={list.length} className="text-xl font-black text-text-secondary" />
                          </header>
                          <ul className="m-0 flex list-none flex-col gap-2 p-0">
                            {(all ? list : list.slice(0, VISIBLE)).map((m) => (
                              <motion.li key={m.id} layoutId={`mail-${m.id}`} className={`relative ${m.triage!.drafted || m.triage!.done ? "opacity-60" : ""}`}>
                                {m.triage!.category !== "archiver" && (
                                  <button
                                    onClick={() => setDone(m.id, !m.triage!.done)}
                                    aria-label={m.triage!.done ? "Remettre dans sa colonne" : DONE[m.triage!.category].button}
                                    title={m.triage!.done ? "Remettre dans sa colonne" : DONE[m.triage!.category].button}
                                    className={`absolute right-2 top-2 z-10 grid size-7 cursor-pointer place-items-center rounded-full border text-xs transition-colors ${m.triage!.done ? "border-success bg-success-soft text-success-text" : "border-border-strong bg-surface text-text-secondary hover:border-accent hover:text-accent"}`}
                                  >
                                    {m.triage!.done ? "↩" : "✓"}
                                  </button>
                                )}
                                <button
                                  onClick={() => setOpenId(m.id)}
                                  className="w-full cursor-pointer rounded-xl border border-border bg-surface p-3 pr-10 text-left text-text transition-colors hover:border-accent"
                                >
                                  <span className="block truncate text-sm font-bold">{senderName(m.sender)}</span>
                                  <span className="block truncate text-xs text-text-secondary">{m.subject ?? "(sans objet)"}</span>
                                  <span className="mt-2 block">
                                    <Pill category={k} tone={toValidate(m.triage) ? "ai" : m.triage!.drafted || m.triage!.done ? "success" : undefined}>
                                      {badge(m.triage!)}
                                    </Pill>
                                  </span>
                                </button>
                              </motion.li>
                            ))}
                          </ul>
                          {list.length > VISIBLE && (
                            <button
                              onClick={() => setExpanded((s) => (s.has(k) ? new Set([...s].filter((x) => x !== k)) : new Set(s).add(k)))}
                              className="cursor-pointer border-0 bg-transparent py-1 text-xs font-semibold text-text-secondary hover:text-text"
                            >
                              {all ? "Réduire" : `+ ${list.length - VISIBLE} autres`}
                            </button>
                          )}
                        </motion.section>
                      );
                    })}
                  </motion.div>
                </div>
              )}

              <AnimatePresence>
                {phase === "reading" && <Reading key="reading" progress={progress} feed={feed.map((id) => byId.get(id)!)} />}
                {phase === "summary" && (
                  <Summary
                    key="summary"
                    total={run.current.length}
                    counts={KEYS.map((k) => [k, count(run.current.map((id) => byId.get(id)!), k)] as const)}
                    onNext={() => setPhase("sorting")}
                  />
                )}
              </AnimatePresence>

              {board.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`${glass} sticky bottom-4 mt-4 flex items-center gap-4 bg-surface px-5 py-3 shadow-card`}
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-full border-2 border-success text-success-text" aria-hidden>
                    ✓
                  </span>
                  <div className="min-w-0">
                    <p className="m-0 font-extrabold">
                      <NumberFlow value={board.length} /> mails traités
                    </p>
                    <p className="m-0 truncate text-xs text-text-secondary">
                      {count(board, "repondre")} à répondre · {pending} à valider · {count(board, "faire")} à faire · {count(board, "argent")} argent ·{" "}
                      {count(board, "archiver")} archivés
                    </p>
                  </div>
                </motion.div>
              )}
            </section>
          </div>
        </div>
        {open && <ReplyDialog key={open.id} mail={open} onClose={() => setOpenId(null)} onDrafted={drafted} onDone={setDone} />}
        <Toaster position="top-center" offset={{ top: "42vh" }} />
      </LayoutGroup>
    </MotionConfig>
  );
}

// Act 1: glass panel over the board, live feed of decisions (newest on top, older ones fade).
function Reading({ progress: { n, total }, feed }: { progress: { n: number; total: number }; feed: Mail[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className={`${glass} absolute inset-x-0 top-0 z-10 h-[min(100%,calc(100vh-190px))] min-h-[520px] flex flex-col gap-5 bg-surface p-6 shadow-card`}
    >
      <div className="flex items-center gap-4">
        <Orb />
        <div>
          <h2 className="m-0 text-3xl font-black tracking-tight">Je lis tes mails</h2>
          <p className="m-0 text-text-secondary">Un par un. Qui écrit, pourquoi, et ce que ça demande de toi.</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={n} className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
          <motion.div className="h-full origin-left rounded-full bg-accent" initial={{ scaleX: 0 }} animate={{ scaleX: total ? n / total : 0 }} />
        </div>
        <span className="shrink-0 text-sm font-bold tabular-nums">
          <NumberFlow value={n} /> / {total} lus
        </span>
      </div>
      <ol aria-live="polite" className="m-0 mt-auto flex list-none flex-col gap-2 p-0">
        {feed.length === 0 && <li className="text-sm text-text-secondary">{total ? "Je lis le premier mail…" : "Je regarde ce qu'il y a de nouveau…"}</li>}
        <AnimatePresence initial={false}>
          {feed.map((m, i) => (
            <motion.li
              key={m.id}
              layout
              initial={{ opacity: 0, y: -14 }}
              animate={{ opacity: 1 - i * 0.13, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2 text-sm"
            >
              <span className="size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
              <span className="min-w-0 flex-1 truncate">
                <b>{senderName(m.sender)}</b> <span className="text-text-secondary">· {m.triage!.summary}.</span> <b>{CATEGORIES[m.triage!.category].verb}</b>
              </span>
              <Pill category={m.triage!.category} />
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
    </motion.div>
  );
}

// Act 2: one numbered pill per category; counters roll up from 0 once mounted.
function Summary({ total, counts, onNext }: { total: number; counts: (readonly [Category, number])[]; onNext: () => void }) {
  const [shown, setShown] = useState(false);
  useEffect(() => setShown(true), []);
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className={`${glass} absolute inset-x-0 top-0 z-10 h-[min(100%,calc(100vh-190px))] min-h-[520px] flex flex-col justify-center gap-6 bg-surface p-6 shadow-card`}
    >
      <div className="flex items-center gap-4">
        <Orb />
        <div>
          <h2 className="m-0 text-3xl font-black tracking-tight">Compris.</h2>
          <p className="m-0 text-text-secondary">
            <NumberFlow value={shown ? total : 0} /> mail{total > 1 ? "s" : ""} lu{total > 1 ? "s" : ""}. Voilà ce qu&apos;ils demandent.
          </p>
        </div>
      </div>
      <motion.ul variants={stagger} initial="hidden" animate="show" className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 xl:grid-cols-5">
        {counts.map(([k, n]) => (
          <motion.li key={k} variants={rise} className={`${glass} flex flex-col items-start gap-2 p-4`}>
            <NumberFlow value={shown ? n : 0} className="text-4xl font-black" />
            <Pill category={k} />
          </motion.li>
        ))}
      </motion.ul>
      <button onClick={onNext} className="cursor-pointer self-start rounded-full border-0 bg-accent px-5 py-2 text-sm font-bold text-on-accent hover:bg-accent-hover">
        Ranger
      </button>
    </motion.div>
  );
}

// Centered confirmation with a check that draws itself.
function DraftToast({ name, left }: { name: string; left: number }) {
  const at = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-border bg-surface px-5 py-4 text-text shadow-card">
      <svg viewBox="0 0 40 40" className="size-10 shrink-0 text-success" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
        <circle cx="20" cy="20" r="18" strokeOpacity="0.5" />
        <motion.path d="M12 21l6 6 10-12" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ ...spring, delay: 0.15 }} />
      </svg>
      <div>
        <p className="m-0 font-extrabold">Brouillon créé pour {name}</p>
        <p className="m-0 text-xs text-text-secondary">
          À {at} · <NumberFlow value={left} /> restante{left > 1 ? "s" : ""} à valider
        </p>
      </div>
    </div>
  );
}
