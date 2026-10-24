# Despliegue en Railway + Supabase (ES-9)

Un solo servicio de Railway (`backend`) sirve la API y el frontend estático (`frontend/dist`). Postgres vive en Supabase. Redis existe en staging pero el código aún no lo usa.

## Estructura en Railway
- Proyecto `elevation`, entornos `staging` y `production` (variables separadas).
- Servicio `backend`: build y arranque definidos en `railway.json` (raíz).
  - Build: `npm run build` (el `install` de la raíz instala backend y frontend; el build compila `frontend/dist`).
  - Arranque: `node backend/server.js`. Escucha en `PORT` (lo asigna Railway).
  - Salud: `GET /api/health` (sin base de datos ni auth).
- Servicio `Redis`: sin conexión desde el código todavía.

## Variables del servicio `backend`
Los valores se cargan en Railway (pestaña Variables); no van en el repo. Nombres en `backend/.env.example`.

| Variable | Para qué sirve | Nota |
|---|---|---|
| `DATABASE_URL` | Conexión a Postgres | Session pooler de Supabase, puerto 5432 |
| `DB_SSL` | SSL a la base | `true` |
| `DB_POOL_MAX` | Tope del pool de Sequelize | Opcional, por defecto 5 |
| `NODE_ENV` | Modo | `production` en ambos entornos |
| `JWT_SECRET` | Firma de sesiones | Distinto por entorno. Sin ella el proceso debe fallar (hallazgo P1 del PR #2) |
| `DATA_ENCRYPTION_KEY` | Cifrado de datos (`utils/crypto.js`) | Distinta por entorno. En producción el proceso no arranca sin ella |
| `PROMPT_ENCRYPTION_KEY` | Cifrado de prompts (`promptVault.js`) | Distinta por entorno |
| `ANTHROPIC_API_KEY` | Claude | Timeout 60 s por intento, 1 reintento |
| `ANTHROPIC_MODEL` | Modelo de Claude (opcional) | Por defecto `claude-haiku-5-5`; el ID anterior `claude-3-haiku-20240307` devuelve 404 |
| `ADMIN_EMAILS` | Correos que nacen como admin al registrarse | Separados por coma |
| `FRONTEND_URL` | Origen permitido por CORS | `https://${{RAILWAY_PUBLIC_DOMAIN}}` (mismo origen) |
| `VITE_BACKEND_URL` | URL de la API en el build del frontend | Vacía: el frontend llama al mismo dominio |

No verificado: `DAILY_API_KEY` y `GCS_*` aparecen en el código; si el piloto usa videollamadas o archivos hay que cargarlas.

## Base de datos
- Producción: `sequelize.sync({})` solo crea tablas que falten; no altera columnas (`alter` solo fuera de producción).
- Pendiente (ticket aparte): migraciones versionadas. Hasta entonces, un cambio de columnas en producción requiere SQL manual revisado.
- Staging y production usan proyectos de Supabase distintos. Los entornos de PR nunca apuntan a producción.

## Reversión
- Código: en Railway, servicio `backend` → Deployments → Redeploy del despliegue anterior, o revertir el merge en `main`.
- `vercel.json` y `api/index.js` siguen en el repo hasta decidir su retiro: Vercel es el camino de vuelta mientras tanto.
- Datos: sin migraciones no hay reversión de esquema automática. No verificado: restauración de Supabase (depende del plan de respaldos).

## Pruebas de humo (después de cada despliegue)
1. `GET /api/health` → `{"status":"ok"}`.
2. `GET /` y una ruta del SPA (`/login`) → 200.
3. Registro y login con un usuario sintético.
4. Una conversación de chat (consume Claude: muestra pequeña).
5. Borrado del usuario sintético.

## No verificado aún
- Primer build en Railway (`railway.json`, instalación del frontend por el `install` de la raíz, dependencia nativa `sqlite3` del `package.json` raíz).
- Protección de los entornos de PR en Railway.
- Reversión probada en Railway.
