# ES-84 · Spike de diseño del worker de análisis de IA (PROPUESTA para aprobación)

28-oct-2026 · Autor: Infra-Claude · Decide lo técnico: Mauricio · Decide el alcance: Alejo.
Este documento **no crea servicios ni código**: propone el diseño para estimar y para que Mauricio apruebe el costo. Versión 2 (28-oct): incorpora las decisiones de Mauricio (sin Redis, funciones SQL, clave propia). Todo lo que no se pudo verificar está marcado «no verificado».

## 1. Qué se decidió ya y qué no

| Tema | Estado | Fuente |
| --- | --- | --- |
| Postgres + worker + Redis en el incremento 1; Postgres durable, Redis solo IDs | Aprobado por Alejo | V-10 (doc 08) |
| Credencial propia del worker; lee solo contexto profesional autorizado; publica con consentimiento comprobado en la transacción | Aprobado por Alejo | V-11, ADR-002/003 (docs 08 y 10) |
| El worker es un proceso, no una pantalla; entra en el incremento 1 | Confirmado por Mauricio, 28-oct | ES-84 |
| **Sin Redis en esta versión:** el worker sondea Postgres | **Decidido por Mauricio, 28-oct** (matiza V-10 solo en este punto) | §3 |
| Permisos del worker solo por funciones SQL, con la excepción de las dos tablas de presupuesto | **Aprobado por Mauricio, 28-oct** | §5 |
| Clave de cifrado propia para el dominio profesional | **Aprobado por Mauricio, 28-oct** | §5 |
| Costo del servicio worker en staging y estimación de horas | **Pendiente de aprobación de Mauricio** | §9 y §11 |
| Topes de presupuesto de IA por persona | Pendiente (V-12) | doc 08 |

## 2. Qué hace el worker, con lo que ya existe

Entrada: la **versión activa del contexto profesional** (`CareerContextVersions`, ES-25): campos de lista cerrada que la persona aprobó, cifrados v2. Se lee hoy solo con `getApprovedContext(userId, consumer)`, que exige consentimiento vigente y deja rastro en `BridgeTransfers`.

Salida: **candidatas a competencia** (habilidad del catálogo vigente, nivel propuesto o `null`, citas a las claves de campo que la respaldan) en estado revisable. La persona las confirma, corrige o rechaza; al confirmar se usa el camino que ya existe (`/api/skill-map/proposals/confirm`, ES-28/29), que solo permite bajar el nivel. Aceptar no certifica competencia.

Reutiliza, sin duplicar: `callClaude` (presupuesto, timeout y registro, ES-22), `fenceUntrusted` y los filtros de salida (ES-21, ES-28), el catálogo y la confianza calculada por reglas (ES-29). El modelo no declara confianza.

**Lo que ya hace ES-28 sin worker:** propuestas síncronas, a petición, sobre evidencias confirmadas, con token firmado de 10 minutos y sin guardar nada. El worker no las reemplaza: añade el análisis **durable y asíncrono** sobre el contexto autorizado, con resultado guardado y revocable.

## 3. Topología propuesta

```
 API (Express)  ──(una transacción)──►  Postgres: AiJobs
                                           ▲   │  worker_claim() cada pocos segundos
                                           │   ▼
                                        worker ──► Claude
                                           │
                                   funciones SQL controladas
```

- **Servicio nuevo `worker`** en Railway, **misma imagen y repositorio**, comando de arranque distinto (`node backend/worker.js`). Sin dominio público ni puerto. Variables propias; los secretos los carga Mauricio.
- **Sin Redis ni outbox/relay.** El worker llama `worker_claim()` a intervalos (propuesta: cada 5 s en reposo, con espera creciente hasta 30 s sin trabajo; sin espera si acaba de tomar uno). La función usa `FOR UPDATE SKIP LOCKED`, de modo que varios workers no se pisan. Postgres sigue siendo la única fuente de verdad: no hay cola que reconciliar.
- **Entornos:** staging primero. Producción solo después de aprobar costo y de ES-11. Los entornos de PR **no** llevan worker.
- **Conexiones a Supabase:** el worker usa su propia URL (`WORKER_DATABASE_URL`) y un pool de 2. Con el pool de 5 del API caben de sobra en el límite de 60 conexiones de staging.
- **Si más adelante hace falta Redis** (mucho volumen o latencia), se añade como despertador sin cambiar el modelo de datos ni las funciones: el estado sigue en Postgres.
- **Latencia aceptada:** el análisis es asíncrono; esperar unos segundos hasta el siguiente sondeo es imperceptible frente a la llamada a Claude.

## 4. Datos nuevos (migraciones versionadas, nunca `sync`; depende de ES-59 fase 2)

Tablas nuevas, sin contenido privado ni texto de la persona (dos, sin outbox):

- **`AiJobs`**: `id`, `UserId`, `kind` (`competency_extraction`), `contextVersion` (versión de `CareerContextVersions`), `contextHash`, `requestId` (único por persona: idempotencia), `status`, `attempt`, `leaseOwner`, `leaseExpiresAt`, `fence` (entero que solo crece), `errorCode`, fechas. **No guarda prompts ni respuestas.**
- **`SkillCandidates`**: `jobId`, `UserId`, `skillKey`, `level` (1–4 o `null`), `citations` (claves de campo; sin texto), `status` (`REVIEW_REQUIRED`, `ACCEPTED`, `REJECTED`, `INVALIDATED`), único `(jobId, skillKey)`. Los textos de apoyo, si se guardan, van cifrados v2 como el resto.

Todo con `UserId` y verificación de propietario en servidor en cada lectura; el borrado y la exportación de ES-23 los recorren (§8).

## 5. Permisos del worker: solo funciones, sin acceso a tablas

El rol `elevation_worker` **no tiene privilegio sobre ninguna tabla** de personas. Solo puede ejecutar cuatro funciones `SECURITY DEFINER` (propietario: un rol sin login, `search_path` fijo, `REVOKE ALL ... FROM PUBLIC`):

1. **`worker_claim()`**: toma con `FOR UPDATE SKIP LOCKED` el siguiente job `PENDING`, lo pasa a `RUNNING`, sube `fence`, fija el lease y devuelve `{jobId, fence, userId, contextVersion, payload cifrado}` **solo** de esa versión de contexto, y **solo si** el consentimiento `professional_bridge` está vigente (si no, marca el job `CANCELLED`).
2. **`worker_heartbeat(jobId, fence)`**: renueva el lease si el `fence` coincide.
3. **`worker_publish(jobId, fence, candidatas)`**: en **una transacción**: bloquea `FOR SHARE` la fila de consentimiento y comprueba que sigue vigente; comprueba que el job está `RUNNING` con ese `fence`; que la versión de contexto sigue activa y con el mismo `contextHash`; inserta candidatas (`ON CONFLICT DO NOTHING`); pasa el job a `REVIEW_REQUIRED`. Si algo falla, no escribe nada.
4. **`worker_fail(jobId, fence, errorCode)`**: marca el reintento o `FAILED` según `attempt`.

Además, para `callClaude` (ES-22) el worker necesita registrar uso y reservar presupuesto: se le concede **solo** `SELECT/INSERT/UPDATE` sobre `AiBudgetCounters` y `AiUsages`, que guardan cifras y no contenido. Es la única excepción y debe revisarla Mauricio.

**Por qué funciones y no permisos de tabla:** la propuesta inicial del doc 10 (permisos de tabla) no alcanza para gestionar leases ni para comprobar consentimiento sin leer tablas privadas. Con funciones, la denegación es verificable: `SELECT` sobre `ChatTurns`, `DiaryEntries`, `Consents`, `CareerContextVersions` debe fallar con `permission denied`.

**Revocación y publicación sobre la misma fuente:** la revocación ya actualiza el consentimiento y la versión de contexto en una transacción (gancho en `utils/consent.js`, ES-25). Se ampliará para, en esa misma transacción, pasar los jobs vivos a `INVALIDATED` e invalidar las candidatas. `worker_publish` bloquea el consentimiento `FOR SHARE` y la revocación lo toma `FOR UPDATE`: una de las dos espera a la otra, en cualquier orden.

**Fencing:** si un worker pierde el lease (se colgó, hubo reinicio) y otro reclama el job, el `fence` sube; la publicación del intento viejo falla porque su `fence` ya no coincide.

### Riesgos abiertos de este diseño

- **Pooler de Supabase (no verificado):** hay que comprobar que un rol propio funciona con el usuario `rol.proyecto` del pooler compartido y con las funciones `SECURITY DEFINER`. Los bloqueos deben ser de transacción (`FOR UPDATE`, `FOR SHARE`), no de sesión.
- **Clave de cifrado propia del dominio profesional (aprobada):** el worker usa una clave nueva, `PROFESSIONAL_ENCRYPTION_KEY`, y **no** recibe `DATA_ENCRYPTION_KEY`, con la que se cifran chats y diario. Así, aunque el servicio del worker se comprometiera, no podría descifrar lo privado. Implica trabajo de Dev: identificar la clave en el formato cifrado, cifrar con la nueva el `payload` de `CareerContextVersions`, **volver a cifrar las versiones existentes** con una migración de datos reversible y probada, y documentar la rotación. El API debe poder descifrar con ambas claves durante la transición. Hasta que exista este cambio el worker no puede arrancar.
- **API de datos de Supabase (no verificado):** hay que confirmar en el panel que la API REST pública está desactivada o que las tablas tienen RLS. Es un riesgo previo e independiente del worker.

## 6. Estados y transiciones

`PENDING` → `RUNNING` (reclamo) → `REVIEW_REQUIRED` (publicó candidatas) → `COMPLETED` (la persona resolvió todas).
`RUNNING` → `PENDING` (lease vencido, `attempt`+1) → `FAILED` al superar el máximo de intentos (propuesta: 3).
`PENDING` o `RUNNING` o `REVIEW_REQUIRED` → `CANCELLED` (la persona cancela) o `INVALIDATED` (revocación o borrado).
No hay otras transiciones; las ilegales fallan en la función y se prueban una por una.

## 7. Entrega y recuperación

- **Reclamo por sondeo:** `worker_claim()` entrega como máximo un job por llamada. Si el worker se cuelga, el lease vence y el job vuelve a `PENDING`.
- **Recuperación:** un barrido dentro del propio `worker_claim()` devuelve a `PENDING` los `RUNNING` con lease vencido (`attempt` + 1) y pasa a `FAILED` los que superan el máximo. No hace falta proceso aparte.
- **Idempotencia:** la dan las restricciones, no una cola: `requestId` único por persona, `(jobId, skillKey)` único y `fence`.
- **Presupuesto (V-13):** si se agota el límite de la persona o de la cohorte, el job queda `PENDING` con aviso, sin llamar a Claude y sin perder el último mapa válido. Los topes los define Alejo (V-12); no se inventan aquí.
- **Timeouts y reintentos acotados** de la llamada a Claude como en `callClaude`; el lease debe superar con margen el timeout.
- **Cuándo se crea un job (propuesta):** por **acción explícita de la persona** («Analizar mi contexto») y no automáticamente al confirmar el contexto: controla el gasto y deja claro qué se analiza. Decisión de Alejo.

## 8. Borrado, exportación y auditoría

- El borrado (ES-23) debe **drenar el worker** como productor: detener nuevos reclamos, esperar o invalidar los `RUNNING`, borrar jobs y candidatas de esa persona, y recién entonces purgar. El doc 18 ya prevé «web, workers e integraciones».
- La exportación incluye los jobs y candidatas de la persona.
- Auditoría: cada reclamo registra en `BridgeTransfers` las claves entregadas y su hash, sin texto, como cualquier otro consumidor (`consumer = 'worker'`).

## 9. Costos

Precios de Railway leídos en https://railway.com/pricing el 28-oct-2026 (a reconfirmar): memoria USD 0,00000386 por GB-segundo; CPU USD 0,00000772 por vCPU-segundo; salida de red USD 0,05 por GB. Plan Pro: USD 20 mínimos con USD 20 de uso incluido. Railway cobra por uso real.

Con 30 días (2,59 millones de segundos): **1 GB de memoria constante ≈ USD 10 al mes** y **1 vCPU constante ≈ USD 20 al mes**.

Estimación de orden de magnitud (**no medida**; se mide en staging):

| Pieza | Supuesto de uso medio | Costo mensual aproximado |
| --- | --- | --- |
| Servicio worker en staging (sin Redis) | ~0,15 GB y ~0,01 vCPU | ≈ USD 1,7 |
| Redis | no se crea | USD 0 |
| Staging + producción (cuando exista) | | ≈ USD 3,4 |

Cabe dentro de los USD 20 de uso incluido del plan Pro, compartidos con el API. Supabase no añade costo por el rol ni por las funciones. El costo dominante será el **consumo de Claude**, pendiente de V-12. Antes de crear el servicio hay que confirmar el límite de gasto de uso configurado en el proyecto de Railway.

## 10. Plan de pruebas (QA, con Postgres real)

1. **Aislamiento:** con `elevation_worker`, `SELECT` sobre `ChatTurns`, `DiaryEntries`, `Consents`, `CareerContextVersions` y `Users` falla; solo las cuatro funciones responden.
2. **Revocación concurrente, ambos órdenes**, con dos conexiones reales y pausa antes del commit: nunca queda una candidata publicada tras una revocación.
3. **Fencing:** un intento con lease vencido no publica; dos workers sobre el mismo job producen un solo resultado.
4. **Dos workers sondeando a la vez:** cada job lo toma uno solo y el resultado es único.
5. **Reinicio del worker a mitad** (`kill -9`) y **Postgres no disponible un momento**: el job se retoma sin duplicar.
5b. **Clave propia:** el worker no descifra datos cifrados con `DATA_ENCRYPTION_KEY`; la migración de datos de la clave se prueba hacia delante y hacia atrás.
6. **Presupuesto agotado:** no llama a Claude, conserva el avance y devuelve el estado esperado.
7. **Borrado con worker activo:** nada queda tras el purgado; el worker no escribe después.
8. **Entrada maliciosa:** campos con instrucciones o secretos no cambian la salida ni salen en logs.
9. **Granularidad de logs:** ningún texto de la persona en logs del worker.
10. **Estado en CI:** el job de deriva (`db:drift`) cubre las tablas nuevas; el rol y las funciones se crean con migración y se prueban en el Postgres efímero.

## 11. Paquetes de trabajo y estimación (propuesta, no comprometida)

| Paquete | Responsable | Horas (rango) |
| --- | --- | --- |
| Migraciones de `AiJobs`, `SkillCandidates`, rol y funciones | Dev con Infra | 7–11 |
| Funciones SQL y pruebas de aislamiento y concurrencia | Dev (QA diseña los casos) | 10–14 |
| Proceso worker con sondeo, recuperación, reutilización de `callClaude` y filtros | Dev | 7–11 |
| Clave de cifrado propia: identificador de clave, nueva clave, migración de datos y rotación | Dev | 6–10 |
| Endpoint para crear/consultar/cancelar jobs y revisar candidatas (sin pantalla nueva) | Dev | 4–6 |
| Servicio worker en Railway staging, variables, humo y reversión | Infra | 3–4 |
| Ampliar revocación y borrado (ES-23) | Dev | 4–6 |
| **Total propuesto** | | **41–62** |

Es una estimación mía para discutir, **no comprometida**: el rango real se fija con Dev tras revisar este documento. Sin Redis baja el trabajo del relay y de la infraestructura; la clave propia añade la migración de datos. Lo que más la puede mover es el comportamiento de las funciones `SECURITY DEFINER` en el pooler (§5) y las pruebas de concurrencia.

## 12. Orden de ejecución y dependencias

1. ES-59 fase 2 (migraciones antes de cada despliegue; retirar `sync`) — **requisito**.
2. Revisar la excepción de CHECK pendiente (QA-43-02) y el respaldo de staging.
3. Migraciones y funciones del worker en una base de pruebas; pruebas de aislamiento en CI.
4. Servicio worker en staging (con aprobación de Mauricio; sin Redis).
5. Piloto sintético; producción solo con ES-11.

## 13. Decisiones que se piden

**Resueltas por Mauricio (28-oct-2026)**
1. Sin Redis en esta versión: el worker sondea Postgres. ✔
2. Diseño con funciones SQL y la excepción de las dos tablas de presupuesto. ✔
3. Clave de cifrado propia para el dominio profesional. ✔

**Pendientes**
4. Mauricio: aprobar el costo (§9) y la creación del servicio worker en staging, con los requisitos de §15.
5. Alejo: ¿el análisis se lanza por acción de la persona o automáticamente al confirmar el contexto? (§7)
6. Alejo: topes de presupuesto de IA (V-12), necesarios para fijar los límites del worker.
7. Alejo: confirmar que ES-84 está dentro del alcance del incremento 1 y que prescindir de Redis en esta versión no contradice V-10 (la arquitectura con Redis queda como evolución).

## 14. Lo que este spike NO verificó

- Funcionamiento de roles propios, funciones `SECURITY DEFINER` y bloqueos en el **pooler real de Supabase**.
- Consumo real de memoria y CPU del worker (el costo es una estimación).
- Calidad de las candidatas con Claude real y ataques de inyección reales.
- Que la API REST pública de Supabase esté desactivada o con RLS.
- Qué muestra el prototipo de Figma sobre este flujo (no se pudo abrir sin registro). Por lo acordado el worker no tiene pantalla propia.

## 15. Qué necesita Infra para crear el servicio en staging

Nada de esto se hace hasta que Dev entregue el código del worker y las migraciones estén aplicadas (ES-59 fase 2). Es la lista para que Mauricio la tenga lista:

1. **Aprobación del costo** de §9 (≈ USD 1,7 al mes en staging, no medido).
2. **Límite de gasto de uso** en el proyecto de Railway confirmado, con el valor que decida Mauricio.
3. **Respaldo o punto de restauración de la base de staging** antes de aplicar las migraciones, y la confirmación de Mauricio (como en toda migración de staging).
4. **Rol `elevation_worker` en Supabase:** lo crea una migración sin contraseña; **Mauricio** le pone la contraseña directamente en Supabase y arma la URL `WORKER_DATABASE_URL` (por el pooler compartido). Infra no ve esos valores.
5. **Variables del servicio `worker` (solo nombres; los valores los carga Mauricio):** `WORKER_DATABASE_URL`, `ANTHROPIC_API_KEY`, `PROFESSIONAL_ENCRYPTION_KEY` (clave nueva, distinta de `DATA_ENCRYPTION_KEY`), `AI_BUDGET_TOKENS_PER_USER`, `AI_BUDGET_TOKENS_COHORT`, `AI_BUDGET_PERIOD`, `AI_CALL_TIMEOUT_MS`, `AI_MAX_RETRIES`, y las propias del worker: `WORKER_POLL_MS`, `WORKER_LEASE_SECONDS`, `WORKER_MAX_ATTEMPTS`. El worker **no** recibe `DATABASE_URL` del API, `JWT_SECRET` ni `DATA_ENCRYPTION_KEY`.
6. **Topes de presupuesto de IA** (V-12): al menos provisionales, como en staging hoy.
7. **La clave profesional nueva respaldada** por Mauricio fuera del repositorio; perderla deja ilegibles los contextos cifrados con ella.
8. **Verificar en Supabase** (Mauricio o quien tenga acceso): rol propio y funciones `SECURITY DEFINER` por el pooler, y que la API REST pública esté desactivada o con RLS.
9. **Una prueba de humo** acordada con QA y una forma de volver atrás: borrar el servicio `worker` y, si hace falta, revertir las migraciones del worker en staging (con `down` protegido).
