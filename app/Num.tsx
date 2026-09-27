"use client";

import { useEffect, useState } from "react";
import NumberFlow from "@number-flow/react";

// Server-rendered counter that rolls up from 0 on mount, then rolls to each new value (Tri page style).
export function Num({ value, className }: { value: number; className?: string }) {
  const [shown, setShown] = useState(false);
  useEffect(() => setShown(true), []);
  return <NumberFlow value={shown ? value : 0} className={className} />;
}
