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
| `DB_SYNC_ALTER` | Permite que `sync()` altere columnas | Solo `true` en una base de desarrollo desechable; no definir en staging ni producción |
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
- **Esquema hasta que existan migraciones (QA-57-05, decisión propuesta):** (1) en producción y en staging no se altera el esquema desde el código; (2) un cambio de columnas se hace con SQL revisado y aprobado por Mauricio, aplicado a mano y registrado en el PR; (3) `alter` solo se activa de forma explícita con `DB_SYNC_ALTER=true` en un entorno de desarrollo desechable, nunca por defecto y sin depender de `NODE_ENV` (QA-57-05).
- Migraciones versionadas y plan de migración continuo: **ES-59** (https://iatech-team-xqxmjki1.atlassian.net/browse/ES-59). Hasta que se cierre rige la regla de arriba.
- Staging y production usan proyectos de Supabase distintos. Los entornos de PR nunca apuntan a producción.

## Sesiones y cierre de sesión (ES-18)
- Cada token lleva un `jti`; `POST /api/logout` revoca el actual y `POST /api/logout-all` corta todas las sesiones de la persona. Un administrador que cambia rol/estado, borra o restablece la contraseña de una cuenta también corta sus sesiones anteriores.
- Tablas nuevas `RevokedTokens` y `AuthRevocations`: las crea `sync()` al arrancar (no altera tablas existentes). Sin migraciones hasta ES-59.
- **Al desplegar:** los tokens emitidos antes (sin `jti`) dejan de valer; cada persona debe iniciar sesión una vez.
- **Reversión a una versión anterior:** el código anterior acepta los tokens con `jti` pero **no aplica las revocaciones**; los registros quedan en las tablas y vuelven a surtir efecto al volver a la versión nueva. Las tablas no se borran en la reversión.
- Si no se puede consultar la base, la API responde 503 en las rutas autenticadas (cierra en falla).

## Consentimiento por propósito (ES-19)
- Tablas nuevas `Consents` y `ConsentEvents`: las crea `sync()` al arrancar (no altera tablas existentes). Sin migraciones hasta ES-59.
- Rutas `/api/consents` (solo la persona autenticada). Contrato completo en `docs/elevation-skillmap/14-CONTRATO-CONSENTIMIENTO.md`.
- Reversión: el código anterior ignora las tablas; no se borran. Ningún flujo existente depende todavía del consentimiento.

## Conversaciones y diario (ES-20)
- Tablas nuevas `ChatTurns`, `DiaryEntries` y `DerivedInvalidations`: las crea `sync()` al arrancar (no altera tablas existentes). Sin migraciones hasta ES-59.
- El diario y los turnos se cifran con el formato v2 (AES-256-GCM) derivado de `DATA_ENCRYPTION_KEY`: la clave debe ser la misma en todo entorno que lea esos datos; con otra clave el descifrado falla (no devuelve texto cifrado).
- `Messages` conserva el formato de cifrado anterior; no hay re-cifrado.
- Reversión: el código anterior ignora las tablas nuevas y sigue leyendo `Messages`; no se borran. Contrato en `docs/elevation-skillmap/15-CONTRATO-CONVERSACIONES-DIARIO.md`.

## Límites de acompañamiento y seguridad (ES-21)
- Sin tablas ni variables nuevas. El registro de recursos de apoyo `backend/config/supportResources.json` sale **vacío**: no se muestran números hasta que alguien verifique cada país (fuente, verificador y fecha) mediante un PR.
- El detector de riesgo es una ayuda limitada y sus textos son un borrador sin validar por un especialista: no abrir el piloto sin esa revisión. Detalle y límites en `docs/elevation-skillmap/16-LIMITES-Y-FRONTERA-PRIVADA.md`.
- Reversión: sin datos que revertir; el código anterior no detecta ni interrumpe.

## Presupuesto, fallos y reintentos de IA (ES-22)
- **Acción de Infra/Mauricio antes de desplegar:** cargar `AI_BUDGET_TOKENS_PER_USER` (obligatoria) y, si se decide, `AI_BUDGET_TOKENS_COHORT`, `AI_BUDGET_PERIOD`, `AI_CALL_TIMEOUT_MS` y `AI_MAX_RETRIES`. Los valores son una decisión pendiente (V-12): **sin `AI_BUDGET_TOKENS_PER_USER` el chat, las recomendaciones y el matching responden 503** (también en staging).
- Tablas nuevas `AiBudgetCounters` y `AiUsages`: las crea `sync()` (sin migración). `config/aiPricing.json` sale vacío: no hay costos en dinero hasta verificar precios.
- Reversión: el código anterior ignora las tablas y vuelve a llamar sin tope; no se borran. Detalle en `docs/elevation-skillmap/17-PRESUPUESTO-Y-FALLOS-DE-IA.md`.

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

## CI y auditoría de dependencias
- El workflow `CI` (`.github/workflows/ci.yml`) corre por PR: frontend (instalar, lint informativo, auditoría, tipos + build) y backend (instalar, sintaxis, `npm test`, auditoría).
- `npm audit --omit=dev --audit-level=high` **bloquea** el CI en backend y frontend (decisión de Mauricio, 25-oct-2026). Las vulnerabilidades moderadas no bloquean; hoy hay 6 moderadas en el backend (`@google-cloud/storage`, `gaxios`, `retry-request`, `teeny-request`, `uuid`, `sequelize`) como riesgo aceptado hasta subir esas versiones (cambios con ruptura posible).
- Lint del frontend: 4 errores previos (`UserDashboard.tsx`, `BoardManifest.tsx`); sigue informativo hasta que un ticket los corrija.
- Protección de `main`: hoy exige el check `Vercel`. Los checks `backend` y `frontend` se añaden como requeridos cuando el workflow esté en `main` (ver orden en `docs/elevation-skillmap/12-OPERACION-Y-RELEASES.md`, paso 2); `Vercel` se retira después.

## No verificado aún
- Protección de los entornos de PR en Railway.
