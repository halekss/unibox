# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Unibox: one inbox for Outlook + Gmail, sorted by a local LLM (Langflow → Ollama `qwen2.5:14b`). Next.js 16 + React 19, PostgreSQL 17 in Docker, no ORM (raw `pg`), no provider SDK for Gmail (REST). The UI and all user-facing strings are in French; code comments are in English.

## Commands

```bash
npm run dev                                   # app on http://localhost:3000 (HTTP Basic, password = APP_PASSWORD)
npm test                                      # node --test lib/*.test.ts (Node 22.18+ runs the TS directly)
node --test lib/triage.test.ts                # one test file
node --test --test-name-pattern="Archivé" lib/triage.test.ts   # one test
npx tsc --noEmit                              # typecheck (there is no linter)
npx next build                                # production build
docker compose up -d                          # Postgres on localhost:5434
```

AI side (needed for À ranger, À supprimer and Tri IA; nothing runs as a service, both stop with their terminal):

```bash
LANGFLOW_OPEN_BROWSER=false ~/ProjetsWSL/langflow/.venv/bin/langflow run --host 127.0.0.1 --port 7860
cd langflow && ~/ProjetsWSL/langflow/.venv/bin/python create_flow.py          # "Email Sorter" -> LANGFLOW_FLOW_ID
cd langflow && ~/ProjetsWSL/langflow/.venv/bin/python create_triage_flow.py   # "Email Triage" -> LANGFLOW_TRIAGE_FLOW_ID
```

The flow scripts accept an existing flow id to update it in place (PATCH). The prompts live in these Python files, not in the TS code.

## Architecture

- **`proxy.ts`** guards every page, API route and server action (HTTP Basic + same-origin check, `X-Forwarded-Host` aware for Tailscale serve). New routes are protected automatically.
- **`lib/`** is the business logic; `app/` only renders and calls it through server actions (`app/actions.ts`) and `app/api/*` routes.
  - `mailbox.ts` is the provider-agnostic layer: a `providers` record maps `outlook` / `gmail` to `sync`, `trash`, `moveToFolder`, `replyDraft` from `microsoft.ts` / `gmail.ts`. A new mailbox operation needs an implementation in both provider files and an entry in that record.
  - `accounts.ts` + `crypto.ts`: OAuth tokens stored AES-256-GCM encrypted (`TOKEN_ENC_KEY`), refreshed by `freshToken`.
  - `classify.ts`: the folder-sorting AI (`tagInbox`, `scanFoldersForCleanup`) and `runFlow`, the single helper that calls any Langflow flow.
  - `triage.ts`: the Tri IA categories, shared with client components, so no server imports in it.
- **Two independent AI features:**
  1. *Sorting* (À ranger / À supprimer): decisions are stored as JSON **tags** on `emails.tags` (`folder:…`, `new_folder_idea:…`, `delete_suggested:…`, `rejected:…`, `keep`). An email's location is `coalesce(app_folder, folder)` (`EFFECTIVE_FOLDER`): `app_folder` is set in the app first, then `applyAppFolders` moves the real message and clears it.
  2. *Triage* (Tri IA, `app/tri/`): decision stored in `emails.triage` (JSONB: category, summary, amount, draft, plus `drafted` / `done` set by the app, never by the model). `/api/triage` streams decisions over SSE, one email at a time, with an in-memory lock (one run per process). A `done` email is displayed in the Archivé column (`column()`).
- Nothing is ever sent or permanently deleted: trash goes to the mailbox's recoverable trash, replies are saved as drafts in Outlook/Gmail.

## Gotchas

- `db/schema.sql` runs only when the Docker volume is first created. A schema change also needs a manual `ALTER TABLE` on the existing database.
- `emails.id` is `BIGSERIAL`: `pg` returns it as a **string**. Server actions receiving an id from the client must `Number(id)` before validating it.
- Styling: every color is a token in `app/tokens.css` (DESIGN_TOKENS.md values, `light-dark()` pairs); `app/layout.tsx` (one CSS string) and the Tri page (Tailwind v4, `app/tri/tri.css`, `@theme inline` over the tokens, default palette disabled) only reference them. The page follows the theme (device setting, or the per-device choice in Comptes > Apparence: `.theme-light` / `.theme-dark` on `<html>`; never `.light`, which is the status dot); the sidebar, undo toast and `code.cmd` are always dark. HTML emails are inverted in dark mode (`MailFrame.tsx`). An element that switches `color-scheme` must be added both to the color-scheme rules and to the token block's selector list in `tokens.css`: Next compiles `light-dark()` with LightningCSS, whose fallback only works for `color-scheme` written in `.css` files. Old names `--card`, `--muted`, `--line`, `--line-2`, `--soft` are aliases. The global `button` reset is in `@layer base` so Tailwind utilities can override it: keep it layered.
- Email HTML is only rendered through `app/MailFrame.tsx` (DOMPurify + sandboxed iframe + CSP). Remote images are blocked on purpose (tracking pixels); the user decided not to display them.
- The Langflow call fails with `LANGFLOW_DOWN` when Langflow isn't running. Check `curl localhost:7860/health` before debugging the AI code.
- Colors and categories follow `DESIGN_TOKENS.md` (usage rules, palette, light/dark values). Never hardcode a color in a component. When applying it: map its tokens onto the existing variables in `app/layout.tsx` (`--page`, `--card`...) rather than creating a parallel set, and keep `lib/triage.ts` as the source of truth for category keys. Take only the colors and labels from `DESIGN_TOKENS.md`, not its keys.