# Seguridad — Bitácora (Trading Journal)

Informe de evaluación y guía de endurecimiento. Estándares de referencia:
**OWASP ASVS 4.0.3**, **OWASP Top 10 2021** y **OWASP MASVS v2** (este último
aplicará cuando existan apps nativas; hoy el cliente móvil es la **PWA**).

> Alcance del cumplimiento: **interno / buenas prácticas**. Última revisión: 2026-06-22.

## Arquitectura
- **Web:** SPA en JavaScript *vanilla* (sin framework ni build), servida como
  estática en **GitHub Pages** (objetivo: **dominio propio detrás de Cloudflare**).
- **Backend:** **Supabase** — PostgreSQL 17, Auth (GoTrue) email/contraseña,
  API REST (PostgREST) protegida por **Row Level Security**.
- **Móvil:** **PWA** (manifest + service worker). Apps nativas **planeadas**
  (no construidas). MASVS/MobSF se aplicarán cuando existan binarios.
- **Datos:** diario de trading (financiero / privado). Caché offline en
  `localStorage` + cola de escritura (outbox).

## Controles ya implementados (mantener)
- **CSP estricta** (meta): `default-src 'none'`, `script-src 'self' https://cdn.jsdelivr.net`,
  `connect-src` limitado al proyecto Supabase, `base-uri 'none'`, `form-action 'none'`.
  **Sin scripts inline.** (ASVS V14.4)
- **Anti-XSS por diseño:** render con `textContent`/`createTextNode`; `innerHTML`
  solo con SVG estáticos. (ASVS V5.3)
- **Autorización (RLS):** las 4 tablas (`trades`, `journal`, `accounts`,
  `user_settings`) tienen RLS y políticas por dueño `(select auth.uid()) = user_id`
  en SELECT/INSERT/UPDATE/DELETE, con `WITH CHECK` en escrituras y comprobación
  cruzada (un trade solo referencia cuentas del propio usuario). (ASVS V4.1/V4.2)
- **Secretos:** solo se expone la `anon`/publishable key (rol `anon`); sin
  `service_role` ni claves privadas en el repositorio.
- **Anti-clickjacking** (frame-busting JS) y `referrer: no-referrer`.
- **Logout seguro:** al cerrar sesión se borran la caché y el outbox del usuario
  en `localStorage`.

## Registro de riesgos
| ID | Área | Sev. | Estado | Recomendación |
|----|------|------|--------|---------------|
| F-01 | HSTS / cabeceras | Medio | Pendiente (infra) | Cloudflare: HSTS + cabeceras de seguridad (ver abajo). |
| F-02 | Auth: contraseñas filtradas | Medio | Pendiente (panel) | Activar leaked-password protection (HIBP) en Supabase. |
| F-03 | Auth: MFA | Medio | **App lista** · panel pendiente | UI de 2FA implementada (enrolar con QR + reto en login). Falta activar TOTP en el panel de Supabase. Opcional: forzar `aal2` en RLS. |
| F-04 | Cadena de suministro (SRI) | Medio | Pendiente | Fijar versión exacta del SDK + `integrity` (SRI). |
| F-05 | Almacenamiento cliente | Medio | **Resuelto** | Limpieza de `localStorage` en logout. |
| F-06 | Política de contraseñas | Bajo | Pendiente (panel) | Longitud mínima ≥ 8 en servidor. |
| F-07 | DoS / WAF | Bajo | Pendiente (infra) | Cloudflare WAF + rate-limiting. |
| F-08 | RLS init-plan | Bajo | **Resuelto** | `auth.uid()` → `(select auth.uid())` en las 16 políticas. |
| F-09 | DAST/SAST en CI | Info | **Parcial** | Workflow ZAP añadido (`.github/workflows/zap.yml`). |

## F-04 — Aplicar SRI al SDK de Supabase (pendiente)
Calcular el hash de la versión exacta y fijarla en `index.html`:
```sh
VER=$(curl -s "https://data.jsdelivr.com/v1/packages/npm/@supabase/supabase-js/resolved?specifier=2" \
  | sed -n 's/.*"version":"\([^"]*\)".*/\1/p')
curl -s "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@${VER}/dist/umd/supabase.js" -o sb.js
echo "sha384-$(openssl dgst -sha384 -binary sb.js | openssl base64 -A)"
```
Sustituir el `<script>` por (versión + hash reales):
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.X.Y/dist/umd/supabase.js"
        integrity="sha384-…" crossorigin="anonymous"></script>
```

## Cabeceras recomendadas en Cloudflare (F-01 / F-07)
GitHub Pages no permite cabeceras personalizadas; añadirlas en el proxy:
```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Permissions-Policy: geolocation=(), camera=(), microphone=()
X-Frame-Options: DENY
```
Activar además: **WAF** (reglas OWASP), **rate-limiting** en `/auth` y reglas
de bot. Mantener "Enforce HTTPS" en GitHub Pages.

## Configuración de Supabase (F-02 / F-03 / F-06)
- Auth → Passwords: **leaked-password protection ON**, longitud mínima ≥ 8.
- Auth → MFA: habilitar **TOTP**. La app ya trae la UI de enrolamiento
  (Ajustes → Gestionar 2FA) y el reto de código en el login.
- Auth → Rate Limits: ajustar sign-in/sign-up/OTP (defensa DoS del backend).
- Mantener RLS en **todas** las tablas nuevas (plantilla de políticas arriba).

### Endurecimiento opcional: forzar 2FA en el servidor (RLS)
El reto de la app es UX cliente. Para que el servidor exija `aal2` a quien tenga
factor verificado (sin bloquear a quien no tiene MFA), añadir a las políticas:
```sql
-- ejemplo para SELECT en trades (replicar en cada tabla/comando):
using (
  (select auth.uid()) = user_id
  and (
    (select auth.jwt()->>'aal') = 'aal2'
    or not exists (
      select 1 from auth.mfa_factors f
      where f.user_id = (select auth.uid()) and f.status = 'verified'
    )
  )
)
```
Aplicar **con el usuario presente** para probar el login y evitar bloqueos.

## CI/CD: DAST con OWASP ZAP
`.github/workflows/zap.yml` ejecuta un *baseline scan* manual contra un entorno
**de staging** (nunca producción). Para rutas autenticadas y escaneo activo,
usar el *ZAP Automation Framework* con contexto de login.

## CI/CD: MASVS / MobSF (cuando existan apps nativas)
```sh
docker run --rm -p 8000:8000 opensecurity/mobile-security-framework-mobsf:latest
curl -F 'file=@app-release.apk' http://localhost:8000/api/v1/upload -H "Authorization:$MOBSF_KEY"
curl -X POST http://localhost:8000/api/v1/scan        -H "Authorization:$MOBSF_KEY" -d "hash=<HASH>"
curl -X POST http://localhost:8000/api/v1/report_json -H "Authorization:$MOBSF_KEY" -d "hash=<HASH>"
```
Verificar: solo HTTPS, sin claves hardcoded, **AES-GCM** (no ECB/RC4),
Keychain/Keystore, permisos mínimos, consultas parametrizadas.

## Checklist OWASP (estado)
- [x] HTTPS forzado · [ ] verificar cipher suites (`testssl.sh`)
- [ ] HSTS (requiere Cloudflare) — F-01
- [x] Validación/escape de entradas (textContent)
- [ ] WAF / anti-DoS — F-07
- [x] Gestión de secretos (sin secretos en repo)
- [x] Hash de contraseñas (bcrypt, Supabase) · [ ] MFA / leaked-pw — F-02/F-03
- [x] Autorización por RLS (mínimo privilegio)
- [x] Logout limpia datos sensibles del cliente — F-05
- [ ] DAST/MobSF integrados — F-09 (ZAP añadido)

## Reportar una vulnerabilidad
Contacto privado del responsable del proyecto. No abrir issues públicos para
fallos de seguridad.
