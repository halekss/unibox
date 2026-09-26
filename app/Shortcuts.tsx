"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// À ranger keyboard: Entrée = ranger, R = refuser, J/K = casier suivant/précédent. Ignored while typing.
export function Shortcuts({ next, prev }: { next?: string; prev?: string }) {
  const router = useRouter();
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (e.ctrlKey || e.metaKey || e.altKey || t.closest("input, textarea, button, a, summary")) return;
      const key = e.key.toLowerCase();
      if (key === "enter") document.getElementById("confirm")?.click();
      else if (key === "r") document.getElementById("reject")?.click();
      else if (key === "j" && next) router.push(next);
      else if (key === "k" && prev) router.push(prev);
      else return;
      e.preventDefault();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [next, prev, router]);
  return null;
}
