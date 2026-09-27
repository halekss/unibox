"use client";

import DOMPurify from "dompurify";
import { useEffect, useState } from "react";

// Sanitized by DOMPurify, then shown in a sandboxed iframe: no scripts, the email's CSS cannot leak into the
// page, and the CSP blocks remote content so no tracking pixel fires when the email is opened. Links open in a
// new tab (<base target>, allow-popups).
// Remote images stay hidden (user decision). Dark theme: emails hardcode their own light colors, so the whole
// rendered email is inverted (hue kept) instead of recolored; the paper lands close to --surface.
const frame = (html: string, dark: boolean) =>
  `<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: cid:; style-src 'unsafe-inline'"><base target="_blank"><style>html{background:#fff}body{font:14px/1.5 system-ui,sans-serif;color:#1c1a33;margin:16px;overflow-wrap:anywhere}a{color:#3b2fa8}${dark ? "html{filter:invert(.89) hue-rotate(180deg)}" : ""}</style>${DOMPurify.sanitize(html)}`;

// Same rule as tokens.css: a theme forced in Comptes > Apparence wins, otherwise the device setting.
const isDark = () => {
  const c = document.documentElement.classList;
  return c.contains("theme-dark") || (!c.contains("theme-light") && matchMedia("(prefers-color-scheme: dark)").matches);
};

const URL_RE = /(https?:\/\/[^\s<>"')\]]+)/g;

// Plain-text email: URLs become links (split on a capturing group puts them at odd indexes).
function Linked({ text }: { text: string }) {
  return text.split(URL_RE).map((part, i) =>
    i % 2 ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer">
        {part}
      </a>
    ) : (
      part
    ),
  );
}

export function MailFrame({ html, text, className }: { html: string | null; text: string | null; className?: string }) {
  // DOMPurify needs the browser DOM: the iframe is built after mount.
  const [doc, setDoc] = useState<string | null>(null);
  useEffect(() => setDoc(html ? frame(html, isDark()) : null), [html]);
  if (html)
    return doc ? (
      <iframe title="Contenu du mail" sandbox="allow-popups allow-popups-to-escape-sandbox" srcDoc={doc} className={className} />
    ) : (
      <p className={className}>Chargement…</p>
    );
  return (
    <pre className={className}>
      <Linked text={(text ?? "").replace(/\r\n?/g, "\n").trim() || "(mail vide)"} />
    </pre>
  );
}
