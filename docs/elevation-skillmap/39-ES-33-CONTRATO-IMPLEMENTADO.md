# ES-33 · Contrato implementado del tramo preparatorio

28-oct-2026 · [Dev-Codex]. Plan 38 publicado en Jira 10260; aprobación explícita «Aprobar el plan con las dependencias indicadas» y aceptación de las recomendaciones sobre contratos ausentes, registradas en 10261.

**No cierra ES-33 integrada.** Backend propio implementado y probado contra puertos de ES-14/ES-32 simulados en tests. ES-14/ES-32 siguen fuera de main `6dc61e9` al verificar. El lector canónico de disponibilidad/zona y el acceso/retención de revisión humana aún no están acordados con Mauricio. No se copian modelos ni se fusionan PR ajenos. Sin cambios frontend; ES-34 conserva su diseño y la consola ES-35 su autorización separada.

## Contratos de entrada y bloqueo efectivo

`utils/careerPlanContracts.js` es el único puerto de planificación:

- `getRoute(userId, choiceId)` usa `utils/routes.getAcceptedChoice` y `getRoutes` de **ES-32, ya en `main`** (verificado contra Postgres real en `es-33-integration-postgres.cjs`). Si el módulo faltara → 503 `route_contract_pending`. No crea un motor alternativo ni permite elegir el dueño. Una elección ajena responde 404; una elección cuya base cambió, 409.
- `getContext(userId)` lee el **contexto canónico de ES-14 (`ParticipantContext`, ya en `main`)** y devuelve `{version, weeklyMinutes, timeZone, locale}` solo de la persona que pide. Reglas aprobadas por Mauricio (28-oct-2026): (1) **solo cuenta un contexto completado** (la persona pulsó «continuar»); un borrador no se usa; (2) **disponibilidad o zona horaria desconocidas** (`null` en ES-14) no se inventan ni se convierten en cero: 409 `availability_unknown` / `timezone_unknown` con mensaje ES/EN que lleva a Mi contexto; sin contexto o sin completar, 409 `context_incomplete`; (3) cuenta inactiva o con otro rol → 403 `owner_required`; con solicitud de eliminación → 403 `deletion_pending`; (4) la **versión del contexto** entra en la huella: editarlo deja los experimentos en `needs_review`, sin reescribir lo guardado. No lee una preferencia alternativa. El snapshot guardado en planes explica una aceptación histórica; no es otra fuente canónica.
- Revisión humana: **no hay endpoint de feedback por terceros** ni rol inventado. Las solicitudes propias quedan `pending_authorization`, `shared:false`; no se concede acceso ni se envían materiales. El contrato de ES-35 debe definir asignación, selección de versiones, facilitator_sharing, autor/fecha de servidor, retirada y retención/exportación del feedback de terceros.

Los fixtures viven exclusivamente en `backend/test/`. No hay modo demo, flag de entorno, payload o bypass de runtime que los habilite. Si un contrato real falla cerrado (por ejemplo 404 por una elección inexistente, o 409 por un contexto incompleto) una propuesta no se crea; el dueño todavía recupera su historia con `basis.status=needs_review` y puede pausar/retirar. No se publica un resultado simulado como real.

## API y propiedad

Montajes `/api/experiments` y `/api/career-plan` con verificarToken. El router y cada escritura verifican User actual activo/rol user y deletionPending; el principal siempre viene del servidor. Sin bypass admin/therapist/board/superadmin. Cuerpo/query cerrados, JSON con límites, 404 uniforme para IDs ajenos/inexistentes, respuestas del router no-store. Los rechazos anteriores del JWT conservan su contrato existente (sin sesión 403; inválido/revocado/eliminación pendiente 401).

| Método / recurso | Cuerpo o consulta |
| --- | --- |
| POST `/api/experiments/proposals` | `{choiceId, taskIndex, minutes}`; 20/30/45 minutos |
| POST `/api/experiments` | `{requestId, proposal, token}`; confirma propuesta exacta propia vigente |
| GET `/api/experiments?after=0` | Lista propia, 100 máximo y nextAfter |
| GET `/api/experiments/:id?after=0` | Versión actual e historial paginado; fundamento y solicitudes propias |
| POST `/api/experiments/:id/versions` | `{requestId, expectedVersion, change}` |
| GET `/api/experiments/:id/review-requests?after=0` | Historial propio paginado de solicitudes/retiradas |
| POST `/api/experiments/:id/review-requests` | Solicitar/retirar; datos exactos abajo |
| POST `/api/career-plan/proposals` | `{experimentId, expectedVersion, budget?}` |
| POST `/api/career-plan/versions` | Aceptar/avanzar/pausar; datos exactos abajo |
| GET `/api/career-plan?after=0` | Historial propio de planes y su base efectiva |
| GET `/api/career-plan/versions/:id` | Versión propia concreta |
| GET `/api/career-plan/reminders?after=0` | Solo activos vencidos con consentimiento y plan vigentes; GET no consume |
| GET `/api/career-plan/reminders?history=true&after=0` | Historia propia, sin exigir renovar consentimiento |
| POST `/api/career-plan/reminders` | Aceptar/cancelar/acusar recibo explícitamente |

requestId: 8–64 ASCII letras/números/guiones, UUID aceptado. Repetir el cuerpo exacto recupera el resultado persistido, incluso para reconciliar una respuesta perdida. Mismo ID con cuerpo distinto o versión antigua → 409; no se reejecuta una mutación por perder la respuesta. Una repetición puede devolver una fila histórica ya superseded: el consumidor debe recuperar el estado actual, no anunciar que se reactivó.

### Experimento

Propuesta sin persistencia: plantilla neutral ES/EN del plan aprobado, tarea del catálogo y costo unknown. Rúbrica `not_domain_validated`, sin puntos/porcentajes, escala profesional o certificación. Regulado → 422 `needs_safe_template` hasta disponer de plantilla especializada. No se inventa una práctica regulada. Sin proveedor LLM ni acceso a URLs.

Cambios permitidos:

```text
{action: start}
{action: submit, sample?: texto≤6000, evidenceRefs?: [{evidenceId,version}], assistance}
{action: reflect, observation: texto≤2000, interpretation: texto≤2000}
{action: decide, decision: continue|adjust|pause|discard, reason: texto≤2000}
{action: rebase}
```

Submit exige sample o referencias profesionales propias/vigentes, y asistencia explícita `none|planning|drafting|substantial|unknown`, siempre `self_report`. No hay archivos/parser ni selección de turnos. Una entrega directa no crea Evidence automáticamente. Reenviar entrega retira reflexión/decisión anteriores de la versión actual; el historial se conserva. Reflejar exige submitted; decidir exige self_reviewed. No existe acción human_review. Ninguna acción escribe SkillAssessment ni acredita competencia por checkbox.

Rebase explícito revalida ruta/contexto y crea una nueva versión ready; no lleva una entrega o decisión antigua como resultado actual. Su propósito es reconfirmar un fundamento cambiado, nunca aprobar por defecto una propuesta obsoleta.

Solicitar revisión: `{requestId, expectedVersion, action:request, submissionVersion, evidenceRefs:[], includeSample:boolean}`. Selección dentro de esa entrega, sin datos de otra persona; se guarda solo la intención, con shared:false. Retirar: `{requestId, expectedVersion, action:withdraw, reviewId}`. La retirada no requiere nuevo consentimiento. Un cambio de entrega señala needsReview en solicitudes antiguas; las pistas propias y humanas permanecen separadas.

### Plan

Propuesta determinista: tres posibles acciones 7/30/90 para reflexionar, practicar/ajustar y revisar la decisión, con propósito ES/EN, dependencias, evidencia esperada y recursos de brechas. Fechas null, accepted:false y status:proposed hasta aceptar. Decisiones pause/discard no generan un plan activo. Recursos conservan fuente, precio publicado/por confirmar, idioma, duración, propósito y ejercicio del catálogo; no se inventan cursos ni costos.

Aceptar:

```text
{requestId, action:accept, expectedVersion:0|versión_actual,
 proposal, token, selections:[{actionKey,chosenDate,estimatedMinutes,resourceRefs:[],declaredCost?}]}
```

Fechas ISO reales elegidas por el dueño, sin pasado ni dependencias posteriores/cíclicas/omitidas. La acción inicial de siete días conserva 20–45 minutos; las posteriores pueden durar más según disponibilidad (hasta el máximo semanal permitido). La suma por semana incluye todos los planes propios aceptados, incluso pendientes de revisión hasta pausarlos, y excluye acciones completadas. Los recursos están incluidos en los minutos declarados; no se suman de nuevo, y su duración conocida debe caber. Elegir un curso no acredita capacidad.

Budget opcional `{amount,currency}`: costos de acción declarados por la persona con el mismo formato y origen self_report, incluyendo sus recursos. Precio desconocido, moneda distinta, duración desconocida o costo insuficiente requieren confirmación; no se asume cero ni se convierte moneda. Costo declarado por encima del presupuesto bloquea aceptación. Sin presupuesto los costos desconocidos permanecen explícitos, sin afirmar viabilidad económica verificada.

Avanzar: `{requestId, action:complete, expectedVersion, planId, actionKey, completionEvidence: texto}`; exige dependencias completas y fundamento vigente. Guarda evidencia de finalización declarada, sin subir el mapa. Pausar: `{requestId,action:pause,expectedVersion,planId}`; permitido aunque la base necesite revisión o falte el contrato de contexto. Cada cambio crea otra versión; la previa pasa a superseded y sus recordatorios no se reactivan.

### Recordatorios dentro de la aplicación

Aceptar: `{requestId,action:accept,planVersionId,actionKey,localDateTime:"YYYY-MM-DDTHH:mm",timeZone,accepted:true}`. Fecha de la acción elegida, zona igual al snapshot canónico, instante futuro. IANA vigente, sin asumir zona del país/host; horas locales ambiguas/inexistentes por DST se rechazan. La aceptación requiere notifications vigente por withConsent y se vincula al evento de otorgamiento, no solo a la versión de política: revocar y volver a otorgar **no** resucita una aceptación antigua.

Acuse: `{requestId,action:acknowledge,reminderId}`; exige que haya vencido, permiso y base actuales; marca delivered mediante un evento propio idempotente. Cancelar: `{requestId,action:cancel,reminderId}`; no exige renovar permiso. Sin aceptación/permiso/base no hay entrega activa. GET no marca delivered; no hay email/push/cron/worker, envío externo, notificación al especialista ni garantía de ejecución en segundo plano.

## Datos, invalidación y seguridad

Cinco modelos propios: CareerExperiment, CareerExperimentVersion, CareerPlanVersion, CareerExperimentReview (solo solicitudes), CareerReminder. Contenido profesional, snapshots y eventos cifrados v2; referencias/versiones y metadatos mínimos fuera. FK a Users, cuatro FK compuestas de dueño+recurso que impiden insertar hijos de otro dueño y once índices únicos nombrados. Elección de ruta se verifica mediante el contrato; no se crea una FK a una tabla de un PR aún ausente.

Migración aditiva/repetible `20261028-es33-career-plan.cjs`, probada dos veces antes de sync de los modelos. Infraestructura ejecuta `npm run migrate:career-plan` en el entorno aprobado antes de habilitar; **no se ejecutó en staging/producción**. Rollback de aplicación conserva tablas y su cobertura de derechos; no down destructivo.

CORE: exportación descifrada de cinco recursos e historial, sin hashes/requestIds/tokens técnicos; los hashes se guardan en columna, no se duplican en payload exportado. Purga de recordatorios → planes → solicitudes → versiones → contenedores para respetar FK; núcleo de derechos/procesador/consentimientos sin rediseño. Fallo SQL revierte todo; reintento/replay conserva B. No existe aún feedback de terceros que requiera inventar su retención.

Escrituras con User lock, cuenta actual, expectedVersion e idempotencia; huella HMAC ligada a dueño, elección, contexto, pertenencia/versiones de evidencia y plantilla/rúbrica. Nueva evidencia, retirada/cambio de evidencia, cambios de elección/contexto/catálogo o versión del experimento devuelven needs_review, razón y versiones anteriores. Sin consumo global de invalidaciones de otros motores ni reescritura silenciosa.

Recordatorios: se mantiene el bloqueo de consentimiento **hasta confirmar la escritura** usando withConsent existente; cancelación y recuperación histórica son propias. El gateway no se modifica. La composición de ruta/contexto/evidencia usa helpers separados: no se promete snapshot global atómico; los consumidores deben comprobar de nuevo al publicar. La integración real de esos puertos queda pendiente.

No se consultan conversaciones, diario, ánimo o crisis ni se copian al motor; no se contacta a empleadores o revisores; no se cambia stack, proveedor, configuración de ESLint o dependencias. Errores genéricos sin SQL, payloads ni tokens en logs. Todos los mensajes nuevos ES/EN. No se presenta una reflexión propia como feedback profesional.

## Pendientes que impiden cerrar ES-33 integrada

1. ~~ES-32 fusionado y verificación contra ese backend real~~: **hecho** (PR #43 en `main`; `es-33-integration-postgres.cjs`).
2. ~~ES-14 integrado y lector de contexto~~: **hecho** con las reglas de arriba (contexto completado; 409 si falta disponibilidad o zona).
3. Contrato canónico de asignación, compartición, autorización y retención de feedback humano. No reemplazarlo con un chequeo de rol.
4. Rúbricas/plantillas específicas de dominio, revisión especializada y pertinencia con catálogo real/seis personas; fixtures no son aceptación del piloto.
5. Pantalla ES-34 y consola ES-35 con sus diseños aprobados, integración E2E real y despliegue verificado por infraestructura.

Pruebas reproducibles y resultados: `40-ES-33-VERIFICACION.md`.
