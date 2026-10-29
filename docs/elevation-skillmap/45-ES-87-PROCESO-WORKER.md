# ES-87 · Proceso worker de análisis de IA (PROPUESTA para revisión de QA)

28-oct-2026 · Autor: Dev-Worker-Claude · Decide lo técnico: Mauricio. Subtarea B de ES-84 (spike `43-SPIKE-WORKER-ES-84.md`). Depende de ES-85 (tablas, rol y funciones SQL) y ES-86 (clave profesional). Todo lo que no se pudo verificar está marcado «no verificado».

## Qué es
`node backend/worker.js` (o `npm run worker` en `backend/`): un proceso **sin pantalla ni puerto**, misma imagen y repositorio que el API. Sondea Postgres, reclama un job de análisis, lee el contexto profesional que la persona autorizó, pregunta a Claude por candidatas a competencia y las publica para que la persona las revise. **No arranca el API, no usa `sync()` y no importa módulos de chats, diario, consentimiento, sesiones ni rutas** (una prueba lo comprueba).

## Flujo de un job
1. `worker_claim` (ES-85): job `PENDING` → `RUNNING`, `fence` +1, lease; devuelve el payload **cifrado** de la versión autorizada y el catálogo vigente. Solo si el consentimiento `professional_bridge` sigue vigente.
2. Descifrado con `PROFESSIONAL_ENCRYPTION_KEY` (ES-86) y nuevo saneado del texto (secretos y caracteres ocultos).
3. Prompt: instrucciones + catálogo (confiable) + texto de la persona **dentro de un bloque delimitado como dato no confiable** (`fenceUntrusted`). Sin identificadores ni correo.
4. `callClaude` (ES-22): reserva de presupuesto atómica, timeout y reintentos acotados, registro de uso sin contenido.
5. La salida se reduce a `{skillKey, level, citations}`: habilidad del catálogo, nivel 1–4 o `null`, y 1–7 claves de campo **de las que se entregaron**. Confianza, notas y cualquier otro campo se descartan; el modelo no declara confianza. Si el modelo propuso algo y todo se descartó, es salida inválida (reintentable).
6. `worker_publish` (ES-85): bajo bloqueo del consentimiento, con `fence` y con la misma validación en SQL. Si algo no cuadra no escribe nada.

## Recuperación y concurrencia
- **Heartbeat** cada tercio del lease. Si devuelve `false` (job invalidado, cancelado o reclamado), el worker abandona sin publicar.
- **Lease vencido** (el worker murió, `kill -9`, reinicio): el siguiente `worker_claim` lo devuelve a `PENDING` (o `FAILED` al agotar intentos). Una publicación tardía del intento viejo falla por el `fence`.
- **Sondeo**: `WORKER_POLL_MS` (5 s) en reposo, duplicando hasta `WORKER_POLL_MAX_MS` (30 s); sin espera tras tomar un job. Si la base no responde, espera creciente (hasta 60 s) y sigue vivo; en el registro solo aparece el código del error.
- **Presupuesto agotado** (persona o cohorte): no se llama al proveedor, el job vuelve a `PENDING` con aviso `budget_exhausted`, el intento se devuelve y espera `WORKER_BUDGET_RETRY_SECONDS` (15 min). El último mapa válido de la persona no se toca.
- **No reintentables** (FAILED de inmediato): contexto inválido, no se puede descifrar, credencial del proveedor inválida, petición mal formada, prompt que jamás cabría en el tope por persona, presupuesto no configurado.
- **Apagado ordenado** (SIGTERM/SIGINT): deja de reclamar, termina el job en curso (hasta `WORKER_SHUTDOWN_MS`) y sale; si no termina, sale con código 1 y el lease lo recupera.

## Aislamiento del entorno
El worker **se niega a arrancar** (código 2, sin imprimir valores) si define `DATA_ENCRYPTION_KEY`, `PROMPT_ENCRYPTION_KEY`, `JWT_SECRET` o `DATABASE_URL` (la del API), si falta una variable obligatoria, si la clave profesional es inválida o si `WORKER_LEASE_SECONDS` no supera el peor caso de la llamada (timeout × (reintentos + 1) + 30 s). También revisa lo que un `.env` local pudiera inyectar. `database.js` recibe la URL propia (`WORKER_DATABASE_URL`) y un pool de 2.

## Variables (solo nombres; los valores los carga Mauricio)
| Variable | Qué es |
| --- | --- |
| `WORKER_DATABASE_URL` | Conexión con el rol `elevation_worker` (por el pooler compartido). Obligatoria |
| `PROFESSIONAL_ENCRYPTION_KEY` (+ `PROFESSIONAL_KEY_ID`, `…_PREVIOUS`) | Clave del dominio profesional (ES-86). Obligatoria |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | Claude (modelo opcional) |
| `AI_BUDGET_TOKENS_PER_USER` (obligatoria), `AI_BUDGET_TOKENS_COHORT`, `AI_BUDGET_PERIOD`, `AI_CALL_TIMEOUT_MS`, `AI_MAX_RETRIES` | Presupuesto y tiempos (ES-22); topes definidos por Alejo (V-12) |
| `WORKER_POLL_MS`, `WORKER_POLL_MAX_MS`, `WORKER_LEASE_SECONDS`, `WORKER_MAX_ATTEMPTS`, `WORKER_SHUTDOWN_MS`, `WORKER_BUDGET_RETRY_SECONDS` | Propias del worker (valores por defecto en `worker/config.js`) |
| `DB_SSL`, `DB_POOL_MAX` | Como en el API (pool por defecto 2) |

No recibe: `DATA_ENCRYPTION_KEY`, `PROMPT_ENCRYPTION_KEY`, `JWT_SECRET`, `DATABASE_URL`.

## Registro
Una línea JSON por evento con una **lista cerrada de campos** (`jobId`, `fence`, `attempt`, códigos, conteos y tiempos). Nunca texto de personas, salida del modelo, claves, prompts ni identificadores de personas; de un error solo se registra su código, no su mensaje.

## Límites conocidos
- Un esquema no distingue un nivel 4 legítimo de uno inducido por instrucciones escondidas en el texto: la defensa es el saneado, el bloque no confiable, la regla «interés/motivación no es evidencia de nivel» del prompt y que **la persona revisa cada candidata y solo puede bajar el nivel** al confirmar (ES-28/29). Pregunta de producto abierta: ¿se permiten niveles no nulos a partir de motivaciones e intereses, o conviene forzar `null` en el incremento 1?
- El idioma de la persona no se conoce en el worker: el catálogo se envía con etiquetas ES/EN y la rúbrica en inglés. La salida no lleva texto, así que no hay nada que traducir.

## Pruebas
- `test/es-87-worker.test.cjs` (17, sin base): entorno, registro, saneado, prompt, validación de la salida, clasificación de errores, bucle (con doble de la base), sondeo, apagado y aislamiento de módulos.
- `test/integration/es-87-postgres.cjs` (`npm run test:worker-process:pg`): Postgres real con el rol restringido, migraciones reales, SDK y `callClaude` reales contra un proveedor simulado por HTTP. Flujo completo, entrada maliciosa, errores del proveedor, presupuesto (persona y cohorte), revocación durante el análisis, worker zombi y fencing, dos workers, base caída, **`kill -9` de un proceso real**, rechazo de entornos inválidos (incluido `.env`), base inalcanzable y ausencia de fugas en los registros. El apagado con SIGTERM de un proceso real solo corre fuera de Windows (CI, Linux).

## No verificado
- Claude real: calidad de las candidatas y comportamiento ante inyecciones reales (el proveedor se simuló).
- Supabase real y su pooler con este rol (ver PR #60); consumo real de memoria y CPU del servicio.
- SIGTERM sobre un proceso real en Windows (no existe allí); se ejecuta en el CI de Linux.
- Creación del servicio en Railway, variables y límite de gasto: Infra/Mauricio, fuera de este PR.
