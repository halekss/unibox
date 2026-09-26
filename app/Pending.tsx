"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

type Props = { children: ReactNode; busy: string; className?: string; id?: string; formAction?: (form: FormData) => void | Promise<void> };

// Submit button that shows `busy` and disables itself while its form's server action runs.
export function PendingButton({ children, busy, className = "btn", id, formAction }: Props) {
  const { pending } = useFormStatus();
  return (
    <button id={id} className={className} formAction={formAction} disabled={pending} aria-busy={pending}>
      {pending ? busy : children}
    </button>
  );
}
