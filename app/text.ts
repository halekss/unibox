// Emails carry CRLF and leading blank lines, which the HTML parser normalizes inside <pre>:
// render the normalized text so server and client markup match.
export const plain = (t: string | null) => (t ?? "").replace(/\r\n?/g, "\n").trim();

// "Epitech <pedago@epitech.eu>" -> "Epitech" / "pedago@epitech.eu".
export const senderName = (s: string | null) => (s ?? "").replace(/<.*>/, "").replace(/"/g, "").trim() || senderAddr(s) || "(inconnu)";
export const senderAddr = (s: string | null) => (s?.match(/<([^>]+)>/)?.[1] ?? s ?? "").trim().toLowerCase();

// Today -> "08:14", this year -> "12 sept.", older -> "12 sept. 2016".
export function shortDate(d: Date): string {
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", ...(d.getFullYear() !== now.getFullYear() && { year: "numeric" }) });
}
