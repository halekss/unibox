"use client";

import { useActionState } from "react";
import { analyzeInbox } from "./actions.ts";

export function AnalyzeForm({ left }: { left: number }) {
  const [, action, pending] = useActionState(analyzeInbox, null);
  return (
    <form action={action} className="card head">
      <span>{left} mail(s) de la Boîte de réception à analyser (refusés inclus).</span>
      <button disabled={left === 0 || pending} aria-busy={pending}>
        {pending ? "Analyse en cours… (~2 min, ne ferme pas la page)" : "Analyser les 20 suivants (~2 min)"}
      </button>
    </form>
  );
}
