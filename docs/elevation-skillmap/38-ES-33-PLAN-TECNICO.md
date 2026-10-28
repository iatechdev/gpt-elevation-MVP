# ES-33 · Experimento, revisión y plan persistentes — propuesta para aprobación

28-oct-2026 · [Dev-Codex]. Fase 1, **sin implementación**. Alejo autorizó tomar ES-33 en el chat. Base: main `6dc61e9`; carpeta aislada, rama `ES-33-experimento-plan`. Jira ES-33, SP2-HU23, RF-09/RF-10. Fuentes: PRD §5 RF-09/10/11/12/16/17 y §6; HUs §SP2-HU23. No existen comentarios previos ni contrato aprobado de esta historia en Jira al revisarla.

## 1. Alcance y base verificada

Un backend recuperable para pasar de una ruta aceptada a una prueba pequeña, registrar lo ocurrido, decidir y construir un plan 7/30/90. **ES-34 construye la pantalla** de comparar rutas, experimentar y consultar el plan; **ES-35 la consola de revisión humana**. ES-33 no modifica pantallas, estilos ni navegación. No necesita maqueta visual nueva; sí aprobación explícita de este plan técnico conforme a AGENTS.md. Los mensajes de API se entregan en ES/EN y la interfaz posterior consume códigos estables.

Reutilización:

- ES-27 en main: `getConfirmedEvidence` para referencias propias vigentes y procedencia. No acceder a chat/diario/ánimo/crisis para completar un experimento.
- ES-29 en main: Skill Map, rúbricas de capacidades y pistas separadas. Entregar una tarea **no escribe una evaluación ni sube niveles** automáticamente.
- ES-31 en main: catálogo publicado con tareas ES/EN, fuentes, recursos, duración y precio publicado/por confirmar. No contiene plantillas de experimentos con rúbrica específica de dominio.
- ES-32, PR #43: `getAcceptedChoice(userId,id)`, versiones/fundamento y rutas comparables. Sigue abierto en QA, head `b54d364`; todavía no está en main.
- ES-14, PR #32: ParticipantContext con idioma, zona horaria y disponibilidad canónicos; todavía no está en main. Su utilidad actual valida el DTO; no expone un lector interno mínimo para planificación. No crear una segunda fuente de preferencias en ES-33.
- ES-18/19/23: `verificarToken`, cuenta actual, `deletionPending`, `withConsent`, cifrado v2, registro CORE y procesador de exportación/borrado. No rediseñarlos.

No hay contrato de asignación/pertenencia que autorice a una persona revisora a ver o evaluar material de otra, ni servicio de envío/scheduler de recordatorios. El rol admin/therapist/board por sí solo **no** acredita ese acceso.

## 2. Experimento propuesto y límites del contenido

Propongo un generador **determinista, sin llamadas LLM en esta versión**, igual que ES-32. Genera una propuesta cerrada desde una tarea ES/EN del rol elegido y recursos curados vinculados a una brecha. No inventa ejercicios técnicos de dominio, resultados, vacantes, precios ni evidencias. El servidor vuelve a comprobar que la elección es accepted/current y que su fundamento no cambió.

Plantilla de contenido propuesta para aprobación humana:

| Campo | ES | EN |
| --- | --- | --- |
| Título | Muestra breve de una tarea, con datos ficticios | Short task sample using fictitious data |
| Pregunta | ¿Qué puedo aprender al probar esta tarea y explicar mis decisiones? | What can I learn by trying this task and explaining my decisions? |
| Tarea inicial | Elige una tarea de la ficha. Prepara un ejemplo pequeño con datos ficticios y anota qué hiciste, qué verificaste y qué ayuda utilizaste. | Choose a task from the role card. Prepare a small example with fictitious data and record what you did, what you checked, and what help you used. |
| Evidencia esperada | Una muestra breve o una descripción verificable del trabajo y sus límites; no incluyas datos de terceros. | A short sample or a verifiable description of the work and its limits; do not include third-party data. |
| Criterios de reflexión | Describe la decisión tomada; identifica una comprobación; declara la ayuda utilizada y lo que queda por verificar. | Describe the decision made; identify a check; state the assistance used and what remains to be verified. |
| Límite | Este ejercicio no acredita competencia, autonomía ni habilitación profesional. | This exercise does not establish competence, autonomy or professional authorization. |

Estos criterios constituyen una **rúbrica de reflexión**, versionada y marcada `not_domain_validated`, sin escala numérica ni evaluación automática de desempeño. La rúbrica de capacidad de ES-29 puede referenciarse con versión, sin declarar que el ejercicio la demuestra. La aprobación técnica de implementación no se hace pasar por validación especializada; la publicación de la plantilla requiere aprobación explícita de estos textos. Una rúbrica profesional de dominio o una actividad regulada necesita revisión especializada registrada; de lo contrario queda pendiente/no se propone como práctica profesional real.

La tarea inicial se elige entre 20/30/45 minutos. Son presupuestos de esfuerzo propuestos, no tiempos observados ni garantía de completar una actividad externa. Si la disponibilidad confirmada no permite 20 minutos, responder `needs_scope_reduction`; no forzar un plan imposible. Entrevistas externas las organiza la persona; no se reserva, contacta ni postula por ella.

Costo siempre explícito: `unknown` mientras no haya una declaración/fuente; no asumir que una tarea es gratuita. Los recursos conservan precio, moneda, idioma, duración y fuente del catálogo. No confundir precio cero publicado con desconocido. Presupuesto máximo opcional declarado para este plan: ante precio desconocido no se afirma que cabe en el presupuesto; tampoco se inventan tipos de cambio.

Asistencia declarada por entrega: `none|planning|drafting|substantial|unknown`, con origen `self_report`. Describe ayuda usada (incluida IA); no prueba autonomía. No invoca Claude para juzgar desempeño ni escribe en el Skill Map. Una futura propuesta con Claude utilizaría el gateway y presupuesto existentes, con otra aprobación del cambio.

## 3. Flujo y estados del servidor

1. **Proponer:** comprobar elección propia vigente, contexto mínimo canónico, catálogo y versiones; devolver propuesta ES/EN y token firmado propio con caducidad breve, huella de entradas y esquema/rúbrica. No persistir como aceptada.
2. **Aceptar experimento:** confirmación explícita con requestId; revalidar entradas y token en servidor. Crear versión inicial y devolver solo el estado confirmado. Propuesta vencida, modificada o ajena no se confirma.
3. **Avanzar/entregar:** `ready → in_progress → submitted`, nueva versión por cambio con expectedVersion. Entrega vinculada a referencias profesionales propias y vigentes, o texto de muestra escrito directamente aquí; sin subir/descargar archivos ni buscar turnos privados. El texto directo nunca se convierte en Evidence confirmado automáticamente: ES-27 conserva su flujo de revisión/confirmación.
4. **Reflexión propia:** guardar observación e interpretación en campos separados; observación descrita por la persona lleva `self_report`, sin fingir observación independiente. Dudas y límites explícitos. `self_reviewed` no equivale a `human_reviewed`.
5. **Revisión humana:** solicitud explícita con versión exacta de entrega y materiales elegidos; estados `not_requested|pending_authorization|requested|reviewed|withdrawn|needs_review`. Sin asignación/consentimiento válidos no se comparte material ni se permite escribir feedback humano. Al cambiar la entrega, una revisión anterior queda histórica. Actor/fecha se asignan en servidor; el participante no puede falsificar revisor ni autor.
6. **Decidir:** guardar razón escrita y decisión `continue|adjust|pause|discard`, referida al experimento/entrega revisados. Ninguna decisión acredita contratación o competencia.
7. **Proponer y aceptar plan:** generar borrador 7/30/90 desde decisión, disponibilidad y recursos; aceptar acciones y fechas de forma explícita. Conservar versiones, sin hacer pasar el borrador por plan aceptado.
8. **Seguir y revisar:** guardar avance y evidencia de finalización por acción. Un checkbox solo registra avance declarado. Ante cambios se devuelve motivo y versión afectada; la persona decide ajustar/reconfirmar.

Estados ortogonales: lifecycle del experimento, estado de revisión humana, estado de fundamento (`current|needs_review`) y estado del plan (`proposed|accepted|superseded|needs_review|paused`). No usar un único `completed` que mezcle entrega, revisión, competencia y aceptación.

Mensajes mínimos ES/EN: «Falta confirmar tu disponibilidad / Confirm your availability»; «Entrega guardada / Submission saved»; «Pendiente de revisión humana / Awaiting human review»; «Esta versión necesita revisión porque cambió su fundamento / This version needs review because its basis changed»; «Recordatorio activado solo dentro de la aplicación / Reminder enabled only within the application». La pantalla ES-34 presenta el diseño y textos completos antes de implementarlos.

## 4. Plan 7/30/90 y recordatorios

El servidor organiza acciones con `actionKey, horizonDays, purpose{es,en}, estimatedMinutes, dependencies[], completionEvidence, chosenDate, status, resourceRefs[]`. Horizontes 7/30/90 son metas de planificación, no fechas impuestas ni garantías. Primer horizonte: probar/reflexionar; siguiente: repetir o ajustar una brecha; último: revisar evidencia y decisión. No imponer tres cursos ni rellenar con recursos irrelevantes. Si faltan datos/catálogo adecuado, devolver aclaraciones y no publicar un plan ficticio.

Fechas elegidas por la persona, dependencias acíclicas y dentro del mismo plan, minutos enteros y suma acotada a disponibilidad semanal confirmada. Declarar cómo se reparte el esfuerzo, sin contar minutos de tarea y del recurso dos veces. Actividades externas con coordinación pendiente se indican como tales. Disponibilidad cero o insuficiente → reducir alcance/pausar, no sobrecargar.

**Fuente única:** idioma/zona/disponibilidad se leen de ParticipantContext mediante un lector mínimo autorizado por Mauricio. El plan conserva un snapshot cifrado con `contextVersion, weeklyMinutes, timeZone` exclusivamente para explicar qué base se aceptó; no modifica ni sustituye preferencias. Cambiar contexto invalida la planificación afectada, sin reescribir fechas elegidas. Si la fuente no está disponible, usar fixtures del contrato durante desarrollo y devolver `context_contract_pending` en la integración; no valores ficticios en producción.

Propongo **recordatorios dentro de la aplicación** como alcance inicial: persistir fecha/hora local elegida, zona IANA, instante UTC, acción y aceptación explícita. `GET /api/career-plan/reminders` devuelve los pendientes del dueño al abrir la aplicación. Sin email, push, cron, worker, mensajes a terceros ni entrega en segundo plano garantizada. Requiere propósito `notifications` vigente mediante helper existente y aceptación por acción; revocar/cancelar o quedar plan desactualizado impide entregarlos. Exportación/lectura histórica propia no exige volver a otorgar el consentimiento revocado. Horas locales ambiguas/inexistentes por horario estacional se rechazan para que la persona elija un instante inequívoco.

Si se requiere envío fuera de la aplicación, objeción de infraestructura: hace falta contrato de canal/proveedor/cola, reintentos, supresión por revocación y prueba de no envío; no está autorizado inventar esa infraestructura dentro de ES-33.

GET no marca un recordatorio como entregado. POST distingue aceptar/cancelar/acusar recibo; solo un acuse explícito e idempotente marca delivered. Sin aceptación y permiso vigentes no aparece como recordatorio activo; el historial propio conserva sus estados sin exigir renovar el permiso.

## 5. API propuesta para ES-34 y futura revisión ES-35

Prefijos nuevos de recursos personales, siempre verificarToken + cuenta actual/propietario + guard de eliminación. Listas paginadas (100 máximo), no query de UserId ni bypass admin. JSON cerrado y límites por campo/lista; no contenido privado en errores/logs.

| Método y recurso | Finalidad |
| --- | --- |
| POST `/api/experiments/proposals` | choiceId propio, taskKey/índice de tarea, minutos; propuesta basada en catálogo y contexto vigentes |
| POST `/api/experiments` | Confirmar propuesta exacta firmada, requestId |
| GET `/api/experiments` y `/:id` | Recuperar versiones propias y fundamento/estado de revisión |
| POST `/api/experiments/:id/versions` | expectedVersion + requestId, avance/entrega/reflexión/decisión razonada; transición y campos permitidos por estado |
| POST `/api/experiments/:id/review-requests` | Solicitar/retirar revisión de versión y materiales explícitos; no concede acceso a nadie |
| POST `/api/career-plan/proposals` | Proponer 7/30/90 para experimento/decisión propios actuales |
| POST `/api/career-plan/versions` | Confirmar propuesta, acciones y fechas o registrar avance con control de versión y requestId |
| GET `/api/career-plan` y `/versions/:id` | Plan aceptado e historial propio; propuesta separada |
| GET/POST `/api/career-plan/reminders` | Pendientes propios / aceptación-cancelación explícita, ligada a versión/acción |

Review de terceros: interfaz de servicio propuesta, **todavía no autorizada ni existente**, que ES-35 consumirá para leer material seleccionado y publicar feedback. No se monta una ruta de escritura humana bajo `verificarAdmin` o `verificarTerapeuta`. Se habilita solamente después de que Mauricio entregue/apruebe su helper canónico de asignación y acceso.

Errores nuevos estables bilingües: 400 invalid_input; 403 owner_required/consent_required/deletion_pending; 404 resource_not_found (igual para ID ajeno); 409 version_conflict/basis_changed/transition_not_allowed; 422 needs_availability/needs_scope_reduction/invalid_dependencies/ambiguous_local_time; 503 catalog_unavailable/context_contract_pending/reviewer_contract_pending. Repetición exacta de requestId recupera el mismo resultado; mismo ID con cuerpo distinto 409. No repetir una mutación automáticamente ante respuesta perdida.

## 6. Modelo, migraciones y derechos

Propuesta de cinco modelos con nombres definitivos a confirmar al implementar:

| Modelo | Datos y control |
| --- | --- |
| CareerExperiment | UserId, choiceId, currentVersion, deletedAt; contenedor propio |
| CareerExperimentVersion | UserId/experimentId/version, estado, payload cifrado v2 (tarea, pregunta, rúbrica y límites, entrega, ayuda, reflexión/decisión), referencias/versiones profesionales, basisHash, requestId/inputHash |
| CareerPlanVersion | UserId/experimentId/version, estado, payload cifrado v2 (snapshot de disponibilidad, acciones, fechas, avance y evidencias), referencias de versión, basisHash, requestId/inputHash |
| CareerExperimentReview | UserId/experimentId/submissionVersion, solicitud/materiales elegidos/estado; feedback cifrado y actor de servidor solo al existir autorización canónica; historia/versiones de revisión, nunca publicar por suplantación |
| CareerReminder | UserId/planVersion/actionKey, payload cifrado con fecha/zona/aceptación, estado active/cancelled/delivered, requestId/inputHash; sin contenido privado en logs |

Migración aditiva, FK a Users y contenedores correspondientes, índices por dueño/ID, únicos dueño+requestId y experimentId+version; índices parciales con nombres explícitos para una versión vigente y recordatorio activo por acción/versión. Evitar cascadas que borren material de otra persona. Aplicar dos veces sobre PG temporal, comprobar esquema ORM, concurrencia y rollback. No down destructivo ni migración contra producción; infraestructura decide despliegue.

**Extensión declarativa de CORE para aprobar en este ticket:** exportar los cinco recursos propios e historial descifrados (JSON cuando aplique), excluyendo hashes/requestIds/tokens técnicos; purgar con el procesador existente y verificar rollback/reintento/replay, preservando al otro dueño. El permiso de ES-32 no se extiende automáticamente a estos modelos nuevos. La política sobre autoría/retención de una revisión humana de tercero queda pendiente de Mauricio; no se registra feedback real hasta definirla. Sin tocar datos clínicos ni mezclar la tabla legacy PlanRequest de suscripciones con el plan profesional.

Todas las referencias a evidencias se resuelven en servidor mediante getConfirmedEvidence; una referencia ajena o no vigente se rechaza sin revelar su existencia. No copiar texto del diario/chat. La entrega directa es dato profesional cifrado del dueño; no se extrae un origen íntimo sin autorización.

## 7. Versiones, invalidación y carreras

Base rastreable: elección/fundamento ES-32, versión del catálogo, taskKey/índice y hash de tarea, rúbrica, referencias de evidencias/versiones, contexto canónico y reglas de planificación. Nueva evidencia, revisión/cambio de rúbrica, retirada del origen, consentimiento revocado, cambio de elección, catálogo o disponibilidad devuelve `needs_review` con códigos/motivos ES/EN y versiones anteriores visibles al dueño. Invalidaciones existentes se consumen sin darlas por resueltas globalmente para otros motores.

No usar exclusivamente un booleano guardado: revalidar al leer y antes de aceptar/publicar resultado/entrega/plan/recordatorio. Si cambia la base entre propuesta y confirmación, 409 y recuperación del estado propio. Escrituras serializadas por dueño con User lock y expectedVersion; requestId para primer intento/reconciliación. La existencia de helpers con transacciones propias **no acredita un snapshot global**. Si hace falta una publicación atómica multihelper, Mauricio debe aprobar una composición transaccional; no se promete resolverla con dos lecturas.

El recordatorio que ya se entregó no se presenta como pendiente otra vez; cancelación/revocación impide entregas nuevas. Una cuenta con eliminación pendiente no genera ni recibe nuevos recordatorios. Una revisión recibida después de cambiar versión no sobrescribe la entrega vigente; permanece histórica y necesita revisión.

## 8. Pruebas y entrega previstas

- Unitarias: esquema cerrado ES/EN; plantilla/rúbrica/ayuda/procedencia; 20/30/45 minutos; reducción de alcance; propuesta inalterable/vencida; estados y transiciones; decisiones; 7/30/90; límites de disponibilidad/costo desconocido; DAG; fechas elegidas/IANA y horario estacional; no inferir competencia.
- HTTP/JWT/Postgres/cifrado reales: A/B en todos los recursos/IDs/referencias; admin/therapist/board sin bypass; autor humano falsificado; revocación de token, consentimiento y eliminación pendiente; sin sesión. Mocks solo donde falte contrato, declarados expresamente.
- Concurrencia/idempotencia: dos versiones con misma base, primer guardado simultáneo, response perdida recuperable, misma petición/cuerpo distinto, cambio de base durante operación, rollback sin estado falsamente guardado.
- Invalidation: editar/borrar evidencia, revocar puente/compartición, nueva evidencia, cambiar catálogo/elección/rúbrica/contexto; antes de confirmar, después y antes de recordatorio. Que no resuciten propuestas ni feedback de versión anterior.
- Derechos: exportación exacta propia y descarga ajena 404; cinco tablas sin omisiones; purga con fallo SQL/reintento/replay y B intacto. Revisión humana real/exportación de su autoría depende del contrato de retención.
- Recordatorios: default sin aceptación, permiso ausente/revocado, cancelación, versión obsoleta, fecha ambigua, entrega única dentro de app y cero mensajes externos.
- Controles negativos/mutaciones críticas: IDs, fecha/versión, límites de tiempo, completar checkbox no sube nivel, consentimiento y aislamiento. Sin llamadas de IA ni comparación con desempeño profesional real.
- Suite backend, sintaxis, PG real y CI; verificar frontend lint/test/tipos/build si cambia la rama base, sin atribuir una pantalla no implementada. Audit con salida real; sin silenciar reglas, secretos, .env, node_modules o artefactos en Git.

Entrega futura: un PR contra main firmado [Dev-Codex], criterios cubiertos, Seguridad y privacidad, resultados reales, dependencias y no verificado. Mauricio revisa núcleo/contratos y QA verifica; no fusiono ni cierro hilos. Un tramo contra fixtures no cierra ES-33 integrada.

## 9. OBJECIONES y decisiones que requiere esta propuesta

**OBJECIÓN 1 — dependencia no integrada.** ES-32 y ES-14 aún no están en main. Implementar contra ramas apiladas haría depender el PR de contratos todavía en QA; inventar disponibilidad/zona duplicaría la fuente canónica. Alternativa recomendada: aprobar y desarrollar módulos puros contra fixtures del contrato, integrar solo tras merge de ambos por Mauricio. No se cherry-pickean ni se fusionan PR ajenos. Preparación útil mientras espera QA; la validación integrada queda pendiente.

**OBJECIÓN 2 — revisión humana y retención sin contrato.** Ser admin/terapeuta no autoriza acceso. Mauricio debe confirmar helper canónico que compruebe asignación vigente + facilitator_sharing para recursos/versiones/materiales seleccionados, con withConsent en lectura/escritura/publicación, autor/fecha de servidor, retirada de compartición y política de exportación/purga de feedback con autor de tercero. Alternativas: aportar ese contrato para completar el circuito, o dejar solicitudes/estado pending_authorization y probar el adaptador con fixtures sin habilitar acceso de terceros. Se detiene solo la parte afectada; no se llama a una reflexión propia revisión humana.

**OBJECIÓN 3 — contenido, recordatorios y estimación.** El catálogo no trae experimento/rúbrica de dominio y no hay canal de notificaciones; tampoco está resuelta la revisión humana. Recomiendo la plantilla neutral/rúbrica de reflexión propuesta y recordatorios dentro de app, ambos sujetos a esta aprobación explícita; contenido específico espera especialista. Estimación revisada: **16–24 h** para motor, cinco modelos/ciclo de vida, endpoints, invalidación, fechas, derechos y pruebas; incluye adaptación a contratos existentes una vez disponibles, excluye crear la infraestructura canónica de permisos/notificaciones y la UI ES-34. Las 8 h (6–10) del ticket no alcanzan de forma defendible para todo ese alcance más las dependencias. Es una estimación, no horas ejecutadas ni promesa de fecha. Fecha de entrega: por reprogramar con Alejo/Mauricio; no se promete cumplir el corte vencido del 27-oct.

**Aprobar ahora:** (1) este plan backend sin UI; (2) motor determinista + textos/plantilla neutral con límites y sin acreditación de dominio; (3) uso canónico de ParticipantContext y snapshots versionados; (4) recordatorios solo dentro de app con aceptación/notifications; (5) extensión declarativa de CORE de los recursos propios, manteniendo pendiente el feedback de terceros; (6) desarrollo contra fixtures mientras se fusionan dependencias, sin declarar integración completa; (7) estimación revisada. **Contrato separado de Mauricio necesario:** acceso/asignación/compartición/retención para revisión humana y lector mínimo de disponibilidad/zona/versiones. No se implementa frontend ni núcleo nuevo de permisos sin aprobación.

## 10. Aprobación y desarrollo del tramo preparatorio

Respuesta explícita del usuario: «Aprobar el plan con las dependencias indicadas»; ante contratos inexistentes: «No, pero acepto que lo hagamos con tus recomendaciones». Registro firmado en Jira 10261. Se aplica la recomendación de desarrollar contra puertos/fixtures y mantener revisión humana pending_authorization/shared:false. No se toma esa respuesta como existencia de un contrato de Mauricio ni se habilita acceso de terceros. Contrato efectivamente implementado: documento 39; verificación y límites: documento 40. ES-33 integrada permanece pendiente.
