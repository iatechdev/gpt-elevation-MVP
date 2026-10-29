# ES-36 — Contrato mínimo recomendado, v1

[Dev-Codex]

28-oct-2026. El usuario solicitó «El contrato que me recomiendes». Esta es mi recomendación concreta. **Su implementación en el núcleo de consentimiento/identidad/derechos requiere revisión técnica de Mauricio.** El alcance de código aprobado sigue siendo la interfaz con fixtures; este documento no registra una aprobación técnica que no ocurrió ni habilita recolección real.

## 1. Finalidad independiente y voluntaria

Propongo `pilot_metrics`, permiso opcional específico, con versión de política y scope de piloto resuelto por servidor. No reutilizar `research`, `professional_bridge`, `facilitator_sharing`, `notifications` o `necessary` para incorporar por inferencia una finalidad nueva. Mauricio decide su extensión en la lista cerrada PURPOSES/SCOPES de ES-19 y sus hooks.

Texto propuesto, por aprobar con su política:

- ES: «Autorizo el uso de mis respuestas estructuradas y eventos mínimos para evaluar este piloto. Esto no permite leer mi chat, diario o ánimo, ni autoriza investigación general. Puedo retirarlo sin perder acceso a las demás funciones.»
- EN: “I allow my structured responses and minimal events to be used to evaluate this pilot. This does not allow access to my chat, journal or mood, or authorize general research. I can withdraw it without losing access to other features.”

Sin casilla marcada inicialmente ni concesión por abrir el formulario. Antes de recoger: política, scope y configuración efectivos. Concesión/revocación mediante el contrato canónico, sin una segunda tabla de permisos creada por ES-36. Un scope antiguo o desactualizado no sirve para un nuevo piloto o versión. Revocar no bloquea el uso necesario del producto.

## 2. Propietario, cohorte y ventana autoritativos

Reutilizar verificarToken y req.user.id. Recomiendo que Mauricio entregue un helper transaccional equivalente a:

`resolvePilotAccess(actorId, operation, transaction)` → asignación, piloto opaco, modalidad B2C/patrocinado si está definida, inicio/fin de participación y ventana actual, versión de asignación y operación autorizada. El nombre es propuesto, no un helper existente.

- Persona: leer, enviar o retirar exclusivamente sus respuestas. Ni URLs ni query/body aceptan UserId, seudónimo o cohorte para cambiar de propietario.
- Fundador/revisor del piloto: acceso solo agregado y solo a la cohorte asignada en servidor; verificar rol vigente y asignación. Un admin general sin esa asignación recibe 403. No se presupone que el rol founder ya exista.
- Terapeuta, board y administrador sin asignación no leen respuestas individuales. Un identificador ajeno recibe 404 indistinguible cuando corresponda.
- Inicio y ventanas asignados explícitamente, sin usar correo, idioma, first check-in o createdAt como sustituto. Si hay asignaciones ambiguas o sin ventana: not_configured/conflicto, nunca elegir al azar.

No crear una administración de cohortes o nuevo esquema de identidad dentro de ES-36. Mientras el helper/configuración no existan, los endpoints reales de esta función permanecen sin habilitar.

## 3. Escrituras, consultas propias y retirada

API propuesta de 10246: GET/PUT/DELETE `/api/pilot/feedback/me`. Guardar respuestas cerradas con questionnaireVersion, baseVersion y requestId; servidor resuelve la ventana. Comparar el cuerpo canónico completo en replays. Mismo ID/otro cuerpo o versión concurrente → 409; error conserva borrador. Idempotencia transaccional, con índice único y lectura comprobable del resultado. No autosave.

`withConsent` para nuevas respuestas/eventos y cada incorporación a nuevos agregados, con comprobación/bloqueo dentro de la transacción. La revocación concurrente se coordina con el mismo permiso; no basta hasConsent antes de un proceso de varios pasos. Ordenar locks por dueño/asignación de forma estable.

**Leer/exportar la propia información y retirarla no exige conceder otra vez pilot_metrics.** Esas operaciones usan propiedad/derechos necesarios y la barrera de sesión/borrado del núcleo. No obligar a volver a autorizar analítica para ejercer retirada o consultar el estado. Un replay no elude la revocación ni reintroduce la respuesta a agregados.

La retirada es versionada e idempotente, deja de aportar a nuevas consultas agregadas y no se trata como una respuesta negativa. No modifica otros consentimientos. Seudónimo opaco distinto por piloto, generado en servidor y vinculado internamente a UserId para exportación/purga; no un hash simple de correo, ni anonimización irreversible que impida borrar.

## 4. Datos mínimos y derechos de ES-23

Solo enums y estados necesarios: valor inicial, ámbito opcional, escuchado, respetado, utilidad/claridad profesional y categorías de ayuda. null/no respuesta, unsure y not_explored separados. Sin texto libre, idioma/país/profesión como dimensiones, ánimo, diagnósticos, citas, CV, prompts, conversación o indicador de crisis.

Respuestas cifradas v2. Eventos sin payload libre: tipo permitido, dueño interno, seudónimo, piloto/ventana autorizados, versión de esquema/operación y referencia técnica mínima para deduplicación. Nunca cuerpo de chat o una referencia privada que permita reconstruirlo desde analítica. El emisor de un hecho sustantivo es el commit del servicio dueño, no el navegador declarando haber terminado un experimento.

Recomiendo que los nuevos agregados excluyan inmediatamente contribuciones retiradas/revocadas al consultar y que no se mantengan cachés con filas personales. Sin histórico retrocapturado de chat/diario para llenar huecos.

Mauricio debe incorporar estos modelos al registro cerrado de exportación/purga ES-23, con pruebas de propietario y restauración/replay. Recomiendo retirar el contenido del almacén analítico activo al revocar según la política acordada; si hay auditoría necesaria, que sea mínima y sin respuestas. No inventar un periodo legal o del proveedor: configurar retención y tarea de purga aprobadas antes de habilitar; sin política de retención no hay recolección.

No ofrecer descarga de filas del piloto al fundador. Una copia agregada ya entregada/descargada no se puede recuperar automáticamente; explicarlo sin prometer borrado remoto. Ninguna decisión de retención se ejecuta contra producción desde este PR.

## 5. Agregados sin reconstrucción

`GET /api/admin/pilot-metrics`, con guard canónico más asignación y autorización de contribuciones vigentes. Proyección estricta sin UserId/seudónimos/respuestas por persona; sin filtros libres de idioma, país, profesión o fechas que permitan diferencias entre subconjuntos. Cache-Control no-store. Una pantalla no recibe conteos secretos para ocultarlos con CSS.

Regla mínima recomendada: muestra menor de cinco → suppressed sin conteos. Añadir supresión de complementos, unanimidades o cortes que permitan inferir respuestas individuales, con política versionada aprobada por Mauricio antes de devolver ready. **Para la cohorte de seis, usar suppressed como valor seguro hasta acordar esa política; no prometer que los resultados numéricos estarán siempre visibles.** Las metas propuestas 5/6 y 4/6 permanecen visibles sin fingir datos reales.

B2C/patrocinado se separan solo si están clasificados y autorizados en servidor, y cada corte permite publicación. Caso EN nunca como subgrupo. No llamarlo anónimo: es seudónimo con acceso y minimización.

DTO por medida: status not_configured/not_available/in_progress/suppressed/ready. Solo ready lleva denominadores/numeradores/faltantes autorizados y consistentes. No rellenar con 0 un resultado protegido, fuera de ventana o de un motor ausente. Datos profesionales desde ES-33; hasta que exista, not_available.

## 6. Aceptación y alcance del código actual

Para activar el backend real: contrato revisado por Mauricio; finalidad/política/retención y ventanas aprobadas; helper de acceso/asignación operativo; registro de exportación/purga e invalidación; migración aditiva aplicada/probada; A/B/roles/cohortes, revocación en ambos órdenes y supresión del propio JSON probados en DB real; aprobación de QA.

La interfaz actual solo usa `createFixtureRepository`, no fetch de métricas/feedback, y exige literalmente `VITE_ENABLE_PILOT_FEEDBACK_PREVIEW=true`. No implementa esos controles en servidor ni finge que el guard cliente los acredita. Reload elimina las respuestas de la simulación; el resultado dice “Guardado solo en la simulación”. El contrato de transporte y su idempotencia/derechos reales siguen pendientes. No se activa el piloto al aprobar o compilar esta propuesta.
