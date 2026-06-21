# plan.md

## 1) Objectives
- Probar el **core** en aislamiento (integraciones externas + LLM): **Binance/Alpaca/OANDA sync + Claude insights** con parsing estable y manejo de errores.
- Construir un **Trading Journal V1** (FastAPI + React + MongoDB) con logging manual, analytics, importación CSV, adjuntos de imágenes y UI premium (Apple-futurista) con dark/light.
- End-to-end testing por fases para asegurar flujo completo y no-regresiones.

## 2) Implementation Steps

### Phase 1 — POC (Core Integrations in Isolation: Brokers + Claude)
**Goal:** no avanzar hasta que *fetch → parse → normalize → store-ready* funcione para los 3 brokers + Claude.

**User stories (POC):**
1. As a user, I can verify my Binance API key/secret and fetch my recent trades.
2. As a user, I can verify my Alpaca API keys and fetch orders/fills from paper trading.
3. As a user, I can verify my OANDA practice token and fetch transactions/trades.
4. As a user, I can see a normalized list of trades (common schema) regardless of broker.
5. As a user, I can request Claude to summarize my last N trades and receive actionable insights.

**Steps:**
- Web research (best practices):
  - Binance signed endpoints (HMAC SHA256), recvWindow, timestamp drift.
  - Alpaca orders/fills endpoints + pagination.
  - OANDA transactions endpoint usage + rate limits.
  - emergentintegrations Claude call patterns + retries.
- Create `poc_brokers_claude.py`:
  - Load env: BINANCE_KEY/SECRET, ALPACA_KEY/SECRET/BASE_URL, OANDA_TOKEN/ACCOUNT_ID/BASE_URL, EMERGENT_LLM_KEY.
  - Implement clients:
    - Binance: signed request helper + fetch trades/orders.
    - Alpaca: headers auth + fetch orders/activities.
    - OANDA: bearer auth + fetch transactions.
  - Normalize to `NormalizedTrade` (symbol, market, side, qty, entry/exit/time, fees, realized_pnl, raw).
  - Basic de-dupe key (`broker + broker_trade_id`).
  - Claude insights call (`claude-sonnet-4.5`): prompt with summary stats + sample trades; validate response shape.
  - Robust error handling: invalid creds, time drift, pagination empty, rate limit, partial failures.
- Exit criteria: each broker returns ≥1 normalized trade (or clear “no trades” success) + Claude returns insights.


### Phase 2 — V1 App Development (MVP around proven core; auth deferred)
**Goal:** single-user mode first (no auth) to validate complete UX + dataflow quickly; add auth next phase.

**User stories (V1):**
1. As a user, I can create/edit/delete a trade manually with full fields (prices, qty, SL/TP, fees, timestamps).
2. As a user, I can upload and view chart screenshots attached to a trade.
3. As a user, I can tag trades and assign a strategy/setup to analyze performance.
4. As a user, I can view a dashboard with key metrics and an equity curve.
5. As a user, I can import trades via CSV and review a preview before saving.
6. As a user, I can filter/search trades by symbol, market, date range, strategy, tags.
7. As a user, I can view a daily P&L calendar heatmap.

**Backend (FastAPI + MongoDB):**
- Core collections: trades, strategies, tags, uploads (or embedded refs).
- Trade schema (normalized + manual): marketType, symbol, side, entry/exit, qty, times, fees, pnl, rr, strategyId, tags[], emotion, notes, attachments[].
- Endpoints (no auth yet):
  - Trades CRUD + list with filters + pagination.
  - Strategies CRUD; Tags CRUD.
  - CSV import: upload CSV → map fields → preview → commit.
  - Upload endpoint for images (store base64 or object-store-ready abstraction).
  - Analytics endpoints: summary metrics, equity curve series, calendar P&L aggregation, breakdown by strategy/symbol/day.
- Metrics engine: win rate, profit factor, expectancy, avg win/loss, max drawdown, Sharpe (simple), equity curve.

**Frontend (React + shadcn/ui + Tailwind):**
- App shell with Apple-futurista styling: glass panels, subtle gradients, smooth transitions; dark/light toggle.
- Pages:
  - Dashboard (metric cards + equity chart + heatmap + recent trades).
  - Trades list (advanced filters, table, quick actions).
  - Trade create/edit (form + attachments + emotion/notes).
  - Strategies/Tags management.
  - CSV import (upload, mapping UI, preview).
  - AI insights (basic panel; can be stubbed until Phase 3 if needed).
- Ensure state handling: loading/empty/error, optimistic UI for edits, form validation.

**Testing:**
- Run `testing_agent_v3` end-to-end for: create trade → attach image → dashboard metrics update → filters → csv import.


### Phase 3 — Add Multi-user Auth + Broker Connections + AI (Production-ish)
**Goal:** enable multi-user isolation and automatic broker sync with encrypted key storage.

**User stories (Auth + Brokers + AI):**
1. As a user, I can register/login/logout with email/password and keep my data private.
2. As a user, I can connect Binance/Alpaca/OANDA by saving API credentials securely.
3. As a user, I can trigger a broker sync and see imported trades without duplicates.
4. As a user, I can schedule/auto-run sync (manual trigger in UI + backend-ready job hook).
5. As a user, I can request Claude to analyze my performance by strategy and emotions.
6. As a user, I can view AI insights history and regenerate insights.

**Backend:**
- Auth: bcrypt, JWT access tokens, /register /login /me; userId on all documents.
- Broker connections:
  - CRUD for connections per user; encrypt secrets at rest.
  - Sync endpoints: `/sync/binance`, `/sync/alpaca`, `/sync/oanda` using proven POC code.
  - Idempotency: upsert by (userId, broker, broker_trade_id).
- AI endpoint:
  - `/insights/run` generates insights from last N trades + aggregates; store results.
- Update all analytics/trade queries to be user-scoped.

**Frontend:**
- Auth screens (Apple-inspired) + guarded routes.
- Brokers page: connect/test/sync per broker; show last sync status.
- AI insights page: run analysis, show sections (patterns, mistakes, suggestions).

**Testing:**
- `testing_agent_v3`: multi-user isolation, connect broker (mock creds allowed), sync no-dup, AI insights generation.


### Phase 4 — Hardening & Polish
**User stories (quality):**
1. As a user, I can export my trades to CSV/JSON.
2. As a user, I can audit changes (optional) or see import logs.
3. As a user, I can handle partial fills and multi-leg trades (basic support).
4. As a user, I can customize dashboards (saved filters, default timeframe).
5. As a user, I can trust the app with stable performance and clear error messages.

**Steps:**
- Performance: indexes (userId+date, userId+symbol, broker ids), pagination everywhere.
- Security: rate limit auth, secret encryption, CORS tightening.
- UX polish: animations, skeleton loaders, better empty states, consistent typography.
- Final E2E test run.


## 3) Next Actions
1. Create and run Phase 1 POC script (Binance/Alpaca/OANDA + Claude) using your API keys.
2. Confirm normalized schema covers your needs (options/futures fields, multi-leg note).
3. After POC success, implement Phase 2 V1 (no-auth) and run first E2E test.
4. Proceed to Phase 3 auth + broker sync + AI storage and re-test.

## 4) Success Criteria
- POC: all 3 broker connectors return valid normalized trades (or “no trades” success) + Claude produces coherent insights; errors are actionable.
- V1: user can log trades (manual + CSV), attach images, view metrics/equity/heatmap, filter effectively; E2E tests pass.
- Multi-user: JWT auth works; strict user data isolation; broker sync is idempotent and reliable.
- UX: Apple-futurista UI with smooth dark/light toggle; responsive and stable.