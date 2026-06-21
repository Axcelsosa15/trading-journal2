# Trading Journal

Diario de trading de futuros: registro manual de operaciones, importación CSV,
sincronización con brokers (Binance / Alpaca / OANDA), analítica (equity curve,
calendario, breakdowns) e insights con IA (Claude).

**Stack:** FastAPI + React + MongoDB.

## Estructura

- `backend/` — API FastAPI (auth JWT, trades, analítica, brokers, IA).
- `frontend/` — SPA en React (Create React App + craco + Tailwind/shadcn).

## Puesta en marcha

Ver **[DEPLOY.md](./DEPLOY.md)** para:

- Correr el proyecto en local.
- Desplegarlo gratis (MongoDB Atlas + Render + Vercel).

### Resumen rápido (local)

```bash
# Backend
cd backend && cp .env.example .env   # completa los valores
pip install -r requirements.txt
uvicorn server:app --reload --port 8000

# Frontend
cd frontend && cp .env.example .env
yarn install && yarn start
```

## Variables de entorno

- Backend: ver `backend/.env.example`.
- Frontend: ver `frontend/.env.example`.

La IA usa la API oficial de Anthropic (`ANTHROPIC_API_KEY`).
