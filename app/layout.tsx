import { Suspense, type ReactNode } from "react";
import { Schibsted_Grotesk } from "next/font/google";
import { Sidebar } from "./Sidebar.tsx";
import { UndoToast } from "./UndoToast.tsx";

export const metadata = { title: "Unibox" };

const font = Schibsted_Grotesk({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });

const css = `
:root {
  color-scheme:dark;
  --night:#0B0A24; --night-2:#2A2668; --night-3:rgb(124 110 255 / .12); --on-night:#D6D2F5; --on-night-2:#B6B0E6; --on-night-3:#8F89C4;
  --bg:#0B0A24; --card:rgb(124 110 255 / .1); --text:#FFFFFF; --muted:#B6B0E6; --line:rgb(255 255 255 / .12); --line-2:rgb(255 255 255 / .07); --soft:rgb(255 255 255 / .05);
  --accent:#8B7DFF; --accent-soft:rgb(139 125 255 / .22); --accent-text:#C9C2FF; --accent-on-night:#C9C2FF;
  --danger:#FF8A84; --danger-soft:rgb(229 72 77 / .16); --danger-line:rgb(229 72 77 / .45);
  --outlook:#0F6CBD; --gmail:#C5221F; --ok:#6EE7B7; --down:#E5484D;
  --glass-blur:blur(18px); --glow:0 0 60px -10px rgb(139 125 255 / .55);
}
* { box-sizing:border-box; }
/* Same backdrop as the Tri page: two soft light blooms over the night gradient. */
body { margin:0; font-size:14px; line-height:1.5; color:var(--text); min-height:100vh; background-color:var(--bg); background-attachment:fixed; background-image:
  radial-gradient(60% 50% at 75% 0%, rgb(139 125 255 / .28), transparent 70%),
  radial-gradient(40% 40% at 10% 100%, rgb(99 70 230 / .25), transparent 70%),
  linear-gradient(180deg, #13113A, #0B0A24); }
a { color:inherit; text-decoration:none; }
/* Layered so Tailwind's utilities (Tri page, tri.css declares theme, base, utilities) can colour buttons. */
@layer base { button, input { font:inherit; color:inherit; } }
:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
.muted { color:var(--muted); }
.small { font-size:13px; }

.app { display:flex; min-height:100vh; }
.content { flex:1; min-width:0; padding:28px 32px 40px; }
/* Three blues: sidebar and titles (darkest), elements (--card), page (--page, halfway to white). Tokens below
   are the page set; every element drawn with --card re-declares the night set so its own text stays readable.
   Only the email itself stays white (.body-in). */
.content { background:var(--page); color:var(--text); --page:#E3FBFF;
  --text:#13113A; --muted:#2A2766; --line:rgb(19 17 58 / .18); --line-2:rgb(19 17 58 / .1); --soft:rgb(255 255 255 / .12); --card:#3B3685;
  --accent:#4B3BD0; --accent-soft:#ECE9FF; --accent-text:#211C6E; --danger:#B42318; --danger-soft:#FCE9E7; --danger-line:#F3C7C3; }
.panel, .bin, .body, .aibar, .mitem, .search, .filters a, .tabs, .btn:not(.danger):not(.link-danger) {
  --text:#fff; --muted:#B6B0E6; --line:rgb(255 255 255 / .12); --line-2:rgb(255 255 255 / .07); --soft:rgb(255 255 255 / .05);
  --accent:#8B7DFF; --accent-soft:rgb(139 125 255 / .22); --accent-text:#C9C2FF;
  --danger:#FF8A84; --danger-soft:rgb(229 72 77 / .16); --danger-line:rgb(229 72 77 / .45); color:var(--text); }

/* Sidebar */
.side { width:240px; flex-shrink:0; background:rgb(11 10 36 / .55); backdrop-filter:var(--glass-blur); border-right:1px solid var(--line); color:var(--on-night); display:flex; flex-direction:column; gap:28px;
  padding:24px 16px; position:sticky; top:0; height:100vh; overflow-y:auto; }
.brand { display:flex; align-items:center; gap:10px; padding:0 8px; font-size:18px; font-weight:800; color:#fff; letter-spacing:-.01em; }
.logo { width:30px; height:30px; border-radius:7px; background:var(--accent-on-night); color:var(--night); display:flex; align-items:center; justify-content:center; }
.sections { display:flex; flex-direction:column; gap:2px; }
.sections a { display:flex; align-items:center; gap:12px; padding:10px 12px; border-radius:8px; font-weight:500; }
.sections a:hover { background:var(--night-3); color:#fff; }
.sections a[aria-current] { background:rgb(139 125 255 / .25); color:#fff; font-weight:600; box-shadow:inset 0 0 0 1px var(--line); }
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
.panel { background:var(--card); border:1px solid var(--line); border-radius:20px; backdrop-filter:var(--glass-blur); }
.btn { border:1px solid var(--line); background:var(--card); border-radius:8px; padding:9px 14px; font-weight:600; cursor:pointer; white-space:nowrap; }
.btn:hover:not(:disabled) { background:#45409A; }
.btn:disabled { opacity:.5; cursor:not-allowed; }
.btn.primary { background:#8B7DFF; border-color:#8B7DFF; color:#0B0A24; font-weight:800; border-radius:99px; box-shadow:var(--glow); }
.btn.primary:hover:not(:disabled) { background:#A094FF; }
.btn.danger { background:var(--danger-soft); border-color:var(--danger-line); color:var(--danger); font-weight:700; }
.btn.danger:hover:not(:disabled) { background:rgb(229 72 77 / .28); }
.btn.link-danger { border:0; background:transparent; color:var(--danger); font-weight:500; }
.btn.icon { width:40px; height:40px; padding:0; display:inline-flex; align-items:center; justify-content:center; color:var(--danger); }
.btn.small { padding:6px 10px; font-size:13px; }
.chip { font-size:12px; font-weight:600; border-radius:6px; padding:2px 8px; background:var(--line); color:var(--on-night); white-space:nowrap; }
.chip.ai { background:var(--accent-soft); color:var(--accent-text); }
input[type=checkbox] { width:18px; height:18px; margin:0; accent-color:var(--accent); }
kbd { font-family:inherit; font-size:12px; font-weight:700; background:var(--soft); border:1px solid var(--line); border-bottom-width:2px; border-radius:5px; padding:1px 6px; }
.analyze { display:flex; flex-direction:column; align-items:flex-end; gap:6px; }
.banner { display:flex; align-items:center; gap:12px; padding:12px 16px; margin-bottom:16px; }
.banner span { flex:1; }
.empty { padding:40px; text-align:center; color:var(--muted); }

/* Boîte */
.inbox { display:grid; grid-template-columns:430px minmax(0,1fr); margin:-28px -32px -40px; min-height:100vh; }
.list { background:transparent; border-right:1px solid var(--line); display:flex; flex-direction:column; min-width:0; }
.list-head { padding:20px 20px 12px; display:flex; flex-direction:column; gap:14px; border-bottom:1px solid var(--line); }
.list-head .row1 { display:flex; align-items:baseline; justify-content:space-between; gap:12px; }
.list-head h1 { font-size:24px; margin:0; }
.search { display:flex; align-items:center; gap:8px; border:1px solid var(--line); border-radius:99px; padding:0 14px; height:40px; background:var(--card); color:var(--muted); }
.search input { border:0; background:transparent; flex:1; outline:none; color:var(--text); min-width:0; }
.filters { display:flex; gap:6px; flex-wrap:wrap; }
.filters a { background:var(--card); border:1px solid var(--line); border-radius:99px; padding:5px 13px; font-size:13px; font-weight:500; display:inline-flex; align-items:center; gap:6px; }
.filters a[aria-current] { background:#8B7DFF; border-color:#8B7DFF; color:#0B0A24; font-weight:700; }
.mails-list { overflow-y:auto; padding:12px; display:flex; flex-direction:column; gap:8px; }
.mitem { display:flex; flex-direction:column; gap:3px; padding:12px 16px; border-radius:14px; background:var(--card); border:1px solid transparent; }
.mitem:hover { background:#45409A; }
.mitem[aria-current] { background:#4F49AD; border-color:#8B7DFF; box-shadow:inset 3px 0 0 var(--accent); }
.mitem .top { display:flex; align-items:center; gap:8px; }
.mitem .from { font-weight:700; flex:1; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.mitem time { font-size:12px; color:var(--muted); }
.ellip { overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.mitem .chip { align-self:flex-start; margin-top:3px; }
.reader { padding:28px 40px; display:flex; flex-direction:column; gap:20px; min-width:0; }
.aibar { display:flex; align-items:center; gap:12px; background:var(--card); border:1px solid var(--line); backdrop-filter:var(--glass-blur); box-shadow:var(--glow); color:#fff; border-radius:12px; padding:12px 14px 12px 20px; flex-wrap:wrap; }
.aibar > span { flex:1; font-size:15px; }
.aibar strong { color:var(--accent-on-night); }
.aibar .btn:not(.primary) { background:transparent; color:#fff; }
.reader h2 { margin:0; font-size:30px; line-height:1.15; font-weight:800; letter-spacing:-.02em; max-width:28ch; }
.meta { display:flex; align-items:center; gap:12px; }
.avatar { width:36px; height:36px; border-radius:50%; background:var(--accent-soft); color:var(--accent-text); display:flex; align-items:center; justify-content:center; font-weight:800; flex-shrink:0; }
.meta > div { flex:1; display:flex; flex-direction:column; min-width:0; }
.body { background:var(--card); border-radius:20px; padding:10px; max-width:900px; box-shadow:var(--glow); }
.body-in { display:block; width:100%; min-height:65vh; border:0; border-radius:12px; background:#fff; color:#1C1A33; margin:0; padding:24px 28px;
  font:inherit; font-size:15px; line-height:1.65; white-space:pre-wrap; overflow-wrap:anywhere; }
iframe.body-in { padding:0; }
.body-in a { color:#3B2FA8; text-decoration:underline; }

/* À ranger */
.sorter { display:flex; gap:24px; align-items:flex-start; }
.bins { width:420px; flex-shrink:0; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); grid-auto-rows:132px; gap:12px; position:sticky; top:28px; }
.bin { background:var(--card); border:1px solid var(--line); border-radius:4px 4px 16px 16px; box-shadow:inset 0 5px 0 var(--accent); backdrop-filter:var(--glass-blur);
  padding:16px 14px 12px; display:flex; flex-direction:column; gap:6px; min-width:0; }
.bin:hover { border-color:var(--accent); }
.bin[aria-current] { box-shadow:inset 0 5px 0 var(--accent), var(--glow); border:2px solid var(--accent); padding:15px 13px 11px; }
.plate-row { display:flex; align-items:center; gap:6px; min-width:0; }
.plate { font-size:13px; font-weight:700; padding:3px 9px; border-radius:4px; background:var(--line-2); border:1px solid transparent; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.plate.new { background:transparent; border:1px dashed var(--accent); }
.bin[aria-current] .plate { background:var(--accent-soft); }
.bin .big { margin-top:auto; display:flex; align-items:baseline; gap:6px; }
.bin .big b { font-size:38px; font-weight:800; letter-spacing:-.03em; line-height:1; }
.stack { display:flex; flex-direction:column; gap:2px; }
.stack i { height:3px; border-radius:2px; background:var(--muted); display:block; }
.stack i + i { background:var(--line); }
.detail { flex:1; min-width:0; overflow:hidden; display:flex; flex-direction:column; }
.detail-head { padding:20px 24px; display:flex; flex-direction:column; gap:8px; border-bottom:1px solid var(--line-2); }
.detail-head label { display:flex; align-items:center; gap:12px; }
.detail-head input[type=text] { font-size:22px; font-weight:800; letter-spacing:-.02em; border:1px solid var(--line); border-radius:8px; padding:6px 12px; flex:1; min-width:0; background:var(--soft); }
.detail-foot { display:flex; align-items:center; gap:12px; padding:14px 24px; border-top:1px solid var(--line-2); background:var(--soft); flex-wrap:wrap; }
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
.groups-head { font-size:13px; color:var(--muted); background:var(--soft); border-bottom:1px solid var(--line-2); border-radius:20px 20px 0 0; padding-block:12px; }
.group { border-bottom:1px solid var(--line-2); }
.group:last-child { border-bottom:0; }
.group > summary { list-style:none; cursor:pointer; }
.group > summary::-webkit-details-marker { display:none; }
.group[open] { background:var(--soft); }
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
.connect { border:2px dashed rgb(19 17 58 / .35); border-radius:20px; padding:20px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; text-align:center; }
.connect a { font-weight:700; color:var(--accent-text); }
.ia { display:grid; grid-template-columns:minmax(0,1.5fr) minmax(0,1fr); gap:16px; }
.ia .panel { padding:22px; display:flex; flex-direction:column; gap:12px; }
.ia .panel.down { border:2px solid var(--down); }
.ia-title { display:flex; align-items:center; gap:10px; font-size:17px; font-weight:800; }
.ia-title .light { width:10px; height:10px; }
code.cmd { display:block; background:rgb(0 0 0 / .35); border:1px solid var(--line); color:#E8E6F5; border-radius:8px; padding:12px 14px; font-size:13px; line-height:1.5; white-space:pre-wrap; word-break:break-all; }
.facts div { display:flex; justify-content:space-between; gap:12px; }

/* Undo toast */
.toast { position:fixed; left:50%; bottom:28px; transform:translateX(-50%); z-index:20; display:flex; align-items:center; gap:14px;
  background:rgb(29 26 85 / .9); backdrop-filter:var(--glass-blur); border:1px solid var(--line); color:#fff; border-radius:16px; padding:10px 10px 10px 18px; box-shadow:var(--glow); }
.toast-undo { border:0; background:transparent; color:var(--accent-on-night); font-weight:700; padding:6px 8px; cursor:pointer; border-radius:6px; }
.toast-undo:hover { background:var(--night-2); }
.toast-close { border:0; background:transparent; color:var(--on-night-2); font-size:18px; line-height:1; padding:4px 8px; cursor:pointer; border-radius:6px; }

/* Segmented tabs */
.tabs { display:flex; background:var(--card); border:1px solid var(--line); border-radius:10px; padding:3px; }
.tabs a { border-radius:8px; padding:7px 14px; font-weight:500; color:var(--muted); }
.tabs a[aria-current] { background:var(--accent-soft); color:#fff; font-weight:700; }

/* Motion, same feel as the Tri page: pages rise in, list items and panels cascade (CSS only, first ~12 staggered). */
@keyframes rise { from { opacity:0; transform:translateY(14px); } }
.content > * { animation:rise .45s cubic-bezier(.2,.8,.3,1) both; }
.mitem, .mrow, .group, .bin, .panel, .connect { animation:rise .45s cubic-bezier(.2,.8,.3,1) both; animation-delay:calc(var(--i, 12) * 40ms); }
:is(.mitem,.mrow,.group,.bin,.panel,.connect):nth-child(1) { --i:0; }
:is(.mitem,.mrow,.group,.bin,.panel,.connect):nth-child(2) { --i:1; }
:is(.mitem,.mrow,.group,.bin,.panel,.connect):nth-child(3) { --i:2; }
:is(.mitem,.mrow,.group,.bin,.panel,.connect):nth-child(4) { --i:3; }
:is(.mitem,.mrow,.group,.bin,.panel,.connect):nth-child(5) { --i:4; }
:is(.mitem,.mrow,.group,.bin,.panel,.connect):nth-child(6) { --i:5; }
:is(.mitem,.mrow,.group,.bin,.panel,.connect):nth-child(7) { --i:6; }
:is(.mitem,.mrow,.group,.bin,.panel,.connect):nth-child(8) { --i:7; }
:is(.mitem,.mrow,.group,.bin,.panel,.connect):nth-child(9) { --i:8; }
:is(.mitem,.mrow,.group,.bin,.panel,.connect):nth-child(10) { --i:9; }
:is(.mitem,.mrow,.group,.bin,.panel,.connect):nth-child(11) { --i:10; }
:is(.mitem,.mrow,.group,.bin,.panel,.connect):nth-child(12) { --i:11; }
.btn, .mitem, .mrow, .bin, .sections a, .frow, .filters a { transition:background-color .2s, border-color .2s, box-shadow .2s, transform .2s; }
.btn:active:not(:disabled) { transform:scale(.97); }
.bin:hover { transform:translateY(-2px); }
@media (prefers-reduced-motion:reduce) { *, *::before { animation:none !important; transition:none !important; } }

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
  .mitem:not([aria-current]) { border-color:transparent; }
  .side { position:fixed; top:auto; bottom:0; left:0; right:0; height:auto; width:auto; z-index:10; border-right:0; border-top:1px solid var(--line); background:rgb(11 10 36 / .85); padding:6px 4px 14px; gap:0; overflow:visible; }
  .brand, .folders, .status { display:none; }
  .sections { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); }
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
