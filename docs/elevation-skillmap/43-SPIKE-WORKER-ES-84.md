# ES-84 · Spike de diseño del worker de análisis de IA (PROPUESTA para aprobación)

28-oct-2026 · Autor: Infra-Claude · Decide lo técnico: Mauricio · Decide el alcance: Alejo.
Este documento **no crea servicios ni código**: propone el diseño para estimar y para que Mauricio apruebe costo y permisos. Todo lo que no se pudo verificar está marcado «no verificado».

## 1. Qué se decidió ya y qué no

| Tema | Estado | Fuente |
| --- | --- | --- |
| Postgres + worker + Redis en el incremento 1; Postgres durable, Redis solo IDs | Aprobado por Alejo | V-10 (doc 08) |
| Credencial propia del worker; lee solo contexto profesional autorizado; publica con consentimiento comprobado en la transacción | Aprobado por Alejo | V-11, ADR-002/003 (docs 08 y 10) |
| El worker es un proceso, no una pantalla; entra en el incremento 1 | Confirmado por Mauricio, 28-oct | ES-84 |
| Costo de Railway del worker y de Redis, permisos SQL, estimación | **Pendiente** | este documento |
| Topes de presupuesto de IA por persona | Pendiente (V-12) | doc 08 |

## 2. Qué hace el worker, con lo que ya existe

Entrada: la **versión activa del contexto profesional** (`CareerContextVersions`, ES-25): campos de lista cerrada que la persona aprobó, cifrados v2. Se lee hoy solo con `getApprovedContext(userId, consumer)`, que exige consentimiento vigente y deja rastro en `BridgeTransfers`.

Salida: **candidatas a competencia** (habilidad del catálogo vigente, nivel propuesto o `null`, citas a las claves de campo que la respaldan) en estado revisable. La persona las confirma, corrige o rechaza; al confirmar se usa el camino que ya existe (`/api/skill-map/proposals/confirm`, ES-28/29), que solo permite bajar el nivel. Aceptar no certifica competencia.

Reutiliza, sin duplicar: `callClaude` (presupuesto, timeout y registro, ES-22), `fenceUntrusted` y los filtros de salida (ES-21, ES-28), el catálogo y la confianza calculada por reglas (ES-29). El modelo no declara confianza.

**Lo que ya hace ES-28 sin worker:** propuestas síncronas, a petición, sobre evidencias confirmadas, con token firmado de 10 minutos y sin guardar nada. El worker no las reemplaza: añade el análisis **durable y asíncrono** sobre el contexto autorizado, con resultado guardado y revocable.

## 3. Topología propuesta

```
 API (Express)  ──(misma transacción)──►  Postgres: AiJobs + AiJobOutbox
      │                                        ▲        │
      │                                        │        ▼
      │                         relay ──► Redis (solo IDs) ──► worker ──► Claude
      │                                        │                 │
      └────────── lectura de estado ───────────┘      funciones SQL controladas
```

- **Servicio nuevo `worker`** en Railway, **misma imagen y repositorio**, comando de arranque distinto (`node backend/worker.js`). Sin dominio público ni puerto. Variables propias; secretos los carga Mauricio.
- **Redis** como servicio de Railway en la red privada (`*.railway.internal`), con clave, sin proxy TCP público, sin persistencia obligatoria (se reconstruye desde Postgres), con `maxmemory` pequeño.
- **Relay** (un bucle dentro del proceso worker, o del API; propuesta: dentro del worker): lee `AiJobOutbox` sin enviar y empuja el ID del job a Redis.
- **Entornos:** staging primero. Producción solo después de aprobar costo y de ES-11. Los entornos de PR **no** llevan worker ni Redis.
- **Conexiones a Supabase:** el worker usa su propia URL (`WORKER_DATABASE_URL`) y un pool de 2. Con el pool de 5 del API caben de sobra en el límite de 60 conexiones de staging.

### Objeción razonada (para decidir, no bloquea)

Redis solo sirve aquí para **despertar** al worker; la verdad está en Postgres. Para un piloto de seis personas, un sondeo a Postgres con `FOR UPDATE SKIP LOCKED` cada pocos segundos cumpliría lo mismo con una pieza menos que operar, pagar y asegurar. Alejo eligió Redis (V-10) y este diseño lo respeta. Si Mauricio quiere revisarlo, el diseño sirve igual: el worker tomaría los jobs directamente de la función de reclamo (§5) y el relay desaparecería. Costo de revisarlo: una decisión; ahorro: un servicio y su superficie de ataque.

## 4. Datos nuevos (migraciones versionadas, nunca `sync`; depende de ES-59 fase 2)

Tablas nuevas, sin contenido privado ni texto de la persona:

- **`AiJobs`**: `id`, `UserId`, `kind` (`competency_extraction`), `contextVersion` (versión de `CareerContextVersions`), `contextHash`, `requestId` (único por persona: idempotencia), `status`, `attempt`, `leaseOwner`, `leaseExpiresAt`, `fence` (entero que solo crece), `errorCode`, fechas. **No guarda prompts ni respuestas.**
- **`AiJobOutbox`**: `jobId`, `createdAt`, `sentAt`. Se inserta en la misma transacción que el job.
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
- **Clave de cifrado:** para descifrar `CareerContextVersions.payload` el worker necesita `DATA_ENCRYPTION_KEY`, que hoy es la misma de los chats y el diario. La barrera real es el permiso SQL, no la clave. Defensa adicional recomendada: una clave aparte para el dominio profesional (implica cifrar de nuevo el contexto existente). Decisión de Mauricio.
- **API de datos de Supabase (no verificado):** hay que confirmar en el panel que la API REST pública está desactivada o que las tablas tienen RLS. Es un riesgo previo e independiente del worker.

## 6. Estados y transiciones

`PENDING` → `RUNNING` (reclamo) → `REVIEW_REQUIRED` (publicó candidatas) → `COMPLETED` (la persona resolvió todas).
`RUNNING` → `PENDING` (lease vencido, `attempt`+1) → `FAILED` al superar el máximo de intentos (propuesta: 3).
`PENDING` o `RUNNING` o `REVIEW_REQUIRED` → `CANCELLED` (la persona cancela) o `INVALIDATED` (revocación o borrado).
No hay otras transiciones; las ilegales fallan en la función y se prueban una por una.

## 7. Entrega y recuperación

- **Outbox → Redis:** entrega **al menos una vez**. La idempotencia no la da la cola sino las restricciones: `requestId` único, `(jobId, skillKey)` único y `fence`.
- **Reconciliación:** un barrido periódico (propuesta: cada 30 s) reenvía los `PENDING` sin `sentAt` o antiguos, y devuelve a `PENDING` los `RUNNING` con lease vencido. Si Redis cae, los jobs esperan en Postgres y se retoman al volver.
- **Presupuesto (V-13):** si se agota el límite de la persona o de la cohorte, el job queda `PENDING` con aviso, sin llamar a Claude y sin perder el último mapa válido. Los topes los define Alejo (V-12); no se inventan aquí.
- **Timeouts y reintentos acotados** de la llamada a Claude como en `callClaude`; el lease debe superar con margen el timeout.
- **Cuándo se crea un job (propuesta):** por **acción explícita de la persona** («Analizar mi contexto») y no automáticamente al confirmar el contexto: controla el gasto y deja claro qué se analiza. Decisión de Alejo.

## 8. Borrado, exportación y auditoría

- El borrado (ES-23) debe **drenar el worker** como productor: detener nuevos reclamos, esperar o invalidar los `RUNNING`, borrar jobs, outbox y candidatas de esa persona, y recién entonces purgar. El doc 18 ya prevé «web, workers e integraciones».
- La exportación incluye los jobs y candidatas de la persona.
- Auditoría: cada reclamo registra en `BridgeTransfers` las claves entregadas y su hash, sin texto, como cualquier otro consumidor (`consumer = 'worker'`).

## 9. Costos

Precios de Railway leídos en https://railway.com/pricing el 28-oct-2026 (a reconfirmar): memoria USD 0,00000386 por GB-segundo; CPU USD 0,00000772 por vCPU-segundo; volúmenes USD 0,00000006 por GB-segundo; salida de red USD 0,05 por GB. Plan Pro: USD 20 mínimos con USD 20 de uso incluido.

Con 30 días (2,59 millones de segundos): **1 GB de memoria constante ≈ USD 10 al mes** y **1 vCPU constante ≈ USD 20 al mes**. Railway cobra por uso real.

Estimación de orden de magnitud (**no medida**; hay que medir en staging):

| Pieza | Supuesto de uso medio | Costo mensual aproximado por entorno |
| --- | --- | --- |
| Worker en reposo | ~0,15 GB y ~0,01 vCPU | ≈ USD 1,7 |
| Redis pequeño | ~0,1 GB y ~0,01 vCPU, sin volumen | ≈ USD 1,2 |
| Total por entorno | | ≈ USD 3 |
| Staging + producción | | ≈ USD 6 |

Dentro de los USD 20 de uso incluido del plan Pro, que ya comparte el API. El costo dominante no es la infraestructura sino el **consumo de Claude**, pendiente de V-12. Con Supabase no hay costo extra por el rol ni las funciones.

## 10. Plan de pruebas (QA, con Postgres real)

1. **Aislamiento:** con `elevation_worker`, `SELECT` sobre `ChatTurns`, `DiaryEntries`, `Consents`, `CareerContextVersions` y `Users` falla; solo las cuatro funciones responden.
2. **Revocación concurrente, ambos órdenes**, con dos conexiones reales y pausa antes del commit: nunca queda una candidata publicada tras una revocación.
3. **Fencing:** un intento con lease vencido no publica; dos workers sobre el mismo job producen un solo resultado.
4. **Entrega duplicada del relay:** un solo job y un solo conjunto de candidatas.
5. **Redis caído y recuperado**, y **reinicio del worker a mitad** (`kill -9`): el job se retoma sin duplicar.
6. **Presupuesto agotado:** no llama a Claude, conserva el avance y devuelve el estado esperado.
7. **Borrado con worker activo:** nada queda tras el purgado; el worker no escribe después.
8. **Entrada maliciosa:** campos con instrucciones o secretos no cambian la salida ni salen en logs.
9. **Granularidad de logs:** ningún texto de la persona en logs del worker.
10. **Estado en CI:** el job de deriva (`db:drift`) cubre las tablas nuevas; el rol y las funciones se crean con migración y se prueban en el Postgres efímero.

## 11. Paquetes de trabajo y estimación (propuesta, no comprometida)

| Paquete | Responsable | Horas (rango) |
| --- | --- | --- |
| Migraciones de `AiJobs`, `AiJobOutbox`, `SkillCandidates`, rol y funciones | Dev con Infra | 8–12 |
| Funciones SQL y pruebas de aislamiento y concurrencia | Dev (QA diseña los casos) | 10–14 |
| Proceso worker, relay, reconciliación, reutilización de `callClaude` y filtros | Dev | 10–16 |
| Endpoint para crear/consultar/cancelar jobs y revisar candidatas (sin pantalla nueva) | Dev | 4–6 |
| Servicio worker y Redis en Railway staging, variables, humo y reversión | Infra | 4–6 |
| Ampliar revocación y borrado (ES-23) | Dev | 4–6 |
| **Total propuesto** | | **40–60** |

Es una estimación mía para discutir: el rango real se fija con Dev tras revisar este documento. Lo que más la puede mover es el comportamiento de las funciones `SECURITY DEFINER` en el pooler (§5) y las pruebas de concurrencia.

## 12. Orden de ejecución y dependencias

1. ES-59 fase 2 (migraciones antes de cada despliegue; retirar `sync`) — **requisito**.
2. Revisar la excepción de CHECK pendiente (QA-43-02) y el respaldo de staging.
3. Migraciones y funciones del worker en una base de pruebas; pruebas de aislamiento en CI.
4. Servicio worker y Redis en staging (con aprobación de Mauricio).
5. Piloto sintético; producción solo con ES-11.

## 13. Decisiones que se piden

**A Mauricio**
1. ¿Mantener Redis (V-10) o sondear Postgres? (§3)
2. ¿Aprobar el worker **solo con funciones SQL** y la excepción de las dos tablas de presupuesto? (§5)
3. ¿Clave de cifrado propia para el dominio profesional? (§5)
4. Aprobar el costo estimado y la creación de los servicios en staging. (§9)

**A Alejo**
5. ¿El análisis se lanza por acción de la persona o automáticamente al confirmar el contexto? (§7)
6. Topes de presupuesto de IA (V-12), necesarios para fijar límites del worker.
7. Confirmar que ES-84 está dentro del alcance del incremento 1 para el registro de decisiones del PRD.

## 14. Lo que este spike NO verificó

- Funcionamiento de roles propios, funciones `SECURITY DEFINER` y bloqueos en el **pooler real de Supabase**.
- Consumo real de memoria y CPU del worker y de Redis (los costos son una estimación).
- Calidad de las candidatas con Claude real y ataques de inyección reales.
- Que la API REST pública de Supabase esté desactivada o con RLS.
- Qué muestra el prototipo de Figma sobre este flujo (no se pudo abrir sin registro). Por lo acordado el worker no tiene pantalla propia.
