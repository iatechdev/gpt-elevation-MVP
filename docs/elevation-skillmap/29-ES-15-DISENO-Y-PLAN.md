# ES-15 — Mi espacio y diario ES/EN

[Dev-Codex]

27-oct-2026 · **Diseño y plan técnico para aprobación. Solo documentación; sin implementación.**

Rama propia `ES-15-mi-espacio-diario`, base `main` 4311d69. Fuentes: Jira ES-15/ES-20, contrato `15-CONTRATO-CONVERSACIONES-DIARIO.md`, rutas reales `diary.js`/`chat.js`, ChatPage/UserDashboard, PRD RF-15/16 y design system/guía UX interiores. ES-20 figura Listo; su comentario QA 10120 acredita humo desplegado sobre 6b17291, no una prueba nueva de esta UI. ES-16 está En QA (PR #39) y sus ejercicios permanecen desactivados por defecto.

## 1. Pantallas, navegación y flujo

### Navegación persistente

Una barra compacta de contenido, conservando las cabeceras existentes: **Mi espacio / My space** y **Mi siguiente paso / My next step**. Se muestra en los dos chats, diario y nueva puerta profesional. Dentro de Mi espacio: **Conversar / Talk** hacia `/app/chat` y **Diario / Journal** hacia `/app/diary`.

`/app/space/tools` («Mis herramientas / My tools») será una puerta de navegación, no una recomendación o un plan calculado. Ofrece Brújula, Mis evidencias, Mi mapa y Catálogo cuando esas rutas estén realmente registradas en App. Si aún no existen: tarjetas «En preparación / In preparation», sin enlaces activos. Si ninguna existe, estado explicativo de opciones profesionales aún no disponibles y regreso a Mi espacio.

Se propone un pequeño contexto frontend de rutas disponibles, obtenido del árbol de Route ya registrado, sin modificar guards ni las definiciones de las otras HUs. Evita enlaces inexistentes y activa las tarjetas al integrarse las pantallas: `/app/compass`, `/app/evidence`, `/app/skill-map`, `/app/route-catalog`. No se usa el progreso de ánimo como Skill Map. La presencia de una ruta no se presenta como disponibilidad de datos personales o de su backend; cada pantalla conserva sus estados propios.

El enlace a ejercicios solo aparece si existe la ruta de ES-16 **y** su bandera de publicación está habilitada. No se duplica su catálogo ni se habilita contenido sin revisar. Este PR nace de main, sin copiar o apilar los PR de otras HUs.

### Diario

- `/app/diary`: lista de entradas propias guardadas, fecha y fragmento breve, «Nueva entrada». Consulta explícita hasta las **100 más recientes**; aviso del límite, sin afirmar que es el historial completo o inventar paginación que el servidor no ofrece.
- `/app/diary/new`: fecha explícita, textarea de hasta 10.000 caracteres y contador; guardar/cancelar. No hay título, etiqueta emocional, evaluación ni campos fuera del contrato.
- `/app/diary/:id`: lectura de una entrada confirmada, fecha y última edición, editar, borrar y «Elegir contexto en el chat». Esa última acción abre el selector del chat, **sin preseleccionar ni transferir texto automáticamente**.
- Edición del contenido/fecha en el mismo detalle con estado local «Cambios sin guardar»; cancelar restaura la última lectura confirmada y pide confirmar si perdería cambios locales.
- Borrar requiere diálogo explícito sobre la entrada guardada y los cambios locales que se descartarían, con foco inicial en cancelar. Solo después se hace DELETE. No se muestra «deshacer»: el servidor vacía el contenido y la UI no puede recuperarlo.

Guardar no comparte con chat, carrera, terapeuta o facilitador. Una entrada recién guardada no queda seleccionada por defecto. Leer, editar y borrar validan siempre el dueño en servidor; un ID ajeno o borrado se muestra como entrada no disponible.

### Contexto del chat (ambas superficies existentes)

El chat de `/app/chat` y el integrado en dashboard reutilizan un adaptador de cliente común para historial, envío recuperable y selección de diario, sin crear otra conversación ni rehacer check-in/checkout.

1. «Elegir entradas para este envío / Choose entries for this message» abre un selector autenticado. Se carga el diario solo al abrirlo. Casillas inicialmente desmarcadas, máximo tres; fecha y fragmento identifican la entrada. La selección se mantiene solo en RAM.
2. Se muestra el aviso: «El chat usa la versión guardada al procesar el mensaje, hasta 2.000 caracteres de cada entrada seleccionada». No se promete una vista previa exacta del prompt ni transferencia de los 10.000 caracteres completos.
3. «Guardar no comparte. Esta selección permite consultar esas entradas en el chat; no autoriza el recorrido profesional». Sin casillas elegidas se omite contextEntryIds.
4. Antes de enviar se releen las entradas seleccionadas. Si cambió updatedAt o alguna falta: conservar texto, mostrar cambio/no disponibilidad y pedir revisar la selección; no enviar automáticamente otra versión. No se inventa un token de preview o bloqueo de versión del servidor.
5. El envío captura `{message,lang,requestId,contextEntryIds}` de forma inmutable; durante su ejecución no se cambia ese cuerpo ni se disparan envíos dobles. Retries explícitos conservan ID **y cuerpo**, nunca otro contexto bajo el mismo intento.
6. Burbuja pendiente diferenciada de mensajes confirmados. Fallos de red/proveedor/presupuesto se muestran como estado del envío, no como respuestas guardadas del asistente. La última conversación confirmada queda visible.
7. Tras confirmación/recuperación del turno se actualiza historial sin duplicar, se limpia el borrador confirmado y se desmarca el contexto para el próximo envío. «Consultar estado» y, cuando procede, «Reintentar el mismo envío» usan el contrato existente; no hay polling, seguimiento o envío automáticos.
8. Se explica que dejar de seleccionar evita nuevas lecturas directas del diario, pero no borra lo que ya apareció en el historial. Borrar una entrada tampoco se presenta como borrado de mensajes ya confirmados o retirada de autorizaciones profesionales previas, que tienen otros flujos.

## 2. Wireframes

```text
DIARIO · LISTADO
┌──────────────────────────────────────────────────────┐
│ Volver al inicio                              ES EN │
│ [Mi espacio] [Mi siguiente paso]                      │
│ [Conversar] [Diario]                                 │
│ Mi diario privado                    [Nueva entrada] │
│ Guardar no comparte con otras personas o con carrera.│
│ Hasta las 100 entradas más recientes.                │
│ ┌ [Fecha] [fragmento propio]              [Abrir] ┐   │
│ └───────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────┘

NUEVA / EDICIÓN
┌──────────────────────────────────────────────────────┐
│ [Mi espacio] [Mi siguiente paso]               ES EN │
│ [Conversar] [Diario]                                 │
│ Nueva entrada / Editar entrada                       │
│ [Cambios sin guardar / Guardando / Guardado / Error]  │
│ Fecha [calendario]                                   │
│ Contenido                                           │
│ ┌────────────────────────────────────────────────┐  │
│ │ Texto propio sin enviar ni guardar todavía       │  │
│ └────────────────────────────────────────────────┘  │
│ [n]/10.000                       [Guardar] [Cancelar]│
└──────────────────────────────────────────────────────┘

DETALLE CONFIRMADO
┌──────────────────────────────────────────────────────┐
│ [Fecha] · Última edición [fecha/hora]                  │
│ [Texto guardado, escapado y con saltos de línea]      │
│ [Editar] [Borrar] [Elegir contexto en el chat]         │
└──────────────────────────────────────────────────────┘

CHAT · CONTEXTO Y ENVÍO
┌──────────────────────────────────────────────────────┐
│ [Mi espacio] [Mi siguiente paso] [Conversar] [Diario]  │
│ Asistente de IA                                      │
│ [Conversación confirmada existente]                  │
│ [Elegir entradas para este envío] [0/3 seleccionadas] │
│ ┌ [ ] [Fecha] [fragmento] ┐  [Sin seleccionar diario] │
│ └────────────────────────┘                          │
│ Versión guardada al procesar · máximo 2.000 por entrada│
│ [Texto del mensaje]                         [Enviar]│
│ [Enviando / Sin confirmar / Confirmado / Fallido]     │
│ [Consultar estado] [Reintentar el mismo envío]        │
└──────────────────────────────────────────────────────┘

MI SIGUIENTE PASO · PUERTA DE NAVEGACIÓN
┌──────────────────────────────────────────────────────┐
│ [Mi espacio] [Mi siguiente paso]               ES EN │
│ [Brújula] [Mis evidencias] [Mi mapa] [Catálogo]        │
│ Cada enlace existe solo si su ruta está registrada.  │
│ De lo contrario: En preparación, sin enlace activo.   │
│ No muestra recomendaciones ni un plan inventado.      │
└──────────────────────────────────────────────────────┘
```

Diálogos: cancelar/borrar para eliminación; permanecer/descartar para salida con cambios. El resultado desconocido de una creación tiene una vista de recuperación con acceso al diario, borrador retenido y sin reintentar POST automáticamente.

## 3. Estados y recuperación de errores

| Operación | Comportamiento propuesto |
| --- | --- |
| Cargar diario o detalle | Loading real; error de red/500 no se convierte en lista vacía; vacío solo tras GET válido |
| Crear | Borrador → guardando → ACK con ID → GET del ID → guardado comprobado; si no coincide el estado actual, pedir revisar |
| POST sin respuesta | Resultado desconocido, texto local retenido; consultar lista; no identificar por coincidencia de texto ni repetir POST a ciegas. Sin requestId no se garantiza creación exactamente una vez |
| Recuperar creación incierta | «Consultar mi diario» para inspeccionar lo guardado. Descartar borrador es solo local, con confirmación. Crear otro intento exige decisión explícita avisando que el anterior podría haberse guardado; no se llama retry idempotente |
| Editar | Mantener copia local y última confirmada separadas. ACK + GET coincidente permite mostrar guardado; error conserva contenido local |
| PUT sin respuesta | GET del ID para inspeccionar estado actual; si coincide, mostrar coincidencia actual sin atribuir éxito causal no comprobado; no repetir PUT automáticamente ni duplicar invalidaciones |
| Borrar | Confirmación explícita → DELETE → GET no disponible; actualizar lista y quitar selecciones/cache local. Sin ACK, 404 permite indicar no disponible, no asegurar qué intento la borró |
| Cambio en otro dispositivo | Releer antes de guardar/usar contexto, avisar si updatedAt difiere y conservar borrador. No prometer protección atómica: API no tiene ETag/expectedVersion |
| Sesión cambiada/vencida | Ocultar contenido privado, limpiar RAM/selección/pendientes de la sesión, abortar o ignorar respuestas antiguas y ofrecer login |
| Chat sin ACK | Consultar GET del requestId propio; completed recupera respuesta, pending ofrece consulta manual, failed/404 permite el reintento explícito adecuado con el mismo cuerpo/ID; códigos de presupuesto no reintentan automáticamente |
| Salir/recargar con texto local o envío pendiente | Pedir confirmación. En otra carga solo se promete recuperar lo confirmado por GET, no un borrador RAM ni un envío cuyo ID se perdió al abandonar |

No hay autosave, copias privadas en localStorage/sessionStorage, URL o logs. No se ofrece cancelación del procesamiento remoto que la API no admite. No se infiere que un 404 de turno tras un fallo de red garantice que el servidor nunca recibirá el intento; el mismo requestId conserva su función de deduplicación.

## 4. Textos ES/EN propuestos

Todo texto de interfaz en i18n; texto del diario y conversación originales, sin traducción automática o HTML.

| ES | EN |
| --- | --- |
| Mi espacio / Mi siguiente paso | My space / My next step |
| Conversar / Diario | Talk / Journal |
| Mi diario privado | My private journal |
| Nueva entrada / Abrir / Editar / Borrar | New entry / Open / Edit / Delete |
| Fecha / Contenido / Última edición | Date / Content / Last edited |
| Guarda solo lo que quieras conservar. Guardar no comparte con otras personas ni con el recorrido profesional. | Save only what you want to keep. Saving does not share with other people or with your career journey. |
| Aún no tienes entradas guardadas. | You do not have any saved entries yet. |
| Hasta las 100 entradas más recientes; esta lista puede no incluir todo tu diario. | Up to the 100 most recent entries; this list may not include your entire journal. |
| Cargando diario… / Guardando… / Guardado | Loading journal… / Saving… / Saved |
| Cambios sin guardar / Guardar / Cancelar | Unsaved changes / Save / Cancel |
| Revisa la fecha y el contenido (1–10.000 caracteres). | Check the date and content (1–10,000 characters). |
| No pudimos cargar tu diario. Reintentar | We could not load your journal. Retry |
| No pudimos guardar. Tus cambios siguen en esta pantalla. | We could not save. Your changes are still on this screen. |
| No pudimos verificar el guardado. Revisa tu diario antes de crear otra entrada. | We could not verify the save. Check your journal before creating another entry. |
| Consultar mi diario / Descartar borrador | Check my journal / Discard draft |
| Crear otra entrada puede duplicar un intento anterior cuyo resultado desconocemos. | Creating another entry may duplicate a previous attempt whose outcome is unknown. |
| El contenido guardado cambió. Revisa antes de continuar. | The saved content changed. Review it before continuing. |
| La entrada no está disponible. | The entry is not available. |
| Se borrará la entrada guardada y se descartarán los cambios locales. No podrás recuperarla desde esta pantalla. | The saved entry will be deleted and local changes discarded. You will not be able to recover it from this screen. |
| Borrar la entrada no borra mensajes ya confirmados ni retira por sí solo autorizaciones profesionales anteriores. | Deleting the entry does not delete previously confirmed messages or by itself withdraw earlier career authorizations. |
| Si sales, perderás los cambios sin guardar. | Leaving will discard unsaved changes. |
| Asistente de IA | AI assistant |
| Elegir contexto en el chat | Choose context in chat |
| Elegir entradas para este envío | Choose entries for this message |
| Entradas seleccionadas: [n]/3 | Selected entries: [n]/3 |
| Sin seleccionar diario | No journal entries selected |
| El chat usa la versión guardada al procesar el mensaje, hasta 2.000 caracteres de cada entrada seleccionada. | Chat uses the version saved when the message is processed, up to 2,000 characters from each selected entry. |
| Esta selección permite consultar esas entradas en el chat; no autoriza su uso profesional. | This selection lets chat consult those entries; it does not authorize career use. |
| Dejar de seleccionar evita nuevas lecturas directas, pero no borra lo que ya apareció en la conversación. | Deselecting prevents new direct reads, but does not erase what has already appeared in the conversation. |
| Una entrada seleccionada cambió o ya no está disponible. Revisa la selección. | A selected entry changed or is no longer available. Review your selection. |
| Enviar / Enviando… / Sin confirmar / Envío confirmado | Send / Sending… / Unconfirmed / Message confirmed |
| No pudimos confirmar este envío. Conservamos tu texto en esta pantalla. | We could not confirm this message. Your text remains on this screen. |
| Consultar estado / Reintentar el mismo envío | Check status / Retry the same message |
| El envío sigue en proceso. Puedes consultar su estado. | The message is still processing. You can check its status. |
| Tu sesión venció. Inicia sesión para continuar. | Your session expired. Sign in to continue. |
| Brújula / Mis evidencias / Mi mapa / Catálogo | Compass / My evidence / My map / Catalog |
| En preparación | In preparation |
| Las opciones profesionales aún no están disponibles aquí. Puedes volver a Mi espacio. | Career options are not available here yet. You can return to My space. |

Los errores de proveedor/presupuesto reutilizan códigos existentes con presentación ES/EN propia; no se imprimen errores internos ni se simula una respuesta guardada a partir del campo reply de un 4xx/5xx.

## 5. Componentes, tokens y accesibilidad

Reutilizar React Router, LanguageProvider, token/guards y helpers HTTP/persistencia existentes. Nuevos componentes limitados a navegación de espacio, puerta profesional, lista/detalle/editor de diario, selector de contexto y adaptador/hook de envío de chat común a las dos superficies. Se conservan layout general, check-in, checkout, backoffice y las otras zonas.

daisyUI 5 con prefijo `elv-`: botones, cards, textarea, input fecha, checkbox y link; diálogos semánticos con Escape, foco inicial en cancelar/permanecer y restauración. Textos/body 16px y apoyo 14px Inter; títulos Playfair Display **400**, sin negrita. Fondo #F9F9F7, superficie #FAF8F4/blanca, texto #1C1917, bordes #D6D2C4; oliva decorativo #6B7D5C y acción/foco #4A6741 AA, advertencia #92400E y error #B91C1C; radios .65/1rem y espaciado 4/8/12/16/24/32. Tokens semánticos locales.

Lista/selector en una columna en móvil; navegación se envuelve sin tabla horizontal ni desplazar el composer fuera de pantalla. 320/375/768/1440, zoom 200%, objetivos de 44px, labels explícitos, fieldsets, estado aria-live sin robar foco al cargar, errores con enlaces al campo, salto al contenido y prefers-reduced-motion. Texto largo escapado con saltos de línea y overflow-wrap. Sin gestos obligatorios, emojis como única etiqueta ni acciones ocultas al teclado.

## 6. Plan técnico: APIs, modelos y validaciones

**Sin nuevos endpoints, tablas ni migraciones.** Reutilizar DiaryEntry y DerivedInvalidation de ES-20; Message/ChatTurn y el flujo de ES-18/19/20/21/22/23. El backend guarda cifrado v2 del diario y registra invalidación por editar/borrar. No se altera la identidad, consentimiento, revocación, exportación, borrado o modelo/proveedor de Mauricio.

| API real | Uso y contrato |
| --- | --- |
| GET `/api/diary?limit=100` | `{entries:[{id,date,content,createdAt,updatedAt}]}`, propias/no borradas, más recientes; no cursor, total ni hasMore |
| POST `/api/diary` | `{date:'YYYY-MM-DD',content}`, 201 con entrada; no admite un requestId idempotente |
| GET `/api/diary/:id` | entrada propia; ajena, borrada o inexistente: 404 indistinguible |
| PUT `/api/diary/:id` | fecha y/o contenido, devuelve entrada; cada edición genera invalidación; sin CAS/ETag |
| DELETE `/api/diary/:id` | `{id,deleted:true}`; segundo borrado 404; vacía contenido y registra invalidación |
| GET `/api/messages` | historial propio confirmado `[ {role:'user'|'bot',text} ]`; no paginación/IDs de turnos en esa respuesta |
| POST `/api/chat` | `{message,lang,requestId,contextEntryIds?}`, hasta 3 IDs propios/no borrados; contexto normalizado y acotado a 2.000 caracteres por entrada |
| GET `/api/chat/turns/:requestId` | estado propio pending/completed/failed, retryable y reply si completed; 404 para otro dueño |

Validar respuestas tipadas/campos permitidos, ID entero positivo, fecha de calendario real y contenido no vacío de 1–10.000 caracteres. Se preserva el texto original; no se recorta silenciosamente. La fecha se elige explícitamente; no se deduce idioma, residencia o preferencia de zona horaria. El margen de fecha admitido usa la validación del servidor (fecha UTC hasta now+36h), sin inventar validaciones canónicas de ParticipantContext. Mensaje de chat hasta 4.000 caracteres, requestId UUID válido y máximo 3 referencias; el backend sigue siendo la autoridad.

El servidor no liga contextEntryIds/idioma al requestId almacenado (compara el mensaje); el cliente debe congelar cuerpo completo para no variar el significado de un reintento. No se envía requestId a POST de diario fingiendo soporte. No se intenta identificar una creación por igualdad de texto entre entradas. Las mutaciones nunca se reenvían automáticamente tras un ACK perdido.

### Seguridad y privacidad

JWT existente; propietario siempre `req.user.id`. GET/PUT/DELETE/selección comprueban UserId y deletedAt en servidor, incluso si se manipulan URLs, selección o rol local. No se crean owner IDs desde frontend. Admin, terapeuta, board o facilitador no reciben entradas ajenas ni un resumen nuevo. Los datos se mantienen en RAM mientras se editan; limpiar en cambio de sesión y no aceptar respuestas antiguas de otro token.

La selección permite lectura para el acompañamiento personal, **no professional_bridge ni facilitator_sharing**. Sin selección no se lee diario para el prompt. Se conservan delimitación de texto no confiable, prioridad de seguridad y presupuesto de IA. No se cambian los recursos de ES-21 ni se habilitan ejercicios pendientes de revisión.

Borrar/editar registra invalidaciones existentes; no se inventa en frontend la resolución de todos los derivados. El contrato no ofrece trazabilidad para borrar retroactivamente texto que el modelo ya incorporó en mensajes confirmados. Las autorizaciones profesionales previas se retiran por su flujo; el borrado integral sigue en ES-23. Estas limitaciones se comunican antes de prometer eliminación o retirada total.

## 7. Pruebas propuestas

1. Unitarias de clientes/modelos: fecha/Unicode/1–10.000 caracteres, campos cerrados, parseo de respuestas, hasta tres IDs, selección vacía, nuevo UUID por intención y cuerpo congelado para retry, no comparar creaciones por texto, disponibilidad de rutas sin enlaces falsos, ES/EN completos.
2. Navegador con respuestas de contrato: CRUD, vacío/carga/error/guardado, borrador frente a confirmado, POST sin ACK, PUT/DELETE sin ACK, conflicto entre dispositivos, cambiar/cerrar con borrador, cancelación de borrado, token cambiado/401, notas fuera de storage/URL/logs y sin publicar diario en otras zonas.
3. Chat en ambas superficies: sin selección no se envían IDs; selección explícita una/dos/tres; cuarta bloqueada; entradas cambiadas/borradas antes de enviar piden revisar; fallo preserva mensaje y cuerpo del intento; 409 pending/failed/completed/404, retry mismo requestId, consulta manual, errores de presupuesto sin autoenvío, sin respuesta de error presentada como guardada y sin duplicar historial.
4. Integración HTTP/JWT/ORM/cifrado/PostgreSQL locales reales: A crea/lee/edita/borra; B/admin/terapeuta/board no leen/alteran IDs ajenos y no llaman al proveedor por contexto ajeno. Diario v2, invalidaciones atómicas sin texto, borrado retira de lista/contexto y segunda eliminación 404. Capturar prompt con proveedor simulado: sin selección no entra diario; con selección solo las propias elegidas y acotadas; instrucciones incrustadas siguen delimitadas. JWT revocado 401 y sin sesión 401/403.
5. Chat real contra DB con proveedor simulado: transacción de turno, requestId/replay y recuperación, cuerpo conservado en cliente, proveedor fallido y última conversación válida. Ninguna llamada real a Claude o producción sin entorno/presupuesto autorizado; mocks se declaran y no acreditan calidad semántica.
6. Responsive/teclado/foco/diálogos a los cuatro anchos, zoom 200%, reduced motion y capturas. Frontend lint 0 errores/advertencias, npm test, tsc -b, build, audit; regresión backend de las APIs reutilizadas y pruebas con DB real cuando corresponda. Salidas reales en PR, sin silenciar reglas ni cambiar configuración para pasar.

## 8. Límites y decisiones para aprobación

- POST del diario sin idempotencia y sin revisión de elemento: el cliente puede evitar reenvíos ciegos y representar incertidumbre, **no garantizar creación exactamente una vez o impedir todas las sobrescrituras concurrentes**. Mauricio decide si desea un contrato adicional; no se rediseña unilateralmente.
- GET del diario sin cursor: se muestra honestamente el límite de 100; no se afirma recuperación de todas las entradas desde esta lista. Historial completo con más entradas requiere ampliar contrato.
- Navegación Mi siguiente paso es una puerta a pantallas realmente registradas; no sustituye los servicios de rutas/experimentos/plan de ES-32/33/34, ni usa datos de ánimo como competencia.
- Integración de ES-16 se verifica cuando #39 esté en main, sin apilar su código ni habilitar sus ejercicios. Tampoco se copian los otros PR; la navegación responde a las rutas presentes en cada integración.
- Ninguna revisión clínica, editorial o de staging se da por realizada. Sin nuevos datos o fuentes profesionales inventados.

Estimación técnica orientativa: 10–14 h para diario, adaptación de los dos chats, navegación y pruebas; sin espera de revisión/QA/contratos nuevos. No es un compromiso de fecha y difiere de las 7 h originales: se registra para decidir alcance y capacidad.

**Solicitud:** aprobar pantallas, estados, textos y plan con estas limitaciones del contrato. Después se implementa; no se considera aprobado diseño por haber asignado la HU. No se fusiona ni se toca producción desde Codex.
