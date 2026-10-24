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
| `TRUST_PROXY_HOPS` | Saltos de proxy de confianza para la IP del rate limit | `1` en Railway; sin definir no se confía en `X-Forwarded-For` |
| `ADMIN_EMAILS` | Correos que nacen como admin al registrarse | Separados por coma |
| `FRONTEND_URL` | Origen permitido por CORS | `https://${{RAILWAY_PUBLIC_DOMAIN}}` (mismo origen) |
| `VITE_BACKEND_URL` | URL de la API en el build del frontend | Vacía: el frontend llama al mismo dominio |

No verificado: `DAILY_API_KEY` y `GCS_*` aparecen en el código; si el piloto usa videollamadas o archivos hay que cargarlas.

## Base de datos
- Producción (`NODE_ENV=production`): `sequelize.sync({})` solo crea las tablas que falten; no altera columnas.
- **Esquema hasta que existan migraciones (QA-57-05, decisión propuesta):** (1) en producción y en staging no se altera el esquema desde el código; (2) un cambio de columnas se hace con SQL revisado y aprobado por Mauricio, aplicado a mano y registrado en el PR; (3) `alter` solo debe activarse de forma explícita en un entorno de desarrollo desechable, nunca por defecto (cambio de código pendiente de Dev, ver QA-57-05).
- Migraciones versionadas: ticket propuesto en ES-9 (clave de Jira por enlazar aquí y en el PR #4 cuando se cree).
- Staging y production usan proyectos de Supabase distintos. Los entornos de PR nunca apuntan a producción.

## Reversión
- Código (**probado en staging el 23 y 24-oct-2026**, QA ES9-04): panel de Railway → proyecto `elevation` → entorno `staging` → servicio `backend` → Deployments → menú ⋮ del despliegue anterior → Rollback. Railway reactiva el código previo (crea un despliegue nuevo, sin recompilar). Variables y base de datos no cambian con la reversión.
- **Cómo confirmar qué versión corre tras un Rollback:** `GET /api/health` puede **no** traer el campo `commit`, porque Railway no inyecta `RAILWAY_GIT_COMMIT_SHA` en un despliegue revertido (observado dos veces; la causa es una inferencia). Se confirma por el panel (despliegue marcado ACTIVE y su commit) o por CLI: `railway deployment list --service backend --json` → `meta.commitHash` y `meta.reason` (`rollback` o `deploy`), más las pruebas de humo. En un despliegue normal, `commit` sí aparece.
- Volver a avanzar: `railway deployment redeploy --service backend --environment staging --from-source --yes` (o un push a la rama) despliega de nuevo el último commit de la rama. Mientras se está en rollback, un push lo deshace.
- El CLI solo ofrece `redeploy` del último despliegue; no hay rollback por CLI.
- `vercel.json` y `api/index.js` siguen en el repo hasta decidir su retiro: Vercel es el camino de vuelta mientras tanto.
- Datos: sin migraciones no hay reversión de esquema automática. No verificado: restauración de Supabase (depende del plan de respaldos).
- En un despliegue normal, `/api/health` informa el commit (`RAILWAY_GIT_COMMIT_SHA`); tras un rollback no, ver arriba.

## Pruebas de humo (después de cada despliegue)
1. `GET /api/health` → `{"status":"ok"}`.
2. `GET /` y una ruta del SPA (`/login`) → 200.
3. Registro y login con un usuario sintético.
4. Una conversación de chat (consume Claude: muestra pequeña).
5. Borrado del usuario sintético.

## No verificado aún
- Protección de los entornos de PR en Railway.
