"use client";

import { useActionState } from "react";

// Button for a long AI batch (~2 min): disabled with a progress label while the server action runs.
export function AnalyzeForm({ text, left, run }: { text: string; left: number; run: (prev: null) => Promise<null> }) {
  const [, action, pending] = useActionState(run, null);
  return (
    <form action={action} className="analyze">
      <button className="btn" disabled={left === 0 || pending} aria-busy={pending}>
        {pending ? "Analyse en cours… ne ferme pas la page" : "Analyser les 20 mails suivants"}
      </button>
      <span className="small muted">{left === 0 ? "Tout est analysé." : text}</span>
    </form>
  );
}
