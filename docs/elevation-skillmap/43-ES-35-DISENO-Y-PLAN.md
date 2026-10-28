# ES-35 — Diseño y plan para aprobación

Estado: propuesta de Fase 1, 28-oct-2026. Autor: [Dev-Codex].
Rama ES-35-consola-facilitacion desde origin/main 6dc61e93542776147693e87b6e95c9c4c0b47d22.
No hay código de producto implementado en este ticket.

## 1. Alcance y evidencia

ES-35 / SP2-HU16: consola mínima para el facilitador asignado, con invitación, progreso operativo, fallos recuperables, materiales seleccionados, revisión con autor/fecha/evidencia y objeción del titular. No es un panel clínico ni un acceso general de administración.

Fuentes inspeccionadas: Jira ES-35; docs/elevation-skillmap/02-PRD.md RF-11 y 04-SPRINT-2-HUS.md HU16; docs/hu-tecnicas/DESIGN-SYSTEM.md; frontend/src/App.tsx y guards; backend/middlewares/auth.js, User.js, utils/sessions.js, utils/consent.js, routes/consents.js, utils/personalData.js, routes/skillMap.js, SkillAssessment.js y utils/skillMap.js. Referencia adicional NO integrada: contrato de ES-33 en rama ES-33-experimento-plan, documento 39-ES-33-CONTRATO-IMPLEMENTADO.md.

Hallazgos:
- main tiene JWT con sesión revocable y consentimiento facilitator_sharing/default, pero no middleware de facilitador ni contrato de asignación/cohorte/material seleccionado.
- User.role es string libre; eso no define quién puede asignar el rol ni qué puede leer. therapistId es una asignación de terapia y no sirve para esta consola.
- Consentir facilitator_sharing no selecciona un material, una versión o un destinatario. No habilita leer todo el Skill Map ni getConfirmedEvidence de otra persona.
- SkillAssessment separa self/review, pero no tiene contrato público de autor profesional, objeción ni publicación por facilitador. No se escribirá esa pista directamente.
- ES-33 guarda intención de revisión pending_authorization/shared:false; NO concede acceso al tercero ni acepta feedback de terceros.
- Las pantallas ya existentes de admin/terapeuta manejan otros datos. No se reutilizan sus consultas, permisos ni asignaciones.

## 2. Entrega propuesta en dos tramos

A. Tras aprobación de diseño: interfaz ES/EN con seis personas completamente sintéticas, estados/operaciones simulados en memoria, preview desactivada por defecto mediante VITE_ENABLE_FACILITATION_PREVIEW=true. No usa cuentas ni datos reales, no envía correo, no escribe API y no guarda contenido en storage. Sin enlaces nuevos desde admin/therapist/board ni cambios en chat. Banner permanente de simulación. Recarga/cambio de sesión descarta la simulación. No hay fallback automático de error real a fixtures.

B. Integración: endpoints/modelos de ES-35 utilizando contratos de Mauricio de identidad, asignación, compartición, revocación y derechos. Se implementa cuando esos contratos estén acordados y disponibles. Sin contrato, acceso real cerrado, nunca un bypass por rol. No se cierra la HU integrada por completar A.

La autorización del tramo A no autoriza cambiar el núcleo de Mauricio. El apartado 8 solicita decisiones separadas para B.

## 3. Pantallas, flujo y wireframe

Rutas propuestas:
- /facilitation: lista de personas asignadas; acceso real sujeto a autorización de servidor.
- /facilitation/participants/:id: progreso operativo, incidencias y materiales compartidos.
- /facilitation/participants/:id/reviews/new?shareId=:id: revisión de una versión explícitamente compartida.
- /app/professional-reviews: revisiones propias y objeciones. Pantalla mínima separada para cumplir el derecho de objeción, sin rediseñar dashboard/chat; acceso por enlace directo en el preview. El punto de entrada integrado del participante se añadirá cuando ES-34 esté integrado y aprobado.

Wireframe (contenido sintético en A):

    Saltar al contenido          Elevation       ES | EN
    Consola de facilitación
    [Vista preliminar · datos sintéticos · no se guardan]
    [Privacidad y alcance de acceso]
    Personas asignadas
    Alias       Invitación       Avance operativo       Abrir
    Persona A   Aceptada          Siguiente paso         [Ver]
    ... seis alias sintéticos, sin nombres reales o correos ...
    [Sin resumen estadístico ni filtros por atributos personales]

    < Volver a personas
    Persona A       Actualizado: fecha de servidor / simulada
    Invitación: aceptada | Progreso: experimento entregado
    Incidencias operativas: código permitido, estado, fecha
    Materiales compartidos
    [Título profesional | versión | alcance | estado de acceso]
    [Ver material] [Registrar revisión]
    Revisiones: autor, fecha, material/versión, estado/objeción

    Registrar revisión
    Material: versión exacta compartida (solo lectura)
    Evidencias examinadas: selección dentro de ese permiso
    Observación profesional [texto]   Límites [texto]
    [Cancelar] [Vista previa]
    Vista previa exacta -> [Confirmar registro]
    Solo después del ACK aparece como registrada

    Mis revisiones profesionales (titular)
    [Autor | fecha | material/versión | observación | límites]
    [Objetar revisión] -> motivo -> vista previa -> confirmar
    [Objeción registrada | respuesta profesional cuando exista]

Flujo del facilitador: lista -> persona -> material autorizado -> revisión -> vista previa -> confirmación -> historial.
Flujo del participante: lista propia -> revisión -> objeción -> confirmación -> estado.
Invitación: A muestra estado y simula solicitar/reintentar con confirmación; B queda pendiente del servicio canónico. No expone el correo ni el token de invitación en listado/logs.
Incidencias: catálogo cerrado de fallos profesionales/operativos recuperables, nunca mensaje de excepción, prompt, fragmento de chat o motivo de crisis. Solo recargar y acciones permitidas por el contrato; no ejecutar trabajos arbitrarios o reintentar IA automáticamente.

No se muestran chats, diario, ánimo, autoevaluaciones privadas, puntuaciones personales, crisis, secretos, perfil completo ni información clínica. Una incidencia privada no se transforma en un código identificable del panel.

## 4. Componentes, tokens y accesibilidad

Reutilizar React Router, i18n ES/EN existente, fuentes y espaciado del sistema; daisyUI 5 con prefijo elv- y estilos acotados a la nueva consola. No crear otro sistema global ni instalar un stack distinto.
Componentes: card, button, badge, alert, fieldset, textarea, select y tabla semántica/lista móvil. Estados no dependen solo del color.
Paleta del área privada: fondo #f9f9f7, superficie #FAF8F4, texto #1C1917, bordes #D6D2C4, estados del DS; oliva accesible #4A6741 para texto/botones pequeños si #6B7D5C no alcanza contraste. Texto secundario se oscurece cuando lo requiera AA; medir texto >=4,5:1 y controles >=3:1, sin asumir que cada token histórico cumple. Esta variante local se somete a aprobación.
Inter 16px cuerpo/controles; Playfair 400 títulos. Retícula de 4px, cards radio16, padding16/24/32.
Móvil 320px: tarjetas apiladas con etiquetas repetidas y sin desplazamiento horizontal; >=768px lista/tabla y detalle a dos columnas si hay espacio; >=1024px ancho máximo legible. Tema claro/oscuro local, zoom200%, prefers-reduced-motion.
Teclado: salto al main, foco visible >=3px, orden lógico, labels explícitos, error junto al campo + aria-describedby, aria-live para confirmación/fallo. Diálogo con foco contenido, Escape cancela y devuelve foco; no se pierde borrador al cambiar idioma. Guard de salida para revisión/objeción no guardada. Recarga/pérdida de autorización elimina datos visibles sensibles; no se retiene material en caché del cliente.

## 5. Estados

- Vacío: sin asignaciones; sin material compartido; sin revisiones; no implica falta de capacidad.
- Cargando: skeleton con nombre accesible, sin contenido anterior de otra persona.
- Guardando: botón deshabilitado, estado anunciado; no mostrar éxito optimista.
- Éxito: registro confirmado con identificador/autor/fecha del servidor; en A dice Simulación.
- Error de lectura: mensaje breve + reintentar, sin convertirlo en vacío.
- Error de escritura/ACK perdido: conservar borrador y reintentar requestId/cuerpo exactos; no duplicar.
- Conflicto409: material o revisión cambió; recargar/comparar, no sobrescribir.
- Acceso retirado/no asignado/consentimiento revocado: limpiar material/acciones; respuesta genérica sin revelar existencia ajena.
- 401/sesión cerrada: login; 403/404 sin acceso según contrato; 503 contrato indisponible no abre fixtures.
- Versiones antiguas: históricas, no certifican vigencia; una versión nueva necesita selección/autorización nueva.
- Objeción: enviada, pendiente de respuesta, respondida; no desaparece ni reescribe la revisión original.

## 6. Textos ES / EN propuestos (todos mediante claves facilitation.*)

| ES | EN |
| --- | --- |
| Consola de facilitación | Facilitation console |
| Vista preliminar · datos sintéticos · no se guardan | Preview · synthetic data · changes are not saved |
| Personas asignadas | Assigned participants |
| No tienes personas asignadas. | You have no assigned participants. |
| Ver progreso | View progress |
| Invitación / Pendiente / Aceptada / Vencida | Invitation / Pending / Accepted / Expired |
| Solicitar invitación / Confirmar solicitud | Request invitation / Confirm request |
| Progreso operativo / Sin información disponible | Operational progress / No information available |
| Contexto confirmado / Ruta elegida / Experimento entregado / Plan aceptado | Context confirmed / Route chosen / Experiment submitted / Plan accepted |
| Incidencias recuperables / Actualizar estado | Recoverable issues / Refresh status |
| Materiales compartidos / Versión / Acceso retirado | Shared materials / Version / Access withdrawn |
| Esta persona no ha compartido materiales contigo. | This participant has not shared materials with you. |
| Solo puedes consultar materiales seleccionados para ti. | You can only view materials selected for you. |
| Registrar revisión / Evidencias examinadas | Record review / Examined evidence |
| Observación profesional / Límites de esta revisión | Professional observation / Limits of this review |
| Vista previa / Confirmar registro / Cancelar | Preview / Confirm record / Cancel |
| Autor / Fecha / Historial | Author / Date / History |
| Mis revisiones profesionales / Objetar revisión | My professional reviews / Object to review |
| Motivo de la objeción / Confirmar objeción | Reason for objection / Confirm objection |
| Objeción registrada / Pendiente de respuesta / Respondida | Objection recorded / Awaiting response / Responded |
| Revisión registrada. / Simulación completada. | Review recorded. / Simulation completed. |
| Cargando… / Guardando… / Reintentar | Loading… / Saving… / Retry |
| No se pudo cargar la información. | Information could not be loaded. |
| No se confirmó el guardado. Conservamos el borrador para reintentar. | Saving was not confirmed. Your draft is kept so you can retry. |
| El material cambió. Revisa la versión antes de continuar. | The material changed. Check the version before continuing. |
| Tu acceso ya no está disponible. | Your access is no longer available. |
| Hay cambios sin guardar. / Seguir editando / Descartar y salir | You have unsaved changes. / Keep editing / Discard and leave |
| Completa este campo. / Selecciona al menos una evidencia autorizada. | Complete this field. / Select at least one authorized evidence item. |
| No se muestran estadísticas de subgrupos para proteger la privacidad. | Subgroup statistics are not displayed to protect privacy. |
| Esta revisión no es un diagnóstico ni garantiza empleo. | This review is not a diagnosis and does not guarantee employment. |

Códigos, fechas y variables se traducen/formatean en locale; no concatenar cadenas ES en EN. Etiquetas y feedback humano mantienen su idioma de autoría, indicado; no traducirlos con IA sin autorización. Mensajes de validación de longitud/límites e incidencias también bilingües. Antes de implementar se completará el diccionario siguiendo estos textos, sin introducir promesas ni nuevas acciones.

## 7. Plan técnico propuesto de integración (NO contrato vigente)

Express + Sequelize + Postgres; sin cambios de proveedor LLM y sin llamadas nuevas a Claude para esta HU.
Rutas propuestas, sujetas al contrato canónico:
- GET /api/facilitation/participants?after=cursor: listado mínimo de asignaciones autorizadas, paginado.
- GET /api/facilitation/participants/:participantId: invitación/progreso/incidencias por allowlist.
- GET /api/facilitation/participants/:participantId/materials/:shareId: versión profesional explícitamente compartida.
- POST /api/facilitation/participants/:participantId/invitations: solo si Mauricio delega este permiso y entrega servicio idempotente; sin llamar al registro público ni conceder consentimiento. De otro modo, lectura del estado únicamente.
- GET y POST /api/facilitation/participants/:participantId/reviews: historial y registro, body cerrado {shareId, materialVersion, evidenceRefs, observation, limits, expectedVersion, requestId}.
- GET /api/professional-reviews: revisiones del titular req.user.id, paginadas.
- POST /api/professional-reviews/:reviewId/objections: {reason, expectedVersion, requestId}, titular resuelto en servidor.
- POST /api/facilitation/participants/:participantId/reviews/:reviewId/responses: respuesta a objeción {objectionId, response, expectedVersion, requestId}, solo autor aún autorizado; no cerrar unilateralmente la objeción ni alterar el original.

No crear endpoints públicos de búsqueda por correo ni exportación masiva de cohortes. Estado operativo proviene de lectores mínimos, no de consultas a tablas de chat/diario/ánimo. Sin service definitivo de invitación no se manda correo. No asignación/compartición implícita al solicitar revisión ES-33.

Modelos candidatos propios:
- FacilitationReview: UserId titular, AuthorId servidor, ShareId/versión, referencias mínimas de evidencia/versiones, observación/límites cifrados v2, estado/versionado, requestId+huella, createdAt servidor. Registro inmutable; corrección añade versión, no overwrite.
- FacilitationReviewEvent: UserId, ReviewId/versión, ActorId servidor, tipo objection/response, motivo/respuesta cifrados, requestId+huella y createdAt. No pone email/nombre en logs. Resolver la identidad profesional mostrable mediante contrato; conservar atribución con minimización.
Asignaciones/cohortes/invitaciones/materiales compartidos son núcleo de Mauricio: NO se crean tablas duplicadas ni se escribe Consent, User.role o therapistId desde ES-35. Una integración declarativa con CORE para estos dos modelos requiere aprobación y decisión de retención/autoría.

Migración aditiva idempotente con índices (UserId,id), (ShareId,materialVersion), unicidad idempotencia (actor,requestId) por operación; FKs y borrado acordados con el núcleo antes de migrar. No alter destructivo ni cambios en producción. Verificar instalación limpia/repetida/esquema ORM sin ejecutar down con pérdida de datos.

Autorización de servidor en CADA listado/lectura/escritura:
1. Reutilizar verificarToken/sessionProblem; validar cuenta activa y permisos vigentes a través del helper acordado de Mauricio, sin confiar en localStorage, claims antiguos o role enviado por el cliente.
2. Resolver participante/owner desde el recurso y asignación actual. Query scope por actor+titular, no findByPk ajeno seguido de respuesta parcial. Admin/superadmin/therapist/board sin excepción automática.
3. Reutilizar withConsent(UserId,'facilitator_sharing',...) y deletionPending; exigir además permiso de destinatario, material/versión exacta y finalidad por el helper canónico. Consentimiento general nunca sustituye selección explícita. Propietario puede objetar y consultar su historial sin consentir compartir.
4. Escrituras transaccionales: revalidar asignación/permiso/consentimiento/material al commit; bloqueos coordinados con revocación de Mauricio. withConsent solo coordina consentimiento, no promete atomicidad de asignación por sí solo.
5. Autor/fecha vienen de req.user y servidor; rechazar campos extra, IDs inválidos, duplicados/versiones ajenas, longitud excedida (propuesta 4.000 observación, 2.000 límites/motivo/respuesta, 8 referencias, requestId64), cuerpo64KB, paginado20 máximo50. Validar contenido sin enviar texto privado al LLM. No afirmar filtrado semántico infalible.
6. requestId+huella ligada a actor/owner/material/versiones; replay exacto idempotente, cuerpo distinto409. Material revocado/cambiado no se puede publicar aunque exista borrador.
7. No-store, sin contenido en telemetría/logs, sin payloads crudos de terceros en errores. No caché de materiales; al recuperar foco/errores de permiso, limpiar/revalidar. No se puede recuperar una copia ya vista/descargada: explicarlo sin prometer borrado remoto.

Revisión profesional = observación sobre material compartido y evidencia examinada, sin nivel nuevo del Skill Map en este tramo. Si se requiere publicar una competencia/nivel, Mauricio debe definir helper de pista review y propagación/invalidation; no escribir SkillAssessment directo ni confundir self con review. El criterio actual no exige una puntuación y esta propuesta no la añade.

Agregados: recomendación para piloto de seis: OMITIR todos los agregados y filtros estadísticos por idioma/mercado/estado u otras combinaciones, incluidos complementos. Mostrar solo filas operativas de personas realmente asignadas, bajo su permiso. No publicar 0/1–4 celdas ni total-complemento que revele EN. Esta vista identificada autorizada no se presenta como anónima. Si se pide reporte agregado luego, requiere contrato de cohortes y supresión conjunta/diferencias, no solo ocultar una celda menor de5.

## 8. Contratos pendientes / propuesta para Mauricio

Deben quedar documentados y aprobados antes de B:
1. Quién recibe rol/capability de facilitación, quién asigna/retira personas, elegibilidad y acceso de admin/superadmin, permisos sobre invitaciones y campos operativos exactos.
2. Helper único de asignación+destinatario+material/versiones y bloqueo para carrera entre lectura/revocación. Selección realizada por el titular con vista previa, nunca por el facilitador. IDs/versión de ES-33 review-request no son autorización.
3. Qué implica facilitator_sharing/default y su versión; si necesita scope por destinatario/selección. ES-35 consume el contrato, no lo rediseña. Revocación retira acceso futuro sin destruir automáticamente el historial propio del titular.
4. Lectores mínimos de hitos/fallos autorizados de ES-14/25/27/29/32/33; qué estado se considera operativo y bajo qué base/permiso se comparte. No deducirlo leyendo tablas privadas ni usar ánimo/seguridad.
5. Autoría mostrable, corrección/objeción/respuesta, retiro del revisor, retención de feedback de terceros, exportación del dueño y eliminación de datos propios del autor. Política de la revisión si se revoca un material o cambia su versión. Recomiendo mantener historial propio con etiquetas de obsolescencia, sin acceso residual del tercero.
6. Autorizar solo extensión declarativa de CORE para dos modelos, cifrado v2, invalidación/borrado de referencias; identidad del autor retenida/anonimizada según política explícita. No fijar días de retención inventados.
7. Contrato de invitaciones y envío ES-12 si procede. Hasta entonces solo estado o simulación explícita, sin correo real ni token.
8. Integración con ES-33: consumir solicitud exacta y permiso independiente; habilitar feedback real solo cuando ambas autorizaciones existan. No convertir pending_authorization en accepted por guardar el preview.

## 9. Pruebas y aceptación prevista

Tramo A:
- Unitarias: diccionario ES/EN, estados/transiciones, inmutabilidad/versiones/objeción, idempotencia/conflicto/error/ACK perdido, revocación y cambio de sesión, ausencia de agregados/filtros por EN o combinaciones.
- Navegador compilado: seis personas ficticias, lista/detalle/revisión/vista previa/confirmación/objeción/respuesta; vacío/carga/error/403/409/revocación; preview OFF sin entrada ni material; cero API writes. Interceptaciones/mocks documentados, no pruebas de permisos reales.
- 320/375/768/1440, zoom200%, ES/EN, teclado/foco/skip/dialog/Escape, oscuro/reduced-motion; medir contraste con cálculo/herramienta.
- lint exit0 sin advertencias, test, tsc -b, build, audit; comparación antes/después de zonas afectadas. No desactivar reglas.

Tramo B:
- HTTP con JWT/sesiones reales y Postgres aislado: legítimo facilitador asignado+share vigente puede leer/revisar SOLO esa versión. Titular ve/objeta su revisión.
- Sin token / inválido / revocado: rechazo de middleware existente (hoy falta token403, inválido401); rol ajeno403; persona/review/share ajenos y no asignados404 uniforme; no enumeración.
- Admin común, superadmin sin asignación, terapeuta, board, otro facilitador y usuario no acceden por ser roles.
- Permiso a persona A no permite B; permiso a material A no concede resto de su mapa/evidencias/historial; autor falsificado rechazado.
- Revocar consentimiento, share, asignación, cambiar rol, borrar cuenta/material o cambiar versión bloquea operaciones nuevas y carrera concurrente al commit; retirada/objeción propia no exige compartir.
- Publicación/replay/concurrencia: sin duplicados, 409 si requestId cambia o versión obsoleta; ni escritura parcial ni éxito previo al commit.
- Canarios privados (chat/diario/ánimo/crisis) ausentes de respuesta/logs/exportación del facilitador, sin importar estado de fallos.
- Exportación/borrado y retención acordados, migración limpia/repetida y equivalencia ORM reales, agregados no recuperables por parámetros/REST alternativos.
- E2E integrado participante comparte versión -> facilitador revisa -> titular objeta -> revisor responde -> revocación bloquea; no se declara cumplido hasta ejecutar con contratos reales.

## 10. OBJECIÓN: dependencias y estimación

Objeto considerar ES-35 completa en 3–5h con permisos/revisión reales. Evidencia: main carece de asignación, selección por destinatario/material e invitaciones; facilitator_sharing solo scope default; ES-33 no permite feedback de terceros. Improvisar rol o reusar consultas de terapia expondría información privada y contradiría HU02/HU03/RF-11.

Alternativa recomendada: aprobar diseño e interfaz sintética por separado (12–18h estimadas), mantenerla OFF y acordar primero los contratos. Integración más pruebas de permisos/derechos/migraciones 16–24h adicionales una vez recibidos, total orientativo28–42h, sujeto a esos contratos. No equivale a horas ya trabajadas ni a compromiso de fecha; el vencimiento Jira27-oct ya pasó. El cierre requiere QA y no cabe prometerlo hoy.
Alternativa: Mauricio entrega primero servicio/contratos completos; Dev integra consola después, sin preview público; reduce duplicidad pero detiene UI hasta contrato.
Detener solo acceso real, migraciones/derechos del núcleo y publicación hasta autorización. Preparación de documentación ahora; código frontend después de aprobación explícita según AGENTS.md.

## 11. Entrega

Un ticket, rama y PR contra main. Fase1 solo documentación; aún no PR de producto ni estado En QA. En DEV al crear rama. Cuando exista aprobación, implementar el tramo autorizado con pruebas reales, indicar mocks/criterios pendientes y sección Seguridad y privacidad. No fusionar ni cerrar hilos de QA. El diseño propuesto no constituye aprobación humana.

## 12. Aprobación recibida

Alejo aprobó explícitamente en este chat: «Aprobar diseño y vista preliminar propuesta».
Registrado en Jira ES-35, comentario 10274, después de presentar este diseño en 10273.
Autoriza únicamente el tramo A. No autoriza modificar el núcleo de Mauricio ni habilitar permisos/datos reales.
La objeción de estimación y los contratos del apartado 8 siguen abiertos para la integración.

