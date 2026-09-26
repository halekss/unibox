"use client";

import { useActionState } from "react";

// Button for a long AI batch (~2 min): disabled with a progress label while the server action runs.
export function AnalyzeForm({ text, left, run }: { text: string; left: number; run: (prev: null) => Promise<null> }) {
  const [, action, pending] = useActionState(run, null);
  return (
    <form action={action} className="card head">
      <span>{text}</span>
      <button disabled={left === 0 || pending} aria-busy={pending}>
        {pending ? "Analyse en cours… (~2 min, ne ferme pas la page)" : "Analyser les 20 suivants (~2 min)"}
      </button>
    </form>
  );
}
