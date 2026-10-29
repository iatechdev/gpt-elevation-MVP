# ES-36 — Utilidad y métricas mínimas del piloto

[Dev-Codex]

28-oct-2026 · Fase 1 para aprobación. Solo documentación; sin implementación ni pruebas de esta HU.

Rama aislada `ES-36-utilidad-piloto`, base main 6dc61e9. Fuentes: ES-36; PRD §10/RF-11; HU22 del sprint; contratos y código de ES-18/19/23; design system y tokens interiores. ES-18/19 figuran Listo. ES-32/33 siguen Por hacer; no existe hoy su resultado profesional persistido. No se inicia la fase 2 de landing (ES-60 solo tiene aprobación de fase 1).

## 1. Hallazgos y alcance propuesto

El panel actual `/api/admin/metrics` combina MoodLog y ratings, y no identifica una cohorte del piloto ni sus permisos. No sirve como fuente de estas métricas: sentirse escuchado no es ánimo ni mejoría clínica, y mensajes/check-ins no acreditan activación o una decisión profesional. No se modificará ni se conectará ese panel a esta entrega.

Propuesta: un formulario voluntario de la persona en `/app/feedback`, y una página separada de resultados agregados del piloto en `/admin/pilot-metrics`, sujeta al permiso de cohorte que defina Mauricio. No cambia el checkout ni aparece un modal automático después de conversar; se accede por un enlace discreto desde el cuerpo del dashboard y se puede cerrar sin presión. Sin SDK de terceros, cookies de seguimiento, LLM o nuevas consultas a chat/diario/ánimo.

Las respuestas son datos personales de su dueño aunque seudonicemos eventos. El permiso analítico y el acceso a cohortes **no están definidos en el contrato actual**: la lista de propósitos está cerrada, `research` se describe como investigación y el contrato analítico de ES-19 solo concreta eventos de consentimiento. Se propone un contrato para revisión de Mauricio, no reinterpretarlo unilateralmente.

## 2. Pantalla de participante y flujo ES/EN

1. Entrar con la sesión existente, cargar la propia respuesta guardada y la ventana asignada por servidor. No derivar la cohorte, el inicio o el idioma del correo ni de un ID enviado por el navegador.
2. Aviso opcional claro, finalidad aprobada y estado del permiso. Ninguna autorización ni respuesta preseleccionada. Si el permiso requerido está sin definir, no habilitar envío real. Si está definido pero falta, mostrar el estado y el control del propósito canónico que Mauricio autorice, sin una casilla global ni vincularlo al puente o a notificaciones. Los textos de ese control necesitan su finalidad/alcance reales; no presentar investigación amplia como si autorizara únicamente esta encuesta.
3. Preguntas estructuradas, sin texto libre: valor inicial, ámbito del valor si lo hubo, sentirse escuchado, sentirse respetado y utilidad/claridad profesional si la persona exploró ese ámbito. Opciones sí/no/no estoy seguro y no lo he explorado/no responder cuando correspondan; null/no contestado permanece distinto de no. Etiquetas estables, independientes del idioma.
4. Para aclarar qué resultó útil, categorías opcionales: ordenar ideas, reconocer experiencia, aclarar un siguiente paso, otra ayuda sin detallar. No solicitar ejemplos íntimos, copiar una conversación, una cita o un CV. La limitación respecto al ejemplo cualitativo del PRD se registra abajo.
5. Revisar y guardar explícitamente. Al menos una respuesta elegida para enviar; omitir todo cierra sin escritura ni evento de completado. No exigir contexto/evidencia/puente profesional para declarar valor personal.
6. Guardar → confirmación del servidor + lectura de la propia revisión → guardado. Si se pierde la respuesta, conservar borrador y requestId/cuerpo y consultar antes de reintentar. 409 conserva edición local y permite revisar la última versión. Cambio de sesión limpia RAM e ignora respuestas antiguas. Salir con cambios pide confirmar, con foco inicial en permanecer.
7. Editar crea revisión propia; no se acumulan múltiples votos por insistir o cambiar de idioma. Solo la última respuesta válida de cada persona/ventana entra en el denominador pertinente. Retirar una respuesta debe dejar de incorporarla a nuevos agregados y respetar el contrato de retención que confirme Mauricio.

No habrá recordatorios automáticos, rachas, premios por contestar, felicitaciones por responder sí ni cambios de nivel/plan por contestar no. Se respeta el silencio. Los errores no aparecen como texto guardado.

## 3. Pantalla de resultados y definición de medidas

Página nueva y aislada, reutilizando el layout/guard administrativo existente **más autorización de cohorte en servidor**. El rol admin por sí solo no debe conceder acceso a cualquier cohorte. Sin contratos vigentes: estado no configurado; sin permiso: 403. No crear una lista de personas ni mostrar identificadores, correos, lengua, país, respuestas individuales o ánimo.

Metas estáticas del PRD claramente separadas de resultados observados:

| Medida | Meta propuesta y ventana | Fuente propuesta del resultado |
| --- | --- | --- |
| Activación | 5/6 en 7 días desde el inicio de participación asignado | Confirmación explícita de valor personal o profesional; no inferirlo de visitas, mensajes, contexto o evidencia |
| Experimento + decisión | 4/6 en 30 días | Estados persistidos autorizados de ES-33; hasta existir: no disponible, nunca cero ni inferido de un curso/checkbox |
| Escuchado y respetado | 5/6; proponer cierre de día 7, pendiente de PO | Ambas respuestas afirmativas, con faltantes/indecisión separados; percepción, no mejoría clínica |
| Opción pertinente o siguiente paso claro | 4/6; proponer cierre de día 30, pendiente de PO | Respuesta profesional explícita; no obligatoria para acreditar valor personal |

El 6 de las metas no sustituye el tamaño real de una cohorte. El inicio/ventana y pertenencia vienen del contrato de Mauricio; no usar createdAt o primer check-in como sustituto silencioso. Antes de que cierre una ventana, marcarla en curso; no tratar una persona fuera de ventana como abandono o fallo. Respuestas posteriores se describen como tardías si la política lo admite, sin reescribir un corte cerrado sin versión nueva.

DTO propuesto distingue `not_configured`, `not_available`, `in_progress`, `suppressed` y `ready`. Solo `ready` puede traer conteos observados autorizados: elegibles, respondieron, faltantes, no exploraron/no saben y numerador definido. Sin fuentes no hay números simulados. No imputar faltantes como respuestas negativas ni promediar dimensiones distintas.

Sin filtros por ES/EN, país, profesión, día libre o combinaciones de características. B2C y patrocinado solo por cortes autorizados en servidor y con muestra suficiente; si no existe clasificación canónica, no inventarla. Suprimir muestras menores de cinco y proteger inferencias por complementos/diferencias entre cortes. La regla exacta de supresión complementaria necesita decisión de Mauricio: con seis personas puede impedir mostrar algunas cifras. La UI conserva las metas y explica protección/no disponibilidad; no reconstruye los conteos ocultos ni exporta filas individuales.

No optimizar duración o número de mensajes. Las visitas/mensajes, si hubiera autorización para contarlos, aparecen como actividad y nunca como acciones sustantivas. El estado de un experimento o decisión se toma del backend correspondiente, no de un evento arbitrario del navegador.

## 4. Wireframes

```text
PARTICIPANTE · /app/feedback
┌────────────────────────────────────────────────────────┐
│ [Volver a mi espacio]                           ES | EN │
│ Tu opinión es opcional                                 │
│ Puedes omitir preguntas o salir. No cambia tu acceso.   │
│ [Ventana del servidor / Aún no configurada]             │
│ [Finalidad y permiso canónico, por confirmar]           │
│ ¿Has encontrado algo que te haya servido aquí?           │
│ ( ) Sí   ( ) No   ( ) No estoy seguro   ( ) No responder │
│ Si sí: [personal / profesional / ambos / no responder]  │
│ ¿Te has sentido escuchado?          [opciones sin marcar]│
│ ¿Te has sentido respetado?          [opciones sin marcar]│
│ Si exploraste opciones profesionales:                   │
│ ¿Una opción pertinente o un paso más claro?              │
│ [sí / no / no sé / no exploré / no responder]            │
│ ¿Qué ayudó? [categorías opcionales, sin texto libre]     │
│ [Cambios sin guardar / Guardando / Guardado / Error]     │
│ [Guardar respuestas] [Salir sin responder]              │
│ [Retirar respuesta guardada, con confirmación]          │
└────────────────────────────────────────────────────────┘

RESULTADOS · /admin/pilot-metrics
┌────────────────────────────────────────────────────────┐
│ Métricas del piloto · ES | EN                           │
│ [Cohorte/ventana autorizada, sin selector libre de IDs]  │
│ Metas propuestas · No son resultados obtenidos          │
│ [Activación 5/6 · 7d] [Experimento/decisión 4/6 · 30d]   │
│ [Escuchado/respetado 5/6] [Utilidad profesional 4/6]     │
│ Resultados observados                                  │
│ [Sin configurar / En curso / Protegidos / Disponibles]  │
│ Por medida: ventana, denominador y faltantes autorizados│
│ Sin datos personales, subgrupo EN, ánimo o porcentaje IA│
│ [Actualizar]                                           │
└────────────────────────────────────────────────────────┘
```

Con lector de pantalla, cada grupo tendrá legend/fieldset y opciones rotuladas, sin depender de color. Mobile: una columna; escritorio: dos columnas para tarjetas, formulario con ancho de lectura. Anchos 320/375/768/1440 y zoom 200%; orden de foco lógico, primer enlace de salto, controles 44px, aria-live para estados sin robar foco y reduced motion. Ningún cambio del checkout, chat, terapeuta o board.

## 5. Componentes, tokens y textos propuestos

Reutilizar LanguageProvider, React Router, ProtectedRoute/AdminRoute, sesión/HTTP existentes y daisyUI `elv-`: card, button, radio/checkbox, fieldset, alert y diálogo accesible. Tokens interiores: fondo #F9F9F7, superficie #FAF8F4/blanca, tinta #1C1917, borde #D6D2C4, acción/foco #4A6741, aviso #92400E, error #B91C1C. Inter para cuerpo 16px/apoyo 14px; Playfair Display 400 para títulos. Espaciado 4/8/12/16/24/32, radios .65/1rem. Sin gráficas clínicas ni radar, emojis como única etiqueta o nuevas dependencias.

| ES | EN |
| --- | --- |
| Tu opinión es opcional | Your feedback is optional |
| Puedes omitir preguntas o salir. Esto no cambia tu acceso ni tus opciones. | You can skip questions or leave. This does not change your access or options. |
| ¿Has encontrado algo que te haya servido aquí? | Have you found something useful here? |
| Personal / Profesional / Ambos | Personal / Career-related / Both |
| ¿Te has sentido escuchado? | Have you felt listened to? |
| ¿Te has sentido respetado? | Have you felt respected? |
| Si exploraste opciones profesionales: ¿encontraste una opción pertinente o un siguiente paso más claro? | If you explored career options: did you find a relevant option or a clearer next step? |
| Sí / No / No estoy seguro / No responder | Yes / No / Not sure / Skip this question |
| No he explorado esa parte | I have not explored that area |
| ¿Qué ayudó? (opcional, sin añadir textos personales) | What helped? (optional, without adding personal text) |
| Ordenar ideas / Reconocer experiencia / Aclarar un siguiente paso / Otra ayuda, sin detallar | Organizing ideas / Recognizing experience / Clarifying a next step / Other help, without details |
| Cargando / Cambios sin guardar / Guardando / Guardado | Loading / Unsaved changes / Saving / Saved |
| Guardar respuestas / Salir sin responder | Save responses / Leave without responding |
| No pudimos guardar. Tus respuestas siguen en esta pantalla. | We could not save. Your responses remain on this screen. |
| No pudimos confirmar el guardado. Consulta antes de reintentar. | We could not confirm the save. Check before retrying. |
| La respuesta guardada cambió. Revisa antes de continuar. | The saved response changed. Review it before continuing. |
| Retirar respuesta / Cancelar | Withdraw response / Cancel |
| Se retirará de nuevos resultados. Revisa los límites de retirada de informes anteriores. | It will be withdrawn from new results. Review the limits of withdrawing earlier reports. |
| Métricas del piloto / Metas propuestas / Resultados observados | Pilot metrics / Proposed targets / Observed results |
| Las metas no son resultados obtenidos ni evidencia de eficacia clínica. | Targets are not achieved results or evidence of clinical effectiveness. |
| Sin configurar / En curso / Datos protegidos / No disponible | Not configured / In progress / Protected data / Not available |
| Elegibles / Respondieron / Sin respuesta / No exploraron / No saben | Eligible / Responded / Missing responses / Not explored / Not sure |
| Estos resultados están protegidos por el tamaño de la muestra. | These results are protected because of the sample size. |
| Tu sesión venció. Inicia sesión para continuar. | Your session expired. Sign in to continue. |

La explicación exacta del consentimiento, retirada y retención se publicará solo tras confirmar el contrato; los textos anteriores no sustituyen una política aprobada. Todo por claves i18n, sin traducir respuestas libres porque no se recogen.

## 6. Propuesta técnica (no es un contrato canónico aprobado)

### APIs nuevas para revisar

- `GET /api/pilot/feedback/me`: ventana/configuración del titular, estado del permiso y última revisión propia (o ausencia de respuesta, no un voto negativo).
- `PUT /api/pilot/feedback/me`: respuestas cerradas, questionnaireVersion, baseVersion y requestId. Solo dueño del token; idempotencia sobre el cuerpo canónico completo, 409 si el mismo ID cambia de contenido o hay revisión concurrente. Éxito solo tras commit.
- `DELETE /api/pilot/feedback/me`: retirada de la respuesta de la ventana vigente, con requestId/baseVersion y resultado recuperable; no borra decisiones de consentimiento ni otros datos de la persona. Contrato de retirada/retención pendiente.
- `GET /api/admin/pilot-metrics`: guard admin existente más permiso/asignación canónica de cohorte, campos cerrados, sin userId/country/lang/filtros arbitrarios. Devuelve DTO mínimo ya suprimido por servidor; no manda filas para que frontend agregue.

El cliente no necesita un POST genérico de eventos que acepte hechos que no puede demostrar. Los eventos sustantivos se emiten desde operaciones confirmadas del servidor, con whitelist de campos/tipos; si un origen no ofrece hook/estado canónico, queda no disponible hasta acordarlo. Visitar una ruta nunca se transforma en confirmación de evidencia o plan.

### Datos y migraciones propuestas

Dos modelos a revisar con Mauricio antes de persistir:

- `PilotFeedbackSubmission`: UserId del principal, versión de cuestionario/ventana y de revisión, respuestas estructuradas cifradas v2, requestId/hash y marcas de guardado/retirada. Versionado e índices únicos para idempotencia/concurrencia; una sola revisión vigente por persona/ventana. Sin idioma, profesión, país, texto libre, puntuación emocional o identificadores privados del chat.
- `PilotMetricEvent`: referencia interna al dueño para sus derechos, seudónimo derivado en servidor, cohorte autorizada si existe, nombre de evento permitido, versión y source/request/job ID técnico necesario, fecha del servidor. Sin payload libre, prompts, citas, CV, ánimo, riesgo o nombres. Índice de deduplicación por origen/version/evento; una persona/revisión cuenta una vez.

Una migración aditiva e idempotente, con índices/FK y sin alterar tablas legadas ni `sync/alter`; probar aplicación/repetición/rollback transaccional en PostgreSQL desechable. No ejecutar producción ni down destructivo. La pertenencia a cohorte no se almacena en una nueva tabla de identidad propia de ES-36: se consume el contrato de Mauricio.

Validar objetos/campos cerrados, versiones/UUID, enums, fechas/ventanas del servidor, estados no respondido/no seguro/no explorado separados. Rechazar campos extra y IDs ajenos en URL/query/body. No aceptar hora, cohorte, seudónimo o dueño arbitrarios del cliente. Respuestas solo RAM hasta confirmar; sin autosave o web storage privado.

### Propiedad, propósito y derechos

Reutilizar verificarToken/req.user.id y la barrera de borrado/sesión. Si Mauricio asigna un propósito opcional (por ejemplo research, pendiente de confirmar), usar `withConsent` dentro de la operación, incluidos replays y lectura para nuevos agregados; no duplicar ni cambiar PURPOSES/SCOPES. Verificar la vigencia al acceder, no un checkbox o caché.

Los modelos con UserId y seudónimos siguen siendo personales: requieren **contrato de incorporación a exportación/purga ES-23**, retirada al revocar e invalidación de informes/descargas antes de activarse. CORE es un registro cerrado; no añadirlo ni saltarlo unilateralmente. No asegurar que seudonimizar elimina obligaciones o hace los datos anónimos. Sin acceso de admin a respuestas propias de terceros ni resúmenes individuales.

Eventos iniciales candidatos: usefulness_answered desde el guardado confirmado; career_bridge_confirmed/evidence_confirmed desde sus commits autorizados; fallos/recuperaciones IA solo desde metadatos canónicos sin contenido. Consentimiento y borrado se integran solo con los hooks acordados por Mauricio. No fingir account_verified si no existe verificación de correo, ni exercise_completed/rutas/experimento/plan antes de que esas funciones estén integradas y autorizadas. No retrocapturar historia de chat/diario/ánimo para rellenar métricas.

## 7. Pruebas propuestas

- Unitarias de schema/enums, conteo por persona/ventana, faltantes/indecisión/no explorado, límites de ventanas, fechas/cortes versionados, idempotencia sobre cuerpo completo, revisiones y deduplicación. Metas propuestas nunca como resultados.
- HTTP/JWT/ORM/cifrado/migración/PostgreSQL reales: A/B con IDs cambiados; admin/board/terapeuta sin lectura de respuestas ajenas; anon 401/403; JWT revocado; cohorte ajena 403/404. Falsificar rol/cohorte en navegador no lo evita.
- Consentimiento negar/revocar antes, durante y después de guardar/leer/agregar; sin nuevas escrituras/lecturas autorizadas por un permiso revocado, sin fila huérfana y retirada efectiva de nuevos informes. Exportación y purga propias según contrato de Mauricio; nunca entregar datos B en A.
- Privacidad del agregado: grupos <5, idioma EN, filtros no admitidos, deducción por complementos/cortes, B2C/patrocinado insuficientes; el JSON mismo no contiene conteos suprimidos ni IDs/texto, no solo la UI.
- Navegador ES/EN: carga/vacío/sin configurar/error/guardado, salir sin contestar sin escritura, borrador conservado tras fallo, respuesta perdida/replay, 409, retirada confirmada, expiración/cambio de sesión, teclado/foco, 320/375/768/1440, zoom y reduced motion.
- Frontend lint 0 errores/advertencias, npm test, tsc -b, build/audit; regresión backend y migración. Diferenciar fixtures de integración real; sin llamadas a LLM ni producción. Salidas reales en PR.

## 8. OBJECIONES y contratos necesarios

**OBJECIÓN 1 — propósito y acceso a cohortes faltantes.** ES-19 no autoriza automáticamente estos nuevos eventos o respuestas; User no contiene pertenencia/ventana del piloto ni se encontró helper de acceso a cohorte. Usar research por inferencia o admin global como permiso suficiente duplicaría/rediseñaría el núcleo de Mauricio. Necesito que confirme finalidad/versión/alcance, helper de cohorte/ventana/actor y política de revocación/retención/exportación/purga. Hasta entonces, detener guardado/eventos/agregados reales; interfaz solo contra fixtures explícitos del contrato propuesto, si se aprueba.

**OBJECIÓN 2 — ejemplo cualitativo frente a minimización.** PRD §10 pide ejemplo específico de acompañamiento y explicar la evidencia que ayudó, mientras ES-36 prohíbe conversaciones/citas/CV en analítica. No se resuelve añadiendo un textarea libre a este almacén. Propuesta: categorías opcionales aquí y revisión cualitativa separada, con encuadre/permiso privado propio si Alejo la exige; eso no se presenta como ejemplo específico ya recogido. PO decide alcance; Mauricio define ese acceso si fuera necesario.

**OBJECIÓN 3 — ventana y privacidad de una muestra de seis.** Solo activación 7d y experimento/decisión 30d tienen ventanas explícitas. Proponer 7d para acompañamiento y 30d para utilidad requiere aprobación del PO. Suprimir grupos pequeños y diferencias puede ocultar resultados del piloto incluso si hay seis participantes: Mauricio debe definir una política concreta antes de prometer números visibles. Las metas 5/6 y 4/6 siempre son propuestas, sin afirmar logro.

Estimación preliminar Dev: **10–16 h** para formulario, APIs/modelos/migración, instrumentación acotada, reporte y pruebas, después de recibir contratos; frente a 4 h originales. No incluye espera, implementación del núcleo de permisos/derechos o motores ES-32/33. Sin fecha comprometida. Si se exige recoger ejemplos libres o construir administración de cohortes, hay que reestimar alcance, no hacerlo por inferencia.

**Solicitud de aprobación:** revisar pantallas/flujo/textos y plan. Se puede aprobar el diseño y avanzar interfaz con fixtures; persistencia, instrumentación y resultados reales requieren los contratos anteriores de Mauricio. Ningún tramo contra mocks cierra la HU integrada ni habilita recolección real del piloto.
