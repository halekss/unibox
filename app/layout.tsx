import type { ReactNode } from "react";
import Link from "next/link";

export const metadata = { title: "Boîte unifiée" };

const css = `
:root { --bg:#fafafa; --card:#fff; --text:#1a1a1a; --muted:#666; --border:#e2e2e2; --accent:#2563eb; --danger:#b91c1c; }
@media (prefers-color-scheme: dark) { :root { --bg:#141414; --card:#1e1e1e; --text:#eee; --muted:#999; --border:#333; --accent:#60a5fa; --danger:#f87171; } }
* { box-sizing: border-box; }
body { margin:0; font:15px/1.5 system-ui, sans-serif; background:var(--bg); color:var(--text); }
main { max-width:1100px; margin:0 auto; padding:24px 16px; }
h1 { font-size:1.4rem; margin:0 0 4px; }
.muted { color:var(--muted); font-size:.9rem; }
.card { background:var(--card); border:1px solid var(--border); border-radius:10px; padding:16px; margin:16px 0; }
.head { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
.badge { font-size:.75rem; padding:2px 8px; border-radius:99px; border:1px solid var(--border); color:var(--muted); }
input[type=text] { font:inherit; padding:6px 10px; border:1px solid var(--border); border-radius:6px; background:var(--bg); color:var(--text); flex:1; min-width:200px; }
button { font:inherit; padding:6px 14px; border-radius:6px; border:1px solid var(--border); background:var(--bg); color:var(--text); cursor:pointer; }
button.primary { background:var(--accent); border-color:var(--accent); color:#fff; }
button.danger { color:var(--danger); }
ul { list-style:none; padding:0; margin:12px 0; }
li { padding:6px 0; border-top:1px solid var(--border); }
li label { display:flex; gap:8px; align-items:baseline; cursor:pointer; }
li details { margin:4px 0 0 24px; }
section li details { margin:0; }
header { display:flex; gap:16px; padding:12px 16px; border-bottom:1px solid var(--border); background:var(--card); }
a { color:var(--accent); text-decoration:none; }
a[aria-current] { font-weight:600; text-decoration:underline; }
h2 { font-size:1.1rem; margin:0 0 8px; }
.split { display:grid; grid-template-columns:260px 1fr; gap:24px; margin-top:16px; }
.split nav li { border:0; padding:3px 0; }
@media (max-width: 700px) { .split { grid-template-columns:1fr; } }
summary { cursor:pointer; color:var(--muted); font-size:.85rem; }
pre { white-space:pre-wrap; font:inherit; font-size:.85rem; color:var(--muted); margin:6px 0; }
.row { display:flex; gap:8px; align-items:flex-start; justify-content:space-between; }
.row > details, .row > label { flex:1; }
button.small { padding:2px 10px; font-size:.8rem; }
.actions { display:flex; gap:8px; justify-content:flex-end; }
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <style>{css}</style>
        <header>
          <Link href="/boite">Boîte unifiée</Link>
          <Link href="/">Propositions</Link>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
