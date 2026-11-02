# ES-88 · Revocación, borrado y exportación con los jobs y candidatas del worker (PROPUESTA para revisión de QA)

28-oct-2026 · Autor: Dev-Worker-Claude · Decide lo técnico: Mauricio. Subtarea D de ES-84 (spike `43-SPIKE-WORKER-ES-84.md`, §5 y §8). Depende de ES-85 (tablas y funciones) y ES-87 (worker). Todo lo que no se pudo verificar está marcado «no verificado».

## Qué cambia
| Dónde | Cambio |
| --- | --- |
| `utils/aiJobs.js` (nuevo) | `invalidateForUser(userId, motivo, transaction)`: jobs vivos (`PENDING`, `RUNNING`, `REVIEW_REQUIRED`) → `INVALIDATED` (con `errorCode` = motivo y lease liberado) y candidatas vigentes (`REVIEW_REQUIRED`, `ACCEPTED`) → `INVALIDATED`. Los jobs terminados y las candidatas rechazadas no se tocan. |
| `utils/consent.js › setConsent` | Al **revocar `professional_bridge`**, junto a los ganchos de ES-25 y ES-27 y en la misma transacción: `invalidateForUser(..., 'consent_revoked')`. Si la invalidación falla, la revocación entera se deshace. |
| `utils/careerContext.js › revoke` | Al revocar voluntariamente la versión de contexto activa: `'context_revoked'`, en la misma transacción. |
| `utils/dataRights.js › requestDeletion` | Al aceptar una solicitud de borrado: `'deletion_requested'`, en la misma transacción. El worker deja de producir para esa persona desde ese momento. |
| `utils/personalData.js` (registro cerrado de ES-23) | Dos entradas nuevas: `skillCandidates` y `aiJobs` (candidatas antes que jobs por su clave foránea). La **exportación** las incluye (también las invalidadas: es historial de la persona) y la **purga** las borra. |

## Exportación: qué sale y qué no
- `aiJobs`: `id`, `kind`, `contextVersion`, `status`, `attempt`, `catalogVersion`, `errorCode`, `startedAt`, `finishedAt`, `createdAt`.
- `skillCandidates`: `id`, `jobId`, `skillKey`, `level`, `citations` (claves de campo, sin texto), `status`, `catalogVersion`, `createdAt`.
- No salen: `contextHash`, `requestId`, `leaseOwner`, `fence`, `notBefore`, `leaseExpiresAt` (estado técnico interno) ni el texto del contexto (eso ya sale en `careerContext`).

## Cómo se drena el worker (productor) en el borrado
1. **Al aceptar la solicitud**, `requestDeletion` revoca los consentimientos (ES-23) e invalida jobs y candidatas. Desde ahí: `worker_claim` no entrega nada de esa persona (jobs nuevos incluidos, por la solicitud pendiente); `worker_heartbeat` responde `false` (el worker abandona); `worker_publish` y `worker_fail` no escriben (`fenced`).
2. **La purga** (`processDeletion`) borra candidatas y luego jobs. Después de la purga el job ni existe: `worker_publish`/`worker_fail` responden `job_not_found` sin escribir y el heartbeat `false`.
3. **Una publicación en curso no puede colarse**: sus candidatas se insertan con clave foránea a `Users` (KEY SHARE) y tanto `requestDeletion` como `processDeletion` toman esa fila `FOR UPDATE` al empezar, así que esperan a que confirme y entonces ven y borran lo publicado (probado).

## Orden de bloqueos (sin interbloqueos)
Consentimiento → jobs → candidatas, el mismo de `worker_publish`. En `invalidateForUser` los **jobs se actualizan antes** que las candidatas: si hay una publicación en curso, esa actualización espera a que confirme y la siguiente sentencia (READ COMMITTED toma la instantánea por sentencia) ya ve las candidatas recién publicadas. El reclamo del worker no espera al consentimiento (`SKIP LOCKED`, ES-85).

## Pruebas
`npm run test:worker-rights:pg` (Postgres real, migraciones reales con sus disparadores, código real de consentimiento, contexto, derechos de datos y borrado; el worker es una conexión real con el rol restringido): revocación del puente (alcance por persona, idempotencia, no se resucita al volver a consentir), **atomicidad** (si falla la invalidación, la revocación se deshace), **orden 1** (revocación retenida y publicación que espera) y **orden 2** (publicación primero y revocación que espera) con el gancho real, revocación voluntaria del contexto con una publicación en curso, exportación (campos, ajenos, vista previa y descarga), borrado con el worker activo (antes y después de la purga, `replay` incluido), solicitud y purga que esperan una publicación en curso, y un **guardián del registro cerrado**: toda tabla con `UserId` debe estar en el registro de ES-23 o en una lista corta de excepciones revisadas (ledgers de borrado y exportación, sesiones, y datos clínicos/de terapeutas que ya bloquean por `requiresReview`).

## No verificado
- Supabase real y su pooler (ver #60); las pruebas usan Postgres local.
- Las **candidatas `ACCEPTED`** se invalidan al revocar. Qué significa «aceptar» (si crea una evaluación del Skill Map en ES-29) lo define ES-89; si crea filas derivadas fuera de estas tablas, su invalidación debe revisarse allí (hoy `revokeForConsent` de evidencia y mapa ya cubre lo que se apoya en el chat).
- Solicitudes de borrado aceptadas **antes** de desplegar ES-88: sus jobs no se invalidaron al aceptarse, pero el reclamo y la publicación ya las rechazan (ES-85) y la purga borra las filas igualmente.
- Cobertura de la tabla de excepciones del guardián frente a tablas que añadan otras sesiones: la prueba fallará con el nombre de la tabla y obligará a decidirlo.
