import type { ReactNode } from "react";
import { CATEGORIES, type Category } from "@/lib/triage.ts";

// Shared spring: every move on the Tri page settles instead of running on a fixed duration.
export const spring = { type: "spring", stiffness: 420, damping: 34, mass: 0.8 } as const;

// Full class strings (Tailwind only sees literal class names).
const TONE: Record<Category, string> = {
  repondre: "text-cat-repondre bg-cat-repondre/15 border-cat-repondre/40",
  faire: "text-cat-faire bg-cat-faire/15 border-cat-faire/40",
  argent: "text-cat-argent bg-cat-argent/15 border-cat-argent/40",
  lire: "text-cat-lire bg-cat-lire/15 border-cat-lire/40",
  archiver: "text-cat-archiver bg-cat-archiver/15 border-cat-archiver/40",
};

export function Pill({ category, children }: { category: Category; children?: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold ${TONE[category]}`}>
      {children ?? CATEGORIES[category].label}
    </span>
  );
}
