"use client";

import type { ReactNode } from "react";

// Submit button that asks for confirmation first (irreversible actions).
export function ConfirmButton({ children, message, className = "btn" }: { children: ReactNode; message: string; className?: string }) {
  return (
    <button className={className} onClick={(e) => { if (!window.confirm(message)) e.preventDefault(); }}>
      {children}
    </button>
  );
}
