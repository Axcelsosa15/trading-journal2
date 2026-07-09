# Bitácora — Trading Journal

A self-contained trading-journal web app, implemented from the Claude Design
prototype `Bitácora.dc.html`. No build step and no runtime dependencies —
open `index.html` in a browser (the Geist webfont loads from Google Fonts when
online; everything else works offline).

## Features

- **Resumen** — KPIs (P&L neto, win rate, profit factor, esperanza/op.),
  benchmark vs. histórico, control de riesgo, equity curve, latest trades,
  and P&L by setup.
- **Operaciones** — trade table with result / symbol / setup / account / tag
  filters; CSV, tax-CSV and full-JSON-backup exports.
- **Calendario** — monthly P&L heatmap with navigation and month stats.
- **Analítica** — equity curve plus P&L by weekday, emotion, symbol, tag,
  session and hour.
- **Estadísticas** — advanced metrics: expectancy ($ and R), SQN, Sharpe,
  Sortino, Kelly, profit factor, payoff, drawdown + duration, recovery factor,
  streaks, percentiles, MAE/MFE edge ratio, plus a P&L distribution histogram
  and an underwater drawdown curve.
- **Correlaciones** — Pearson correlation of numeric factors (rating, size,
  hour, MAE/MFE) with P&L, best/worst category per factor, and an explorer
  (scatter + trend line, or ranked bars by chosen result measure).
- **Diario** — journal entries with mood, daily P&L and lessons; quick 10-second
  note, live search + mood filter, mood-vs-result chart, lessons library, and
  links to that day's trades.
- **Cuentas** — funded / live / demo accounts with per-account profit factor,
  expectancy and realized drawdown.
- **Ajustes** — risk rules (max trades/day, max daily/weekly loss) and the
  pre-trade checklist.
- **PWA / offline** — installable on mobile and desktop (web app manifest +
  service worker). The app shell is cached so it loads with no connection;
  data is cached locally for offline viewing, and trades/journal entries
  created offline are queued and synced automatically on reconnect.

All charts are inline SVG. Data is stored per user in **Supabase** (Postgres
with Row Level Security); a local snapshot is cached in `localStorage` for
offline viewing.

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
- Strategy presets: the **EMA/VWAP (NQ)** system is selectable as a trade *Setup*,
  and its official pre-trade checklist can be loaded from **Ajustes** with one click.
- Insights engine: the **Insights** view surfaces deterministic, plain-language
  patterns from your own trades (best/worst day · setup · emotion · session,
  revenge-trading, cold-streak and overtrading signals, conviction calibration).
- `sw.js`, `manifest.webmanifest`, `icon-*.png` — PWA (offline app shell + install).
- Trade screenshots: attach a chart image when adding/editing a trade; stored in
  a private per-user Supabase Storage bucket and shown via a short-lived signed URL.
- CSV import: in **Operaciones → Importar**, map your broker/prop-firm CSV
  columns (auto-detected) and bulk-import trades; P&L is computed when absent.
- `tests/` — headless jsdom smoke tests; `tests/run.js` is the runner.
- `SECURITY.md` — security assessment and remediation guide.

## Run

Open `index.html` directly, or serve the folder:

```sh
python3 -m http.server 8000   # then visit http://localhost:8000
```

## Tests

The app has **no runtime dependencies**; `jsdom` is a dev-only dependency for the
headless smoke tests that boot the app with a mocked Supabase client.

```sh
npm install          # installs jsdom
npm run check        # node --check on app.js / sw.js
npm test             # runs tests/*.test.js
```

CI (`.github/workflows/ci.yml`) runs these on every PR and push to `main`.
`codeql.yml` adds SAST and `dependabot.yml` keeps dev deps + Actions patched.
