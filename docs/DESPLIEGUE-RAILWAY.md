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
| `PROFESSIONAL_ENCRYPTION_KEY` | Cifrado del contexto profesional (`utils/professionalCrypto.js`, ES-86) | Distinta de `DATA_ENCRYPTION_KEY` y por entorno; mín. 32 caracteres. Sin ella, en producción, el API responde 503 al guardar contexto profesional. Respaldo fuera del repositorio. Ver doc 44 |
| `AI_ANALYSIS_TRIGGER` | Quién pide el análisis de IA del contexto profesional (ES-89, API) | Opcional: `explicit` (por defecto) o `automatic`. Pendiente de confirmar por Alejo. Ver doc 47 |
| `WORKER_DATABASE_URL` y `WORKER_*` | Servicio `worker` (ES-87, `node backend/worker.js`): conexión con el rol `elevation_worker` y sondeo/lease/intentos | Solo en el servicio worker, nunca en el API. El worker no recibe `DATA_ENCRYPTION_KEY`, `JWT_SECRET` ni `DATABASE_URL`. Ver doc 45 |
| `PROFESSIONAL_KEY_ID` | Identificador de esa clave (`a-z0-9`, 1–8) | Opcional, por defecto `p1`; cambia al rotar |
| `PROFESSIONAL_ENCRYPTION_KEY_PREVIOUS`, `PROFESSIONAL_KEY_ID_PREVIOUS` | Clave anterior, solo para descifrar | Solo durante una rotación |
| `ANTHROPIC_API_KEY` | Claude | Timeout 60 s por intento, 1 reintento |
| `ANTHROPIC_MODEL` | Modelo de Claude (opcional) | Por defecto `claude-haiku-5-5`; el ID anterior `claude-3-haiku-20240307` devuelve 404 |
| `TRUST_PROXY_HOPS` | Saltos de proxy de confianza para la IP del rate limit | `1` en Railway; sin definir no se confía en `X-Forwarded-For` |
| `ADMIN_EMAILS` | Correos que nacen como admin al registrarse | Separados por coma |
| `FRONTEND_URL` | Origen permitido por CORS | `https://${{RAILWAY_PUBLIC_DOMAIN}}` (mismo origen) |
| `VITE_BACKEND_URL` | URL de la API en el build del frontend | Vacía: el frontend llama al mismo dominio |
| `VITE_LANDING_EXAMPLE_APPROVED` | Publica la franja de ejemplo de la landing (ES-64) | Variable de compilación; solo `true` cuando el texto esté aprobado por el especialista y por Mauricio o Alejo. Sin ella la franja queda oculta |

No verificado: `DAILY_API_KEY` y `GCS_*` aparecen en el código; si el piloto usa videollamadas o archivos hay que cargarlas.

## Base de datos
- Producción (`NODE_ENV=production`): `sequelize.sync({})` solo crea las tablas que falten; no altera columnas.
- **Esquema hasta que se cierre ES-59 (fase 2) (QA-57-05, decisión propuesta; ver "Migraciones versionadas"):** (1) en producción y en staging no se altera el esquema desde el código; (2) un cambio de columnas se hace con SQL revisado y aprobado por Mauricio, aplicado a mano y registrado en el PR; (3) `alter` solo se activa de forma explícita con `DB_SYNC_ALTER=true` en un entorno de desarrollo desechable, nunca por defecto y sin depender de `NODE_ENV` (QA-57-05).
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

## Datos de demostración sintéticos en staging

Sin catálogos publicados, «Mi mapa» y el catálogo de rutas muestran «catálogo no disponible». Para una demostración en **staging** (nunca en producción) hay una semilla
sintética e idempotente: `backend/scripts/seedStagingDemo.js`.

```bash
cd backend
ALLOW_SYNTHETIC_CATALOG=true DEMO_USER_PASSWORD='<clave de 12+ caracteres, definida por el operador>' npm run seed:demo
```

- **Qué crea:** el catálogo de habilidades (8, todas con el rótulo «[SINTÉTICO]/[SYNTHETIC]») y el catálogo de rutas sintético, ambos **publicados**; una persona de
  demostración (`demo.participante@example.invalid`, rol `user`) con 3 evidencias confirmadas y 3 autoevaluaciones. Las otras 5 habilidades quedan «sin evidencia».
- **Variables (las define el operador en el entorno del comando; nada va al repositorio):** `ALLOW_SYNTHETIC_CATALOG=true` y `DEMO_USER_PASSWORD`. La clave se guarda con bcrypt y
  el script nunca la imprime. Producción no define `ALLOW_SYNTHETIC_CATALOG`.
- **Funciona con `NODE_ENV=production`:** staging corre así. Antes `seedRouteCatalogSynthetic.js` se negaba con ese valor y no podía cargarse; ahora exige la bandera.
- **Se niega, sin escribir nada,** si falta la bandera o la clave, si ya hay un catálogo **real** publicado (no sintético) o si hay un borrador abierto que no sea de la semilla
  (vacío o con cualquier contenido real: se toma por del cliente). Repetirlo no duplica nada ni cambia la clave de la persona.
- **Si una corrida se corta a medias** (por ejemplo, una desconexión entre crear el borrador y publicarlo), queda un borrador íntegramente sintético: la siguiente corrida lo reconoce como
  propio, lo completa y lo publica (la salida dice `resumed`). Un borrador vacío por un corte justo después de crearlo no se distingue de uno del cliente y se rechaza: se descarta desde el backoffice.
- **Cuenta temporal y bandera de un solo uso (recomendación de QA):** la persona de demostración es **temporal**: se borra después de la presentación con el flujo de borrado de datos (ES-23). La bandera
  `ALLOW_SYNTHETIC_CATALOG` se define **solo en el comando** que corre la semilla (o en el entorno de staging) y **no debe quedar definida en producción** ni en ningún servicio que atienda a clientes; después de cargar
  la demostración conviene quitarla del entorno donde se haya puesto.
- **Cómo retirarlo:** cuando el cliente publique su catálogo real desde el backoffice, el sintético queda archivado y las autoevaluaciones de la demostración se marcan como
  desactualizadas. La persona de demostración se elimina con el flujo de borrado de datos (ES-23).
- **No lo hace:** no activa banderas de build (`VITE_ENABLE_*`), no crea restricciones de rutas (ES-32 no está en `main`) ni toca el catálogo real.
- **Pruebas:** `npm run test:seed-demo:pg` con `SEED_TEST_DATABASE_URL` (Postgres local desechable) y `npm test`.

## Migraciones versionadas (ES-59, fase 1)

Herramienta: `sequelize-cli` (decisión de Mauricio, 25-oct), configurada solo con `DATABASE_URL`. Las migraciones están en `backend/migrations`; la tabla de control es `SequelizeMeta`.

**Estado de la fase 1 (este PR):** herramienta, línea base y comprobación en el CI. **Todavía NO se desactiva `sync()`** en staging ni en producción: la aplicación sigue creando las tablas que falten al arrancar, y las historias que añadan tablas no necesitan migración hasta que Mauricio apruebe el cambio de proceso (fase 2).

| Comando (en `backend/`) | Qué hace |
| --- | --- |
| `npm run db:migrate` | Aplica las migraciones pendientes |
| `npm run db:migrate:status` | Lista las aplicadas (`up`) y las pendientes (`down`) |
| `npm run db:migrate:undo` | Deshace la última. Todo `down` exige `ALLOW_DESTRUCTIVE_MIGRATION=true` y se niega con `NODE_ENV=production`, desde la primera migración que deshace |
| `npm run db:drift` | Compara el esquema de `sync()` con el de las migraciones sobre bases nuevas, y comprueba deshacer y reaplicar. Solo en un Postgres local o desechable |

**Migraciones actuales**
1. `20261001000000-baseline`: el esquema que `sync()` creaba el 28-oct (36 tablas, 3 tipos enumerados y sus índices). Es idempotente. Su `down` borra todas las tablas y exige `ALLOW_DESTRUCTIVE_MIGRATION=true` y `NODE_ENV` distinto de producción.
2. `20261026-es23-data-rights`: heredada de ES-23. Con `sequelize-cli` no hace nada (la línea base ya crea sus tablas); `scripts/migrateDataRights.js` sigue creándolas a mano.
3. `20261028010000-drop-duplicate-es23-index`: quita el índice duplicado `export_requests_owner_expiry` que dejó la ejecución manual de ES-23 en staging. En una base nueva no hace nada.

**Pasar una base que ya tiene el esquema (staging) a migraciones.** No se ejecuta la línea base: se registra como aplicada y luego se aplican las demás. Aviso: `npm run db:migrate` directo sobre una base creada por `sync()` (como staging) falla con «already exists»; solo sirve este camino.

1. Confirmar que la base coincide con la línea base (`db:drift` en local compara `sync` con migraciones; contra staging, volcado de esquema).
2. Crear `SequelizeMeta` y registrar `20261001000000-baseline.js` y `20261026-es23-data-rights.cjs` como aplicadas.
3. `npm run db:migrate` con la `DATABASE_URL` de staging (aplica solo la de limpieza del índice).

Antes, un volcado de respaldo o punto de restauración y la confirmación de Mauricio. Producción empieza ya con migraciones, sin pasar por este camino.

**Regla para cada PR que toque el esquema (a partir de la fase 2):** una migración nueva con `up` y `down`, con nombre `AAAAMMDDHHMMSS-descripcion`; una migración aplicada no se edita; cambios aditivos por defecto; los destructivos (borrar o cambiar tipo) en dos despliegues y con confirmación de Mauricio. El CI (`db:drift`) falla si el modelo y las migraciones no coinciden. Excepción: las restricciones e índices que solo existen en las migraciones y están listados por nombre, con su motivo, en `backend/scripts/drift-allowed.json` (Sequelize no declara CHECK ni claves foráneas compuestas); cualquier otra diferencia es deriva. Quien añada una la declara en el PR de su historia.

**Fases pendientes:** aplicar las migraciones antes de cada despliegue en Railway (comando previo) y retirar `sync()` de producción y staging (fase 2); hacer `db:drift` un check requerido de `main` (fase 3). Nota: `sequelize-cli` está en `dependencies` (no en `devDependencies`) porque el comando previo lo necesita dentro de la imagen; la prueba P1-8 lo trata como herramienta de línea de comandos.

## Diferencias conocidas de staging

Staging se creó con `sync()` antes de que existieran las migraciones; producción nacerá con migraciones. Por eso hay diferencias que se aceptan de forma explícita y no se corrigen tocando staging.

**Los 6 CHECK de ES-32 (QA-43-02, decisión de Mauricio: aceptar como diferencia conocida, 28-oct-2026).** La migración `20261028-es32-routes.cjs` crea 6 restricciones CHECK que los modelos no declaran. En una base creada con migraciones existen; en staging, cuyas tablas de rutas las creó `sync()`, no existen (0 frente a 6). Nombres:

- `RouteChoices_decision_check`
- `RouteChoices_slot_check`
- `RouteChoices_status_check`
- `RouteConstraintsVersions_status_check`
- `RouteConstraintsVersions_version_check`
- `RouteReviewRequests_status_check`

**Motivo.** El camino documentado para pasar staging a migraciones (registrar la línea base y ejecutar `db:migrate`) usa `CREATE TABLE IF NOT EXISTS`, que no añade restricciones a tablas que ya existen. Añadirlas exigiría una migración propia tras verificar que las filas actuales las cumplen, y en staging solo hay datos sintéticos.

**Efecto.** El servidor valida de entrada el slot y la decisión (`utils/routes.js`) y es el único que fija el estado y la versión; la diferencia es de defensa en profundidad en la base, no de comportamiento. Que ninguna otra ruta de escritura salte esa validación no se ha auditado aquí. Las pruebas de QA con Postgres real se ejecutan sobre bases creadas con migraciones, que sí los tienen.

**Cuándo se reabre.** Si se recrea staging, o si se exige paridad exacta entre staging y producción, se crea una migración propia que añada los 6 CHECK (comprobando antes las filas existentes) y se retira esta entrada. Hasta entonces `db:drift` no se ve afectado: compara bases nuevas creadas por `sync()` y por migraciones, no la base de staging.

No se toca la base de staging ni se migra nada por este motivo.

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
