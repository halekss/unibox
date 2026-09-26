import { Suspense, type ReactNode } from "react";
import { Schibsted_Grotesk } from "next/font/google";
import { Sidebar } from "./Sidebar.tsx";
import { UndoToast } from "./UndoToast.tsx";

export const metadata = { title: "Unibox" };

const font = Schibsted_Grotesk({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });

const css = `
:root {
  --night:#1C1A33; --night-2:#2C2950; --night-3:#242145; --on-night:#C9C6E3; --on-night-2:#A7A3C8; --on-night-3:#8D89B3;
  --bg:#EFEFF5; --card:#FFFFFF; --text:#1C1A33; --muted:#585674; --line:#DAD9E6; --line-2:#ECEBF3; --soft:#F6F6FA;
  --accent:#5B4BE0; --accent-soft:#ECE9FF; --accent-text:#3B2FA8; --accent-on-night:#B8AFFF;
  --danger:#B42318; --danger-soft:#FCE9E7; --danger-line:#F3C7C3;
  --outlook:#0F6CBD; --gmail:#C5221F; --ok:#5FD08B; --down:#E5484D;
}
* { box-sizing:border-box; }
body { margin:0; font-size:14px; line-height:1.5; background:var(--bg); color:var(--text); }
a { color:inherit; text-decoration:none; }
button, input { font:inherit; color:inherit; }
:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
.muted { color:var(--muted); }
.small { font-size:13px; }

.app { display:flex; min-height:100vh; }
.content { flex:1; min-width:0; padding:28px 32px 40px; }

/* Sidebar */
.side { width:240px; flex-shrink:0; background:var(--night); color:var(--on-night); display:flex; flex-direction:column; gap:28px;
  padding:24px 16px; position:sticky; top:0; height:100vh; overflow-y:auto; }
.brand { display:flex; align-items:center; gap:10px; padding:0 8px; font-size:18px; font-weight:800; color:#fff; letter-spacing:-.01em; }
.logo { width:30px; height:30px; border-radius:7px; background:var(--accent-on-night); color:var(--night); display:flex; align-items:center; justify-content:center; }
.sections { display:flex; flex-direction:column; gap:2px; }
.sections a { display:flex; align-items:center; gap:12px; padding:10px 12px; border-radius:8px; font-weight:500; }
.sections a:hover { background:var(--night-3); color:#fff; }
.sections a[aria-current] { background:var(--night-2); color:#fff; font-weight:600; }
.sections .long { flex:1; }
.sections .short { display:none; }
.count { font-size:13px; color:var(--on-night-2); }
.count.hot { font-size:12px; font-weight:700; color:var(--night); background:var(--accent-on-night); border-radius:99px; padding:1px 8px; }
.folders { display:flex; flex-direction:column; gap:1px; }
.side-label { padding:0 12px 6px; font-size:13px; color:var(--on-night-3); }
.frow { display:flex; align-items:center; gap:6px; padding:6px 12px 6px 28px; border-radius:6px; }
.frow:hover { background:var(--night-3); color:#fff; }
.fgroup > summary { list-style:none; cursor:pointer; padding-left:8px; }
.fgroup > summary::-webkit-details-marker { display:none; }
.caret { width:16px; height:16px; flex-shrink:0; display:inline-flex; align-items:center; justify-content:center; border-radius:4px; }
.caret::before { content:""; border:4px solid transparent; border-left:5px solid var(--on-night-2); margin-left:4px; transition:transform .15s; }
.fgroup[open] > summary .caret::before { transform:rotate(90deg); margin-left:0; margin-top:4px; }
.fgroup > summary:hover .caret { background:var(--night-2); }
.fchildren { margin-left:14px; border-left:1px solid var(--night-2); }
@media (prefers-reduced-motion:reduce) { .caret::before { transition:none; } }
.fname { flex:1; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.folders .n { color:var(--on-night-3); font-size:13px; min-width:22px; text-align:right; }
.status { margin-top:auto; display:flex; align-items:center; gap:10px; padding:12px; border-radius:8px; background:var(--night-3); font-size:13px; line-height:1.35; }
.status .sub { color:var(--on-night-3); }
.light { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
.light.ok { background:var(--ok); } .light.down { background:var(--down); }

/* Shared pieces */
.prov { width:16px; height:16px; flex-shrink:0; border-radius:4px; color:#fff; font-size:10px; font-weight:800; display:inline-flex; align-items:center; justify-content:center; }
.prov.outlook { background:var(--outlook); } .prov.gmail { background:var(--gmail); }
.head { display:flex; align-items:flex-end; gap:24px; margin-bottom:22px; flex-wrap:wrap; }
.head > div:first-child { flex:1; min-width:260px; }
h1 { margin:0 0 6px; font-size:34px; font-weight:800; letter-spacing:-.025em; line-height:1.1; }
.head p { margin:0; font-size:15px; color:var(--muted); max-width:70ch; }
.panel { background:var(--card); border:1px solid var(--line); border-radius:14px; }
.btn { border:1px solid #CBC9DB; background:var(--card); border-radius:8px; padding:9px 14px; font-weight:600; cursor:pointer; white-space:nowrap; }
.btn:hover:not(:disabled) { background:var(--soft); }
.btn:disabled { opacity:.5; cursor:not-allowed; }
.btn.primary { background:var(--accent); border-color:var(--accent); color:#fff; font-weight:700; }
.btn.primary:hover:not(:disabled) { background:#4B3BD0; }
.btn.danger { background:var(--danger-soft); border-color:var(--danger-line); color:var(--danger); font-weight:700; }
.btn.danger:hover:not(:disabled) { background:#F9DAD6; }
.btn.link-danger { border:0; background:transparent; color:var(--danger); font-weight:500; }
.btn.icon { width:40px; height:40px; padding:0; display:inline-flex; align-items:center; justify-content:center; color:var(--danger); }
.btn.small { padding:6px 10px; font-size:13px; }
.chip { font-size:12px; font-weight:600; border-radius:6px; padding:2px 8px; background:var(--line-2); color:#2A2845; white-space:nowrap; }
.chip.ai { background:var(--accent-soft); color:var(--accent-text); }
input[type=checkbox] { width:18px; height:18px; margin:0; accent-color:var(--accent); }
kbd { font-family:inherit; font-size:12px; font-weight:700; background:#fff; border:1px solid #CBC9DB; border-bottom-width:2px; border-radius:5px; padding:1px 6px; }
.analyze { display:flex; flex-direction:column; align-items:flex-end; gap:6px; }
.banner { display:flex; align-items:center; gap:12px; padding:12px 16px; margin-bottom:16px; }
.banner span { flex:1; }
.empty { padding:40px; text-align:center; color:var(--muted); }

/* Boîte */
.inbox { display:grid; grid-template-columns:430px minmax(0,1fr); margin:-28px -32px -40px; min-height:100vh; }
.list { background:var(--card); border-right:1px solid var(--line); display:flex; flex-direction:column; min-width:0; }
.list-head { padding:20px 20px 12px; display:flex; flex-direction:column; gap:14px; border-bottom:1px solid var(--line); }
.list-head .row1 { display:flex; align-items:baseline; justify-content:space-between; gap:12px; }
.list-head h1 { font-size:24px; margin:0; }
.search { display:flex; align-items:center; gap:8px; border:1px solid var(--line); border-radius:10px; padding:0 12px; height:40px; background:var(--soft); color:var(--muted); }
.search input { border:0; background:transparent; flex:1; outline:none; color:var(--text); min-width:0; }
.filters { display:flex; gap:6px; flex-wrap:wrap; }
.filters a { border:1px solid var(--line); border-radius:99px; padding:5px 13px; font-size:13px; font-weight:500; display:inline-flex; align-items:center; gap:6px; }
.filters a[aria-current] { background:var(--night); border-color:var(--night); color:#fff; font-weight:600; }
.mails-list { overflow-y:auto; }
.mitem { display:flex; flex-direction:column; gap:3px; padding:13px 20px; border-bottom:1px solid var(--line-2); }
.mitem:hover { background:var(--soft); }
.mitem[aria-current] { background:#F3F2FA; box-shadow:inset 3px 0 0 var(--accent); }
.mitem .top { display:flex; align-items:center; gap:8px; }
.mitem .from { font-weight:700; flex:1; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.mitem time { font-size:12px; color:var(--muted); }
.ellip { overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.mitem .chip { align-self:flex-start; margin-top:3px; }
.reader { padding:28px 40px; display:flex; flex-direction:column; gap:20px; min-width:0; }
.aibar { display:flex; align-items:center; gap:12px; background:var(--night); color:#fff; border-radius:12px; padding:12px 14px 12px 20px; flex-wrap:wrap; }
.aibar > span { flex:1; font-size:15px; }
.aibar strong { color:var(--accent-on-night); }
.aibar .btn:not(.primary) { background:transparent; border-color:#45416E; color:#fff; }
.reader h2 { margin:0; font-size:30px; line-height:1.15; font-weight:800; letter-spacing:-.02em; max-width:28ch; }
.meta { display:flex; align-items:center; gap:12px; }
.avatar { width:36px; height:36px; border-radius:50%; background:#E3E0F2; display:flex; align-items:center; justify-content:center; font-weight:800; flex-shrink:0; }
.meta > div { flex:1; display:flex; flex-direction:column; min-width:0; }
.body { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:28px 32px; font-size:15px; line-height:1.65; max-width:72ch;
  white-space:pre-wrap; overflow-wrap:anywhere; color:#2A2845; margin:0; font-family:inherit; }

/* À ranger */
.sorter { display:flex; gap:24px; align-items:flex-start; }
.bins { width:420px; flex-shrink:0; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); grid-auto-rows:132px; gap:12px; position:sticky; top:28px; }
.bin { background:var(--card); border:1px solid var(--line); border-radius:4px 4px 12px 12px; box-shadow:inset 0 7px 0 var(--night);
  padding:16px 14px 12px; display:flex; flex-direction:column; gap:6px; min-width:0; }
.bin:hover { border-color:#B9B6CF; }
.bin[aria-current] { border:2px solid var(--night); padding:15px 13px 11px; }
.plate-row { display:flex; align-items:center; gap:6px; min-width:0; }
.plate { font-size:13px; font-weight:700; padding:3px 9px; border-radius:4px; background:var(--line-2); border:1px solid transparent; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.plate.new { background:#fff; border:1px dashed var(--night); }
.bin[aria-current] .plate { background:var(--accent-soft); }
.bin .big { margin-top:auto; display:flex; align-items:baseline; gap:6px; }
.bin .big b { font-size:38px; font-weight:800; letter-spacing:-.03em; line-height:1; }
.stack { display:flex; flex-direction:column; gap:2px; }
.stack i { height:3px; border-radius:2px; background:#CBC9DB; display:block; }
.stack i + i { background:var(--line); }
.detail { flex:1; min-width:0; overflow:hidden; display:flex; flex-direction:column; }
.detail-head { padding:20px 24px; display:flex; flex-direction:column; gap:8px; border-bottom:1px solid var(--line-2); }
.detail-head label { display:flex; align-items:center; gap:12px; }
.detail-head input[type=text] { font-size:22px; font-weight:800; letter-spacing:-.02em; border:1px solid var(--line); border-radius:8px; padding:6px 12px; flex:1; min-width:0; background:var(--soft); }
.detail-foot { display:flex; align-items:center; gap:12px; padding:14px 24px; border-top:1px solid var(--line-2); background:#F7F7FB; flex-wrap:wrap; }
.selectall { display:flex; align-items:center; gap:8px; color:var(--muted); margin-right:auto; cursor:pointer; }
.keys { font-size:12px; color:var(--muted); display:flex; gap:6px; align-items:center; }

/* Mail row (À ranger) */
.mrow { display:grid; grid-template-columns:18px 16px 170px minmax(0,1fr) 64px auto; gap:12px; align-items:center; padding:12px 24px; border-bottom:1px solid var(--line-2); }
.mrow:hover { background:var(--soft); }
.mrow > label { display:contents; cursor:pointer; }
.mrow .from { font-weight:700; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.mrow time { font-size:12px; color:var(--muted); text-align:right; }
.mrow details { grid-column:3 / -1; }
.mrow summary { cursor:pointer; color:var(--muted); font-size:12px; }
.mrow.clean { grid-template-columns:18px 16px 170px minmax(0,1fr) auto 64px; }
.mrow pre { white-space:pre-wrap; font:inherit; font-size:13px; color:var(--muted); margin:6px 0 0; max-height:260px; overflow:auto; }

/* À supprimer */
.groups-head, .group > summary { display:grid; grid-template-columns:32px minmax(0,1.4fr) minmax(0,1fr) 70px 110px 260px; gap:16px; align-items:center; padding:11px 24px; }
.groups-head { font-size:13px; color:var(--muted); background:#F7F7FB; border-bottom:1px solid var(--line-2); border-radius:14px 14px 0 0; padding-block:12px; }
.group { border-bottom:1px solid var(--line-2); }
.group:last-child { border-bottom:0; }
.group > summary { list-style:none; cursor:pointer; }
.group > summary::-webkit-details-marker { display:none; }
.group[open] { background:#FAFAFD; }
.gname { display:flex; flex-direction:column; min-width:0; }
.gname > span:first-child { display:flex; align-items:center; gap:6px; font-weight:700; }
.gcount { font-size:20px; font-weight:800; letter-spacing:-.02em; }
.gactions { display:flex; gap:8px; justify-content:flex-end; }
.gmails { padding:0 24px 14px 72px; }
.gmails label { display:grid; grid-template-columns:18px minmax(0,1fr) 110px; gap:12px; align-items:center; padding:8px 0; border-top:1px dashed var(--line); cursor:pointer; }
.gmails input { accent-color:var(--danger); }

/* Comptes */
.section-title { margin:0 0 14px; font-size:18px; font-weight:700; }
.accounts { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:16px; margin-bottom:32px; }
.account { padding:20px; display:flex; flex-direction:column; gap:14px; }
.account .who { display:flex; align-items:center; gap:12px; }
.account .mark { width:40px; height:40px; border-radius:10px; color:#fff; font-weight:800; font-size:18px; display:flex; align-items:center; justify-content:center; }
.mark.outlook { background:var(--outlook); } .mark.gmail { background:var(--gmail); }
.stats { display:flex; gap:28px; }
.stats b { display:block; font-size:26px; font-weight:800; letter-spacing:-.02em; }
.connect { border:2px dashed #CBC9DB; border-radius:14px; padding:20px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; text-align:center; }
.connect a { font-weight:700; color:var(--accent-text); }
.ia { display:grid; grid-template-columns:minmax(0,1.5fr) minmax(0,1fr); gap:16px; }
.ia .panel { padding:22px; display:flex; flex-direction:column; gap:12px; }
.ia .panel.down { border:2px solid var(--down); }
.ia-title { display:flex; align-items:center; gap:10px; font-size:17px; font-weight:800; }
.ia-title .light { width:10px; height:10px; }
code.cmd { display:block; background:var(--night); color:#E8E6F5; border-radius:8px; padding:12px 14px; font-size:13px; line-height:1.5; white-space:pre-wrap; word-break:break-all; }
.facts div { display:flex; justify-content:space-between; gap:12px; }

/* Undo toast */
.toast { position:fixed; left:50%; bottom:28px; transform:translateX(-50%); z-index:20; display:flex; align-items:center; gap:14px;
  background:var(--night); color:#fff; border-radius:10px; padding:10px 10px 10px 18px; box-shadow:0 8px 24px rgba(28,26,51,.25); }
.toast-undo { border:0; background:transparent; color:var(--accent-on-night); font-weight:700; padding:6px 8px; cursor:pointer; border-radius:6px; }
.toast-undo:hover { background:var(--night-2); }
.toast-close { border:0; background:transparent; color:var(--on-night-2); font-size:18px; line-height:1; padding:4px 8px; cursor:pointer; border-radius:6px; }

/* Segmented tabs */
.tabs { display:flex; background:#E2E1EC; border-radius:10px; padding:3px; }
.tabs a { border-radius:8px; padding:7px 14px; font-weight:500; color:var(--muted); }
.tabs a[aria-current] { background:#fff; color:var(--text); font-weight:700; }

/* Narrow screens and phone */
@media (max-width:900px) {
  .inbox { grid-template-columns:1fr; }
  .list { border-right:0; }
  .sorter { flex-direction:column; align-items:stretch; }
  .bins { position:static; width:100%; display:flex; overflow-x:auto; grid-auto-rows:auto; }
  .bin { width:128px; height:96px; flex-shrink:0; }
  .bin .big b { font-size:26px; } .bin .big span, .stack { display:none; }
  .accounts, .ia { grid-template-columns:1fr; }
  .groups-head { display:none; }
  .group > summary { grid-template-columns:32px minmax(0,1fr) auto; }
  .group > summary > :nth-child(3), .group > summary > :nth-child(5) { display:none; }
  .gactions { grid-column:1 / -1; justify-content:flex-start; }
  .mrow { grid-template-columns:18px 16px minmax(0,1fr) auto; }
  .mrow .subj, .mrow time { display:none; }
  .mrow.clean { grid-template-columns:18px 16px minmax(0,1fr) auto; }
}
@media (max-width:760px) {
  .app { flex-direction:column; }
  .content { padding:20px 16px 96px; }
  .inbox { margin:-20px -16px 0; }
  .side { position:fixed; top:auto; bottom:0; left:0; right:0; height:auto; width:auto; z-index:10; padding:6px 4px 14px; gap:0; overflow:visible; }
  .brand, .folders, .status { display:none; }
  .sections { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); }
  .sections a { flex-direction:column; gap:3px; padding:6px 0; font-size:11px; }
  .sections a[aria-current] { background:transparent; color:var(--accent-on-night); }
  .sections .long, .sections .count { display:none; }
  .sections .short { display:inline; }
  h1 { font-size:28px; }
  .reader { padding:20px 16px; }
  .keys { display:none; }
  .toast { bottom:84px; max-width:calc(100% - 32px); }
}
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body className={font.className}>
        <style>{css}</style>
        <div className="app">
          <Sidebar />
          <main className="content">{children}</main>
          <Suspense>
            <UndoToast />
          </Suspense>
        </div>
      </body>
    </html>
  );
}
