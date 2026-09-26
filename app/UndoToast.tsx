"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { undoFiling } from "./actions.ts";
import { PendingButton } from "./Pending.tsx";

const TOAST_PARAMS = ["range", "undo", "tag"];

// "4 mails rangés dans Banque. Annuler" after a filing; the filing action puts what it needs in the URL.
// Hides itself after 12 s by dropping those parameters.
export function UndoToast() {
  const params = useSearchParams();
  const path = usePathname();
  const router = useRouter();
  const folder = params.get("range");
  const undo = params.get("undo");
  const rest = new URLSearchParams([...params].filter(([k]) => !TOAST_PARAMS.includes(k)));
  const back = rest.size ? `${path}?${rest}` : path;

  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => router.replace(back, { scroll: false }), 12_000);
    return () => clearTimeout(t);
  }, [undo, back, router]);

  if (!folder || !undo) return null;
  const n = undo.split(",").length;
  return (
    <form action={undoFiling} className="toast" role="status">
      <input type="hidden" name="undo" value={undo} />
      <input type="hidden" name="tag" value={params.get("tag") ?? ""} />
      <input type="hidden" name="back" value={back} />
      <span>{n > 1 ? `${n} mails rangés` : "1 mail rangé"} dans {folder}</span>
      <PendingButton busy="Annulation…" className="toast-undo">Annuler</PendingButton>
      <button type="button" className="toast-close" aria-label="Fermer" onClick={() => router.replace(back, { scroll: false })}>×</button>
    </form>
  );
}
