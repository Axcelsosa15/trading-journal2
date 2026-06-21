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

All charts are inline SVG; state lives in memory (seeded with sample data).

## Files

- `index.html` — page shell.
- `styles.css` — global resets, fonts, and overlay animations.
- `app.js` — data model, computed metrics, charts, views, and interactions.

## Run

Open `index.html` directly, or serve the folder:

```sh
python3 -m http.server 8000   # then visit http://localhost:8000
```
