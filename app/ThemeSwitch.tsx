"use client";

import { useEffect, useState } from "react";

type Theme = "system" | "light" | "dark";
const CHOICES: [Theme, string][] = [["system", "Système"], ["light", "Clair"], ["dark", "Sombre"]];

// Per-device choice (localStorage "theme"), applied as a class on <html>: .theme-light / .theme-dark in tokens.css.
// "Système" removes the key and follows the device setting. The <head> script in layout.tsx applies it before
// the first paint.
export function ThemeSwitch() {
  const [theme, setTheme] = useState<Theme>("system");
  useEffect(() => {
    try {
      const t = localStorage.getItem("theme");
      if (t === "light" || t === "dark") setTheme(t);
    } catch {}
  }, []);

  function choose(t: Theme) {
    setTheme(t);
    document.documentElement.classList.remove("theme-light", "theme-dark");
    if (t !== "system") document.documentElement.classList.add(`theme-${t}`);
    try {
      if (t === "system") localStorage.removeItem("theme");
      else localStorage.setItem("theme", t);
    } catch {}
  }

  return (
    <div className="tabs" role="radiogroup" aria-label="Apparence" style={{ alignSelf: "flex-start", display: "inline-flex" }}>
      {CHOICES.map(([t, label]) => (
        <button key={t} type="button" role="radio" aria-checked={theme === t} aria-current={theme === t ? "true" : undefined} onClick={() => choose(t)}>
          {label}
        </button>
      ))}
    </div>
  );
}
