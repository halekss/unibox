import type { ReactNode } from "react";
import { CATEGORIES, type Category } from "@/lib/triage.ts";

// Shared spring: every move on the Tri page settles instead of running on a fixed duration.
export const spring = { type: "spring", stiffness: 420, damping: 34, mass: 0.8 } as const;

// Validated category: its own pale background + dark text. "ai": proposed by the model and not validated yet
// (DESIGN_TOKENS rule 3, amber dashed). "success": done / draft saved.
const TONE = {
  ai: "bg-ai-soft text-ai-text border-dashed border-ai",
  success: "bg-success-soft text-success-text border-success",
} as const;

export function Pill({ category, tone, children }: { category: Category; tone?: keyof typeof TONE; children?: ReactNode }) {
  const c = CATEGORIES[category];
  return (
    <span
      style={tone ? undefined : { background: c.bg, color: c.text, borderColor: "transparent" }}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${tone ? TONE[tone] : ""}`}
    >
      {children ?? c.label}
    </span>
  );
}
