# Guía de despliegue gratis — Trading Journal

Esta app es **FastAPI (backend) + React (frontend) + MongoDB (base de datos)**.
La vamos a desplegar **sin pagar Emergent**, usando capas gratuitas:

| Pieza | Servicio | Costo |
|---|---|---|
| Base de datos | **MongoDB Atlas** (M0 free) | $0 |
| Backend (FastAPI) | **Render** (free, Docker) | $0 |
| Frontend (React) | **Vercel** | $0 |
| IA (insights) | **Anthropic API** (tu propia key) | centavos por uso |

> Lo único que se paga es el uso de la IA, y solo cuando pides un análisis. Cada
> insight cuesta unos pocos centavos con `claude-sonnet-4-6`.

---

## 0. Antes de empezar

Sube el proyecto a un repositorio de GitHub (los servicios gratuitos despliegan
desde GitHub). Esta rama ya tiene todo lo necesario.

Genera dos secretos que vas a necesitar (córrelos en tu terminal o en cualquier
consola de Python):

```bash
# JWT_SECRET (sesiones de login)
python -c "import secrets; print(secrets.token_urlsafe(48))"

# ENCRYPTION_KEY (para cifrar las API keys de brokers guardadas)
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Guarda ambos resultados, los pegarás más abajo.

---

## 1. Base de datos — MongoDB Atlas (gratis)

1. Crea cuenta en <https://www.mongodb.com/cloud/atlas/register>.
2. Crea un cluster **M0 (Free)**.
3. En **Database Access**, crea un usuario con contraseña (anótalos).
4. En **Network Access**, agrega `0.0.0.0/0` (permite conexión desde Render).
5. En **Connect → Drivers**, copia la cadena de conexión. Se ve así:
   ```
   mongodb+srv://USUARIO:CONTRASEÑA@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
   Reemplaza `USUARIO` y `CONTRASEÑA` por los reales. Esa cadena es tu `MONGO_URL`.

---

## 2. Backend — Render (gratis, con Docker)

1. Crea cuenta en <https://render.com> y conéctala a tu GitHub.
2. **New + → Blueprint**, elige este repositorio. Render leerá `render.yaml`
   automáticamente y configurará el servicio `trading-journal-api`.
   - (Alternativa sin blueprint: **New + → Web Service**, runtime **Docker**,
     *Root Directory* = `backend`.)
3. En las variables de entorno del servicio, completa las que están marcadas como
   "set in dashboard":
   - `MONGO_URL` → la cadena de Atlas del paso 1.
   - `ENCRYPTION_KEY` → la que generaste en el paso 0.
   - `ANTHROPIC_API_KEY` → tu key de <https://console.anthropic.com>.
   - `CORS_ORIGINS` → de momento déjalo en `*`; lo cambiarás al final por la URL
     de Vercel.
   - `JWT_SECRET` lo genera Render solo (o pega el tuyo).
4. Deploy. Cuando termine, Render te da una URL tipo
   `https://trading-journal-api.onrender.com`. Pruébala abriendo
   `https://trading-journal-api.onrender.com/api/` — debe responder
   `{"message": "...","status":"ok"}`.

> ⚠️ El plan free de Render "duerme" el servicio tras ~15 min de inactividad. La
> primera petición después de dormir tarda ~30–50 s en despertar. Es normal y gratis.
> Si te molesta, Railway o Fly.io son alternativas (ver al final).

---

## 3. Frontend — Vercel (gratis)

1. Crea cuenta en <https://vercel.com> y conéctala a GitHub.
2. **Add New → Project**, elige este repo.
3. En **Root Directory** selecciona `frontend`. Vercel detecta `vercel.json`.
4. En **Environment Variables** agrega:
   - `REACT_APP_BACKEND_URL` = la URL de Render del paso 2
     (ej. `https://trading-journal-api.onrender.com`, **sin** `/api` y sin `/` final).
5. Deploy. Vercel te da una URL tipo `https://tu-app.vercel.app`.

---

## 4. Conectar los dos (CORS)

1. Vuelve a Render → tu servicio → **Environment**.
2. Cambia `CORS_ORIGINS` de `*` a tu URL exacta de Vercel:
   ```
   https://tu-app.vercel.app
   ```
3. Guarda (Render redeploya solo). Listo: el frontend ya puede hablar con el backend
   de forma segura.

---

## 5. Probar

Abre tu URL de Vercel, regístrate, crea un trade y pide un insight de IA. 🎉

---

## Desarrollo local

```bash
# Backend
cd backend
cp .env.example .env        # y rellena los valores
pip install -r requirements.txt
uvicorn server:app --reload --port 8000

# Frontend (en otra terminal)
cd frontend
cp .env.example .env        # REACT_APP_BACKEND_URL=http://localhost:8000
yarn install
yarn start
```

---

## Alternativas de hosting para el backend

- **Railway** (<https://railway.app>): muy fácil, ~$5 de crédito gratis al mes, no
  se duerme mientras haya crédito. Usa el mismo `backend/Dockerfile`. Define las
  mismas variables de entorno (ver `backend/.env.example`).
- **Fly.io** (<https://fly.io>): no se duerme, algo más técnico (`fly launch` desde
  la carpeta `backend`).

En cualquiera de ellos, las variables de entorno necesarias son las mismas que en
`backend/.env.example`.

---

## Qué cambió para salir de Emergent

- `backend/ai_service.py` y `backend/poc_claude.py` ahora usan el SDK oficial de
  Anthropic (`anthropic`) con `ANTHROPIC_API_KEY`, en vez de `emergentintegrations`
  + `EMERGENT_LLM_KEY`.
- `backend/requirements.txt` ya no incluye `emergentintegrations` ni el `litellm`
  alojado por Emergent; agrega `anthropic`.
- `frontend/package.json` ya no depende de `@emergentbase/visual-edits`.
- `frontend/public/index.html` ya no carga el badge, el tracking de PostHog ni los
  scripts de Emergent.
