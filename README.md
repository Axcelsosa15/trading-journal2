# Bitácora — Trading Journal

A self-contained trading-journal web app, implemented from the Claude Design
prototype `Bitácora.dc.html`. No build step and no runtime dependencies —
open `index.html` in a browser (the Geist webfont loads from Google Fonts when
online; everything else works offline).

## Features

- **Resumen** — KPIs (P&L neto, win rate, profit factor, esperanza/op.),
  equity curve, latest trades, and P&L by setup.
- **Operaciones** — trade table with result / symbol / setup filters.
- **Calendario** — monthly P&L heatmap with navigation and month stats.
- **Analítica** — equity curve plus P&L by weekday, by emotion, and by symbol.
- **Diario** — trading-journal entries with mood, daily P&L, and lessons.
- **Nueva operación** — add-trade modal with live estimated-P&L preview.
- **Detalle** — per-trade drawer with metrics, notes, and delete.

All charts are inline SVG. Trades and journal entries **persist in
`localStorage`** (seeded with sample data on first run), so the journal
survives reloads.

## Security

- **Content-Security-Policy** (`default-src 'none'`): scripts load only from
  the same origin and **no inline scripts are allowed**, which neutralizes
  injected-script XSS.
- **No `innerHTML` with user data** — all trade/journal text is rendered via
  `textContent` / `createTextNode`, so typed markup (e.g. `<script>` in a note)
  is shown as literal text, never executed.
- `referrer` set to `no-referrer`; `localStorage` access is wrapped in
  `try/catch` so the app keeps working if storage is unavailable.

## Files

- `index.html` — page shell.
- `styles.css` — global resets, fonts, and overlay animations.
- `app.js` — data model, computed metrics, charts, views, and interactions.

## Run

Open `index.html` directly, or serve the folder:

```sh
python3 -m http.server 8000   # then visit http://localhost:8000
```
