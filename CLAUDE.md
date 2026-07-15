# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Rateio Presentes is a Next.js (App Router) web app used to track workplace gift/farewell
cost-splitting ("rateios") and who has paid via Pix. There is no database: **Google Sheets is
the datastore**. A separate, external email automation (not in this repo) appends new rows to
a "Rateio Presentes" spreadsheet daily; this app reads/writes that same sheet directly via the
Google Sheets API. All UI text and domain vocabulary are in Portuguese (pt-BR) — keep new
strings and variable names consistent with that (e.g. `rateio`, `pessoa`, `pago`, `pendente`).

## Commands

```bash
npm install      # install dependencies
npm run dev      # start dev server at http://localhost:3000
npm run build    # production build
npm start        # run production build
npm run lint     # next lint
```

There is no test suite/framework configured in this repo.

## Configuration

No credentials or spreadsheet IDs are ever committed. Everything is read from environment
variables (see `.env.example`, copy to `.env.local` for local dev; in Vercel set the same
variables under Project Settings > Environment Variables):

- `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY` — Google Cloud service account
  credentials (JWT auth) with Editor access to the spreadsheet.
- `GOOGLE_SHEET_ID` — the spreadsheet ID.
- `GOOGLE_SHEET_TAB` — sheet/tab name, defaults to `Sheet1`.
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL` — used only by the "Enviar e-mail aos pendentes"
  feature; without these that one feature errors but the rest of the app still works.

## Architecture

### Data model: the spreadsheet is the source of truth

`lib/sheets.ts` is the only module that talks to Google Sheets, and it encodes the sheet's
column layout. Rows live in range `Sheet1!A2:K` with one row per participant (not per rateio):

| Col | Field | Notes |
|---|---|---|
| A | dataEmail | date, may arrive as serial number, `YYYY-MM-DD`, or `DD/MM/YYYY` |
| B | assunto | subject/honoree |
| C | remetente | organizer |
| D | pessoa | participant name |
| E | valorIndividual | this participant's share |
| F | valorTotalRateio | total for the whole rateio (repeated per row) |
| G | chavePix | Pix key (repeated per row) |
| H | statusPagamento | `Pago` / `Pendente` |
| I | dataPagamento | payment date |
| J | email | participant email |
| K | estagiario | `Sim`/`Não` — intern flag, affects redistribution math |

`fetchRateios()` reads all rows and groups them client-side into `Rateio` objects keyed by
`dataEmail__assunto` (see `lib/types.ts`), sorted newest-first. Because rows aren't grouped in
the sheet itself, **the grouping key and column order in `sheets.ts` are load-bearing** — if
either changes, the parsing logic must change with it.

Writes are targeted at individual cells/rows via `rowNumber` (the 1-indexed sheet row,
attached to each participant when read). There's no transactional guarantee across a
multi-row rateio; each participant row is updated independently
(`updateParticipantePagamento`, `updateParticipanteEmail`). New rateios are appended as a
block of rows via `criarRateio`.

### API routes (`app/api/*/route.ts`)

Thin wrappers around `lib/sheets.ts`, doing request validation and returning
`NextResponse.json`:

- `GET/POST /api/rateios` — list all rateios; create a new one (validates that participant
  values sum to the declared total, within 0.05 tolerance).
- `PATCH /api/participante` — updates a single participant's payment status/date, or their
  email, identified by `rowNumber`.
- `POST /api/enviar-email` — sends payment-reminder emails via Resend to pending participants
  who have an email on file; returns 500 with a clear message if Resend env vars are unset.

### Pages (`app/*`, client components)

- `app/page.tsx` — main screen. Fetches all rateios once, then does client-side
  search/filter/pagination (browsing one rateio at a time, newest/oldest). Payment toggle,
  payment date, and email edits optimistically update local state and PATCH the API;
  on failure they fall back to reloading from the server (`load()`).
- `app/novo/page.tsx` — create/clone screen. When given `?from=<rateioId>`, preloads that
  rateio's participants as a starting point. Each participant row keeps `percentual` and
  `valor` in sync (editing one recalculates the other from `valorTotal`). "Redistribuir"
  recalculates so all non-intern participants pay equally and interns pay half of that —
  see the comment above `redistribuir()` for the exact formula. Client-side validation
  requires the sum of participant values to match `valorTotal` (0.05 tolerance) before saving.

### Conventions specific to this repo

- Money/date parsing from Sheets is defensive because cell formats vary (see
  `normalizeNumero`, `normalizeDate`, `normalizeTexto` in `lib/sheets.ts`) — reuse those
  helpers rather than re-parsing sheet values elsewhere.
- The 0.05 tolerance for "does the sum match the total" is duplicated in both
  `app/api/rateios/route.ts` (server-side) and `app/novo/page.tsx` (client-side); keep them
  in sync if it changes.
- Styling is Tailwind utility classes inline in JSX; there is no component library or shared
  UI component directory yet — `page.tsx` and `novo/page.tsx` each define their own markup.
